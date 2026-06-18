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
	error?: string;
};

type CodexCred = {
	access?: string;
	accountId?: string;
};

type KeyCred = {
	key?: string;
};

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

function formatTimestamp(value: number | string | undefined): string {
	if (value === undefined || value === null || value === "") return "(none)";
	const ms = typeof value === "number" && value < 10_000_000_000 ? value * 1000 : Number(value);
	const date = new Date(ms);
	if (Number.isNaN(date.getTime())) return String(value);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTextReport(usages: ProviderUsage[]): string {
	const lines = ["AI Usage", ""];
	for (const usage of usages) {
		lines.push(usage.plan ? `${usage.title} (${usage.plan})` : usage.title);
		if (usage.error) {
			lines.push(`  ! ${usage.error}`);
		} else if (usage.windows.length === 0) {
			lines.push("  ! 无数据");
		} else {
			for (const window of usage.windows) {
				const left = Math.max(0, 100 - window.usedPercent);
				lines.push(`  - ${window.label}: ${left}% left · reset ${formatTimestamp(window.resetAt)}`);
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

function codexSecondaryLabel(limitWindowSeconds: number | undefined): string {
	const hours = Math.round((limitWindowSeconds || 0) / 3600);
	if (hours >= 24 * 6) return "Week";
	if (hours >= 24) return `${Math.round(hours / 24)}d`;
	return `${hours}h`;
}

async function getCodexUsage(auth: Record<string, any>): Promise<ProviderUsage> {
	const cred = (auth["openai-codex"] ?? {}) as CodexCred;
	if (!cred.access) {
		return { provider: "openai-codex", title: "Codex", windows: [], error: "未配置 openai-codex 凭据" };
	}

	const headers: Record<string, string> = {
		Authorization: `Bearer ${cred.access}`,
		Accept: "application/json",
		"User-Agent": "pi-dusage",
	};
	if (cred.accountId) headers["ChatGPT-Account-Id"] = cred.accountId;

	const { res, body } = await fetchJson("https://chatgpt.com/backend-api/wham/usage", { headers });
	if (!res.ok || !body?.rate_limit) {
		return {
			provider: "openai-codex",
			title: "Codex",
			windows: [],
			error: `请求失败 HTTP ${res.status}${body?.error?.message ? `: ${body.error.message}` : ""}`,
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

	return { provider: "openai-codex", title: "Codex", plan: body.plan_type || undefined, windows };
}

function zaiWindowLabel(limit: any): string {
	if (limit.type === "TOKENS_LIMIT" && limit.unit === 3 && limit.number === 5) return "5h";
	if (limit.type === "TIME_LIMIT") return "Time";
	if (limit.number && limit.unit) return `${limit.type} ${limit.number}/${limit.unit}`;
	return String(limit.type || "window");
}

async function getZaiUsage(auth: Record<string, any>): Promise<ProviderUsage> {
	const cred = (auth["zai-coding-cn"] ?? {}) as KeyCred;
	if (!cred.key) {
		return { provider: "zai-coding-cn", title: "z.ai Coding CN", windows: [], error: "未配置 zai-coding-cn 凭据" };
	}

	const { res, body } = await fetchJson("https://bigmodel.cn/api/monitor/usage/quota/limit", {
		headers: {
			Authorization: cred.key,
			Accept: "application/json",
		},
	});

	if (!res.ok || body?.success !== true || Number(body?.code) !== 200 || !Array.isArray(body?.data?.limits)) {
		return {
			provider: "zai-coding-cn",
			title: "z.ai Coding CN",
			windows: [],
			error: `请求失败 HTTP ${res.status}${body?.msg ? `: ${body.msg}` : ""}`,
		};
	}

	const windows = body.data.limits.map((limit: any) => ({
		label: zaiWindowLabel(limit),
		usedPercent: limit.percentage ?? 0,
		resetAt: limit.nextResetTime,
	} satisfies UsageWindow));

	return { provider: "zai-coding-cn", title: "z.ai Coding CN", plan: body.data.level || undefined, windows };
}

async function getMinimaxUsage(auth: Record<string, any>): Promise<ProviderUsage> {
	const cred = (auth["minimax-cn"] ?? {}) as KeyCred;
	if (!cred.key) {
		return { provider: "minimax-cn", title: "MiniMax CN", windows: [], error: "未配置 minimax-cn 凭据" };
	}

	const { res, body } = await fetchJson("https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains", {
		headers: {
			Authorization: `Bearer ${cred.key}`,
			Accept: "application/json",
			"Content-Type": "application/json",
		},
	});

	if (!res.ok || Number(body?.base_resp?.status_code) !== 0 || !Array.isArray(body?.model_remains)) {
		return {
			provider: "minimax-cn",
			title: "MiniMax CN",
			windows: [],
			error: `请求失败 HTTP ${res.status}${body?.base_resp?.status_msg ? `: ${body.base_resp.status_msg}` : ""}`,
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

	return { provider: "minimax-cn", title: "MiniMax CN", windows };
}

async function collectUsages(): Promise<ProviderUsage[]> {
	const auth = readAuth();
	return Promise.all([getCodexUsage(auth), getZaiUsage(auth), getMinimaxUsage(auth)]);
}

class UsageOverlay {
	private usages: ProviderUsage[] = [];
	private loading = true;
	private error: string | null = null;
	private loader: Loader;

	constructor(
		private tui: { requestRender: () => void },
		private theme: any,
		private done: () => void,
	) {
		this.loader = new Loader(
			this.tui as any,
			(s: string) => this.theme.fg("accent", s),
			(s: string) => this.theme.fg("muted", s),
			"Fetching usage…",
		);
		void this.refresh();
	}

	private severityColor(remainingPercent: number): "success" | "warning" | "error" {
		if (remainingPercent <= 10) return "error";
		if (remainingPercent <= 30) return "warning";
		return "success";
	}

	private renderProgressBar(usedPercent: number, barWidth: number): string {
		const remaining = Math.max(0, 100 - usedPercent);
		const color = this.severityColor(remaining);
		const filled = Math.min(barWidth, Math.round((usedPercent / 100) * barWidth));
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
			this.done();
			return;
		}
		if (data === "r" && !this.loading) void this.refresh();
	}

	render(width: number): string[] {
		const border = new DynamicBorder((s: string) => this.theme.fg("border", s));
		const lines: string[] = [];
		lines.push(...border.render(width));
		lines.push(truncateToWidth(` ${this.theme.fg("accent", this.theme.bold("AI Usage"))}`, width));

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
					lines.push(truncateToWidth(this.theme.fg("warning", `    ${usage.error}`), width));
					continue;
				}
				for (const window of usage.windows) {
					const remaining = Math.max(0, 100 - window.usedPercent);
					const color = this.severityColor(remaining);
					const labelColor = remaining <= 30 ? color : "dim";
					const bar = this.renderProgressBar(window.usedPercent, barWidth);
					lines.push(truncateToWidth(`    ${this.theme.fg(labelColor, `${window.label}:`)}`, width));
					lines.push(truncateToWidth(`    ${bar} ${this.theme.fg(color, `${remaining.toFixed(0)}% left`)}`, width));
					lines.push(truncateToWidth(`    ${this.theme.fg("dim", `Resets at ${formatTimestamp(window.resetAt)}`)}`, width));
				}
			}
			lines.push("");
		}

		lines.push(this.theme.fg("dim", "  r refresh · Esc close"));
		lines.push(...border.render(width));
		return lines;
	}

	invalidate(): void {}
}

async function showUsage(ctx: ExtensionCommandContext): Promise<void> {
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
	pi.registerCommand("dusage", {
		description: "Show quota usage for Codex, z.ai Coding CN, and MiniMax CN.",
		handler: async (_args, ctx) => {
			await showUsage(ctx);
		},
	});
}
