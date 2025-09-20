import { createClient } from "@supabase/supabase-js";
import { Group } from "@semaphore-protocol/group";

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export const NS_DOMAIN = (process.env.NS_DOMAIN || "ns.com").toLowerCase();
export const SEMAPHORE_SCOPE = process.env.SEMAPHORE_SCOPE || "ns-forum-v1";
export const SEMAPHORE_DEFAULT_DEPTH = parseInt(process.env.SEMAPHORE_TREE_DEPTH || "20", 10);

export async function fetchIdCommitments(): Promise<string[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("proof_args")
    .eq("provider", "dkim")
    .eq("group_id", NS_DOMAIN);

  if (error) throw error;

  const commitments: string[] = [];
  for (const row of data || []) {
    // Parse the JSON string from proof_args
    const args = typeof row.proof_args === 'string' 
      ? JSON.parse(row.proof_args) 
      : row.proof_args;

    const c = args?.idCommitment;
    if (typeof c === "string" && c.length > 0 && c !== "0") {
      commitments.push(c);
    }
  }
  return commitments;
}

export async function buildGroup() {
  const members = await fetchIdCommitments();
  // Deterministic ordering for stable root
  members.sort();
  const group = new Group(members as unknown as bigint[]);
  return {
    root: group.root.toString(),
    depth: Math.max(group.depth, SEMAPHORE_DEFAULT_DEPTH),
    size: group.size,
    members,
  };
}

export async function merkleProofForMember(idCommitment: string) {
  const members = await fetchIdCommitments();
  members.sort();
  const group = new Group(members as unknown as bigint[]);
  const index = group.indexOf(idCommitment);
  if (index < 0) {
    throw new Error("member_not_found");
  }
  const merkle = group.generateMerkleProof(index);
  return {
    root: merkle.root.toString(),
    index: merkle.index,
    siblings: merkle.siblings.map((s) => s.toString()),
  };
}
