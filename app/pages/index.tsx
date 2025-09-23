import React from "react";
import Head from "next/head";
import MessageList from "../components/message-list";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>AnonSchool - Anonymous Posts</title>
      </Head>

      <div className="home-page">
        <div className="article">
          <h1 className="article-title">AnonSchool</h1>
          <p>Post messages anonymously, only open to NS members. Verified with ZK proofs.</p>
        </div>
        <MessageList showMessageForm />
      </div>
    </>
  );
}
