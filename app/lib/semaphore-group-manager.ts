import { Group } from "@semaphore-protocol/group";
import { createClient } from "@supabase/supabase-js";

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

export const NS_DOMAIN = (process.env.NS_DOMAIN || "ns.com").toLowerCase();
export const SEMAPHORE_SCOPE = process.env.SEMAPHORE_SCOPE || "ns-forum-v1";
export const SEMAPHORE_DEFAULT_DEPTH = parseInt(process.env.SEMAPHORE_TREE_DEPTH || "20", 10);

/**
 * Manages Semaphore group state efficiently using incremental operations
 * Follows official Semaphore protocol documentation for off-chain group management
 */
class SemaphoreGroupManager {
  private static instance: SemaphoreGroupManager;
  private group: Group;
  private memberIndexMap: Map<string, number> = new Map(); // commitment -> index
  private initialized = false;

  private constructor() {
    this.group = new Group(); // Create empty group
  }

  static getInstance(): SemaphoreGroupManager {
    if (!SemaphoreGroupManager.instance) {
      SemaphoreGroupManager.instance = new SemaphoreGroupManager();
    }
    return SemaphoreGroupManager.instance;
  }

  /**
   * Initialize the group from database (only runs once)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("Initializing Semaphore group from database...");
    
    // Load all commitments from database
    const commitments = await this.loadCommitmentsFromDatabase();
    
    // Add all members to the group (incremental operations)
    commitments.forEach(commitment => {
      this.addMemberToGroup(commitment);
    });

    this.initialized = true;
    console.log(`Group initialized with ${this.group.size} members`);
  }

  /**
   * Load identity commitments from database
   */
  private async loadCommitmentsFromDatabase(): Promise<string[]> {
    const supabaseClient = getSupabaseClient();
    const { data, error } = await supabaseClient
      .from("memberships")
      .select("proof_args")
      .eq("provider", "dkim")
      .eq("group_id", NS_DOMAIN);

    if (error) throw error;

    const commitments: string[] = [];
    for (const row of data || []) {
      const args = typeof row.proof_args === 'string' 
        ? JSON.parse(row.proof_args) 
        : row.proof_args;
      
      if (args?.idCommitment) {
        commitments.push(args.idCommitment);
      }
    }

    return commitments;
  }

  /**
   * Add member to group (incremental operation - O(log n))
   */
  addMemberToGroup(commitment: string): void {
    this.group.addMember(commitment);
    this.memberIndexMap.set(commitment, this.group.size - 1);
  }

  /**
   * Remove member by commitment (finds index first)
   */
  removeMemberByCommitment(commitment: string): void {
    const index = this.memberIndexMap.get(commitment);
    if (index !== undefined) {
      this.group.removeMember(index);
      this.memberIndexMap.delete(commitment);
    }
  }

  /**
   * Update member by commitment
   */
  updateMemberByCommitment(commitment: string, newCommitment: string): void {
    const index = this.memberIndexMap.get(commitment);
    if (index !== undefined) {
      this.group.updateMember(index, BigInt(newCommitment));
      this.memberIndexMap.delete(commitment);
      this.memberIndexMap.set(newCommitment, index);
    }
  }

  /**
   * Get current root (O(1) operation)
   */
  getRoot(): string {
    return this.group.root.toString();
  }

  /**
   * Get group depth
   */
  getDepth(): number {
    return this.group.depth;
  }

  /**
   * Get group size
   */
  getSize(): number {
    return this.group.size;
  }

  /**
   * Generate Merkle proof for a member
   */
  generateMerkleProof(commitment: string) {
    const index = this.memberIndexMap.get(commitment);
    if (index === undefined) {
      throw new Error("Member not found in group");
    }
    return this.group.generateMerkleProof(index);
  }

  /**
   * Get all members (for debugging)
   */
  getMembers(): string[] {
    return Array.from(this.memberIndexMap.keys());
  }

  /**
   * Check if group is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Force reinitialize (useful for testing or manual refresh)
   */
  async reinitialize(): Promise<void> {
    this.initialized = false;
    this.group = new Group();
    this.memberIndexMap.clear();
    await this.initialize();
  }
}

export default SemaphoreGroupManager;
