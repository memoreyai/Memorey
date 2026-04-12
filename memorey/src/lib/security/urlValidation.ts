import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set(
  [
    "localhost",
    "metadata.google.internal",
    "metadata.google",
    "metadata",
    "0.0.0.0",
    "127.0.0.1",
    "169.254.169.254",
  ].map((h) => h.toLowerCase())
);

function isPrivateIPv4Parts(a: number, b: number, _c: number, _d: number): boolean {
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIPv4String(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  return isPrivateIPv4Parts(nums[0]!, nums[1]!, nums[2]!, nums[3]!);
}

/**
 * Returns true if the address is loopback, link-local, ULA, or IPv4-mapped private.
 */
function isPrivateIp(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").trim();
  if (net.isIPv4(ip)) {
    return isPrivateIPv4String(ip);
  }
  if (!net.isIPv6(ip)) {
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    if (net.isIPv4(v4)) return isPrivateIPv4String(v4);
  }
  // fe80::/10 link-local
  if (/^fe[89ab][0-9a-f]{2}:/i.test(lower)) return true;
  // fc00::/7 unique local (fc00::/8 – fdff::/8)
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
  return false;
}

/**
 * Returns true if the URL must not be fetched server-side (SSRF blocklist).
 * Synchronous: scheme, parse, literal hostname/IP, and blocked names only.
 * Call {@link hostnameResolvesToPrivateIp} before fetch for DNS pinning.
 */
export function isPrivateUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return true;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return true;
  }

  if (parsed.username || parsed.password) {
    return true;
  }

  const host = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host)) {
    return true;
  }

  if (net.isIPv4(host)) {
    return isPrivateIPv4String(host);
  }

  if (net.isIPv6(host)) {
    return isPrivateIp(host);
  }

  return false;
}

/**
 * Returns true if DNS resolves to any private/loopback address (block fetch).
 * Fails closed on resolution errors.
 */
export async function hostnameResolvesToPrivateIp(
  hostname: string
): Promise<boolean> {
  try {
    const results = await dns.lookup(hostname, {
      all: true,
      verbatim: true,
    });
    for (const { address } of results) {
      if (isPrivateIp(address)) return true;
    }
    return false;
  } catch {
    return true;
  }
}
