import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  hostnameResolvesToPrivateIp,
  isPrivateUrl,
} from "@/lib/security/urlValidation";

interface OGData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  fileType: string;
}

const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 5000;

function detectFileType(url: string, contentType: string): string {
  const lower = url.toLowerCase();
  if (contentType.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (
    contentType.includes("image") ||
    /\.(png|jpg|jpeg|gif|webp|svg)/.test(lower)
  )
    return "image";
  if (contentType.includes("video") || /\.(mp4|mov|avi|webm)/.test(lower))
    return "video";
  if (/youtube\.com|youtu\.be/.test(lower)) return "youtube";
  if (/figma\.com/.test(lower)) return "figma";
  if (/github\.com/.test(lower)) return "github";
  if (/notion\.so/.test(lower)) return "notion";
  if (/twitter\.com|x\.com/.test(lower)) return "twitter";
  if (/loom\.com/.test(lower)) return "video";
  return "link";
}

function mapFileTypeForDb(ft: string): string {
  if (ft === "youtube" || ft === "video") return "video";
  if (ft === "image" || ft === "pdf") return ft;
  return "link";
}

async function assertUrlSafeForFetch(url: string): Promise<void> {
  if (isPrivateUrl(url)) {
    throw new Error("blocked");
  }
  const hostname = new URL(url).hostname;
  if (await hostnameResolvesToPrivateIp(hostname)) {
    throw new Error("blocked");
  }
}

async function readResponseBodyLimited(
  res: Response,
  maxBytes: number
): Promise<string> {
  if (!res.body) {
    return "";
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = maxBytes - total;
      if (value.length > remaining) {
        chunks.push(value.slice(0, remaining));
        total = maxBytes;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      total += value.length;
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

async function fetchWithRedirects(
  initialUrl: string
): Promise<{ res: Response; finalUrl: string }> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    await assertUrlSafeForFetch(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "Memorey/1.0 (link preview bot)" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      res.body?.cancel();
      if (!loc) {
        return { res, finalUrl: currentUrl };
      }
      currentUrl = new URL(loc, currentUrl).href;
      continue;
    }

    return { res, finalUrl: currentUrl };
  }

  throw new Error("too many redirects");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit(`extract-meta:${user.id}`, 10, 60)).allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const { url } = (await request.json()) as { url: string };
    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    let parsedInitial: URL;
    try {
      parsedInitial = new URL(url.trim());
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (isPrivateUrl(url)) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (await hostnameResolvesToPrivateIp(parsedInitial.hostname)) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const { res, finalUrl } = await fetchWithRedirects(url.trim());

    const contentType = res.headers.get("content-type") ?? "";
    const fileTypeRaw = detectFileType(finalUrl, contentType);
    const fileType = mapFileTypeForDb(fileTypeRaw);

    if (!contentType.includes("text/html")) {
      res.body?.cancel();
      const fileName =
        finalUrl.split("/").pop()?.split("?")[0] ?? "File";
      return NextResponse.json({
        title: fileName,
        description: null,
        image: fileType === "image" ? finalUrl : null,
        siteName: new URL(finalUrl).hostname,
        fileType,
      } satisfies OGData);
    }

    const html = await readResponseBodyLimited(res, MAX_BYTES);

    const og: OGData = {
      title: null,
      description: null,
      image: null,
      siteName: null,
      fileType,
    };

    const metaRegex = /<meta[^>]+>/gi;
    const metas = html.match(metaRegex) ?? [];

    for (const meta of metas) {
      const prop =
        meta.match(/(?:property|name)="([^"]+)"/i)?.[1]?.toLowerCase() ?? "";
      const content = meta.match(/content="([^"]*)"/i)?.[1] ?? "";
      if (!content) continue;

      if (prop === "og:title" || prop === "twitter:title")
        og.title ??= content;
      if (prop === "og:description" || prop === "twitter:description")
        og.description ??= content;
      if (prop === "og:image" || prop === "twitter:image")
        og.image ??= content;
      if (prop === "og:site_name") og.siteName ??= content;
    }

    if (!og.title) {
      og.title =
        html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
    }

    if (og.image?.startsWith("/")) {
      og.image = new URL(og.image, finalUrl).href;
    }

    if (!og.siteName) {
      og.siteName = new URL(finalUrl).hostname.replace("www.", "");
    }

    return NextResponse.json(og);
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "blocked" || e.message === "too many redirects") {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }
    }
    return NextResponse.json({
      title: null,
      description: null,
      image: null,
      siteName: null,
      fileType: "link",
    } satisfies OGData);
  }
}
