import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";

const ID_STORAGE_KEY = "ns.identity.v1";

// Generate time-based scope for current minute
export function getCurrentMinuteScope(): string {
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
  const minuteTimestamp = Math.floor(now / 60); // Floor divide by 60 to get current minute
  return `ns-post-${minuteTimestamp}`;
}

// Validate that a scope is valid for the current minute (with 2 minute tolerance)
export function isValidScope(scope: string | bigint): boolean {
  const currentMinute = Math.floor(Date.now() / 1000 / 60);
  
  // Handle both string and BigInt scopes
  let scopeStr: string;
  if (typeof scope === 'bigint') {
    scopeStr = scope.toString();
  } else {
    scopeStr = scope;
  }
  
  // Extract minute from scope for string format
  const scopeMatch = scopeStr.match(/^ns-post-(\d+)$/);
  if (!scopeMatch) return false;
  
  const scopeMinute = parseInt(scopeMatch[1], 10);
  
  // Allow current minute or up to 2 minutes ago (2 minute tolerance for clock skew)
  return scopeMinute >= currentMinute - 1 && scopeMinute <= currentMinute;
}

export type StoredIdentity = {
  privateKey: string;
  secretScalar: string;
};

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(ID_STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredIdentity = JSON.parse(raw);
    const id = Identity.import(parsed.privateKey);
    return id;
  } catch {
    return null;
  }
}

export function ensureIdentity(): Identity {
  const existing = loadIdentity();
  if (existing) return existing;
  const id = new Identity();
  persistIdentity(id);
  return id;
}

export function persistIdentity(id: Identity) {
  const data: StoredIdentity = {
    privateKey: id.export(),
    secretScalar: id.secretScalar.toString(),
  };
  localStorage.setItem(ID_STORAGE_KEY, JSON.stringify(data));
}

export function getIdCommitmentString(id: Identity): string {
  return id.commitment.toString();
}

export async function fetchGroupRoot() {
  const res = await fetch("/api/group/root");
  if (!res.ok) throw new Error("Failed to fetch group root");
  return res.json();
}

export async function fetchMerkleProof(idCommitment: string) {
  const res = await fetch(`/api/group/proof?idCommitment=${encodeURIComponent(idCommitment)}`);
  if (!res.ok) throw new Error("Failed to fetch Merkle proof");
  const json = await res.json();
  return json.proof as { root: string; index: number; siblings: string[] };
}

export async function postAnonymousMessage(identity: Identity, text: string) {
  const idc = getIdCommitmentString(identity);
  await fetchGroupRoot(); // Verify group root is accessible
  const merkle = await fetchMerkleProof(idc);

  // Convert siblings to BigInt array as required by generateProof
  const merkleProof = {
    root: BigInt(merkle.root),
    index: merkle.index,
    siblings: merkle.siblings.map((s) => BigInt(s)),
    leaf: BigInt(idc),
  } as { root: bigint; index: number; siblings: bigint[]; leaf: bigint };

  const scope = getCurrentMinuteScope();

  const proof = await generateProof(identity, merkleProof, text, scope);
  
  // Add the original scope to the proof object for server validation
  (proof as any).originalScope = scope;

  const res = await fetch("/api/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, proof }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Post failed: ${err.message || res.statusText}`);
  }
  const data = await res.json();
  
  // Add provider info to the returned message
  return {
    ...data,
    anonGroupProvider: "ns-dkim",
    timestamp: new Date(data.timestamp)
  };
}
