import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { messageId, nullifier } = req.body;
    console.log("🔍 Checking like status:", { messageId, nullifier: nullifier?.substring(0, 10) + "..." });

    if (!messageId || !nullifier) {
      console.log("❌ Missing required parameters:", { messageId: !!messageId, nullifier: !!nullifier });
      return res.status(400).json({ error: "Missing messageId or nullifier" });
    }

    // Hash the nullifier to match how it's stored in the database
    console.log("🔐 Hashing nullifier...");
    const hashedNullifier = await crypto.subtle.digest('SHA-256', 
      new TextEncoder().encode(nullifier)
    );
    const hashedNullifierHex = Array.from(new Uint8Array(hashedNullifier))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    console.log("🔑 Hashed nullifier:", hashedNullifierHex.substring(0, 16) + "...");

    // Check if this nullifier exists for this message
    console.log("🔍 Querying database for existing like...");
    const { data: existingLike, error: queryError } = await supabase
      .from("likes")
      .select()
      .eq("message_id", messageId)
      .eq("nullifier", hashedNullifierHex)
      .single();

    if (queryError && queryError.code !== 'PGRST116') {
      console.error("❌ Database query error:", queryError);
      throw queryError;
    }

    const liked = !!existingLike;
    console.log("✅ Like status result:", { messageId, liked, foundRecord: !!existingLike });
    
    return res.status(200).json({ liked });
  } catch (error) {
    console.error("❌ Error checking like status:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
