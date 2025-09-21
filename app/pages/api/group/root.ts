import type { NextApiRequest, NextApiResponse } from "next";
import { NS_DOMAIN, SEMAPHORE_DEFAULT_DEPTH } from "../../../lib/semaphore-group";
import SemaphoreGroupManager from "../../../lib/semaphore-group-manager";

const groupManager = SemaphoreGroupManager.getInstance();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Use efficient group operations instead of rebuilding entire group
    await groupManager.initialize();
    
    const root = groupManager.getRoot();
    const depth = groupManager.getDepth();
    const size = groupManager.getSize();
    
    return res.status(200).json({ 
      ok: true, 
      groupId: NS_DOMAIN, 
      root, 
      depth: Math.max(depth, SEMAPHORE_DEFAULT_DEPTH), 
      size, 
      recommendedDepth: SEMAPHORE_DEFAULT_DEPTH 
    });
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error("/api/group/root error", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

