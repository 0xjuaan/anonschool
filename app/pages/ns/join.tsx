import React, { useState } from "react";
import { useRouter } from "next/router";
import { ensureIdentity, getIdCommitmentString, registerWithEml } from "../../lib/ns-client";

const JoinNSPage: React.FC = () => {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
        if (result.alreadyRegistered) {
          setStatus("You are already registered with this email! Using your current identity...");
          // The identity is already created and stored above
          // No need to create a new one - use the existing one
        } else if (result.reRegistered) {
          setStatus("Email re-registered with new identity! Redirecting to the forum...");
        } else {
          setStatus("Success! Redirecting to the forum...");
        }
        // Redirect to the /ns page after successful registration or if already registered
        setTimeout(() => {
          router.push("/ns");
        }, 1500);
      } else {
        setStatus("Registration failed. Please check your email file.");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Registration error.";
      setStatus(errorMessage);
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

