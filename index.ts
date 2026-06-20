import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getAgentDir } from "@earendil-works/pi-coding-agent";
import { Key, Loader, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

type UsageWindow = {
	label: string;
	usedPercent: number;
	resetAt?: number | string;
};

type ProviderUsage = {
	provider: string;
	title: string;
	plan?: string;
	windows: UsageWindow[];
	error?: { key: string; params?: Record<string, string | number> };
};

type CodexCred = {
	access?: string;
	accountId?: string;
};

type KeyCred = {
	key?: string;
};

// --- i18n 对接 ---------------------------------------------------------------
// 通过 pi-di18n 暴露的 `pi-i18n/requestApi` 事件获取 I18nApi；未安装 pi-di18n 时
// 回退到内置 en/zh-CN 本地查表。所有用户可见文案都走 i18n.t("dusage.*")。
type I18nApi = {
	getLocale(): string;
	t(key: string, params?: Record<string, string | number>): string;
	onLocaleChanged?(cb: (locale: string) => void): () => void;
	registerBundle?(bundle: {
		version: 1;
		namespace: string;
		locale: string;
		messages: Record<string, string>;
	}): { ok: boolean; errors: string[] };
};

// dusage namespace 消息表（key 不含 "dusage." 前缀；registerBundle 与本地查表共用）。
const DUSAGE_MESSAGES: Record<string, Record<string, string>> = {
	en: {
		title: "AI Usage",
		windowLeft: "{percent}% left",
		resetsAt: "resets at {time}",
		resetWord: "reset",
		refreshHint: "r refresh · Esc close",
		fetching: "Fetching usage…",
		noData: "no data",
		noCredCodex: "openai-codex credentials not configured",
		noCredZai: "zai-coding-cn credentials not configured",
		noCredMinimax: "minimax-cn credentials not configured",
		requestFailed: "request failed HTTP {status}{detail}",
		requestTimedOut: "request timed out",
		requestError: "request error{detail}",
	},
	"zh-CN": {
		title: "AI 用量",
		windowLeft: "剩余 {percent}%",
		resetsAt: "重置于 {time}",
		resetWord: "重置",
		refreshHint: "r 刷新 · Esc 关闭",
		fetching: "正在获取用量…",
		noData: "无数据",
		noCredCodex: "未配置 openai-codex 凭据",
		noCredZai: "未配置 zai-coding-cn 凭据",
		noCredMinimax: "未配置 minimax-cn 凭据",
		requestFailed: "请求失败 HTTP {status}{detail}",
		requestTimedOut: "请求超时",
		requestError: "请求异常{detail}",
	},
};

function detectLocaleFromEnv(): string {
	const env = String(process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || "").toLowerCase();
	return env.startsWith("zh") ? "zh-CN" : "en";
}

function interpolate(tpl: string, params?: Record<string, string | number>): string {
	if (!params) return tpl;
	return tpl.replace(/\{(\w+)\}/g, (_m, name: string) =>
		params[name] === undefined || params[name] === null ? `{${name}}` : String(params[name]),
	);
}

class DusageI18n {
	private api: I18nApi | null = null;
	private localLocale = detectLocaleFromEnv();
	private listeners = new Set<() => void>();

	setApi(api: I18nApi | null): void {
		const prev = this.api;
		this.api = api;
		if (api && api !== prev) {
			for (const [locale, messages] of Object.entries(DUSAGE_MESSAGES)) {
				try {
					api.registerBundle?.({ version: 1, namespace: "dusage", locale, messages });
				} catch {
					// ignore bundle registration failure
				}
			}
			try {
				api.onLocaleChanged?.(() => {
					for (const cb of this.listeners) cb();
				});
			} catch {
				// ignore subscription failure
			}
			// api 接入后通知已打开的 overlay 重渲染（此后 t() 走 api）
			for (const cb of this.listeners) cb();
		}
	}

	onChange(cb: () => void): () => void {
		this.listeners.add(cb);
		return () => this.listeners.delete(cb);
	}

	getLocale(): string {
		try {
			if (this.api) return this.api.getLocale() || this.localLocale;
		} catch {
			// fall through
		}
		return this.localLocale;
	}

	t(key: string, params?: Record<string, string | number>): string {
		if (this.api) {
			try {
				return this.api.t(key, params);
			} catch {
				// fall through to local table
			}
		}
		const localKey = key.startsWith("dusage.") ? key.slice("dusage.".length) : key;
		const msgs = DUSAGE_MESSAGES[this.getLocale()] ?? DUSAGE_MESSAGES.en;
		const tpl = msgs[localKey] ?? DUSAGE_MESSAGES.en[localKey] ?? key;
		return interpolate(tpl, params);
	}
}

const i18n = new DusageI18n();

function requestI18nApi(pi: ExtensionAPI, timeoutMs = 1500): Promise<I18nApi | null> {
	return new Promise((resolve) => {
		let settled = false;
		const finish = (api: I18nApi | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(api);
		};
		const timer = setTimeout(() => finish(null), timeoutMs);
		try {
			pi.events.emit("pi-i18n/requestApi", { reply: (api: I18nApi | null) => finish(api ?? null) });
		} catch {
			finish(null);
		}
	});
}

let i18nEnsurePromise: Promise<void> | null = null;
// 确保只请求一次 I18nApi；session_start 与 command handler 复用同一 promise，
// 使 --no-session 等不触发 session_start 的场景也能正确接入 pi-di18n。
function ensureI18n(pi: ExtensionAPI): Promise<void> {
	if (!i18nEnsurePromise) {
		i18nEnsurePromise = (async () => i18n.setApi(await requestI18nApi(pi)))();
	}
	return i18nEnsurePromise;
}

// -----------------------------------------------------------------------------

function readJson(path: string): any {
	try {
		if (!existsSync(path)) return null;
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}

function readAuth(): Record<string, any> {
	return readJson(join(getAgentDir(), "auth.json")) ?? {};
}

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

function resetToMs(value: number | string | undefined): number {
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return Number.NaN;
	// 秒级（< 10^10）按秒解析，毫秒级原样使用；非数值（如 ISO 字符串）返回 NaN。
	return n < 10_000_000_000 ? n * 1000 : n;
}

function formatTimestamp(value: number | string | undefined): string {
	if (value === undefined || value === null || value === "") return "(none)";
	const date = new Date(resetToMs(value));
	if (Number.isNaN(date.getTime())) return String(value);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTextReport(usages: ProviderUsage[]): string {
	const lines = [i18n.t("dusage.title"), ""];
	for (const usage of usages) {
		lines.push(usage.plan ? `${usage.title} (${usage.plan})` : usage.title);
		if (usage.error) {
			lines.push(`  ! ${i18n.t(usage.error.key, usage.error.params)}`);
		} else if (usage.windows.length === 0) {
			lines.push(`  ! ${i18n.t("dusage.noData")}`);
		} else {
			for (const window of usage.windows) {
				const left = Math.max(0, 100 - window.usedPercent);
				const leftText = i18n.t("dusage.windowLeft", { percent: left.toFixed(0) });
				lines.push(`  - ${window.label}: ${leftText} · ${i18n.t("dusage.resetWord")} ${formatTimestamp(window.resetAt)}`);
			}
		}
		lines.push("");
	}
	return lines.join("\n").trimEnd();
}

async function fetchJson(url: string, options: RequestInit, timeoutMs = 10_000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { ...options, signal: controller.signal });
		const text = await res.text();
		let body: any = null;
		try {
			body = text ? JSON.parse(text) : null;
		} catch {
			body = text;
		}
		return { res, body };
	} finally {
		clearTimeout(timer);
	}
}

// 请求失败时构造 i18n 化的错误对象；统一 status/detail 形状，避免 3 个 provider 重复内联。
function requestFailedError(status: number, detail: string): NonNullable<ProviderUsage["error"]> {
	return { key: "dusage.requestFailed", params: { status, detail } };
}

function requestExceptionError(error: unknown): NonNullable<ProviderUsage["error"]> {
	if (error instanceof Error && error.name === "AbortError") {
		return { key: "dusage.requestTimedOut" };
	}
	const detail = error instanceof Error ? error.message : String(error);
	return { key: "dusage.requestError", params: { detail: detail ? `: ${detail}` : "" } };
}

function codexSecondaryLabel(limitWindowSeconds: number | undefined): string {
	const hours = Math.round((limitWindowSeconds || 0) / 3600);
	if (hours >= 24 * 6) return "Week";
	if (hours >= 24) return `${Math.round(hours / 24)}d`;
	return `${hours}h`;
}

async function getCodexUsage(auth: Record<string, any>): Promise<ProviderUsage> {
	const provider = "openai-codex";
	const title = "Codex";
	const cred = (auth[provider] ?? {}) as CodexCred;
	if (!cred.access) {
		return { provider, title, windows: [], error: { key: "dusage.noCredCodex" } };
	}

	const headers: Record<string, string> = {
		Authorization: `Bearer ${cred.access}`,
		Accept: "application/json",
		"User-Agent": "pi-dusage",
	};
	if (cred.accountId) headers["ChatGPT-Account-Id"] = cred.accountId;

	try {
		const { res, body } = await fetchJson("https://chatgpt.com/backend-api/wham/usage", { headers });
		if (!res.ok || !body?.rate_limit) {
			return {
				provider,
				title,
				windows: [],
				error: requestFailedError(res.status, body?.error?.message ? `: ${body.error.message}` : ""),
			};
		}

		const windows: UsageWindow[] = [];
		const primary = body.rate_limit.primary_window;
		if (primary) windows.push({ label: "5h", usedPercent: primary.used_percent ?? 0, resetAt: primary.reset_at });
		const secondary = body.rate_limit.secondary_window;
		if (secondary) {
			windows.push({
				label: codexSecondaryLabel(secondary.limit_window_seconds),
				usedPercent: secondary.used_percent ?? 0,
				resetAt: secondary.reset_at,
			});
		}

		return { provider, title, plan: body.plan_type || undefined, windows };
	} catch (error) {
		return { provider, title, windows: [], error: requestExceptionError(error) };
	}
}

function zaiWindowLabel(limit: any): string {
	if (limit.type === "TOKENS_LIMIT" && limit.unit === 3 && limit.number === 5) return "5h";
	if (limit.type === "TIME_LIMIT") return "Time";
	if (limit.number && limit.unit) return `${limit.type} ${limit.number}/${limit.unit}`;
	return String(limit.type || "window");
}

async function getZaiUsage(auth: Record<string, any>): Promise<ProviderUsage> {
	const provider = "zai-coding-cn";
	const title = "z.ai Coding CN";
	const cred = (auth[provider] ?? {}) as KeyCred;
	if (!cred.key) {
		return { provider, title, windows: [], error: { key: "dusage.noCredZai" } };
	}

	try {
		const { res, body } = await fetchJson("https://bigmodel.cn/api/monitor/usage/quota/limit", {
			headers: {
				Authorization: cred.key,
				Accept: "application/json",
			},
		});

		if (!res.ok || body?.success !== true || Number(body?.code) !== 200 || !Array.isArray(body?.data?.limits)) {
			return {
				provider,
				title,
				windows: [],
				error: requestFailedError(res.status, body?.msg ? `: ${body.msg}` : ""),
			};
		}

		const windows = body.data.limits.map((limit: any) => ({
			label: zaiWindowLabel(limit),
			usedPercent: limit.percentage ?? 0,
			resetAt: limit.nextResetTime,
		} satisfies UsageWindow));

		return { provider, title, plan: body.data.level || undefined, windows };
	} catch (error) {
		return { provider, title, windows: [], error: requestExceptionError(error) };
	}
}

async function getMinimaxUsage(auth: Record<string, any>): Promise<ProviderUsage> {
	const provider = "minimax-cn";
	const title = "MiniMax CN";
	const cred = (auth[provider] ?? {}) as KeyCred;
	if (!cred.key) {
		return { provider, title, windows: [], error: { key: "dusage.noCredMinimax" } };
	}

	try {
		const { res, body } = await fetchJson("https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains", {
			headers: {
				Authorization: `Bearer ${cred.key}`,
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		});

		if (!res.ok || Number(body?.base_resp?.status_code) !== 0 || !Array.isArray(body?.model_remains)) {
			return {
				provider,
				title,
				windows: [],
				error: requestFailedError(res.status, body?.base_resp?.status_msg ? `: ${body.base_resp.status_msg}` : ""),
			};
		}

		const windows: UsageWindow[] = [];
		for (const item of body.model_remains) {
			const name = item.model_name || "general";
			windows.push({
				label: `${name} 5h`,
				usedPercent: 100 - (item.current_interval_remaining_percent ?? 0),
				resetAt: item.end_time,
			});
			windows.push({
				label: `${name} week`,
				usedPercent: 100 - (item.current_weekly_remaining_percent ?? 0),
				resetAt: item.weekly_end_time,
			});
		}

		return { provider, title, windows };
	} catch (error) {
		return { provider, title, windows: [], error: requestExceptionError(error) };
	}
}

// 统一窗口排序约定：重置时间越早（短窗口，如 5h）越靠前，长窗口（week/month）在后。
// 这样三个 provider 的展示顺序一致，且不依赖各 API 的返回顺序。
function sortWindowsByReset(windows: UsageWindow[]): UsageWindow[] {
	return windows.sort((a, b) => {
		const da = resetToMs(a.resetAt);
		const db = resetToMs(b.resetAt);
		if (Number.isNaN(da) && Number.isNaN(db)) return 0;
		if (Number.isNaN(da)) return 1;
		if (Number.isNaN(db)) return -1;
		return da - db;
	});
}

async function collectUsages(): Promise<ProviderUsage[]> {
	const auth = readAuth();
	const usages = await Promise.all([getCodexUsage(auth), getZaiUsage(auth), getMinimaxUsage(auth)]);
	for (const usage of usages) sortWindowsByReset(usage.windows);
	return usages;
}

class UsageOverlay {
	private usages: ProviderUsage[] = [];
	private loading = true;
	private error: string | null = null;
	private loader: Loader;
	private unsubI18n?: () => void;

	constructor(
		private tui: { requestRender: () => void },
		private theme: any,
		private done: () => void,
	) {
		this.loader = new Loader(
			this.tui as any,
			(s: string) => this.theme.fg("accent", s),
			(s: string) => this.theme.fg("muted", s),
			i18n.t("dusage.fetching"),
		);
		this.unsubI18n = i18n.onChange(() => this.tui.requestRender());
		void this.refresh();
	}

	private severityColor(remainingPercent: number): "success" | "warning" | "error" {
		if (remainingPercent <= 10) return "error";
		if (remainingPercent <= 30) return "warning";
		return "success";
	}

	private renderProgressBar(remainingPercent: number, barWidth: number): string {
		// 进度条表示「剩余配额」：剩余越多（配越充足）填充越满且越绿；剩余越少越红。
		const color = this.severityColor(remainingPercent);
		const filled = Math.min(barWidth, Math.round((remainingPercent / 100) * barWidth));
		return this.theme.fg(color, "█".repeat(filled)) + this.theme.fg("dim", "░".repeat(Math.max(0, barWidth - filled)));
	}

	async refresh(): Promise<void> {
		this.loading = true;
		this.error = null;
		this.tui.requestRender();
		try {
			this.usages = await collectUsages();
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
		} finally {
			this.loading = false;
			this.tui.requestRender();
		}
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
			this.destroy();
			this.done();
			return;
		}
		if (data === "r" && !this.loading) void this.refresh();
	}

	destroy(): void {
		this.unsubI18n?.();
		this.unsubI18n = undefined;
	}

	render(width: number): string[] {
		const border = new DynamicBorder((s: string) => this.theme.fg("border", s));
		const lines: string[] = [];
		lines.push(...border.render(width));
		lines.push(truncateToWidth(` ${this.theme.fg("accent", this.theme.bold(i18n.t("dusage.title")))}`, width));

		if (this.loading) {
			lines.push(...this.loader.render(width));
		} else if (this.error) {
			lines.push("");
			lines.push(truncateToWidth(this.theme.fg("warning", `  ${this.error}`), width));
			lines.push("");
		} else {
			const barWidth = Math.min(42, Math.max(18, width - 28));
			for (const usage of this.usages) {
				lines.push("");
				const planText = usage.plan ? this.theme.fg("dim", ` (${usage.plan})`) : "";
				lines.push(truncateToWidth(`  ${this.theme.fg("accent", usage.title)}${planText}`, width));
				if (usage.error) {
					lines.push(truncateToWidth(this.theme.fg("warning", `    ${i18n.t(usage.error.key, usage.error.params)}`), width));
					continue;
				}
				for (const window of usage.windows) {
					const remaining = Math.max(0, 100 - window.usedPercent);
					const color = this.severityColor(remaining);
					const labelColor = remaining <= 30 ? color : "dim";
					const bar = this.renderProgressBar(remaining, barWidth);
					lines.push(truncateToWidth(`    ${this.theme.fg(labelColor, `${window.label}:`)}`, width));
					lines.push(truncateToWidth(`    ${bar} ${this.theme.fg(color, i18n.t("dusage.windowLeft", { percent: remaining.toFixed(0) }))}`, width));
					lines.push(truncateToWidth(`    ${this.theme.fg("dim", i18n.t("dusage.resetsAt", { time: formatTimestamp(window.resetAt) }))}`, width));
				}
			}
			lines.push("");
		}

		lines.push(this.theme.fg("dim", `  ${i18n.t("dusage.refreshHint")}`));
		lines.push(...border.render(width));
		return lines;
	}

	invalidate(): void {}
}

async function showUsage(ctx: ExtensionCommandContext, pi: ExtensionAPI): Promise<void> {
	await ensureI18n(pi);
	if (ctx.mode !== "tui") {
		console.log(formatTextReport(await collectUsages()));
		return;
	}
	await ctx.ui.custom<void>((tui, theme, _kb, done) => new UsageOverlay(tui, theme, () => done(),), {
		overlay: true,
		overlayOptions: {
			anchor: "center",
			width: "60%",
			maxHeight: "80%",
		},
	});
}

export default function dusageExtension(pi: ExtensionAPI) {
	// session_start 时尝试接入 pi-di18n；未安装则回退内置 en/zh-CN 本地查表。
	pi.on("session_start", () => {
		void ensureI18n(pi);
	});
	pi.registerCommand("dusage", {
		description: "Show quota usage for Codex, z.ai Coding CN, and MiniMax CN.",
		handler: async (_args, ctx) => {
			await showUsage(ctx, pi);
		},
	});
}
