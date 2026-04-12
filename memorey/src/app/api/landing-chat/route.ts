import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rateLimit";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

const SYSTEM = `You are Memorey's AI memory assistant on the marketing site. Extract memory nodes from what the user shares.

Vaults (use these keys only): personal, work, health, lifestyle, study, finance

Respond with valid JSON only — no markdown fences:
{"reply":"Warm 1-2 sentence acknowledgment","nodes":[{"label":"Max 4 words","vault":"personal|work|health|lifestyle|study|finance","detail":"Description"}]}

Extract 2-5 nodes. Be specific.`;

function mockResponse(userText: string) {
  const snippet = userText.slice(0, 80).replace(/"/g, "'");
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          reply:
            "Thanks for sharing — I've mapped a few nodes you could add to your graph.",
          nodes: [
            {
              label: "About you",
              vault: "personal",
              detail: snippet || "Something you shared about yourself",
            },
            {
              label: "Current focus",
              vault: "work",
              detail: "Demo mode — add ANTHROPIC_API_KEY for real extraction.",
            },
          ],
        }),
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (
      !(await checkRateLimit(`landing-chat:${ip}`, 2, 60)).allowed ||
      !(await checkRateLimit("landing-chat:global", 60, 60)).allowed
    ) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    let body: { messages?: { role: string; content: string }[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (Array.isArray(body.messages) && body.messages.length > 20) {
      return NextResponse.json(
        { error: "Conversation too long" },
        { status: 400 }
      );
    }

    const raw = body.messages ?? [];
    const messages = raw
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: typeof m.content === "string" ? m.content.slice(0, 2000) : "",
      }));

    if (messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    if (!apiKey) {
      const last = messages.filter((m) => m.role === "user").pop()?.content ?? "";
      return NextResponse.json(mockResponse(last));
    }

    const model =
      process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: SYSTEM,
        messages,
      }),
    });

    if (!response.ok) {
      console.error("[landing-chat] Anthropic error:", response.status);
      return NextResponse.json(
        { error: "AI service unavailable" },
        { status: 502 }
      );
    }
    const data: unknown = await response.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (err) {
    console.error("[landing-chat]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
