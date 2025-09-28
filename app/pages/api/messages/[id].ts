import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
// import type { SignedMessageWithProof } from "../../../lib/types";
import { getAdminTokenFromRequest, verifySessionToken } from "../../../lib/admin-auth";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    getSingleMessage(req, res);
  } else if (req.method === "DELETE") {
    deleteMessage(req, res);
  } else {
    res.setHeader("Allow", ["GET", "DELETE"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function getSingleMessage(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

    if (!id) {
      res.status(400).json({ error: "Message ID is required" });
      res.end();
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .select(
        /* eslint-disable-next-line max-len */
        "id, group_id, group_provider, text, timestamp, internal, likes, signature, pubkey, memberships(proof, pubkey_expiry, proof_args)"
      )
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      res.status(404).json({ error: "Message not found" });
      res.end();
      return;
    }

    if (data.internal) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res
          .status(401)
          .json({ error: "Authorization required for internal messages" });
        res.end();
        return;
      }

      const pubkey = authHeader.split(" ")[1];
      const { data: membershipData, error: membershipError } = await supabase
        .from("memberships")
        .select("*")
        .eq("pubkey", pubkey)
        .eq("group_id", data.group_id)
        .single();

      if (membershipError || !membershipData) {
        res.status(401).json({ error: "Invalid public key for this group" });
        res.end();
        return;
      }
    }

    const message = {
      id: data.id,
      anonGroupId: data.group_id,
      anonGroupProvider: data.group_provider,
      text: data.text,
      timestamp: data.timestamp,
      ephemeralPubkey: data.pubkey,
      signature: data.signature,
      // @ts-expect-error memberships is not array
      ephemeralPubkeyExpiry: data.memberships.pubkey_expiry,
      internal: data.internal,
      likes: data.likes,
      // @ts-expect-error memberships is not array
      proof: JSON.parse(data.memberships.proof),
      // @ts-expect-error memberships is not array
      proofArgs: JSON.parse(data.memberships.proof_args),
    };

    res.json(message);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
    res.end();
  }
}

async function deleteMessage(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;
    if (!id) {
      res.status(400).json({ error: "Message ID is required" });
      return;
    }

    // Admin auth via signed cookie-based session
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      res.status(500).json({ error: "ADMIN_PASSWORD not configured" });
      return;
    }
    const token = getAdminTokenFromRequest(req);
    const ok = verifySessionToken(adminPassword, token);
    if (!ok) return res.status(401).json({ error: "Unauthorized" });

    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) throw error;

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete message" });
  }
}
