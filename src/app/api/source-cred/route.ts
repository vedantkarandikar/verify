// src/app/api/source-cred/route.ts
import { NextResponse } from "next/server";

const AGENT =
  process.env.FLUO_AGENT_ID_SOURCE_CRED ?? "agent-ZIRfFcdyMusVYfhOXc";
const TIMEOUT_MS = 20000;

function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeout = TIMEOUT_MS
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.claim_id || !Array.isArray(body.domains)) {
      return NextResponse.json(
        { error: "Missing claim_id or domains[]" },
        { status: 400 }
      );
    }

    const FLUO_API_KEY = process.env.FLUO_API_KEY;
    const FLUO_PROJECT_ID = process.env.FLUO_PROJECT_ID;
    if (!FLUO_API_KEY || !FLUO_PROJECT_ID) {
      console.error("Missing Fluo env vars");
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const upstreamUrl = `https://api.fluo.one/api/v1/agents/${AGENT}/run`;

    const fluoQuery = JSON.stringify({
      claim_id: body.claim_id,
      domains: body.domains,
    });

    const resp = await fetchWithTimeout(
      upstreamUrl,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": FLUO_API_KEY,
          "x-project-id": FLUO_PROJECT_ID,
        },
        body: JSON.stringify({ query: fluoQuery }),
      },
      TIMEOUT_MS
    );

    const contentType = resp.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await resp.json();
      return NextResponse.json(json, { status: resp.status });
    } else {
      const text = await resp.text();
      return new NextResponse(text, {
        status: resp.status,
        headers: { "Content-Type": contentType || "text/plain" },
      });
    }
  } catch (err: any) {
    console.error("/api/source-cred error", err);
    return NextResponse.json(
      {
        error:
          err?.name === "AbortError"
            ? "Upstream timed out"
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}
