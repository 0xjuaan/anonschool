import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ensureIdentity, getIdCommitmentString, postAnonymousMessage } from "../lib/ns-client";
import type { SignedMessageWithProof } from "../lib/types";

type NSMessageFormProps = {
  onSubmit: (message: SignedMessageWithProof) => void;
};

const NSMessageForm: React.FC<NSMessageFormProps> = ({ onSubmit }) => {
  const [ready, setReady] = useState(false);
  const [joinNeeded, setJoinNeeded] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function checkJoinStatus() {
      try {
        const id = ensureIdentity();
        const c = getIdCommitmentString(id);
        const res = await fetch(`/api/group/proof?idCommitment=${encodeURIComponent(c)}`);
        setJoinNeeded(!res.ok);
      } catch {
        setJoinNeeded(true);
      }
    }
    checkJoinStatus();
    setReady(true);
  }, []);

  async function onPost() {
    if (!text.trim()) return;
    try {
      setPosting(true);
      setStatus("Building proof...");
      const id = ensureIdentity();
      const message = await postAnonymousMessage(id, text.trim());
      setStatus("Posted!");
      setText("");
      onSubmit(message);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Post failed");
    } finally {
      setPosting(false);
    }
  }

  if (!ready) {
    return (
      <div className="message-form">
        <div className="skeleton-loader">
          <div className="message-card-skeleton">
            <div className="message-card-skeleton-header">
              <div className="skeleton-text skeleton-short"></div>
            </div>
            <div className="skeleton-text skeleton-long mt-1"></div>
          </div>
        </div>
      </div>
    );
  }

  if (joinNeeded) {
    return (
      <div className="message-form">
        <div className="text-center py-6">
          <div className="flex justify-center gap-4">
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-form">
      <textarea
        placeholder="Share your thoughts anonymously..."
        rows={3}
        maxLength={280}
        className="message-form-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="message-form-footer">
        <button 
          className={`inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 
                     text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl 
                     transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed 
                     disabled:transform-none disabled:shadow-lg min-w-[100px] ${posting ? 'loading' : ''}`}
          onClick={onPost} 
          disabled={posting || text.trim().length === 0}
        >
          {posting ? (
            <span className="spinner-icon small"></span>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M13 7l5 5m0 0l-5 5m5-5H6" 
                />
              </svg>
              Post
            </>
          )}
        </button>
        {status && <span className="message-form-status">{status}</span>}
      </div>
    </div>
  );
};

export default NSMessageForm;
