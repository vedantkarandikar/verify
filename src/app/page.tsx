"use client";

import React, { useState } from "react";
import { FactChecker } from "@/components/factchecker";

export default function Home() {
  const [initialText, setInitialText] = useState("");

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Top card */}
        <section
          className="rounded-2xl shadow-lg p-6 md:p-10 bg-white/95 backdrop-blur-sm"
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
            {/* Pass simple props if FactChecker supports them (graceful if ignored) */}
            <FactChecker
              initialText={initialText}
              aria-label="Fact checker input"
            />
          </div>

          {/* accessibility + small footer */}
          <div className="mt-6 text-sm text-gray-600">
            <p>
              Tip: Use your browser's zoom (Cmd/Ctrl + / -) to increase text
              size.
            </p>
          </div>
        </section>

        {/* Subtle footer for trust */}
        <footer className="mt-6 text-center text-xs text-gray-500">
          This tool provides automated assistance and links to sources — it is
          not a substitute for professional advice.
        </footer>
      </div>
    </main>
  );
}
