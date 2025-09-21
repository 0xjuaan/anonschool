import type { NextApiRequest, NextApiResponse } from "next";
import { merkleProofForMember } from "../../../lib/semaphore-group";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: `Method ${req.method} Not Allowed` });
  }

  const idCommitment = (req.query.idCommitment as string) || "";
  if (!idCommitment) {
    return res.status(400).json({ ok: false, error: "missing_idCommitment" });
  }

  try {
    const proof = await merkleProofForMember(idCommitment);
    return res.status(200).json({ ok: true, proof });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "member_not_found") {
      return res.status(404).json({ ok: false, error: "member_not_found" });
    }
    // eslint-disable-next-line no-console
    console.error("/api/group/proof error", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

