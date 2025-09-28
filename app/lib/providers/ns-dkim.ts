import type { AnonGroup, AnonGroupProvider, EphemeralKey } from "../types";

const NS_DOMAIN = (process.env.NEXT_PUBLIC_NS_DOMAIN || "ns.com").toLowerCase();

class NSDKIMProvider implements AnonGroupProvider {
  name() {
    return "ns-dkim";
  }

  getSlug() {
    return "ns";
  }

  getAnonGroup(groupId: string): AnonGroup {
    return {
      id: groupId,
      title: NS_DOMAIN,
      logoUrl: "https://ns.com/favicon.ico"
    };
  }

  // These methods aren't used for NS posts but are required by the interface
  async generateProof(ephemeralKey: EphemeralKey) {
    throw new Error("Not implemented");
    return {
      proof: new Uint8Array(),
      anonGroup: this.getAnonGroup("ns"),
      proofArgs: {}
    };
  }

  async verifyProof(proof: Uint8Array, anonGroupId: string, ephemeralPubkey: bigint, ephemeralPubkeyExpiry: Date, proofArgs: object) {
    throw new Error("Not implemented");
    return false;
  }
}

export const NSDkimProvider = new NSDKIMProvider();