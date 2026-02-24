import crypto from "crypto";
import { DateTime } from "luxon";

export const TOKEN_TZ = "America/Los_Angeles";

export type TokenPayload = {
  businessId: string;
  tokenDate: string;
  nonce: string;
};

export function todayTokenDate(now: DateTime = DateTime.now()): string {
  return now.setZone(TOKEN_TZ).toISODate();
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlToBuffer(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(normalized, "base64");
}

export function signToken(payload: TokenPayload, secret: string): string {
  const data = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyToken(token: string, secret: string): TokenPayload {
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("Invalid token format");
  }
  const [data, sig] = parts;
  const expectedSig = base64url(
    crypto.createHmac("sha256", secret).update(data).digest()
  );
  const sigBuf = base64urlToBuffer(sig);
  const expBuf = base64urlToBuffer(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Invalid token signature");
  }
  const payloadJson = base64urlToBuffer(data).toString("utf8");
  const payload = JSON.parse(payloadJson) as TokenPayload;
  if (!payload.businessId || !payload.tokenDate || !payload.nonce) {
    throw new Error("Invalid token payload");
  }
  return payload;
}

export function generateDailyToken(
  businessId: string,
  tokenDate: string,
  secret: string
): string {
  const nonce = crypto.randomBytes(8).toString("hex");
  return signToken({ businessId, tokenDate, nonce }, secret);
}
