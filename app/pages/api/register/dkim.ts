import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyDkimAndSubject, sha256Hex } from "../../../lib/dkim";

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

    const pubkey: string = typeof idCommitment === "string" && idCommitment.length > 0
      ? idCommitment
      : `dkim_${sha256Hex(`${messageId}|${NS_DOMAIN}`).slice(0, 32)}`;

    const providerName = "dkim";

    const proof = dkim ? JSON.stringify(dkim) : JSON.stringify({});
    const proofArgs = JSON.stringify({
      domain: NS_DOMAIN,
      messageId,
      subject,
      idCommitment: idCommitment || null,
      summary,
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
      // If duplicate pubkey, treat as ok (idempotent)
      if (error.code === "23505") {
        return res.status(200).json({ ok: true, groupId: NS_DOMAIN, pubkey, existed: true });
      }
      throw new Error(`Supabase insert failed: ${error.message}`);
    }

    return res.status(200).json({ ok: true, groupId: NS_DOMAIN, pubkey, summary });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("/api/register/dkim error", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

