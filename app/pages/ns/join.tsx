import React, { useState } from "react";
import { ensureIdentity, getIdCommitmentString, registerWithEml } from "../../lib/ns-client";

const JoinNSPage: React.FC = () => {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fileInput = (e.currentTarget.elements.namedItem("eml") as HTMLInputElement);
    const file = fileInput?.files?.[0];
    if (!file) {
      setStatus("Please select an .eml file.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Generating identity and verifying email via DKIM...");
      const id = ensureIdentity();
      const commit = getIdCommitmentString(id);

      const text = await file.text();
      const result = await registerWithEml(text, commit);
      if (result?.ok) {
        setStatus("Success! You can now post anonymously.");
      } else {
        setStatus("Registration failed. Please check your email file.");
      }
    } catch (err: any) {
      setStatus(err?.message || "Registration error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 20 }}>
      <h1>Join Network School Forum</h1>
      <p>Upload your acceptance email (.eml). We verify DKIM (d=ns.com) and subject.</p>
      <form onSubmit={onSubmit}>
        <input type="file" name="eml" accept="message/rfc822,.eml" />
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={loading}>{loading ? "Verifying..." : "Verify & Join"}</button>
        </div>
      </form>
      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </div>
  );
};

export default JoinNSPage;

