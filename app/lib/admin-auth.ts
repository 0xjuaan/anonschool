import crypto from "crypto";
import type { NextApiResponse, NextApiRequest } from "next";

type AdminSession = {
  exp: number; // unix seconds
};

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function hmac(secret: string, data: string) {
  return base64url(crypto.createHmac("sha256", secret).update(data).digest());
}

export function createSessionToken(secret: string, ttlSeconds: number): string {
  const payload: AdminSession = { exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = base64url(JSON.stringify(payload));
  const sig = hmac(secret, body);
  return `${body}.${sig}`;
}

export function verifySessionToken(secret: string, token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [body, sig] = parts;
  const expected = hmac(secret, body);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const json = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as AdminSession;
    return json.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function setAdminCookie(res: NextApiResponse, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  const cookie = [
    `admin_session=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    isProd ? "Secure" : "",
    "Max-Age=1800", // 30 min
  ]
    .filter(Boolean)
    .join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export function clearAdminCookie(res: NextApiResponse) {
  const isProd = process.env.NODE_ENV === "production";
  const cookie = [
    "admin_session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    isProd ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export function getAdminTokenFromRequest(req: NextApiRequest): string | undefined {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|; )admin_session=([^;]+)/);
  return match ? match[1] : undefined;
}


