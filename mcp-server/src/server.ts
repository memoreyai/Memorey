import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createHash } from "crypto";
import { createClient, type User } from "@supabase/supabase-js";
import OpenAI from "openai";

const PORT = Number(process.env.PORT) || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const MCP_MANIFEST = {
  name: "memorey",
  version: "1.0.0",
  description: "Your portable memory graph for every AI you use",
  auth: {
    type: "bearer",
    description: "Your Supabase access token from the Memorey web app session",
  },
  tools: [
    {
      name: "get_context",
      description: "Get your memory context for the current AI session",
      inputSchema: {
        type: "object",
        properties: {
          vaults: {
            type: "array",
            items: { type: "string" },
            description:
              "Vault names to include. Omit for all active vaults.",
          },
          session_purpose: {
            type: "string",
            description:
              "What this AI session is about. Enables smart filtering.",
          },
        },
      },
    },
    {
      name: "get_graph_summary",
      description: "Get a summary of what is in the user memory graph",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "propose_node_update",
      description:
        "Propose adding or updating a memory node (requires user approval in Memorey)",
      inputSchema: {
        type: "object",
        required: ["category", "title", "value"],
        properties: {
          category: { type: "string" },
          title: { type: "string" },
          value: { type: "string" },
        },
      },
    },
  ],
} as const;

function adminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function authClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function getUserFromBearer(token: string | null): Promise<User | null> {
  if (!token) return null;
  const supabase = authClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export interface AuthedRequest extends Request {
  memoreyUser?: User;
  bearerToken?: string;
}

async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const auth = req.headers.authorization;
  const token =
    auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const user = await getUserFromBearer(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.memoreyUser = user;
  req.bearerToken = token;
  next();
}

const tokenRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const t = auth.slice(7).trim();
      return createHash("sha256").update(t).digest("hex");
    }
    return req.ip || "unknown";
  },
});

type MemoryRow = {
  id: string;
  vault_id: string;
  title: string;
  value: string;
  updated_at: string;
};

type VaultRow = { id: string; name: string; is_active: boolean };

function formatContextByVault(
  nodes: MemoryRow[],
  vaultNameById: Map<string, string>
): string {
  const byVault = new Map<string, MemoryRow[]>();
  for (const n of nodes) {
    const name = vaultNameById.get(n.vault_id) ?? "Unknown";
    if (!byVault.has(name)) byVault.set(name, []);
    byVault.get(name)!.push(n);
  }
  const sections: string[] = [];
  const vaultOrder = [...new Set(nodes.map((n) => vaultNameById.get(n.vault_id) ?? "Unknown"))];
  for (const vaultName of vaultOrder) {
    const list = byVault.get(vaultName);
    if (!list?.length) continue;
    sections.push(`## ${vaultName}`);
    for (const n of list) {
      sections.push(`- ${n.title}: ${n.value}`);
    }
  }
  return sections.join("\n");
}

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "512kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "memorey-mcp" });
});

app.get("/.well-known/mcp.json", (_req, res) => {
  res.json(MCP_MANIFEST);
});

app.post("/tools/get_context", tokenRateLimiter, requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.memoreyUser!.id;
    const admin = adminClient();
    const body = req.body as {
      vaults?: string[];
      session_purpose?: string;
    };

    const { data: allVaults, error: vErr } = await admin
      .from("category_vaults")
      .select("id, name, is_active")
      .eq("user_id", userId);

    if (vErr) {
      console.error("get_context vaults:", vErr);
      return res.status(500).json({ error: "Failed to load vaults" });
    }

    const vaults = (allVaults ?? []) as VaultRow[];
    let activeVaults = vaults.filter((v) => v.is_active);
    const nameFilter = Array.isArray(body.vaults)
      ? body.vaults.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : [];

    if (nameFilter.length > 0) {
      activeVaults = vaults.filter(
        (v) => v.is_active && nameFilter.includes(v.name.trim().toLowerCase())
      );
    }

    const vaultIds = activeVaults.map((v) => v.id);
    const vaultNameById = new Map(activeVaults.map((v) => [v.id, v.name]));

    if (vaultIds.length === 0) {
      return res.json({
        context: "",
        nodeCount: 0,
        vaultsIncluded: activeVaults.map((v) => v.name),
      });
    }

    const purpose =
      typeof body.session_purpose === "string"
        ? body.session_purpose.trim()
        : "";

    let nodes: MemoryRow[] = [];
    const vaultsIncluded = activeVaults.map((v) => v.name);

    if (purpose && OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      let queryEmbedding: number[];
      try {
        const emb = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: purpose,
        });
        const vec = emb.data[0]?.embedding;
        if (!vec?.length) throw new Error("empty embedding");
        queryEmbedding = vec;
      } catch (e) {
        console.error("get_context embed:", e);
        queryEmbedding = [];
      }

      if (queryEmbedding.length > 0) {
        const { data: similar, error: rpcErr } = await admin.rpc("search_nodes", {
          p_user_id: userId,
          p_query_embedding: queryEmbedding,
          p_vault_ids: vaultIds,
          p_limit: 50,
        });
        if (rpcErr) {
          console.error("get_context search_nodes:", rpcErr);
        } else {
          const rows = (similar ?? []) as {
            id: string;
            vault_id: string;
            title: string;
            value: string;
            updated_at?: string;
          }[];
          nodes = rows.map((r) => ({
            id: r.id,
            vault_id: r.vault_id,
            title: r.title,
            value: r.value,
            updated_at: r.updated_at ?? "",
          }));
        }
      }
    }

    if (nodes.length === 0) {
      const { data: recent, error: nErr } = await admin
        .from("memory_nodes")
        .select("id, vault_id, title, value, updated_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .in("vault_id", vaultIds)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (nErr) {
        console.error("get_context nodes:", nErr);
        return res.status(500).json({ error: "Failed to load memories" });
      }
      nodes = (recent ?? []) as MemoryRow[];
    }

    const context = formatContextByVault(nodes, vaultNameById);
    return res.json({
      context,
      nodeCount: nodes.length,
      vaultsIncluded,
    });
  } catch (e) {
    console.error("get_context:", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

app.post(
  "/tools/get_graph_summary",
  tokenRateLimiter,
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const userId = req.memoreyUser!.id;
      const admin = adminClient();

      const { data: vaults } = await admin
        .from("category_vaults")
        .select("id, name")
        .eq("user_id", userId);

      const vaultList = (vaults ?? []) as { id: string; name: string }[];
      const vaultNameById = new Map(vaultList.map((v) => [v.id, v.name]));

      const { data: countsRaw, error: cErr } = await admin
        .from("memory_nodes")
        .select("vault_id")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (cErr) {
        console.error("get_graph_summary counts:", cErr);
        return res.status(500).json({ error: "Failed to summarize graph" });
      }

      const countByVault = new Map<string, number>();
      for (const row of countsRaw ?? []) {
        const vid = (row as { vault_id: string }).vault_id;
        countByVault.set(vid, (countByVault.get(vid) ?? 0) + 1);
      }

      const perVaultLines: string[] = [];
      for (const v of vaultList) {
        const n = countByVault.get(v.id) ?? 0;
        perVaultLines.push(`- ${v.name}: ${n} active nodes`);
      }

      const { data: recent } = await admin
        .from("memory_nodes")
        .select("id, vault_id, title, value, updated_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(5);

      const recentRows = (recent ?? []) as MemoryRow[];
      const recentLines = recentRows.map((n) => {
        const vname = vaultNameById.get(n.vault_id) ?? "?";
        return `  • [${vname}] ${n.title}: ${n.value.slice(0, 80)}${n.value.length > 80 ? "…" : ""}`;
      });

      let lastUpdated: string | null = null;
      if (recentRows[0]?.updated_at) {
        lastUpdated = recentRows[0].updated_at;
      } else {
        const { data: one } = await admin
          .from("memory_nodes")
          .select("updated_at")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        lastUpdated = (one as { updated_at?: string } | null)?.updated_at ?? null;
      }

      const total = (countsRaw ?? []).length;
      const summary = [
        `Total active nodes: ${total}`,
        "",
        "Nodes per vault:",
        ...perVaultLines,
        "",
        "Recently updated (up to 5):",
        ...(recentLines.length ? recentLines : ["  (none)"]),
        "",
        lastUpdated
          ? `Last updated: ${lastUpdated}`
          : "Last updated: (no nodes yet)",
      ].join("\n");

      return res.json({
        summary,
        totalNodes: total,
        lastUpdated,
        nodesPerVault: Object.fromEntries(
          vaultList.map((v) => [v.name, countByVault.get(v.id) ?? 0])
        ),
        recentNodes: recentRows.map((n) => ({
          vault: vaultNameById.get(n.vault_id) ?? "?",
          title: n.title,
          value: n.value,
          updated_at: n.updated_at,
        })),
      });
    } catch (e) {
      console.error("get_graph_summary:", e);
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

app.post(
  "/tools/propose_node_update",
  tokenRateLimiter,
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const userId = req.memoreyUser!.id;
      const body = req.body as {
        category?: string;
        title?: string;
        value?: string;
      };
      const category = typeof body.category === "string" ? body.category.trim() : "";
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const value = typeof body.value === "string" ? body.value.trim() : "";

      if (!category || !title || !value) {
        return res.status(400).json({
          error: "category, title, and value are required",
        });
      }

      const admin = adminClient();
      const { error } = await admin.from("pending_proposals").insert({
        user_id: userId,
        category: category.slice(0, 200),
        title: title.slice(0, 100),
        value: value.slice(0, 600),
        status: "pending",
      });

      if (error) {
        console.error("propose_node_update:", error);
        return res.status(500).json({ error: "Could not queue proposal" });
      }

      return res.json({
        status: "pending_review",
        message:
          "Node queued for your review in Memorey. Check the diff panel.",
      });
    } catch (e) {
      console.error("propose_node_update:", e);
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const requiredEnvVars: Array<{ key: string; value: string }> = [
  { key: "SUPABASE_URL", value: SUPABASE_URL },
  { key: "SUPABASE_SERVICE_ROLE_KEY", value: SUPABASE_SERVICE_ROLE_KEY },
];

for (const { key, value } of requiredEnvVars) {
  if (!value) {
    console.error(
      `Missing required environment variable: ${key}` +
        (key === "SUPABASE_URL" ? " (also checked NEXT_PUBLIC_SUPABASE_URL)" : "")
    );
    process.exit(1);
  }
}

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not set — semantic search in get_context will be disabled");
}

app.listen(PORT, "::", () => {
  console.log(`Memorey MCP server listening on :${PORT}`);
});
