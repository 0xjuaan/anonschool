import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyDkimAndSubject, sha256Hex } from "../../../lib/dkim";
import { addMemberToGroup } from "../../../lib/semaphore-group";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const NS_DOMAIN = (process.env.NS_DOMAIN || "ns.com").toLowerCase();
const NS_ACCEPT_SUBJECT = process.env.NS_ACCEPT_SUBJECT || "Welcome to Network School!";

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
    const { eml, emlBase64, idCommitment } = req.body || {};

    if (!eml && !emlBase64) {
      return res.status(400).json({ ok: false, error: "Missing 'eml' or 'emlBase64' in body" });
    }

    const raw = typeof emlBase64 === "string" ? Buffer.from(emlBase64, "base64").toString("utf8") : String(eml);

    const verification = await verifyDkimAndSubject(raw, {
      expectedDomain: NS_DOMAIN,
      expectedSubject: NS_ACCEPT_SUBJECT,
    });

    if (!verification.ok) {
      return res.status(400).json({ ok: false, error: verification.reason, details: verification.details });
    }

    const { messageId, subject, dkim, summary } = verification;

    // Use DKIM signature as unique discriminator for this email
    // This prevents the same email from being registered multiple times
    const emailSignature = dkim?.signature || sha256Hex(`${messageId}|${NS_DOMAIN}`);
    const pubkey: string = typeof idCommitment === "string" && idCommitment.length > 0
      ? idCommitment
      : `dkim_${emailSignature.slice(0, 32)}`;

    // Check if this email signature is already registered
    const { data: existingMembership } = await supabase
      .from("memberships")
      .select("pubkey, proof_args")
      .eq("provider", "dkim")
      .eq("group_id", NS_DOMAIN)
      .eq("pubkey", pubkey)
      .single();

    // Also check by email signature to prevent duplicate emails with different idCommitments
    const { data: existingBySignature } = await supabase
      .from("memberships")
      .select("pubkey, proof_args")
      .eq("provider", "dkim")
      .eq("group_id", NS_DOMAIN)
      .eq("proof_args->>signature", emailSignature)
      .single();

    if (existingMembership || existingBySignature) {
      const existingPubkey = existingMembership?.pubkey || existingBySignature?.pubkey;
      const isDifferentCommitment = existingBySignature && existingBySignature.pubkey !== pubkey;
      
      return res.status(200).json({ 
        ok: true, 
        groupId: NS_DOMAIN, 
        pubkey: existingPubkey, 
        alreadyRegistered: true,
        message: isDifferentCommitment 
          ? "This email is already registered with a different identity. Each email can only be registered once."
          : "This email has already been registered! You can only register once per email."
      });
    }

    const providerName = "dkim";

    const proof = dkim ? JSON.stringify(dkim) : JSON.stringify({});
    const proofArgs = JSON.stringify({
      domain: NS_DOMAIN,
      messageId,
      subject,
      idCommitment: idCommitment || null,
      summary,
      signature: emailSignature, // Store signature for deduplication
    });

    const { error } = await supabase.from("memberships").insert([
      {
        provider: providerName,
        pubkey,
        pubkey_expiry: null,
        proof,
        proof_args: proofArgs,
        group_id: NS_DOMAIN,
      },
    ]);

    if (error) {
      throw new Error(`Supabase insert failed: ${error.message}`);
    }

    // Add member to Semaphore group (incremental operation)
    if (idCommitment) {
      await addMemberToGroup(idCommitment);
    }

    return res.status(200).json({ ok: true, groupId: NS_DOMAIN, pubkey, summary });
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error("/api/register/dkim error", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

