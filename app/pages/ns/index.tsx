import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ensureIdentity, getIdCommitmentString, postAnonymousMessage } from "../../lib/ns-client";

type FeedItem = {
  id: string;
  text: string;
  timestamp: string;
  group_id: string;
  group_provider: string;
  likes: number;
};

const NSForumPage: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [joinNeeded, setJoinNeeded] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    // Load feed
    fetch("/api/feed")
      .then((r) => r.json())
      .then((j) => setItems(j.items || []))
      .catch(() => setItems([]));


    async function checkJoinStatus() {
      // Check if identity exists
      try {
        const id = ensureIdentity();
        const c = getIdCommitmentString(id);

        // to check membership, we use semaphore to find out
        // if the proof is valid, then the user is a member
        const res = await fetch(`/api/group/proof?idCommitment=${encodeURIComponent(c)}`);
        if (!res.ok) {
          setJoinNeeded(true);
          return;
        }

        const hasMembership = res.ok;
          setJoinNeeded(!hasMembership);
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
      const res = await postAnonymousMessage(id, text.trim());
      setStatus("Posted!");
      setText("");
      // refresh feed
      fetch("/api/feed").then((r) => r.json()).then((j) => setItems(j.items || [])).catch(() => {});
    } catch (e: any) {
      setStatus(e?.message || "Post failed");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: 20 }}>
      <h1>AnonSchool</h1>
      <p>Post anonymously if you've joined via your acceptance email.</p>
      {!ready ? (
        <p>Loading...</p>
      ) : joinNeeded ? (
        <p>
          To post, you need to join first. Go to the <Link href="/join">Join Page</Link>.
        </p>
      ) : (
        <div style={{ margin: "16px 0" }}>
          <textarea
            placeholder="Share your feedback..."
            rows={3}
            maxLength={280}
            style={{ width: "100%" }}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={onPost} disabled={posting || text.trim().length === 0}>
              {posting ? "Posting..." : "Post"}
            </button>
            {status && <span>{status}</span>}
          </div>
        </div>
      )}

      <h2>Recent Posts</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((it) => (
          <li key={it.id} style={{ borderBottom: "1px solid #eee", padding: "12px 0" }}>
            <div style={{ fontSize: 14, color: "#666" }}>{new Date(it.timestamp).toLocaleString()}</div>
            <div style={{ fontSize: 16 }}>{it.text}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NSForumPage;

