import { describe, expect, it } from "vitest";
import { dfastRefreshSignature, parseDFastSnapshot, shouldRefreshForDFast } from "../index.js";

describe("pi-dfast adapter", () => {
	it("accepts only versioned public snapshots", () => {
		expect(parseDFastSnapshot({ version: 1, enabled: true, active: true, provider: "openai-codex", model: "gpt-5.6-luna" })).toEqual({
			version: 1,
			enabled: true,
			active: true,
			provider: "openai-codex",
			model: "gpt-5.6-luna",
		});
		expect(parseDFastSnapshot({ version: 2, enabled: true, active: true })).toBeNull();
		expect(parseDFastSnapshot({ version: 1, enabled: "yes", active: true })).toBeNull();
	});

	it("refreshes only for active openai-codex state", () => {
		expect(shouldRefreshForDFast({ version: 1, enabled: true, active: true, provider: "openai-codex" })).toBe(true);
		expect(shouldRefreshForDFast({ version: 1, enabled: false, active: false, provider: "openai-codex" })).toBe(false);
		expect(shouldRefreshForDFast({ version: 1, enabled: true, active: false, provider: "openai-codex" })).toBe(false);
		expect(shouldRefreshForDFast({ version: 1, enabled: true, active: true, provider: "openai" })).toBe(false);
	});

	it("deduplicates identical state while retaining model changes", () => {
		const luna = { version: 1 as const, enabled: true, active: true, provider: "openai-codex", model: "gpt-5.6-luna" };
		const terra = { ...luna, model: "gpt-5.6-terra" };
		expect(dfastRefreshSignature(luna)).toBe(dfastRefreshSignature({ ...luna }));
		expect(dfastRefreshSignature(luna)).not.toBe(dfastRefreshSignature(terra));
	});
});
