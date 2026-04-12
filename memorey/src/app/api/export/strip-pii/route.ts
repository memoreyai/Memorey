import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json(
      { error: "Server misconfiguration." },
      { status: 500 }
    );
  }

  const anonClient = createClient(url, anon);
  const {
    data: { user },
  } = await anonClient.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await checkRateLimit(`export-strip-pii:${user.id}`, 10, 60)).allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Content required" },
      { status: 400 }
    );
  }

  const content = body.content;
  if (!content || typeof content !== "string") {
    return NextResponse.json(
      { error: "Content required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "PII stripping not configured" },
      { status: 503 }
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are a PII (Personally Identifiable Information) detector and remover.

Analyze this text and remove all PII. Replace each piece of PII with a
placeholder in square brackets describing what was removed.

PII to detect and remove:
- Full names of real people (e.g. "Vikram Mehta" → "[PERSON NAME]")
- Phone numbers (e.g. "+91 98765 43210" → "[PHONE NUMBER]")
- Email addresses (e.g. "vikram@example.com" → "[EMAIL]")
- Physical addresses and locations (e.g. "123 MG Road, Bengaluru" → "[ADDRESS]")
- Financial data (account numbers, specific salary figures, credit card numbers)
- Medical information (diagnoses, medications, health conditions)
- Dates of birth and specific ages

Return a JSON object with exactly these fields:
{
  "stripped": "the full text with all PII replaced by placeholders",
  "removedItems": [
    { "type": "PERSON NAME", "original": "Vikram Mehta", "replacement": "[PERSON NAME]" },
    { "type": "EMAIL", "original": "vikram@example.com", "replacement": "[EMAIL]" }
  ]
}

Only return the JSON. No explanation, no markdown, no preamble.

Text to process:
${content}`,
      },
    ],
  });

  const first = response.content[0];
  const text =
    first && typeof first === "object" && "text" in first
      ? (first as { text: string }).text
      : "{}";

  try {
    const result = JSON.parse(text.replace(/```json|```/g, "").trim()) as {
      stripped?: string;
      removedItems?: Array<{
        type: string;
        original: string;
        replacement: string;
      }>;
    };
    return NextResponse.json({
      stripped: result.stripped ?? content,
      removedItems: result.removedItems ?? [],
    });
  } catch {
    return NextResponse.json({
      stripped: content,
      removedItems: [],
    });
  }
  } catch (err) {
    console.error("[export/strip-pii]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
