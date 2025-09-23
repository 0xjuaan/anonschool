import SemaphoreGroupManager, { NS_DOMAIN, SEMAPHORE_SCOPE, SEMAPHORE_DEFAULT_DEPTH } from "./semaphore-group-manager";

const groupManager = SemaphoreGroupManager.getInstance();


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
  let merkle;
  try {
    merkle = groupManager.generateMerkleProof(idCommitment);
  } catch (e) {
    // If member not found, refresh from DB once to avoid stale in-memory state
    if (e instanceof Error && e.message === 'Member not found in group') {
      await groupManager.reinitialize();
      merkle = groupManager.generateMerkleProof(idCommitment);
    } else {
      throw e;
    }
  }
  return {
    root: merkle.root.toString(),
    index: merkle.index,
    siblings: merkle.siblings.map((s) => s.toString()),
  };
}

// Re-export constants for backward compatibility
export { NS_DOMAIN, SEMAPHORE_SCOPE, SEMAPHORE_DEFAULT_DEPTH };