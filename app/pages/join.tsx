import React, { useState, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ensureIdentity, getIdCommitmentString } from "../lib/ns-client";
import { initZkEmailSdk } from "@zk-email/sdk";

const JoinNSPage: React.FC = () => {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [secretKey, setSecretKey] = useState<{ privateKey: string; secretScalar: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showEmlHelp, setShowEmlHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.eml') || file.type === 'message/rfc822')) {
      handleFileSelect(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) {
      setStatus("Please select an .eml file.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Starting proof generation... This will take 5-20 seconds. Please keep this tab open.");
      
      // Read the file
      const eml = await selectedFile.text();

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
    <React.Fragment>
      <Head>
        <title>Join AnonSchool - Anonymous Network School Forum</title>
        <meta 
          name="description" 
          content="Join AnonSchool by verifying your Network School acceptance email with zero-knowledge proofs." 
        />
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.png?v=2" />
      </Head>
      {showEmlHelp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">How to get your .EML file</h2>
                <button onClick={() => setShowEmlHelp(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-blue-900">
                  Search your inbox for <span className="font-semibold">subject</span> "Network School Acceptance" from <span className="font-semibold">mail@mail.ns.com</span>.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Gmail</h3>
                  <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
                    <li>Open the email</li>
                    <li>Click three dots (More options)</li>
                    <li>Select "Download message"</li>
                  </ol>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Apple Mail</h3>
                  <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
                    <li>File → Save As</li>
                    <li>Select "Raw Message Source"</li>
                    <li>Save with .eml extension</li>
                  </ol>
                  <p className="text-xs text-slate-500 mt-1">Or drag the email to your desktop.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Outlook (Web)</h3>
                  <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
                    <li>Open the email</li>
                    <li>Click three dots (More options)</li>
                    <li>Select "Save"</li>
                  </ol>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Outlook (Desktop)</h3>
                  <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
                    <li>File → Save As</li>
                    <li>Choose location</li>
                    <li>Ensure file type is .eml</li>
                  </ol>
                </div>
              </div>

              <div className="mt-6">
                <a href="https://docs.zk.email/zk-email-sdk/get-eml-file" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View full guide
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="min-h-screen bg-slate-50 py-8 px-4 sm:py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Join AnonSchool
            </h1>
              <p className="text-slate-600 text-lg mb-3">
                Upload your acceptance email (.eml). It will be used to generate a ZK proof without revealing the email contents.
              </p>
              <p className="text-sm text-slate-500 mb-6 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                This service does not have access to your .eml files
              </p>
            <a 
              href="/recover" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200
                       text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 
                       rounded-lg transition-all shadow-sm hover:shadow font-medium"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recover account (already joined)
            </a>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
            <form onSubmit={onSubmit} className="space-y-6">
              
              {/* Help + File Upload Area */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-slate-700">
                    Network School Acceptance Email (.eml file)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowEmlHelp(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    How to get .eml?
                  </button>
                </div>

                <div 
                className={`
                  relative border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all
                  ${dragOver 
                    ? 'border-indigo-400 bg-indigo-50' 
                    : selectedFile 
                      ? 'border-green-400 bg-green-50' 
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                  }
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileInput}
              >
                {selectedFile ? (
                  <div className="space-y-3">
                    <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{selectedFile.name}</p>
                      <p className="text-sm text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <p className="text-xs text-slate-400">Click to select a different file</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-900 mb-2">
                        Drop your .eml file here
                      </p>
                      <p className="text-slate-600">
                        or <span className="text-indigo-600 font-medium">click to browse</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        Network School acceptance email only
                      </p>
                    </div>
                  </div>
                )}
                
                <input 
                  ref={fileInputRef}
                  type="file" 
                  name="eml" 
                  accept="message/rfc822,.eml"
                  disabled={loading}
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                </div>
              </div>
              
              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={loading || !selectedFile} 
                className={`
                  w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200
                  ${loading || !selectedFile
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                  }
                `}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-3">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating Proof...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Verify & Join AnonSchool</span>
                  </div>
                )}
              </button>
            </form>

            {/* Status Message */}
            {status && (
              <div className={`
                mt-6 p-4 rounded-xl border-l-4 
                ${loading 
                  ? 'bg-blue-50 text-blue-800 border-blue-400' 
                  : status.includes('Success') || status.includes('already registered')
                    ? 'bg-green-50 text-green-800 border-green-400'
                    : status.includes('error') || status.includes('failed')
                      ? 'bg-red-50 text-red-800 border-red-400'
                      : 'bg-slate-50 text-slate-700 border-slate-400'
                }
              `}>
                <div className="flex items-start gap-3">
                  <div>
                    <p className="font-medium">{status}</p>
                    {loading && (
                      <p className="text-xs mt-1 opacity-80">This may take 5-20 seconds. Please keep this tab open.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Secret Key Display */}
          {secretKey && !loading && (
            <div className="mt-8 bg-red-50 border-2 border-red-200 rounded-2xl p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-red-800 mb-2">
                    🔐 Save Your Secret Key
                  </h3>
                  <div className="space-y-2 text-red-700">
                    <p className="font-medium">
                      This is your account recovery key. Store it safely - you'll need it to recover your account.
                    </p>
                    <p className="font-bold">
                      ⚠️ This key will only be shown ONCE!
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
                <pre className="text-sm text-slate-800 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                  {JSON.stringify(secretKey, null, 2)}
                </pre>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(secretKey, null, 2));
                    alert('✅ Secret key copied to clipboard!');
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy to Clipboard
                </button>
                <button 
                  onClick={() => router.push('/')}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Continue to Forum
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </React.Fragment>
  );
};

export default JoinNSPage;