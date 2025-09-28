import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminTokenFromRequest, verifySessionToken } from "../../../lib/admin-auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ error: "ADMIN_PASSWORD not configured" });
  }

  const token = getAdminTokenFromRequest(req);
  const isAdmin = verifySessionToken(adminPassword, token);
  return res.status(200).json({ isAdmin });
}


