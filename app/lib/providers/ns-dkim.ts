import { AnonGroupProvider, EphemeralKey } from "../types";

// Minimal provider to support rendering and routing (no proof ops here).
export const NSDkimProvider: AnonGroupProvider = {
  name: () => "ns-dkim",
  getSlug: () => "domain",
  async generateProof(_ephemeralKey: EphemeralKey) {
    throw new Error("NS DKIM provider does not support client-side proof generation.");
  },
  async verifyProof() {
    throw new Error("NS DKIM provider does not verify client-side proofs.");
  },
  getAnonGroup(groupId: string) {
    return {
      id: groupId,
      title: groupId,
      logoUrl: `https://img.logo.dev/${groupId}?token=pk_SqdEexoxR3akcyJz7PneXg`,
    };
  },
};

