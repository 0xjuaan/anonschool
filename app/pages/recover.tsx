import React, { useState } from "react";
import Head from "next/head";
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
    <>
      <Head>
        <title>Recover Account - AnonSchool</title>
        <meta name="description" content="Recover your AnonSchool account using your secret key" />
      </Head>

      <div className="min-h-screen bg-slate-50 py-8 px-4 sm:py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Recover Your Account
            </h1>
            <p className="text-slate-600 text-lg">
              Paste your secret key below to recover your account on this device.
            </p>
          </div>

          {/* Main Form */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <label htmlFor="secret" className="block text-sm font-semibold text-slate-700 mb-3">
                  Secret Key
                </label>
                <textarea
                  id="secret"
                  name="secret"
                  placeholder="Paste your complete secret key here..."
                  className="w-full h-32 px-4 py-3 border border-slate-300 rounded-xl font-mono text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           resize-none bg-slate-50"
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-slate-600 hover:bg-slate-700 
                           text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl 
                           transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed 
                           disabled:transform-none disabled:shadow-lg"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Recovering...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    Recover Account
                  </>
                )}
              </button>
            </form>

            {/* Status Messages */}
            {status && (
              <div className={`mt-6 p-4 rounded-xl border ${
                status.includes("Success") 
                  ? "bg-green-50 border-green-200 text-green-800" 
                  : "bg-red-50 border-red-200 text-red-800"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    status.includes("Success") ? "bg-green-100" : "bg-red-100"
                  }`}>
                    {status.includes("Success") ? (
                      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm font-medium">{status}</p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-3">
                  Recovery Instructions
                </h3>
                <ol className="space-y-2 text-blue-800 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-blue-200 text-blue-800 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                    <span>Paste your complete secret key, including both the privateKey and secretScalar.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-blue-200 text-blue-800 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    <span>The key should be in JSON format, exactly as it was shown when you first joined.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-blue-200 text-blue-800 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                    <span>Make sure to include all characters, including curly braces and quotes.</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Back to Home Link */}
          <div className="text-center mt-8">
            <a 
              href="/" 
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default RecoverPage;
