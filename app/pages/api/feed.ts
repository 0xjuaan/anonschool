import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 100);
    const { data, error } = await supabase
      .from("messages")
      .select("id, text, timestamp, group_id, group_provider, likes")
      .eq("group_provider", "ns-dkim")
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return res.status(200).json({ ok: true, items: data || [] });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("/api/feed error", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

