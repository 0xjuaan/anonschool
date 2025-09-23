import type { NextApiRequest, NextApiResponse } from "next";
import { generateMerkleProof } from "../../lib/semaphore-group";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { idCommitment } = req.body;

    if (!idCommitment) {
      return res.status(400).json({ error: "Missing idCommitment" });
    }

    // Generate Merkle proof using the server-side function
    const merkle = await generateMerkleProof(idCommitment);
    
    // Convert to the format expected by the client
    const response = {
      root: merkle.root.toString(),
      index: merkle.index,
      siblings: merkle.siblings.map((s) => s.toString()),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error generating Merkle proof:", error);
    
    if (error instanceof Error && error.message === 'Member not found in group') {
      return res.status(404).json({ error: "Member not found in group" });
    }
    
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
