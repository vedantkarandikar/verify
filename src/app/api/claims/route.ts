// src/app/api/factcheck-run/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = body?.query;
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'query' in body" },
        { status: 400 }
      );
    }

    const FLUO_API_KEY = process.env.FLUO_API_KEY;
    const FLUO_PROJECT_ID = process.env.FLUO_PROJECT_ID;
    const FLUO_AGENT_ID = "agent-0rpKkKttamHK9WnJaN";

    if (!FLUO_API_KEY || !FLUO_PROJECT_ID || !FLUO_AGENT_ID) {
      console.error("Missing Fluo configuration");
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const upstreamUrl = `https://api.fluo.one/api/v1/agents/${FLUO_AGENT_ID}/run`;

    const resp = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": FLUO_API_KEY,
        "x-project-id": FLUO_PROJECT_ID,
      },
      body: JSON.stringify({ query }),
    });

    const text = await resp.text();
    return new NextResponse(text, {
      status: resp.status,
      headers: {
        "Content-Type": resp.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    console.error("factcheck-run proxy error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
