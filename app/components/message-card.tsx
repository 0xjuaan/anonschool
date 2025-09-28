import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import TimeAgo from "javascript-time-ago";
import Link from "next/link";
import IonIcon from "@reacticons/ionicons";
import type { SignedMessageWithProof } from "../lib/types";
import { generateNameFromPubkey } from "../lib/utils";
import { setMessageLiked, isMessageLiked } from "../lib/store";
import { fetchMessage, toggleLike, checkLikeStatus, getLikeCount } from "../lib/api";
import { hasEphemeralKey } from "../lib/ephemeral-key";
import { loadIdentity } from "../lib/ns-client";
import { verifyMessage } from "../lib/core";
import { Providers } from "../lib/providers";
import Head from "next/head";

interface MessageCardProps {
  message: SignedMessageWithProof;
  isInternal?: boolean;
}

type VerificationStatus = "idle" | "verifying" | "valid" | "invalid" | "error";


const MessageCard: React.FC<MessageCardProps> = ({ message, isInternal }) => {
  const timeAgo = useRef(new TimeAgo("en-US")).current;

  const provider = Providers[message.anonGroupProvider];
  const anonGroup = provider.getAnonGroup(message.anonGroupId);

  // States
  const [likeCount, setLikeCount] = useState(message.likes || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("idle");
  const [likeStatusLoading, setLikeStatusLoading] = useState(true);

  const isGroupPage = window.location.pathname === `/${provider.getSlug()}/${message.anonGroupId}`;
  const isMessagePage = window.location.pathname === `/messages/${message.id}`;

  // Check like status and count on mount
  useEffect(() => {
    async function loadLikeData() {
      try {
        setLikeStatusLoading(true);
        
        // Load both like status and count in parallel
        const [liked, count] = await Promise.all([
          checkLikeStatus(message.id),
          getLikeCount(message.id)
        ]);
        
        setIsLiked(liked);
        setLikeCount(count);
      } catch (error) {
        console.error('Failed to load like data:', error);
        // Fallback to local storage if server check fails
        setIsLiked(isMessageLiked(message.id));
        // Keep the original like count from message.likes as fallback
      } finally {
        setLikeStatusLoading(false);
      }
    }

    loadLikeData();
  }, [message.id]);

  // Handlers
  async function onLikeClick() {
    try {
      const newIsLiked = !isLiked;

      // Optimistic update
      setIsLiked(newIsLiked);
      setLikeCount((prev: number) => (newIsLiked ? prev + 1 : prev - 1));
      setMessageLiked(message.id, newIsLiked);

      // Toggle like on server
      await toggleLike(message.id);
      
      // Refresh like count from server to ensure accuracy
      const actualCount = await getLikeCount(message.id);
      setLikeCount(actualCount);
    } catch (error) {
      console.error('Like toggle failed:', error);
      // Revert optimistic update
      setIsLiked(isLiked);
      setLikeCount(likeCount);
      setMessageLiked(message.id, isLiked);
    }
  }

  async function onVerifyClick() {
    setVerificationStatus("verifying");

    try {
      const fullMessage = await fetchMessage(message.id, message.internal);
      const isValid = await verifyMessage(fullMessage);

      setVerificationStatus(isValid ? "valid" : "invalid");
    } catch (error) {
      console.error("Verification failed:", error);
      setVerificationStatus("error");
    }
  }

  // Render Helpers
  function renderLogo() {
    if (isInternal) {
      return null;
    }

    const logoImg = (
      <Image
        src={anonGroup.logoUrl}
        alt={anonGroup.title}
        width={40}
        height={40}
      />
    );

    // Redirect to group page on logo click if not already on it
    if (!isGroupPage) {
      return (
        <Link
          href={`/${provider.getSlug()}/${message.anonGroupId}`}
          className="message-card-header-logo"
        >
          {logoImg}
        </Link>
      );
    }

    return <div className="message-card-header-logo">{logoImg}</div>;
  }

  function renderSender() {
    const timestampComponent = (
      <span
        className="message-card-header-timestamp"
        title={message.timestamp.toLocaleString()}
      >
        {timeAgo.format(new Date(message.timestamp))}
      </span>
    );

    if (isInternal) {
      return (
        <div className="message-card-header-sender-name internal">
          <span>{generateNameFromPubkey(message.ephemeralPubkey.toString())}</span>
          {timestampComponent}
        </div>
      );
    }

    return (
      <span>
        <div className="message-card-header-sender-text">
          <span>Someone from</span>
        </div>
        <div className="message-card-header-sender-name">
          {isGroupPage ? (
            <span>{anonGroup.title}</span>
          ) : (
            <Link href={`https://ns.com`}>{anonGroup.title}</Link>
          )}

          {isMessagePage ? (
            timestampComponent
          ) : (
            <Link href={`/messages/${message.id}`}>{timestampComponent}</Link>
          )}
        </div>
      </span>
    );
  }

  function renderVerificationStatus() {
    if (verificationStatus === "idle") {
      return (
        <span className="message-card-verify-button" onClick={onVerifyClick}>
          Verify
        </span>
      );
    }

    return (
      <span className={`message-card-verify-status ${verificationStatus}`}>
        {verificationStatus === "verifying" && (
          <span className="message-card-verify-icon spinner-icon small"></span>
        )}
        {verificationStatus === "valid" && (
          <span className="message-card-verify-icon valid">
            <IonIcon name="checkmark-outline" />
          </span>
        )}
        {verificationStatus === "invalid" && (
          <span className="message-card-verify-icon invalid">
            <IonIcon name="close-outline" />
          </span>
        )}
        {verificationStatus === "error" && (
          <span className="message-card-verify-icon error">
            <IonIcon name="alert-outline" />
          </span>
        )}
      </span>
    );
  }

  // Render
  return (
    <div className="message-card">
      <header className="message-card-header">
        <div className="message-card-header-sender">
          {renderLogo()}
          {renderSender()}
        </div>

        {renderVerificationStatus()}
      </header>

      <main className="message-card-content">{message.text}</main>

      <div className="message-card-footer">
        <div className="like-button-container">
          <button
            onClick={onLikeClick}
            disabled={!loadIdentity() || likeStatusLoading}
            className={`like-button ${isLiked ? "liked" : ""} ${likeStatusLoading ? "loading" : ""}`}
          >
            {likeStatusLoading ? (
              <span className="like-loading-icon spinner-icon small"></span>
            ) : (
              <IonIcon name={isLiked ? "heart" : "heart-outline"} />
            )}
            <span className="like-count">{likeCount}</span>
          </button>
          {/* Admin delete (visible when admin session cookie exists; UI flag gates visibility) */}
          {typeof window !== 'undefined' && localStorage.getItem('adminEnabled') === 'true' && (
            <button
              onClick={async () => {
                try {
                  const resp = await fetch(`/api/messages/${message.id}`, { method: 'DELETE' });
                  if (!resp.ok) throw new Error('Delete failed');
                  window.location.reload();
                } catch (e) {
                  console.error(e);
                  alert('Failed to delete message');
                }
              }}
              className="ml-2 text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageCard;
