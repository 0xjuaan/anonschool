import type { NextApiRequest, NextApiResponse } from "next";
import { buildGroup, NS_DOMAIN, SEMAPHORE_DEFAULT_DEPTH } from "../../../lib/semaphore-group";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { root, depth, size } = await buildGroup();
    return res.status(200).json({ ok: true, groupId: NS_DOMAIN, root, depth, size, recommendedDepth: SEMAPHORE_DEFAULT_DEPTH });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("/api/group/root error", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

