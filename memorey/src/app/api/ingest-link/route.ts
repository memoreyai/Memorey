import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import type { ProposedNode } from "@/types/memorey";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FREE_SHARE_LINKS_PER_MONTH,
  currentYearMonth,
  isProPlan,
} from "@/lib/billing/limits";
import {
  getEffectivePlan,
  getMonthlyUsage,
  incrementShareLinkUsage,
} from "@/lib/billing/usage";
import { checkRateLimit } from "@/lib/rateLimit";

const SYSTEM_EXTRACT = `Extract memory nodes from this AI conversation. Return ONLY a valid JSON array.
No markdown. No explanation. No preamble. Just the JSON array.

Each node must have exactly these fields:
{
  category: one of [Work, Goals, Personal, Health, Finance, Study, Relationships, Preferences],
  title: string (max 10 words, factual, present tense. e.g. 'Prefers TypeScript over JavaScript'),
  value: string (max 80 words, the actual information clearly stated),
  confidence: number (0.0-1.0, how clearly stated vs inferred)
}

Rules:
- Maximum 8 nodes. Choose highest signal information only.
- Ignore: greetings, meta-questions about the AI, small talk.
- Prefer explicit statements over inferences.
- confidence 0.9+ = directly stated. 0.7-0.9 = clearly implied. Below 0.7 = inferred.`;

const CATEGORIES: Set<string> = new Set([
  "Work",
  "Goals",
  "Personal",
  "Health",
  "Finance",
  "Study",
  "Relationships",
  "Preferences",
]);

function normalizeHost(host: string): string {
  return host.replace(/^www\./, "").toLowerCase();
}

function isAllowedIngestUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = normalizeHost(u.hostname);
    const path = u.pathname;
    if (h === "chat.openai.com" && path.startsWith("/share/")) return true;
    if (h === "chatgpt.com" && path.startsWith("/share/")) return true;
    if (h === "claude.ai" && path.startsWith("/share/")) return true;
    if (h === "gemini.google.com") return true;
    if (h === "perplexity.ai") return true;
    return false;
  } catch {
    return false;
  }
}

function extractConversationHtml(html: string): string {
  const $ = cheerio.load(html);

  // ── Strategy 1: ChatGPT server-rendered data attributes ──
  const domTurns: string[] = [];
  $(
    '[data-message-author-role="user"], [data-message-author-role="assistant"]'
  ).each((_, el) => {
    const role = $(el).attr("data-message-author-role");
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text && (role === "user" || role === "assistant")) {
      domTurns.push(`${role === "user" ? "User" : "Assistant"}: ${text}`);
    }
  });
  if (domTurns.length > 0) {
    console.log(`[ingest-link] extraction: strategy 1 (data-attributes) found ${domTurns.length} turns`);
    return domTurns.join("\n\n");
  }

  // ── Strategy 2: __NEXT_DATA__ JSON (ChatGPT SSR payload) ──
  const nextDataScript = $("script#__NEXT_DATA__").text();
  if (nextDataScript) {
    try {
      const nextData = JSON.parse(nextDataScript);
      const parts = extractMessagesFromJson(nextData);
      if (parts.length > 0) {
        console.log(`[ingest-link] extraction: strategy 2 (__NEXT_DATA__) found ${parts.length} turns`);
        return parts.join("\n\n");
      }
    } catch (e) {
      console.error("[ingest-link] __NEXT_DATA__ parse error:", e);
    }
  }

  // ── Strategy 3: Inline JSON in <script> tags ──
  const scriptBlocks: string[] = [];
  $("script").each((_, el) => {
    const t = $(el).text();
    if (t.length > 200) scriptBlocks.push(t);
  });
  for (const block of scriptBlocks) {
    // Find JSON objects embedded in script content
    const jsonMatches = block.match(/\{[\s\S]{500,}\}/g);
    if (!jsonMatches) continue;
    for (const candidate of jsonMatches) {
      try {
        const parsed = JSON.parse(candidate);
        const parts = extractMessagesFromJson(parsed);
        if (parts.length > 0) {
          console.log(`[ingest-link] extraction: strategy 3 (inline script JSON) found ${parts.length} turns`);
          return parts.join("\n\n");
        }
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  // ── Strategy 4: <article>, <p> with substantial text ──
  const paras: string[] = [];
  $("article, p").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > 20) paras.push(t);
  });
  if (paras.length > 0) {
    console.log(`[ingest-link] extraction: strategy 4 (p/article) found ${paras.length} blocks`);
    return paras.join("\n\n");
  }

  // ── Strategy 5: Full body text as last resort ──
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  if (bodyText.length > 100) {
    console.log(`[ingest-link] extraction: strategy 5 (body text) ${bodyText.length} chars`);
    return bodyText;
  }

  // Diagnostic logging when everything fails
  console.error(`[ingest-link] All extraction strategies failed.`);
  console.error(`[ingest-link] HTML length: ${html.length}`);
  console.error(`[ingest-link] Title: ${$("title").text()}`);
  console.error(`[ingest-link] Script tags: ${$("script").length}`);
  console.error(`[ingest-link] Has __NEXT_DATA__: ${!!nextDataScript}`);
  console.error(`[ingest-link] First 2000 chars:\n${html.slice(0, 2000)}`);
  return "";
}

/**
 * Recursively walk a JSON tree to find conversation messages.
 * Handles ChatGPT (author.role + content.parts), Claude (sender + text),
 * and generic (role + content) structures.
 */
function extractMessagesFromJson(obj: unknown, depth = 0): string[] {
  if (depth > 20 || !obj || typeof obj !== "object") return [];
  const parts: string[] = [];

  if (Array.isArray(obj)) {
    for (const item of obj) parts.push(...extractMessagesFromJson(item, depth + 1));
    return parts;
  }

  const o = obj as Record<string, unknown>;

  // ChatGPT format: { author: { role }, content: { parts: [string] } }
  if (o.author && typeof o.author === "object" && o.content && typeof o.content === "object") {
    const author = o.author as Record<string, unknown>;
    const content = o.content as Record<string, unknown>;
    const role = author.role as string;
    if ((role === "user" || role === "assistant") && Array.isArray(content.parts)) {
      const text = (content.parts as unknown[])
        .filter((p) => typeof p === "string")
        .join("\n")
        .trim();
      if (text) {
        parts.push(`${role === "user" ? "User" : "Assistant"}: ${text}`);
      }
    }
  }

  // Claude format: { sender: "human"|"assistant", text: "..." }
  if (typeof o.sender === "string" && typeof o.text === "string") {
    const sender = o.sender;
    if ((sender === "human" || sender === "assistant") && o.text.trim()) {
      parts.push(`${sender === "human" ? "User" : "Assistant"}: ${(o.text as string).trim()}`);
    }
  }

  // Generic format: { role: "user"|"assistant", content: "string" }
  if (typeof o.role === "string" && typeof o.content === "string" && o.content.trim()) {
    const role = o.role;
    if (role === "user" || role === "assistant" || role === "human") {
      const label = role === "human" ? "User" : role === "user" ? "User" : "Assistant";
      parts.push(`${label}: ${(o.content as string).trim()}`);
    }
  }

  // Recurse into all values
  if (parts.length === 0) {
    for (const v of Object.values(o)) {
      parts.push(...extractMessagesFromJson(v, depth + 1));
    }
  }

  return parts;
}

function isWhitelistedUrl(urlStr: string): boolean {
  try {
    const h = normalizeHost(new URL(urlStr).hostname);
    return (
      h === "chat.openai.com" ||
      h === "chatgpt.com" ||
      h === "claude.ai" ||
      h === "gemini.google.com" ||
      h === "perplexity.ai"
    );
  } catch {
    return false;
  }
}

function stripPii(text: string): string {
  let s = text;
  s = s.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/gi, "[email]");
  s = s.replace(
    /\b(?:\+?\d{1,3}[-.\s]??)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,6}(?:[-.\s]?\d{2,5})?\b/g,
    "[phone]"
  );
  s = s.replace(/\bhttps?:\/\/[^\s\])"'<>]+/gi, (match) => {
    const trimmed = match.replace(/[.,;:!?)]+$/, "");
    const punct = match.slice(trimmed.length);
    return (isWhitelistedUrl(trimmed) ? trimmed : "[url]") + punct;
  });
  s = s.replace(/\bwww\.[^\s\])"'<>]+/gi, (match) => {
    const trimmed = match.replace(/[.,;:!?)]+$/, "");
    const punct = match.slice(trimmed.length);
    try {
      const full = `https://${trimmed}`;
      return (isWhitelistedUrl(full) ? trimmed : "[url]") + punct;
    } catch {
      return "[url]" + punct;
    }
  });
  return s;
}

function extractMessageText(response: Anthropic.Message): string {
  const blocks = response.content;
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function parseJsonArray(raw: string): unknown[] | null {
  const t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : t;
  const arrMatch = candidate.match(/\[[\s\S]*\]/);
  const jsonStr = arrMatch ? arrMatch[0] : candidate;
  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toProposedNodes(items: unknown[]): {
  nodes: ProposedNode[];
  totalExtracted: number;
} {
  const base = Date.now();
  const nodes: ProposedNode[] = [];
  let i = 0;
  for (const item of items) {
    if (i >= 8) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const cat = typeof o.category === "string" ? o.category.trim() : "";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const value = typeof o.value === "string" ? o.value.trim() : "";
    let conf =
      typeof o.confidence === "number" && !Number.isNaN(o.confidence)
        ? o.confidence
        : 0.75;
    conf = Math.min(1, Math.max(0, conf));
    if (!title || !value) continue;
    const category = CATEGORIES.has(cat) ? cat : "Personal";
    nodes.push({
      tempId: `share-${base}-${i}`,
      category,
      title: title.slice(0, 200),
      newValue: value.slice(0, 500),
      confidence: conf,
      isNew: true,
    });
    i += 1;
  }
  return { nodes, totalExtracted: items.length };
}

function isRateLimitError(e: unknown): boolean {
  return (
    e !== null &&
    typeof e === "object" &&
    "status" in e &&
    (e as { status: number }).status === 429
  );
}

export async function POST(request: Request) {
  try {
  const authHeader = request.headers.get("Authorization");
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    console.error("[ingest-link] EXIT: no bearer token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    console.error("[ingest-link] EXIT: auth failed", authError?.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[ingest-link] Auth OK, user:", user.id);

  if (!(await checkRateLimit(`ingest-link:${user.id}`, 10, 60)).allowed) {
    console.error("[ingest-link] EXIT: rate limited");
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  let body: {
    url?: string;
    userId?: string;
    activeVaultIds?: string[];
    canvasId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    console.error("[ingest-link] EXIT: invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const rawCanvas = body.canvasId;
  const resolvedCanvasId =
    typeof rawCanvas === "string" && rawCanvas.trim().length > 0
      ? rawCanvas.trim()
      : null;

  console.log("[ingest-link] Body parsed — url:", url.slice(0, 80), "userId:", userId.slice(0, 8), "canvasId:", resolvedCanvasId?.slice(0, 8) ?? "null");

  if (!url || userId !== user.id) {
    console.error("[ingest-link] EXIT: url empty or userId mismatch. body.userId:", userId, "session.userId:", user.id);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (resolvedCanvasId) {
    const admin = createAdminClient();
    const { data: cRow } = await admin
      .from("canvases")
      .select("id")
      .eq("user_id", user.id)
      .eq("id", resolvedCanvasId)
      .maybeSingle();
    if (!cRow) {
      return NextResponse.json({ error: "Invalid canvas" }, { status: 400 });
    }
  }

  let billingPlan = "free";
  try {
    const admin = createAdminClient();
    billingPlan = await getEffectivePlan(admin, user.id);
    console.log("[ingest-link] Billing plan:", billingPlan);
    if (!isProPlan(billingPlan)) {
      const ym = currentYearMonth();
      const usage = await getMonthlyUsage(admin, user.id, ym);
      console.log("[ingest-link] Usage for", ym, ":", JSON.stringify(usage));
      if (usage.shareLinkCount >= FREE_SHARE_LINKS_PER_MONTH) {
        console.error("[ingest-link] EXIT: share link limit reached", usage.shareLinkCount, ">=", FREE_SHARE_LINKS_PER_MONTH);
        return NextResponse.json(
          {
            error: `Free plan allows ${FREE_SHARE_LINKS_PER_MONTH} share link imports per month. Upgrade to Pro for unlimited.`,
            code: "SHARE_LINK_LIMIT",
          },
          { status: 403 }
        );
      }
    }
  } catch (e) {
    console.error("[ingest-link] billing check error (continuing):", e);
  }

  if (!isAllowedIngestUrl(url)) {
    console.error("[ingest-link] EXIT: URL not in whitelist:", url);
    return NextResponse.json(
      {
        error:
          "Only share links from ChatGPT (chatgpt.com/share/…), Claude (claude.ai/share/…), Gemini (gemini.google.com), or Perplexity are supported.",
      },
      { status: 400 }
    );
  }

  let html: string;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) {
      const status = res.status;
      console.error(`[ingest-link] fetch failed: ${status} ${res.statusText} for ${url}`);
      if (status === 404) {
        return NextResponse.json(
          { error: "This share link was not found. It may have been deleted or expired." },
          { status: 422 }
        );
      }
      if (status === 403) {
        return NextResponse.json(
          { error: "Access to this share link was blocked by the platform. The link may require authentication or may have been revoked." },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { error: `The platform returned an error (${status}). The link may be expired or temporarily unavailable.` },
        { status: 422 }
      );
    }
    html = await res.text();
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : "";
    console.error(`[ingest-link] fetch exception for ${url}:`, msg);
    if (msg.includes("abort") || msg.includes("timeout")) {
      return NextResponse.json(
        { error: "The request timed out. The platform may be slow — please try again." },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "Could not connect to the platform. Check the URL and try again." },
      { status: 422 }
    );
  }

  console.log(`[ingest-link] Fetched HTML: ${html.length} chars from ${url}`);

  const conversation = extractConversationHtml(html);
  if (!conversation.trim()) {
    return NextResponse.json(
      { error: "No conversation content found at this link." },
      { status: 422 }
    );
  }

  console.log(`[ingest-link] Extracted conversation: ${conversation.length} chars, first 500: ${conversation.slice(0, 500)}`);

  const sanitized = stripPii(conversation);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfiguration." },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  let extractRaw: string;
  try {
    const msg1 = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM_EXTRACT,
      messages: [{ role: "user", content: sanitized }],
    });
    extractRaw = extractMessageText(msg1);
    console.log(`[ingest-link] Anthropic raw response (${extractRaw.length} chars): ${extractRaw.slice(0, 500)}`);
  } catch (e: unknown) {
    if (isRateLimitError(e)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Memory extraction failed. Try again." },
      { status: 500 }
    );
  }

  let arr = parseJsonArray(extractRaw);
  if (!arr) {
    try {
      const msg2 = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_EXTRACT,
        messages: [
          { role: "user", content: sanitized },
          { role: "assistant", content: extractRaw },
          {
            role: "user",
            content: "Return ONLY a JSON array, nothing else.",
          },
        ],
      });
      extractRaw = extractMessageText(msg2);
    } catch (e: unknown) {
      if (isRateLimitError(e)) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Memory extraction failed. Try again." },
        { status: 500 }
      );
    }
    arr = parseJsonArray(extractRaw);
  }

  if (!arr) {
    return NextResponse.json(
      { error: "Could not parse memory extraction. Try again." },
      { status: 422 }
    );
  }

  console.log(`[ingest-link] Parsed JSON array: ${arr.length} items`);

  const { nodes: proposals, totalExtracted } = toProposedNodes(arr);
  console.log(`[ingest-link] Proposals: ${proposals.length} nodes from ${totalExtracted} extracted`);

  let summary: string;
  try {
    const sumMsg = await anthropic.messages.create({
      model,
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `Summarize these memory changes in one plain-English sentence, max 12 words. 
Examples: 'Added 3 work context nodes and updated your tech preferences.'
Return only the sentence, nothing else.

Nodes (JSON): ${JSON.stringify(
            proposals.map((p) => ({
              category: p.category,
              title: p.title,
              value: p.newValue,
            }))
          )}`,
        },
      ],
    });
    summary = extractMessageText(sumMsg).trim().replace(/^["']|["']$/g, "");
    if (!summary) summary = "Captured memories from your shared conversation.";
  } catch (e: unknown) {
    if (isRateLimitError(e)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }
    summary = "Captured memories from your shared conversation.";
  }

  try {
    if (!isProPlan(billingPlan)) {
      await incrementShareLinkUsage(user.id);
    }
  } catch (e) {
    console.error("ingest usage increment:", e);
  }

  return NextResponse.json({
    proposals,
    summary,
    totalExtracted,
    canvasId: resolvedCanvasId ?? undefined,
  });
  } catch (err) {
    console.error("[ingest-link]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
