import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapXaiPeriodWindow, parseXaiBillingWindows, parseXaiUserId, xaiCredentialError } from "../index.js";

function fixture(name: string): unknown {
	return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

describe("xAI SuperGrok usage", () => {
	it("maps the redacted weekly billing fixture and ignores product breakdown", () => {
		expect(parseXaiBillingWindows(fixture("xai-billing-week.json"))).toEqual({
			windows: [{
				id: "week",
				label: "week",
				usedPercent: 16,
				resetAt: Date.parse("2026-08-17T00:00:00Z"),
			}],
		});
	});

	it("does not invent a quota window from missing or unsupported fields", () => {
		expect(parseXaiBillingWindows(fixture("xai-billing-missing-fields.json"))).toEqual({ windows: [] });
		expect(parseXaiBillingWindows({ config: { creditUsagePercent: 40 } })).toEqual({ windows: [] });
	});

	it("keeps an explicitly reported five-hour window when xAI provides one", () => {
		expect(parseXaiBillingWindows({
			config: {
				currentPeriod: { type: "USAGE_PERIOD_TYPE_FIVE_HOUR", end: "2026-08-10T05:00:00Z" },
				creditUsagePercent: 12.5,
			},
		})).toEqual({
			windows: [{ id: "5h", label: "5h", usedPercent: 12.5, resetAt: Date.parse("2026-08-10T05:00:00Z") }],
		});
		expect(mapXaiPeriodWindow("USAGE_PERIOD_TYPE_MONTHLY", 10, undefined)).toBeNull();
	});

	it("accepts only a safe transient user id for the billing header", () => {
		expect(parseXaiUserId({ userId: "0f0797f6-9e0d-4a9f-9329-94f433e6d2f9" })).toBe("0f0797f6-9e0d-4a9f-9329-94f433e6d2f9");
		expect(parseXaiUserId({ userId: "bad\r\nheader" })).toBeNull();
		expect(parseXaiUserId({ userId: "x".repeat(257) })).toBeNull();
	});

	it("requires a non-expired Pi OAuth credential, not an API key", () => {
		expect(xaiCredentialError({})).toBe("dusage.noCredXai");
		expect(xaiCredentialError({ type: "api_key", access: "key" })).toBe("dusage.noCredXai");
		expect(xaiCredentialError({ type: "oauth", access: "access", expires: 99 }, 100)).toBe("dusage.xaiExpired");
		expect(xaiCredentialError({ type: "oauth", access: "access", expires: 101 }, 100)).toBeNull();
	});
});
