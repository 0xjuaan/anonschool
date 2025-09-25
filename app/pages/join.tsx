'use client'

import React, { useState } from "react";
import { useRouter } from "next/router";
import { ensureIdentity, getIdCommitmentString } from "../lib/ns-client";
import { initZkEmailSdk, Proof } from "@zk-email/sdk";

const JoinNSPage: React.FC = () => {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [secretKey, setSecretKey] = useState<{ privateKey: string; secretScalar: string } | null>(null);
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
      setStatus("Starting proof generation... This will take 5-20 seconds. Please keep this tab open.");
      
      // Read the file
      const eml = await file.text();

      // Initialize the SDK
      const sdk = initZkEmailSdk();

      // Create blueprint for NS acceptance emails
      const blueprint = await sdk.getBlueprint("hackertron/NetworkSchool@v2");

      // Create a prover
      const prover = blueprint.createProver();
      
      // Generate the proof with progress updates
      const zkProof = await prover.generateProof(eml);

      

      // Generate Semaphore identity
      setStatus("Generating anonymous identity...");
      const id = ensureIdentity();
      const commit = getIdCommitmentString(id);

      // Store identity components for future use
      const exportedKey = id.export();
      setSecretKey({
        privateKey: exportedKey,
        secretScalar: id.secretScalar.toString()
      });

      // Register with the proof
      setStatus("Proof generated! Registering with server...");

      const response = await fetch("/api/register/dkim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proof: zkProof.packProof(),
          idCommitment: commit
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }

      const result = await response.json();
      
      if (result?.ok) {
        if (result.alreadyRegistered) {
          setStatus("You are already registered with this email!");
        } else {
          setStatus("Success! Please save your secret key below before continuing.");
        }
      } else {
        setStatus("Registration failed. Please check your email file.");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Registration error.";
      setStatus(errorMessage);
      console.error("Registration error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 20 }}>
      <h1>AnonSchool</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ margin: 0 }}>Upload your acceptance email (.eml). We'll generate a zero-knowledge proof that you received an acceptance email, without revealing the email contents.</p>
        <a 
          href="/recover" 
          style={{ 
            padding: "8px 16px", 
            background: "#f0f0f0", 
            borderRadius: 4, 
            textDecoration: 'none',
            color: '#666',
            fontSize: '0.9em'
          }}
        >
          Recover Account
        </a>
      </div>
      
      <form onSubmit={onSubmit}>
        <input 
          type="file" 
          name="eml" 
          accept="message/rfc822,.eml"
          disabled={loading}
        />
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={loading}>
            {loading ? "Generating proof..." : "Verify & Join"}
          </button>
        </div>
      </form>

      {status && (
        <p style={{ marginTop: 12 }}>{status}</p>
      )}

      {secretKey && !loading && (
        <div style={{ marginTop: 20, padding: 20, border: '2px solid #ff6b6b', borderRadius: 8 }}>
          <h3 style={{ color: '#ff6b6b' }}>⚠️ IMPORTANT: Save Your Secret Key</h3>
          <p style={{ marginBottom: 15 }}>
            This is your account recovery key. Save it somewhere safe - you will need it to recover your account if you clear your browser data.
            <br />
            <strong>This key will only be shown once!</strong>
            <br />
            <small style={{ color: '#666' }}>
              The key contains two parts: a private key and a secret scalar. Save both parts exactly as shown.
            </small>
          </p>
          <pre style={{ 
            background: '#f5f5f5', 
            padding: 10, 
            borderRadius: 4,
            overflow: 'auto',
            fontSize: '0.8em',
            marginBottom: 15
          }}>
            {JSON.stringify(secretKey, null, 2)}
          </pre>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(secretKey, null, 2));
              alert('Secret key copied to clipboard!');
            }}
            style={{ marginRight: 10 }}
          >
            Copy to Clipboard
          </button>
          <button 
            onClick={() => router.push('/')}
            style={{ background: '#4CAF50', color: 'white' }}
          >
            I've Saved My Key - Continue to Forum
          </button>
        </div>
      )}
    </div>
  );
};

export default JoinNSPage;