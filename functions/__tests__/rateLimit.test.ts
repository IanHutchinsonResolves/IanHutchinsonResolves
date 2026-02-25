import { isRateLimited } from "../src/lib/rateLimit";

describe("rate limit", () => {
  it("allows first check-in", () => {
    const now = new Date("2026-02-24T12:00:00Z");
    expect(isRateLimited(null, now)).toBe(false);
  });

  it("blocks check-in within 24 hours", () => {
    const now = new Date("2026-02-24T12:00:00Z");
    const last = new Date("2026-02-23T20:00:00Z");
    expect(isRateLimited(last, now)).toBe(true);
  });

  it("allows check-in after 24 hours", () => {
    const now = new Date("2026-02-24T12:00:00Z");
    const last = new Date("2026-02-23T11:59:00Z");
    expect(isRateLimited(last, now)).toBe(false);
  });
});
