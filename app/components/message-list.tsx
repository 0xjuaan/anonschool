"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { fetchMessages } from "../lib/api";
import MessageCard from "./message-card";
import { SignedMessageWithProof } from "../lib/types";
import MessageForm from "./message-form";
import NSMessageForm from "./ns-message-form";

const MESSAGES_PER_PAGE = 30;
const INITIAL_POLL_INTERVAL = 10000; // 10 seconds
const MAX_POLL_INTERVAL = 100000; // 100 seconds

type MessageListProps = {
  isInternal?: boolean;
  showMessageForm?: boolean;
  groupId?: string;
};

const MessageList: React.FC<MessageListProps> = ({
  isInternal,
  showMessageForm,
  groupId,
}) => {
  // State
  const [messages, setMessages] = useState<SignedMessageWithProof[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [pollInterval, setPollInterval] = useState(INITIAL_POLL_INTERVAL);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'likes'>('recent');
  const [displayLimit, setDisplayLimit] = useState(4);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // Refs
  const observer = useRef<IntersectionObserver | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  // Ref to keep track of the last message element (to load more messages on scroll)
  const lastMessageElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMessages(messages[messages.length - 1]?.timestamp.getTime());
        }
      });
      if (node) observer.current.observe(node);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, loading, hasMore]
  );

  // Cached helpers
  const loadMessages = useCallback(
    async (beforeTimestamp: number | null = null) => {
      if (isInternal && !groupId) return;
      setLoading(true);

      try {
        const fetchedMessages = await fetchMessages({
          isInternal: !!isInternal,
          limit: MESSAGES_PER_PAGE,
          beforeTimestamp,
          groupId,
        });

        const existingMessageIds: Record<string, boolean> = {};
        messages.forEach((m) => {
          existingMessageIds[m.id!] = true;
        });
        const cleanedMessages = fetchedMessages.filter(
          (m: SignedMessageWithProof) => !existingMessageIds[m.id!]
        );

        setMessages((prevMessages) => [...prevMessages, ...cleanedMessages]);
        setHasMore(fetchedMessages.length === MESSAGES_PER_PAGE);
      } catch (error) {
        setError((error as Error)?.message);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupId, isInternal]
  );

  const checkForNewMessages = useCallback(async () => {
    if (isInternal && !groupId) return;

    try {
      const newMessages = await fetchMessages({
        groupId,
        isInternal: !!isInternal,
        limit: MESSAGES_PER_PAGE,
        afterTimestamp: messages[0]?.timestamp.getTime(),
      });

      if (newMessages.length > 0) {
        setMessages((prevMessages) => [...newMessages, ...prevMessages]);
        setPollInterval(INITIAL_POLL_INTERVAL);
      } else {
        setPollInterval((prevInterval) =>
          Math.min(prevInterval + 10000, MAX_POLL_INTERVAL)
        );
      }
    } catch (error) {
      console.error("Error checking for new messages:", error);
    }
  }, [groupId, isInternal, messages]);

  // Effects
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const startPolling = () => {
      intervalId = setInterval(() => {
        if (messageListRef.current && messageListRef.current.scrollTop === 0) {
          checkForNewMessages();
        }
      }, pollInterval);
    };

    startPolling();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pollInterval, checkForNewMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Handlers
  function onNewMessageSubmit(signedMessage: SignedMessageWithProof) {
    setMessages((prevMessages) => [signedMessage, ...prevMessages]);
  }

  function handleLikeCountChange(messageId: string, count: number) {
    setLikeCounts((prev) => ({ ...prev, [messageId]: count }));
  }

  // Render helpers
  function renderLoading() {
    return (
      <div className="skeleton-loader">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="message-card-skeleton">
            <div className="message-card-skeleton-header">
              <div className="skeleton-text skeleton-short"></div>
            </div>
            <div className="skeleton-text skeleton-long mt-1"></div>
            <div className="skeleton-text skeleton-long mt-05"></div>
          </div>
        ))}
      </div>
    );
  }

  function renderNoMessages() {
    if (!groupId) return null;

    return (
      <div className="article text-center">
        <p className="title">No messages yet</p>
        <p className="mb-05">
          Are you a member of <span>{groupId}</span>?
        </p>
        {!isInternal ? (
          <p>
            Head over to the <Link href="/">homepage</Link> to send an anonymous
            message by proving you are a member of <span>{groupId}</span>!
          </p>
        ) : (
          <p>
            No messages yet. Be the first one to send anonymous messages to your
            teammates.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {showMessageForm && (
        isInternal ? (
          <MessageForm isInternal={true} onSubmit={onNewMessageSubmit} />
        ) : (
          <NSMessageForm onSubmit={onNewMessageSubmit} />
        )
      )}

      <div className="flex items-center justify-end px-4 py-2 border-b border-slate-200">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Sort by:</span>
          <button
            onClick={() => setSortBy('recent')}
            className={`px-3 py-1 rounded-md transition-colors ${
              sortBy === 'recent'
                ? 'bg-indigo-100 text-indigo-700'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => setSortBy('oldest')}
            className={`px-3 py-1 rounded-md transition-colors ${
              sortBy === 'oldest'
                ? 'bg-indigo-100 text-indigo-700'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            Oldest
          </button>
          <button
            onClick={() => setSortBy('likes')}
            className={`px-3 py-1 rounded-md transition-colors ${
              sortBy === 'likes'
                ? 'bg-indigo-100 text-indigo-700'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            Most Liked
          </button>
        </div>
      </div>

      <div className="message-list" ref={messageListRef}>
        {[...messages]
          .sort((a, b) => {
            if (sortBy === 'recent') {
              return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            } else if (sortBy === 'oldest') {
              return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            } else {
              // likes
              const aLikes = likeCounts[a.id!] ?? a.likes ?? 0;
              const bLikes = likeCounts[b.id!] ?? b.likes ?? 0;
              return bLikes - aLikes;
            }
          })
          .slice(0, displayLimit)
          .map((message, index) => (
            <div
              key={message.id || index}
              ref={index === messages.length - 1 ? lastMessageElementRef : null}
            >
              <MessageCard
                message={message as SignedMessageWithProof}
                isInternal={isInternal}
                onLikeCountChange={handleLikeCountChange}
              />
            </div>
          ))}
        {loading && renderLoading()}
        {!loading && !error && messages.length === 0 && renderNoMessages()}
        
        {/* Show More Button */}
        {messages.length > displayLimit && (
          <div className="text-center py-6 border-t border-slate-100">
            <button
              onClick={() => setDisplayLimit(prev => prev + 7)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 
                       text-slate-600 font-medium rounded-xl hover:bg-slate-50 hover:border-slate-300 
                       transition-all shadow-sm hover:shadow"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
              Show More Messages
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
    </>
  );
};

export default MessageList;
