import type { NextApiRequest, NextApiResponse } from "next";
import { createSessionToken, setAdminCookie } from "../../../lib/admin-auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ error: "ADMIN_PASSWORD not configured" });
  }

  const { password } = req.body || {};
  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createSessionToken(adminPassword, 60 * 30); // 30 minutes
  setAdminCookie(res, token);
  return res.status(200).json({ ok: true });
}


