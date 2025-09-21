import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyDkimAndSubject, sha256Hex } from "../../../lib/dkim";
import { addMemberToGroup } from "../../../lib/semaphore-group";
import SemaphoreGroupManager from "../../../lib/semaphore-group-manager";

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

    // TODO: use zk-email for verification with privacy
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

    // Look up by signature (single source of truth for dedup)
    const { data: existingBySignature } = await supabase
      .from("memberships")
      .select("pubkey, proof_args")
      .eq("provider", "dkim")
      .eq("group_id", NS_DOMAIN)
      .eq("proof_args->>signature", emailSignature)
      .single();

    // Extract old commitment if present
    const oldArgs = existingBySignature?.proof_args;



    const oldCommitment: string | undefined = oldArgs?.idCommitment || undefined;

    const newCommitment: string | undefined = (typeof idCommitment === 'string' && idCommitment.length > 0)
      ? idCommitment
      : undefined;

    // If no record exists: create
    if (!existingBySignature) {
      const providerName = "dkim";
      const proof = dkim ? JSON.stringify(dkim) : JSON.stringify({});
      const proofArgs = {
        domain: NS_DOMAIN,
        messageId,
        subject,
        idCommitment: newCommitment || null,
        summary,
        signature: emailSignature,
      };

      const insertPubkey = newCommitment || `dkim_${emailSignature.slice(0, 32)}`;
      const { error: insertError } = await supabase.from("memberships").insert([
        {
          provider: providerName,
          pubkey: insertPubkey,
          pubkey_expiry: null,
          proof,
          proof_args: proofArgs,
          group_id: NS_DOMAIN,
        },
      ]);
      if (insertError) throw new Error(`Supabase insert failed: ${insertError.message}`);

      if (newCommitment) {
        await addMemberToGroup(newCommitment);
      }

      return res.status(200).json({ ok: true, groupId: NS_DOMAIN, pubkey: insertPubkey, summary });
    }

    // Record exists for this signature
    const existingPubkey: string = existingBySignature.pubkey;

    // If caller didn't provide a new commitment, return alreadyRegistered
    if (!newCommitment) {
      return res.status(200).json({
        ok: true,
        groupId: NS_DOMAIN,
        pubkey: existingPubkey,
        alreadyRegistered: true,
        message: "This email is already registered."
      });
    }

    // If the provided commitment matches the stored one, return alreadyRegistered
    if (oldCommitment && oldCommitment === newCommitment) {
      return res.status(200).json({
        ok: true,
        groupId: NS_DOMAIN,
        pubkey: existingPubkey,
        alreadyRegistered: true,
        message: "Already registered with this identity."
      });
    }

    console.log("MADE IT TO RE-REGISTRATION");

    // Re-registration with a new commitment: update DB and group
    const providerName = "dkim";
    const proof = dkim ? JSON.stringify(dkim) : JSON.stringify({});
    const proofArgs = {
      domain: NS_DOMAIN,
      messageId,
      subject,
      idCommitment: newCommitment,
      summary,
      signature: emailSignature,
    };

    console.log(`🔍!!! Updating membership for commitment: ${newCommitment}`);

    const { error: updateError } = await supabase
      .from("memberships")
      .update({
        pubkey: newCommitment,
        proof,
        proof_args: proofArgs,
      })
      .eq("provider", providerName)
      .eq("group_id", NS_DOMAIN)
      .eq("proof_args->>signature", emailSignature);

    if (updateError) throw new Error(`Supabase update failed: ${updateError.message}`);

    // Update group incrementally
    const groupManager = SemaphoreGroupManager.getInstance();
    if (oldCommitment) {
      groupManager.updateMemberByCommitment(oldCommitment, newCommitment);
    } else {
      groupManager.addMemberToGroup(newCommitment);
    }

    return res.status(200).json({ ok: true, groupId: NS_DOMAIN, pubkey: newCommitment, summary, reRegistered: true });

    // Unreachable: returns occur in each flow above
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error("/api/register/dkim error", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

