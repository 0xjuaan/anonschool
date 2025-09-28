import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

export default function AdminPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("adminToken") || "";
    const isEnabled = localStorage.getItem("adminEnabled") === "true";
    setToken(stored);
    setEnabled(isEnabled);
  }, []);

  async function enable() {
    try {
      setMessage("");
      const resp = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: token }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        setMessage(e.error || "Login failed");
        setEnabled(false);
        return;
      }
      // Mark UI state as enabled; cookie is already set by server
      localStorage.setItem("adminEnabled", "true");
      setEnabled(true);
      setMessage("Admin mode enabled. You can now delete posts on the homepage.");
    } catch (e) {
      setMessage("Login failed");
    }
  }

  function disable() {
    // clear UI flag; cookie expires by time or can be cleared by closing browser
    localStorage.removeItem("adminEnabled");
    setEnabled(false);
    setMessage("Admin mode disabled.");
  }

  return (
    <>
      <Head>
        <title>Admin Controls - AnonSchool</title>
      </Head>
      <div className="min-h-screen bg-slate-50 py-8 px-4 sm:py-12">
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Admin Controls</h1>
            <p className="text-slate-600 mb-6 text-sm">
              This page is not linked publicly. Enter the admin delete token to enable local admin mode.
              Delete actions are authorized server-side using this token; normal users cannot delete posts.
            </p>

            <label className="block text-sm font-semibold text-slate-700 mb-2">Admin Delete Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
              placeholder="Enter ADMIN_DELETE_TOKEN"
            />

            <div className="flex gap-3">
              <button
                onClick={enable}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all"
              >
                Enable Admin Mode
              </button>
              <button
                onClick={disable}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all"
              >
                Disable
              </button>
              <button
                onClick={() => router.push("/")}
                className="ml-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-all"
              >
                Back Home
              </button>
            </div>

            {message && (
              <div className="mt-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
                {message}
              </div>
            )}

            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800 text-xs">
              <p className="font-medium mb-1">Important</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Only users with this token (stored locally) will see delete controls.</li>
                <li>The API verifies the token on every delete request.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


