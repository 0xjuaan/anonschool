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
        <div className="article text-center">
          <p className="mb-05">
          To post, you need to join first. Go to the <Link href="/join">Join Page</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-form">
      <textarea
        placeholder="Share your feedback..."
        rows={3}
        maxLength={280}
        className="message-form-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="message-form-footer">
        <button 
          className={`message-form-submit ${posting ? 'loading' : ''}`}
          onClick={onPost} 
          disabled={posting || text.trim().length === 0}
        >
          {posting ? (
            <span className="spinner-icon small"></span>
          ) : (
            "Post"
          )}
        </button>
        {status && <span className="message-form-status">{status}</span>}
      </div>
    </div>
  );
};

export default NSMessageForm;
