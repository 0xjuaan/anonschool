import React, { useState, useEffect } from "react";
import Head from "next/head";
import MessageList from "../components/message-list";
import { loadIdentity } from "../lib/ns-client";

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    // Check authentication status on client side only
    const identity = loadIdentity();
    setIsAuthenticated(!!identity);
  }, []);

  return (
    <>
      <Head>
        <title>AnonSchool - Anonymous Posts</title>
      </Head>

      <div className="min-h-screen bg-slate-50 py-8 px-4 sm:py-12">
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              AnonSchool
            </h1>
            <p className="text-slate-600 text-lg mb-6">
              Post messages anonymously, only open to NS members. Verified and private using ZK proofs.
            </p>
            
            <div className="flex justify-center items-center gap-4 mb-6">
              {/* Only show buttons if user is not authenticated */}
              {isAuthenticated === false && (
                <>
                  <a 
                    href="/join" 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 
                               text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl 
                               transform hover:-translate-y-0.5"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" 
                      />
                    </svg>
                    Join AnonSchool
                  </a>
                  <a 
                    href="/recover" 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-700 
                               text-white font-semibold rounded-xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    Recover Account
                  </a>
                </>
              )}
              
              {/* How It Works Button */}
              <button
                onClick={() => setShowHowItWorks(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 
                           hover:bg-slate-100 rounded-lg transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How it works
              </button>
            </div>
          </header>

          {/* How It Works Modal */}
          {showHowItWorks && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">
                      How It Works
                    </h2>
                    <button
                      onClick={() => setShowHowItWorks(false)}
                      className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors"
                    >
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <p className="text-slate-600 mb-8 text-center">
                    Anonymous messaging powered by zero-knowledge proofs
                  </p>

                  <div className="space-y-6">
                    {/* Step 1 */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          1. Upload Email
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          Upload your Network School acceptance email (.eml file) to generate a ZK proof that you're a verified member.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          2. Anonymous Identity
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          A unique anonymous commitment is created and added to the verified member set, without revealing your real identity.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          3. Post Anonymously
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          Share messages anonymously while proving you're a verified member, without anyone knowing who you are.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Privacy Note */}
                  <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-slate-700 font-medium mb-1">
                          🔐 Privacy Guaranteed
                        </p>
                        <p className="text-xs text-slate-600">
                          Zero-knowledge proofs ensure your identity remains completely private while proving your membership authenticity.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <MessageList showMessageForm />
          </div>
        </div>
      </div>
    </>
  );
}
