"use client";

import React from "react";
import dynamic from "next/dynamic";

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <main className="container">
      <div className="content">{children}</div>
    </main>
  );
};

const LayoutClient = dynamic(() => Promise.resolve(Layout), {
  ssr: false,
});

export default LayoutClient;
