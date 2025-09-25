import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { addMemberToGroup } from "../../../lib/semaphore-group";
import SemaphoreGroupManager from "../../../lib/semaphore-group-manager";
import { initZkEmailSdk, Proof } from "@zk-email/sdk";

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const NS_DOMAIN = (process.env.NS_DOMAIN || "ns.com").toLowerCase();

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
    const { proof, idCommitment } = req.body;
    if (!proof || !idCommitment) {
      return res.status(400).json({ ok: false, error: "Missing proof or idCommitment" });
    }

    // Initialize the SDK with the official API
    const sdk = initZkEmailSdk();

    // Get the blueprint
    const blueprint = await sdk.getBlueprint("hackertron/NetworkSchool@v2");

    // Parse the packed proof back into a Proof instance
    const proofObj = await Proof.unPackProof(proof, "https://conductor.zk.email");


    // Verify the proof
    const verification = await blueprint.verifyProof(proofObj);
    if (!verification) {
      return res.status(400).json({ ok: false, error: "Invalid proof" });
    }



    // Look up by header hash (single source of truth for dedup)
    const proofHash = proofObj.getHeaderHash();

    const { data: existingByProof } = await supabase
      .from("memberships")
      .select("pubkey")
      .eq("provider", "ns-dkim")
      .eq("group_id", NS_DOMAIN)
      .eq("header_hash", proofHash)
      .single();

    // If no record exists: create
    if (!existingByProof) {
      const proofArgs = {
        proofHash,
        idCommitment: idCommitment || null,
      };

      const { error: insertError } = await supabase.from("memberships").insert([
        {
          provider: "ns-dkim",
          pubkey: idCommitment,
          pubkey_expiry: null,
          proof: JSON.stringify(proof),
          proof_args: proofArgs,
          group_id: NS_DOMAIN,
          header_hash: proofHash,
        },
      ]);
      if (insertError) throw new Error(`Supabase insert failed: ${insertError.message}`);

      if (idCommitment) {
        await addMemberToGroup(idCommitment);
      }

      return res.status(200).json({ ok: true, groupId: NS_DOMAIN, pubkey: idCommitment });
    }

    // Record exists for this proof - return alreadyRegistered response
    const existingPubkey: string = existingByProof.pubkey;
    return res.status(200).json({
      ok: true,
      groupId: NS_DOMAIN,
      pubkey: existingPubkey,
      alreadyRegistered: true,
      message: "This email is already registered. Each email can only be used once for registration."
    });

  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    const errorDetails = e instanceof Error ? e.stack : String(e);
    console.error("/api/register/dkim error:", errorMessage);
    console.error("Details:", errorDetails);
    return res.status(500).json({ ok: false, error: errorMessage });
  }
}