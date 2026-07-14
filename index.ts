import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getAgentDir } from "@earendil-works/pi-coding-agent";
import { Key, Loader, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

type UsageWindow = {
	id: string;
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

export type DUsageError = {
	code: string;
	message: string;
};

export type DUsageWindow = {
	id: string;
	label: string;
	remainingPercent: number;
	resetAt?: number | string;
};

export type DUsageProvider = {
	id: string;
	title: string;
	plan?: string;
	windows: DUsageWindow[];
	error?: DUsageError;
};

export type DUsageSnapshot = {
	version: 1;
	fetchedAt: number;
	providers: DUsageProvider[];
};

type DUsageSubscription = {
	version: 1;
	consumerId: string;
};

type CodexCred = {
	access?: string;
	accountId?: string;
	expires?: number;
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
		stale: "stale",
		fetching: "Fetching usage…",
		noData: "no data",
		noCredCodex: "openai-codex credentials not configured",
		codexExpired: "access token expired — use codex in pi to refresh",
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
		stale: "已过期",
		fetching: "正在获取用量…",
		noData: "无数据",
		noCredCodex: "未配置 openai-codex 凭据",
		codexExpired: "access 令牌已过期，请在 Pi 中使用 codex 发一句话触发续期",
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
function requestFailedError(status: number): NonNullable<ProviderUsage["error"]> {
	return { key: "dusage.requestFailed", params: { status, detail: "" } };
}

function requestExceptionError(error: unknown): NonNullable<ProviderUsage["error"]> {
	if (error instanceof Error && error.name === "AbortError") {
		return { key: "dusage.requestTimedOut" };
	}
	return { key: "dusage.requestError", params: { detail: "" } };
}

function codexSecondaryLabel(limitWindowSeconds: number | undefined): string {
	const hours = Math.round((limitWindowSeconds || 0) / 3600);
	if (hours >= 24 * 6) return "Week";
	if (hours >= 24) return `${Math.round(hours / 24)}d`;
	return `${hours}h`;
}

function codexWindows(rateLimit: any): UsageWindow[] {
	const windows: UsageWindow[] = [];
	const primary = rateLimit?.primary_window;
	if (primary) windows.push({ id: "5h", label: "5h", usedPercent: primary.used_percent ?? 0, resetAt: primary.reset_at });
	const secondary = rateLimit?.secondary_window;
	if (secondary) {
		windows.push({
			id: "secondary",
			label: codexSecondaryLabel(secondary.limit_window_seconds),
			usedPercent: secondary.used_percent ?? 0,
			resetAt: secondary.reset_at,
		});
	}
	return windows;
}

function codexAdditionalUsage(limit: any): ProviderUsage | null {
	const title = typeof limit?.limit_name === "string" ? limit.limit_name.trim() : "";
	if (!title || !limit?.rate_limit) return null;
	const feature = typeof limit.metered_feature === "string" && limit.metered_feature ? limit.metered_feature : title;
	return {
		provider: `openai-codex:${feature}`,
		title,
		windows: codexWindows(limit.rate_limit),
	};
}

async function getCodexUsages(auth: Record<string, any>): Promise<ProviderUsage[]> {
	const provider = "openai-codex";
	const title = "Codex";
	const cred = (auth[provider] ?? {}) as CodexCred;
	if (!cred.access) {
		return [{ provider, title, windows: [], error: { key: "dusage.noCredCodex" } }];
	}
	// access 过期时直接给出可操作提示，不发请求。
	// 不在此处刷新——续期是 Pi 主程序在用 codex 跑请求时的职责（边界：不改用户凭据）。
	// expires 是 Pi 写入的 ms 时间戳（Date.now() + expires_in * 1000）。
	if (cred.expires && Number(cred.expires) <= Date.now()) {
		return [{ provider, title, windows: [], error: { key: "dusage.codexExpired" } }];
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
			return [{
				provider,
				title,
				windows: [],
				error: requestFailedError(res.status),
			}];
		}

		const usages: ProviderUsage[] = [{
			provider,
			title,
			plan: body.plan_type || undefined,
			windows: codexWindows(body.rate_limit),
		}];
		for (const limit of Array.isArray(body.additional_rate_limits) ? body.additional_rate_limits : []) {
			const usage = codexAdditionalUsage(limit);
			if (usage) usages.push(usage);
		}
		return usages;
	} catch (error) {
		return [{ provider, title, windows: [], error: requestExceptionError(error) }];
	}
}

function zaiWindowLabel(limit: any): string {
	if (limit.type === "TOKENS_LIMIT" && limit.unit === 3 && limit.number === 5) return "5h";
	if (limit.type === "TIME_LIMIT") return "Time";
	if (limit.number && limit.unit) return `${limit.type} ${limit.number}/${limit.unit}`;
	return String(limit.type || "window");
}

function zaiWindowId(limit: any): string {
	const type = String(limit.type || "window").toLowerCase();
	const number = limit.number === undefined || limit.number === null ? "na" : String(limit.number);
	const unit = limit.unit === undefined || limit.unit === null ? "na" : String(limit.unit);
	return `${type}-${number}-${unit}`;
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
				error: requestFailedError(res.status),
			};
		}

		const windows: UsageWindow[] = [];
		const seenWindowIds = new Set<string>();
		for (const limit of body.data.limits) {
			const id = typeof limit.id === "string" && limit.id ? limit.id : zaiWindowId(limit);
			if (seenWindowIds.has(id)) continue;
			seenWindowIds.add(id);
			windows.push({
				id,
				label: zaiWindowLabel(limit),
				usedPercent: limit.percentage ?? 0,
				resetAt: limit.nextResetTime,
			});
		}

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
				error: requestFailedError(res.status),
			};
		}

		const windows: UsageWindow[] = [];
		let generalAdded = false;
		for (const item of body.model_remains) {
			// MiniMax Token Plan 的主用量只展示服务端 general 类别；其他多模态分类不作为独立套餐展示。
			if (item.model_name !== "general" || generalAdded) continue;
			generalAdded = true;
			windows.push({
				id: "general-5h",
				label: "general 5h",
				usedPercent: 100 - (item.current_interval_remaining_percent ?? 0),
				resetAt: item.end_time,
			});
			windows.push({
				id: "general-week",
				label: "general week",
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
	const [codexUsages, zaiUsage, minimaxUsage] = await Promise.all([getCodexUsages(auth), getZaiUsage(auth), getMinimaxUsage(auth)]);
	const usages = [...codexUsages, zaiUsage, minimaxUsage];
	for (const usage of usages) sortWindowsByReset(usage.windows);
	return usages;
}

function publicError(usage: ProviderUsage): DUsageError | undefined {
	if (!usage.error) return undefined;
	const key = usage.error.key;
	if (key.endsWith("noCredCodex") || key.endsWith("noCredZai") || key.endsWith("noCredMinimax")) {
		return { code: "credentials_missing", message: i18n.t(key) };
	}
	if (key.endsWith("codexExpired")) return { code: "credentials_expired", message: i18n.t(key) };
	if (key.endsWith("requestTimedOut")) return { code: "timeout", message: i18n.t(key) };
	if (key.endsWith("requestFailed")) {
		return { code: "request_failed", message: `HTTP ${String(usage.error.params?.status ?? "unknown")}` };
	}
	return { code: "request_error", message: i18n.t("dusage.requestError", { detail: "" }) };
}

function remainingPercent(usedPercent: number): number {
	const used = Number(usedPercent);
	if (!Number.isFinite(used)) return 0;
	return Math.max(0, Math.min(100, 100 - used));
}

function toDUsageSnapshot(usages: ProviderUsage[], fetchedAt = Date.now()): DUsageSnapshot {
	return {
		version: 1,
		fetchedAt,
		providers: usages.map((usage) => ({
			id: usage.provider,
			title: usage.title,
			...(usage.plan ? { plan: usage.plan } : {}),
			windows: usage.windows.map((window) => ({
				id: window.id,
				label: window.label,
				remainingPercent: remainingPercent(window.usedPercent),
				...(window.resetAt === undefined ? {} : { resetAt: window.resetAt }),
			})),
			...(publicError(usage) ? { error: publicError(usage) } : {}),
		})),
	};
}

type DusageStatusContext = { ui: Pick<ExtensionContext["ui"], "setStatus"> };

type DusageRuntime = {
	ctx?: DusageStatusContext;
	timer?: ReturnType<typeof setInterval>;
	inFlight: Promise<ProviderUsage[]> | null;
	generation: number;
	active: boolean;
	consumers: Set<string>;
	latestUsages: ProviderUsage[] | null;
	latestSnapshot: DUsageSnapshot | null;
	lastSuccessfulSnapshot: DUsageSnapshot | null;
};

function hasSuccessfulUsage(snapshot: DUsageSnapshot): boolean {
	return snapshot.providers.some((provider) => provider.windows.length > 0);
}

function formatSnapshotFallback(snapshot: DUsageSnapshot, stale = false): string {
	const parts: string[] = [];
	for (const provider of snapshot.providers) {
		for (const window of provider.windows) {
			parts.push(`${provider.title} ${window.label} ${window.remainingPercent.toFixed(0)}% ${i18n.t("dusage.resetWord")} ${formatTimestamp(window.resetAt)}`);
		}
	}
	if (parts.length === 0) return "";
	return `${parts.join(" · ")}${stale ? ` · ${i18n.t("dusage.stale")}` : ""}`;
}

function setDusageStatus(runtime: DusageRuntime, text: string | undefined): void {
	try {
		runtime.ctx?.ui.setStatus("dusage", text);
	} catch {
		// Status rendering is optional; it must not break quota events or refreshes.
	}
}

function updateFallbackStatus(runtime: DusageRuntime): void {
	if (!runtime.ctx || runtime.consumers.size > 0) return;
	const snapshot = runtime.latestSnapshot;
	if (snapshot && hasSuccessfulUsage(snapshot)) {
		setDusageStatus(runtime, formatSnapshotFallback(snapshot));
		return;
	}
	if (runtime.lastSuccessfulSnapshot) {
		setDusageStatus(runtime, formatSnapshotFallback(runtime.lastSuccessfulSnapshot, true));
		return;
	}
	setDusageStatus(runtime, undefined);
}

function publishSnapshot(runtime: DusageRuntime, pi: ExtensionAPI, snapshot: DUsageSnapshot): void {
	runtime.latestSnapshot = snapshot;
	if (hasSuccessfulUsage(snapshot)) runtime.lastSuccessfulSnapshot = snapshot;
	try {
		pi.events.emit("pi-dusage/updated", snapshot);
	} catch {
		// A consumer must not be able to break provider refresh or fallback status.
	}
	updateFallbackStatus(runtime);
}

function refreshDusage(runtime: DusageRuntime, pi: ExtensionAPI): Promise<ProviderUsage[]> {
	if (!runtime.active) return Promise.resolve(runtime.latestUsages ?? []);
	if (runtime.inFlight) return runtime.inFlight;
	const generation = runtime.generation;
	const request = (async () => {
		const usages = await collectUsages();
		if (runtime.active && generation === runtime.generation) {
			runtime.latestUsages = usages;
			publishSnapshot(runtime, pi, toDUsageSnapshot(usages));
		}
		return usages;
	})();
	runtime.inFlight = request;
	void request.then(
		() => {
			if (runtime.inFlight === request) runtime.inFlight = null;
		},
		() => {
			if (runtime.inFlight === request) runtime.inFlight = null;
		},
	);
	return request;
}

function startDusageSession(runtime: DusageRuntime, pi: ExtensionAPI, ctx: DusageStatusContext): void {
	runtime.active = true;
	runtime.generation += 1;
	runtime.ctx = ctx;
	runtime.latestUsages = null;
	runtime.latestSnapshot = null;
	runtime.lastSuccessfulSnapshot = null;
	runtime.inFlight = null;
	if (runtime.timer) clearInterval(runtime.timer);
	void refreshDusage(runtime, pi);
	runtime.timer = setInterval(() => void refreshDusage(runtime, pi), 60_000);
}

function stopDusageSession(runtime: DusageRuntime): void {
	runtime.active = false;
	runtime.generation += 1;
	if (runtime.timer) clearInterval(runtime.timer);
	runtime.timer = undefined;
	runtime.consumers.clear();
	runtime.ctx = undefined;
	runtime.latestUsages = null;
	runtime.latestSnapshot = null;
	runtime.lastSuccessfulSnapshot = null;
}

function parseSubscription(data: unknown): DUsageSubscription | null {
	if (!data || typeof data !== "object") return null;
	const value = data as Partial<DUsageSubscription>;
	if (value.version !== 1 || typeof value.consumerId !== "string" || !value.consumerId.trim()) return null;
	return { version: 1, consumerId: value.consumerId.trim() };
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
		private refreshData: () => Promise<ProviderUsage[]>,
		initialUsages: ProviderUsage[],
	) {
		this.usages = initialUsages;
		this.loading = false;
		this.loader = new Loader(
			this.tui as any,
			(s: string) => this.theme.fg("accent", s),
			(s: string) => this.theme.fg("muted", s),
			i18n.t("dusage.fetching"),
		);
		this.unsubI18n = i18n.onChange(() => this.tui.requestRender());
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
			this.usages = await this.refreshData();
		} catch {
			this.error = i18n.t("dusage.requestError", { detail: "" });
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

async function showUsage(ctx: ExtensionCommandContext, pi: ExtensionAPI, runtime: DusageRuntime): Promise<void> {
	const generation = runtime.generation;
	if (!runtime.active) return;
	await ensureI18n(pi);
	if (!runtime.active || runtime.generation !== generation) return;
	runtime.ctx = ctx;
	const usages = await refreshDusage(runtime, pi);
	if (!runtime.active || runtime.generation !== generation) return;
	if (ctx.mode !== "tui") {
		console.log(formatTextReport(usages));
		return;
	}
	try {
		await ctx.ui.custom<void>((tui, theme, _kb, done) => new UsageOverlay(
			tui,
			theme,
			() => done(),
			() => refreshDusage(runtime, pi),
			usages,
		), {
			overlay: true,
			overlayOptions: {
				anchor: "center",
				width: "60%",
				maxHeight: "80%",
			},
		});
	} catch {
		// TUI rendering is optional; keep the already fetched result readable.
		console.log(formatTextReport(usages));
	}
}

export default function dusageExtension(pi: ExtensionAPI) {
	const runtime: DusageRuntime = {
		inFlight: null,
		generation: 0,
		consumers: new Set(),
		latestUsages: null,
		latestSnapshot: null,
		lastSuccessfulSnapshot: null,
		active: true,
	};

	let unsubscribeEvents: (() => void) | undefined;
	const attachEventListeners = () => {
		if (unsubscribeEvents) return;
		const unsubscribeSubscribe = pi.events.on("pi-dusage/subscribe", (data) => {
			if (!runtime.active) return;
			const subscription = parseSubscription(data);
			if (!subscription) return;
			const wasEmpty = runtime.consumers.size === 0;
			runtime.consumers.add(subscription.consumerId);
			if (wasEmpty) setDusageStatus(runtime, undefined);
			void refreshDusage(runtime, pi);
		});
		const unsubscribeUnsubscribe = pi.events.on("pi-dusage/unsubscribe", (data) => {
			if (!runtime.active) return;
			const subscription = parseSubscription(data);
			if (!subscription) return;
			runtime.consumers.delete(subscription.consumerId);
			if (runtime.consumers.size === 0) updateFallbackStatus(runtime);
		});
		unsubscribeEvents = () => {
			unsubscribeSubscribe();
			unsubscribeUnsubscribe();
			unsubscribeEvents = undefined;
		};
	};

	attachEventListeners();
	pi.on("session_start", (_event, ctx) => {
		startDusageSession(runtime, pi, ctx);
		attachEventListeners();
		const generation = runtime.generation;
		void ensureI18n(pi).then(
			() => {
				if (runtime.active && runtime.generation === generation) updateFallbackStatus(runtime);
			},
			() => undefined,
		);
	});
	pi.on("session_shutdown", () => {
		stopDusageSession(runtime);
		unsubscribeEvents?.();
	});
	pi.registerCommand("dusage", {
		description: "Show quota usage for Codex, z.ai Coding CN, and MiniMax CN.",
		handler: async (_args, ctx) => {
			await showUsage(ctx, pi, runtime);
		},
	});
}
