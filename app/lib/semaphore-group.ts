import SemaphoreGroupManager, { NS_DOMAIN, SEMAPHORE_SCOPE, SEMAPHORE_DEFAULT_DEPTH } from "./semaphore-group-manager";

const groupManager = SemaphoreGroupManager.getInstance();

/**
 * @deprecated Use getGroupRoot() for better performance
 * Fetch all identity commitments from database (inefficient - use sparingly)
 */
export async function fetchIdCommitments(): Promise<string[]> {
  // This function is kept for backward compatibility
  // New code should use groupManager.getMembers() instead
  await groupManager.initialize();
  return groupManager.getMembers();
}

/**
 * Build group state using cached group manager (efficient)
 * This now uses incremental operations instead of rebuilding the entire tree
 */
export async function buildGroup() {
  await groupManager.initialize();
  
  return {
    root: groupManager.getRoot(),
    depth: Math.max(groupManager.getDepth(), SEMAPHORE_DEFAULT_DEPTH),
    size: groupManager.getSize(),
    members: groupManager.getMembers(),
  };
}

/**
 * Get current group root (O(1) operation)
 * This is the most efficient way to get the group root
 */
export async function getGroupRoot(): Promise<string> {
  await groupManager.initialize();
  return groupManager.getRoot();
}

/**
 * Add member to group (incremental operation)
 * Call this when a new member registers
 */
export async function addMemberToGroup(commitment: string): Promise<void> {
  await groupManager.initialize();
  groupManager.addMemberToGroup(commitment);
}

/**
 * Remove member from group (incremental operation)
 * Call this when a member needs to be removed
 */
export async function removeMemberFromGroup(commitment: string): Promise<void> {
  await groupManager.initialize();
  groupManager.removeMemberByCommitment(commitment);
}

/**
 * Generate Merkle proof for a member
 */
export async function generateMerkleProof(commitment: string) {
  await groupManager.initialize();
  return groupManager.generateMerkleProof(commitment);
}

/**
 * @deprecated Use generateMerkleProof() instead
 * Legacy function for backward compatibility
 */
export async function merkleProofForMember(idCommitment: string) {
  await groupManager.initialize();
  const merkle = groupManager.generateMerkleProof(idCommitment);
  return {
    root: merkle.root.toString(),
    index: merkle.index,
    siblings: merkle.siblings.map((s) => s.toString()),
  };
}

// Re-export constants for backward compatibility
export { NS_DOMAIN, SEMAPHORE_SCOPE, SEMAPHORE_DEFAULT_DEPTH };