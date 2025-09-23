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
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { messageId } = req.query;
    console.log("🔢 Getting like count for message:", messageId);

    if (!messageId || typeof messageId !== "string") {
      console.log("❌ Missing or invalid messageId");
      return res.status(400).json({ error: "Missing or invalid messageId" });
    }

    // Count likes for this message
    console.log("🔍 Counting likes in database...");
    const { count, error: countError } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("message_id", messageId);

    if (countError) {
      console.error("❌ Database count error:", countError);
      throw countError;
    }

    const likeCount = count || 0;
    console.log("✅ Like count result:", { messageId, likeCount });
    
    return res.status(200).json({ count: likeCount });
  } catch (error) {
    console.error("❌ Error getting like count:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
