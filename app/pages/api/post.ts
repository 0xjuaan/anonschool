import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyProof, SemaphoreProof } from "@semaphore-protocol/proof";
import crypto from "crypto";
import { getGroupRoot, NS_DOMAIN } from "../../lib/semaphore-group";
import { isValidScope } from "../../lib/ns-client";

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

    // Validate scope is current and properly formatted
    const currentMinute = Math.floor(Date.now() / 1000 / 60);
    
    // Use originalScope if available, otherwise fall back to proof.scope
    const scopeToValidate = (proof as { originalScope?: string }).originalScope || proof.scope;
    const scopeValid = isValidScope(scopeToValidate);
    
    if (!scopeValid) {
      return res.status(400).json({ 
        ok: false, 
        error: "invalid_or_expired_scope", 
        scope: scopeToValidate,
        currentMinute,
        message: "Proof scope must be valid for current minute"
      });
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
    
    // Check if this nullifier has already been used for any post
    const { data: existingPost } = await supabase
      .from("messages")
      .select("id")
      .eq("nullifier", nullifier)
      .single();
    
    if (existingPost) {
      console.log("🚫 Nullifier already used, rejecting post");
      return res.status(400).json({ 
        ok: false, 
        error: "nullifier_already_used", 
        message: "You can only post once per minute"
      });
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
        nullifier: nullifier,
        internal: false,
      },
    ]);

    if (insertMessageError) {
      throw new Error(`Failed to insert message: ${insertMessageError.message}`);
    }

    return res.status(201).json({
      ok: true,
      id,
      text,
      timestamp: now.toISOString(),
      group_id: NS_DOMAIN,
      group_provider: "ns-dkim",
      internal: false,
      likes: 0
    });
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error("/api/post error", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}
