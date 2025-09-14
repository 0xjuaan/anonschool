import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";

const ID_STORAGE_KEY = "ns.identity.v1";
const SCOPE = process.env.NEXT_PUBLIC_SEMAPHORE_SCOPE || "ns-forum-v1";

export type StoredIdentity = {
  trapdoor: string;
  nullifier: string;
};

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(ID_STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredIdentity = JSON.parse(raw);
    const id = new Identity({ trapdoor: BigInt(parsed.trapdoor), nullifier: BigInt(parsed.nullifier) });
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
    trapdoor: id.trapdoor.toString(),
    nullifier: id.nullifier.toString(),
  };
  localStorage.setItem(ID_STORAGE_KEY, JSON.stringify(data));
}

export function getIdCommitmentString(id: Identity): string {
  return id.commitment.toString();
}

export async function registerWithEml(emlText: string, idCommitment?: string) {
  const body: any = { emlBase64: btoa(emlText) };
  if (idCommitment) body.idCommitment = idCommitment;
  const res = await fetch("/api/register/dkim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Registration failed: ${err.error || res.statusText}`);
  }
  return res.json();
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
  const { root } = await fetchGroupRoot();
  const merkle = await fetchMerkleProof(idc);

  // Convert siblings to BigInt array as required by generateProof
  const merkleProof = {
    root: BigInt(merkle.root),
    index: merkle.index,
    siblings: merkle.siblings.map((s) => BigInt(s)),
  } as any;

  const proof = await generateProof(identity, merkleProof, text, SCOPE);

  const res = await fetch("/api/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, proof }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Post failed: ${err.error || res.statusText}`);
  }
  return res.json();
}
