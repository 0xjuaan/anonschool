'use client'

import React, { useState } from "react";
import { useRouter } from "next/router";
import { Identity } from "@semaphore-protocol/identity";
import { persistIdentity, loadIdentity } from "../lib/ns-client";

const RecoverPage: React.FC = () => {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      // Get the secret key from the textarea
      const secretInput = (e.currentTarget.elements.namedItem("secret") as HTMLTextAreaElement).value;
      
      // Parse the secret key
      let secretKey;
      try {
        secretKey = JSON.parse(secretInput);
        if (!secretKey.privateKey || !secretKey.secretScalar) {
          throw new Error("Invalid secret key format");
        }
      } catch (err) {
        setStatus("Invalid secret key format. Please make sure you paste the entire key exactly as it was shown.");
        setLoading(false);
        return;
      }

      // Try to reconstruct the identity
      try {        
        // Create new identity from the base64 private key
        const id = Identity.import(secretKey.privateKey);
        
        // Verify the secret scalar matches
        if (id.secretScalar.toString() !== secretKey.secretScalar) {
          throw new Error("Invalid secret key - scalar mismatch");
        }

        // Verify membership by attempting to fetch merkle proof
        const idCommitment = id.commitment.toString();
        try {
          const merkleProofResponse = await fetch(`/api/group/proof?idCommitment=${encodeURIComponent(idCommitment)}`);
          if (!merkleProofResponse.ok) {
            throw new Error("This identity is not registered in the system.");
          }
          // If we get here, the merkle proof exists, meaning the identity is registered
        } catch (err) {
          throw new Error("This identity is not registered in the system.");
        }

        // Store the identity and verify it was stored correctly
        persistIdentity(id);
        
        // Verify the identity was stored correctly
        const storedId = loadIdentity();
        if (!storedId || storedId.commitment.toString() !== id.commitment.toString()) {
          throw new Error("Failed to store identity. Please try again.");
        }
        
        setStatus("Success! Your account has been recovered. Redirecting to forum...");
        
        // Short delay to let the success message show
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Use window.location for a full page reload instead of client-side navigation
        window.location.href = "/";
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Recovery failed");

      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Recovery failed";
      setStatus(errorMessage);
      console.error("Recovery error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 20 }}>
      <h1>Recover Your Account</h1>
      <p>Paste your secret key below to recover your account on this device.</p>
      
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 15 }}>
          <textarea
            name="secret"
            placeholder="Paste your secret key here..."
            style={{
              width: "100%",
              minHeight: 100,
              padding: 10,
              borderRadius: 4,
              border: "1px solid #ccc",
              fontFamily: "monospace",
              fontSize: "0.9em"
            }}
            required
          />
        </div>
        <div>
          <button 
            type="submit" 
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: 4,
              border: "none",
              background: "#0070f3",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? "Recovering..." : "Recover Account"}
          </button>
        </div>
      </form>

      {status && (
        <p style={{ 
          marginTop: 15,
          padding: 10,
          borderRadius: 4,
          background: status.includes("Success") ? "#e6ffe6" : "#ffe6e6",
          color: status.includes("Success") ? "#006600" : "#cc0000"
        }}>
          {status}
        </p>
      )}

      <div style={{ marginTop: 30 }}>
        <h3>Instructions:</h3>
        <ol style={{ lineHeight: 1.6 }}>
          <li>Paste your complete secret key, including both the privateKey and secretScalar.</li>
          <li>The key should be in JSON format, exactly as it was shown when you first joined.</li>
          <li>Make sure to include all characters, including curly braces and quotes.</li>
        </ol>
      </div>
    </div>
  );
};

export default RecoverPage;
