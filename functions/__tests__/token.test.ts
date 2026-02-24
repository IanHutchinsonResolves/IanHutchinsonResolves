import { signToken, verifyToken } from "../src/lib/token";

describe("token signing", () => {
  const secret = "test-secret";

  it("signs and verifies payload", () => {
    const payload = {
      businessId: "biz_123",
      tokenDate: "2026-02-24",
      nonce: "abc"
    };
    const token = signToken(payload, secret);
    const verified = verifyToken(token, secret);
    expect(verified).toEqual(payload);
  });

  it("rejects tampered tokens", () => {
    const payload = {
      businessId: "biz_123",
      tokenDate: "2026-02-24",
      nonce: "abc"
    };
    const token = signToken(payload, secret);
    const tampered = token.replace("biz_123", "biz_999");
    expect(() => verifyToken(tampered, secret)).toThrow();
  });
});
