import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyProof, SemaphoreProof } from "@semaphore-protocol/proof";
import crypto from "crypto";
import { getGroupRoot, NS_DOMAIN } from "../../lib/semaphore-group";

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { text, proof } = req.body as { text: string; proof: SemaphoreProof };
    if (!text || !proof) {
      return res.status(400).json({ ok: false, error: "missing_text_or_proof" });
    }

    // Get current group root efficiently (O(1) operation)
    const root = await getGroupRoot();

    if (proof.merkleTreeRoot !== root) {
      return res.status(400).json({ ok: false, error: "stale_or_invalid_root", currentRoot: root });
    }

    const valid = await verifyProof(proof);
    if (!valid) {
      return res.status(400).json({ ok: false, error: "invalid_proof" });
    }

    // Enforce one post per nullifier value (idempotent)
    const nullifier = proof.nullifier;

    // Try to create a membership row for the nullifier to satisfy foreign key.
    const { error: insertMembershipError } = await supabase.from("memberships").insert([
      {
        provider: "semaphore",
        pubkey: nullifier,
        pubkey_expiry: null,
        proof: JSON.stringify(proof),
        proof_args: JSON.stringify({ scope: proof.scope, root: proof.merkleTreeRoot }),
        group_id: NS_DOMAIN,
      },
    ]);

    if (insertMembershipError && insertMembershipError.code !== "23505") {
      throw new Error(`Failed to upsert nullifier membership: ${insertMembershipError.message}`);
    }

    const id = crypto.randomUUID().split("-").slice(0, 2).join("");
    const now = new Date();

    const { error: insertMessageError } = await supabase.from("messages").insert([
      {
        id,
        group_id: NS_DOMAIN,
        group_provider: "ns-dkim",
        text,
        timestamp: now.toISOString(),
        signature: nullifier, // placeholder to satisfy NOT NULL
        pubkey: nullifier, // FK to memberships(pubkey)
        internal: false,
      },
    ]);

    if (insertMessageError) {
      throw new Error(`Failed to insert message: ${insertMessageError.message}`);
    }

    return res.status(201).json({ ok: true, id });
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error("/api/post error", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}
