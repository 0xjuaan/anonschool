import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyProof } from "@semaphore-protocol/proof";
import type { BigNumberish } from "ethers";
import { encodeBytes32String } from "ethers/abi";
import { toBigInt as _toBigInt } from "ethers/utils";

/**
 * Converts a bignumberish or a text to a bigint.
 * @param value The value to be converted to bigint.
 * @return The value converted to bigint.
 */
function toBigInt(value: BigNumberish | Uint8Array | string): bigint {
    try {
        return _toBigInt(value)
    } catch (error: any) {
        if (typeof value === "string") {
            return _toBigInt(encodeBytes32String(value))
        }

        throw TypeError(error instanceof Error ? error.message : error.toString())
    }
}

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
  if (req.method === "POST") {
    postLike(req, res);
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function postLike(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { messageId, proof } = req.body;

    // create scope based on the messageId
    const scope = `ns-like-${messageId}`;
    
    // Convert scope to BigInt using the same method as Semaphore
    const scopeBigInt = toBigInt(scope);

    console.log("🎯 Scope:", scope);
    console.log("🌳 Proofs scope:", proof.scope);
    console.log("🔢 Expected scope as BigInt:", scopeBigInt.toString());

    // require that the proof's scope matches the message
    if (BigInt(proof.scope) !== scopeBigInt) {
      return res.status(400).json({ error: "Proof scope does not match message ID" });
    }

    // Hash the nullifier for consistent querying
    const hashedNullifier = await crypto.subtle.digest('SHA-256', 
      new TextEncoder().encode(proof.nullifier)
    );
    const hashedNullifierHex = Array.from(new Uint8Array(hashedNullifier))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // use the nullifier existence to define `existingLike`
    const { data: existingLikeData } = await supabase
      .from("likes")
      .select()
      .eq("message_id", messageId)
      .eq("nullifier", hashedNullifierHex)
      .single();

    const existingLike = existingLikeData !== null;

    // validate the proof
    const valid = await verifyProof(proof);

    if (!valid) {
      return res.status(400).json({ error: "Invalid proof" });
    }

    // Use the already hashed nullifier from above

    if (!existingLike) {
      // Like
      await supabase.from("likes").insert({
        message_id: messageId,
        nullifier: hashedNullifierHex,
      });
    }

    if (existingLike) {
      // Unlike
      await supabase.from("likes").delete().eq("message_id", messageId).eq("nullifier", hashedNullifierHex);
    }

    // Recalculate total likes and persist on messages table for sorting
    const { count, error: countError } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("message_id", messageId);

    if (countError) {
      console.error("❌ Error counting likes:", countError);
    } else {
      const { error: updateError } = await supabase
        .from("messages")
        .update({ likes: count || 0 })
        .eq("id", messageId);
      if (updateError) {
        console.error("❌ Error updating message like count:", updateError);
      }
    }

    return res.status(200).json({ liked: !existingLike, likeCount: count || 0 });
  } catch (error) {
    console.error("Error handling like:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
