import { Message, SignedMessage, SignedMessageWithProof } from "./types";
import { getEphemeralPubkey } from "./ephemeral-key";
import { loadIdentity, getIdCommitmentString } from "./ns-client";
import { generateProof } from "@semaphore-protocol/proof";
import { Identity } from "@semaphore-protocol/identity";

export async function fetchMessages({
  limit,
  groupId,
  isInternal,
  beforeTimestamp,
  afterTimestamp,
}: {
  limit: number;
  isInternal?: boolean;
  groupId?: string;
  beforeTimestamp?: number | null;
  afterTimestamp?: number | null;
}) {
  const url = new URL(window.location.origin + "/api/messages");

  url.searchParams.set("limit", limit.toString());
  if (groupId) url.searchParams.set("groupId", groupId);
  if (isInternal) url.searchParams.set("isInternal", "true");
  if (afterTimestamp) url.searchParams.set("afterTimestamp", afterTimestamp.toString());
  if (beforeTimestamp) url.searchParams.set("beforeTimestamp", beforeTimestamp.toString());

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (isInternal) {
    const pubkey = getEphemeralPubkey();
    if (!pubkey) {
      throw new Error("No public key found");
    }
    headers["Authorization"] = `Bearer ${pubkey}`; // Pubkey modulus is used as the bearer token
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`Call to /messages API failed: ${errorMessage}`);
  }

  const messages = await response.json();
  return messages.map((message: Message) => ({
    ...message,
    timestamp: new Date(message.timestamp),
  }));
}

export async function fetchMessage(
  id: string,
  isInternal: boolean = false
): Promise<SignedMessageWithProof> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (isInternal) {
    const pubkey = getEphemeralPubkey();
    if (!pubkey) {
      throw new Error("No public key found");
    }
    headers["Authorization"] = `Bearer ${pubkey}`;
  }

  const response = await fetch(`/api/messages/${id}`, { headers });

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`Call to /messages/${id} API failed: ${errorMessage}`);
  }

  const message = await response.json();
  try {
    message.ephemeralPubkey = BigInt(message.ephemeralPubkey);
    message.ephemeralPubkeyExpiry = new Date(message.ephemeralPubkeyExpiry);
    message.timestamp = new Date(message.timestamp);
    message.proof = Uint8Array.from(message.proof);
  } catch (error) {
    console.warn("Error parsing message:", error);
  }

  return message;
}

export async function createMembership({
  ephemeralPubkey,
  ephemeralPubkeyExpiry,
  groupId,
  provider,
  proof,
  proofArgs
}: {
  ephemeralPubkey: string;
  ephemeralPubkeyExpiry: Date;
  groupId: string;
  provider: string;
  proof: Uint8Array;
  proofArgs: object;
}) {
  const response = await fetch("/api/memberships", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ephemeralPubkey,
      ephemeralPubkeyExpiry: ephemeralPubkeyExpiry.toISOString(),
      groupId,
      provider,
      proof: Array.from(proof),
      proofArgs,
    }),
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    console.error(`Call to /memberships API failed: ${errorMessage}`);
    throw new Error("Call to /memberships API failed");
  }
}

export async function createMessage(signedMessage: SignedMessage) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...signedMessage,
      ephemeralPubkey: signedMessage.ephemeralPubkey.toString(),
      signature: signedMessage.signature.toString(),
    }),
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    console.error(`Call to /messages API failed: ${errorMessage}`);
    throw new Error("Call to /messages API failed");
  }
}

// Generate nullifier for a given message
// This should match what generateProof produces
async function generateNullifier(identity: Identity, messageId: string): Promise<string> {
  const scope = `ns-like-${messageId}`;
  
  // For now, we need to generate a proof to get the actual nullifier
  // This is not ideal but ensures we get the exact same nullifier
  const idCommitment = getIdCommitmentString(identity);
  
  // Get Merkle proof
  const merkleResponse = await fetch('/api/merkle-proof', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idCommitment }),
  });

  if (!merkleResponse.ok) {
    throw new Error('Failed to get Merkle proof');
  }

  const merkle = await merkleResponse.json();
  
  // Convert Merkle proof to format required by generateProof
  const merkleProof = {
    root: BigInt(merkle.root),
    index: merkle.index,
    siblings: merkle.siblings.map((s: string) => BigInt(s)),
    leaf: BigInt(idCommitment),
  } as { root: bigint; index: number; siblings: bigint[]; leaf: bigint };
  
  // Generate proof to get the actual nullifier
  const proof = await generateProof(identity, merkleProof, messageId, scope);
  
  return proof.nullifier;
}

// Check if user has liked a message
export async function checkLikeStatus(messageId: string): Promise<boolean> {
  try {
    const identity = loadIdentity();
    if (!identity) {
      return false;
    }

    const nullifier = await generateNullifier(identity, messageId);
    
    const response = await fetch('/api/likes/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messageId, nullifier }),
    });

    if (!response.ok) {
      console.error('Failed to check like status');
      return false;
    }

    const { liked } = await response.json();
    return liked;
  } catch (error) {
    console.error('Error checking like status:', error);
    return false;
  }
}

// Get current like count for a message
export async function getLikeCount(messageId: string): Promise<number> {
  try {
    const response = await fetch(`/api/likes/count?messageId=${messageId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error('Failed to get like count');
      return 0;
    }

    const { count } = await response.json();
    return count;
  } catch (error) {
    console.error('Error getting like count:', error);
    return 0;
  }
}

export async function toggleLike(messageId: string) {
  try {
    
    // Load user's Semaphore identity
    const identity = loadIdentity();
    if (!identity) {
      throw new Error("No Semaphore identity found. Please register first.");
    }

    // Get identity commitment
    const idCommitment = getIdCommitmentString(identity);
    
    // Get Merkle proof that user is in the group
    const merkleResponse = await fetch('/api/merkle-proof', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idCommitment }),
    });

    if (!merkleResponse.ok) {
      const errorData = await merkleResponse.json();
      throw new Error(errorData.error || 'Failed to get Merkle proof');
    }
    const merkle = await merkleResponse.json();
    
    // Create scope for this like action
    const scope = `ns-like-${messageId}`;
    
    // Convert Merkle proof to format required by generateProof
    const merkleProof = {
      root: BigInt(merkle.root),
      index: merkle.index,
      siblings: merkle.siblings.map((s: string) => BigInt(s)),
      leaf: BigInt(idCommitment),
    } as { root: bigint; index: number; siblings: bigint[]; leaf: bigint };
    
    const proof = await generateProof(identity, merkleProof, messageId, scope);

    // Send proof to server
    const response = await fetch("/api/likes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messageId,
        proof,
      }),
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      console.error(`Call to /likes API failed: ${errorMessage}`);
      throw new Error("Call to /likes API failed");
    }

    const data = await response.json();
    return data.liked;
  } catch (error) {
    throw error;
  }
}
