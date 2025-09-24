// src/app/api/claim-assess/route.ts
import { NextResponse } from "next/server";

const AGENT = process.env.FLUO_AGENT_ID_ASSESS ?? "agent-UmeIQIjx2QahQJfcT0";
const TIMEOUT_MS = 25000;

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
    if (!body || (!body.claim && !body.query) || !body.claim_id) {
      return NextResponse.json(
        { error: "Missing claim_id and claim/query" },
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

    // The example you gave uses `claim_id` AND a `query` that is a short instruction string.
    // We'll forward both; prefer sending { claim_id, query } as raw body fields inside the "query" string, matching your example.
    const fluoQuery =
      typeof body.query === "string"
        ? body.query
        : String(body.query ?? `Verify: ${body.claim}`);

    // If the agent expects { claim_id, query } as a JSON string, you can wrap as below:
    // const fluoQuery = JSON.stringify({ claim_id: body.claim_id, query: fluoQuery });

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
        body: JSON.stringify({ claim_id: body.claim_id, query: fluoQuery }),
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
    console.error("/api/claim-assess error", err);
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
