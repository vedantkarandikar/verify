"use client";

import React, { useState } from "react";
import { FactChecker } from "@/components/factchecker";
import Script from "next/script";

export default function Home() {
  const [initialText, setInitialText] = useState("");

  return (
    <main className="min-h-screen bg-background flex flex-col p-6">
      <div className="w-full max-w-4xl mx-auto flex-grow flex items-center justify-center">
        {/* Top card */}
        <section
          className="rounded-2xl shadow-lg p-6 md:p-10 bg-white/95 backdrop-blur-sm w-full"
          aria-labelledby="hero-title"
        >
          <header className="text-center mb-6">
            <h1
              id="hero-title"
              className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight text-gray-900"
            >
              Verify posts before you share
            </h1>
            <p className="mt-3 text-lg md:text-xl text-gray-700 max-w-2xl mx-auto">
              Paste a URL or some text to check claims and see supporting or
              refuting evidence.
            </p>
          </header>

          {/* FactChecker component area */}
          <div className="mt-6">
            <FactChecker
              initialText={initialText}
              aria-label="Fact checker input"
            />
          </div>

          <div className="mt-6 text-sm text-gray-600 justify-center text-center max-w-md mx-auto">
            <p>
              Always review the sources and evidence provided before drawing
              conclusions. AI may not always be accurate.
            </p>
          </div>
        </section>
      </div>

      {/* Sticky footer */}
      <footer className="mt-auto text-center text-sm text-gray-500 py-4">
        Made with ❤️ by{" "}
        <a
          href="https://vdnt.dev?utm_source=verify_app"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Vedant
        </a>{" "}
        | Powered by{" "}
        <a
          href="https://fluo.one?utm_source=verify_app"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Fluo
        </a>
      </footer>
    </main>
  );
}
