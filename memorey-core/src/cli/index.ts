#!/usr/bin/env node
/// <reference types="node" />

import { createInterface } from "node:readline";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { MemoreyPipeline } from "../pipeline/MemoreyPipeline.js";
import { ImportEngine } from "../import/ImportEngine.js";
import { ExportEngine } from "../export/ExportEngine.js";
import type { ConversationExchange } from "../extraction/types.js";
import type { MemoryNode, ChangelogEntry, ReconciliationAction } from "../pipeline/types.js";

// ── ANSI Colors ─────────────────────────────────────────────
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

// ── Helpers ─────────────────────────────────────────────────

const MEMOREY_DIR = join(homedir(), ".memorey");
const CONFIG_FILE = join(MEMOREY_DIR, "config.json");

function statusColor(status: string): string {
  switch (status) {
    case "approved":
    case "auto_approved":
      return c.green(status);
    case "pending":
      return c.yellow(status);
    case "rejected":
      return c.red(status);
    default:
      return status;
  }
}

function formatNode(node: MemoryNode, index?: number): string {
  const prefix = index !== undefined ? c.gray(`[${index}] `) : "";
  const id = c.gray(node.id);
  const vault = c.blue(node.vault);
  const conf = c.gray(`conf:${node.confidence.toFixed(2)}`);
  const status = statusColor(node.status);
  const source = c.gray(node.source.platform);
  return `${prefix}${id} ${vault} ${status} ${conf} ${source}\n    ${node.fact}`;
}

function formatChangelog(entry: ChangelogEntry): string {
  const ts = c.gray(entry.timestamp);
  const type = c.cyan(entry.changeType);
  const by = c.gray(`by:${entry.changedBy}`);
  let detail = "";
  if (entry.previousValue && entry.newValue) {
    detail = `\n    ${c.red(`- ${entry.previousValue}`)}\n    ${c.green(`+ ${entry.newValue}`)}`;
  } else if (entry.newValue) {
    detail = `\n    ${c.green(`+ ${entry.newValue}`)}`;
  }
  if (entry.reason) {
    detail += `\n    ${c.gray(entry.reason)}`;
  }
  return `  ${ts} ${type} ${by}${detail}`;
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function ensureDir(): Promise<void> {
  if (!existsSync(MEMOREY_DIR)) {
    await mkdir(MEMOREY_DIR, { recursive: true });
  }
}

interface Config {
  userId: string;
  storagePath: string;
}

async function loadConfig(): Promise<Config> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as Config;
  } catch {
    console.error(c.red("No memorey graph initialized. Run: memorey init <userId>"));
    return process.exit(1) as never;
  }
}

async function getPipeline(): Promise<MemoreyPipeline> {
  const config = await loadConfig();
  const pipeline = new MemoreyPipeline({ storagePath: config.storagePath });
  await pipeline.init(config.userId);
  return pipeline;
}

// ── Commands ────────────────────────────────────────────────

async function cmdInit(userId: string): Promise<void> {
  if (!userId) {
    console.error(c.red("Usage: memorey init <userId>"));
    process.exit(1);
  }

  await ensureDir();

  const storagePath = join(MEMOREY_DIR, `${userId}.json`);
  const config: Config = { userId, storagePath };

  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");

  // Initialize pipeline to create storage file
  const pipeline = new MemoreyPipeline({ storagePath });
  await pipeline.init(userId);
  await pipeline.save();

  console.log(c.cyan("memorey initialized"));
  console.log(`  User ID: ${c.bold(userId)}`);
  console.log(`  Storage: ${c.gray(storagePath)}`);
}

async function cmdAdd(): Promise<void> {
  const pipeline = await getPipeline();

  const platform = await prompt(`${c.cyan("Platform")} (chatgpt/claude/gemini/other): `);
  const userMessage = await prompt(`${c.cyan("User message")}: `);
  const assistantMessage = await prompt(`${c.cyan("Assistant message")}: `);

  const exchange: ConversationExchange = {
    userMessage,
    assistantMessage,
    platform: platform || "other",
    timestamp: new Date().toISOString(),
  };

  console.log(c.gray("\nProcessing..."));
  const result = await pipeline.processExchange(exchange);
  await pipeline.save();

  console.log(c.cyan("\n── Extraction Results ──────────────────"));
  console.log(`  Facts extracted: ${result.extracted.facts.length}`);
  console.log(`  Auto-approved:   ${c.green(String(result.reconciliation.autoApproved))}`);
  console.log(`  Pending:         ${c.yellow(String(result.reconciliation.pending))}`);
  console.log(`  Duplicates:      ${c.gray(String(result.reconciliation.duplicates))}`);
  console.log(`  Conflicts:       ${c.yellow(String(result.reconciliation.conflicts))}`);

  if (result.extracted.facts.length > 0) {
    console.log(c.cyan("\n── Extracted Facts ─────────────────────"));
    for (const fact of result.extracted.facts) {
      const vaultTag = c.blue(fact.vault);
      const conf = c.gray(`conf:${fact.confidence.toFixed(2)}`);
      console.log(`  ${vaultTag} ${conf} ${fact.fact}`);
    }
  }

  if (result.pendingApproval.length > 0) {
    console.log(c.yellow("\n── Pending Approval ────────────────────"));
    for (const node of result.pendingApproval) {
      console.log(`  ${formatNode(node)}`);
    }
  }
}

async function cmdAddFile(filePath: string): Promise<void> {
  if (!filePath) {
    console.error(c.red("Usage: memorey add-file <path>"));
    process.exit(1);
  }

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    console.error(c.red(`File not found: ${filePath}`));
    return process.exit(1) as never;
  }

  let exchanges: ConversationExchange[];
  try {
    exchanges = JSON.parse(raw) as ConversationExchange[];
  } catch {
    console.error(c.red("Invalid JSON. Expected array of ConversationExchange objects."));
    return process.exit(1) as never;
  }

  if (!Array.isArray(exchanges)) {
    console.error(c.red("Expected a JSON array of ConversationExchange objects."));
    return process.exit(1) as never;
  }

  const pipeline = await getPipeline();
  console.log(c.cyan(`Processing ${exchanges.length} exchanges...`));

  const result = await pipeline.processConversation(exchanges);
  await pipeline.save();

  console.log(c.cyan("\n── Results ─────────────────────────────"));
  console.log(`  Total extracted:   ${result.totalExtracted}`);
  console.log(`  Added:             ${result.totalAdded}`);
  console.log(`  Auto-approved:     ${c.green(String(result.totalAutoApproved))}`);
  console.log(`  Pending approval:  ${c.yellow(String(result.totalPendingApproval))}`);
  console.log(`  Duplicates:        ${c.gray(String(result.totalDuplicates))}`);
  console.log(`  Conflicts:         ${c.yellow(String(result.pendingConflicts.length))}`);
}

async function cmdPending(): Promise<void> {
  const pipeline = await getPipeline();
  const pending = pipeline.getPendingNodes();

  if (pending.length === 0) {
    console.log(c.green("No pending facts."));
    return;
  }

  console.log(c.cyan(`── Pending Facts (${pending.length}) ──────────────────`));
  for (let i = 0; i < pending.length; i++) {
    console.log(formatNode(pending[i], i));
  }

  console.log(c.gray("\nOptions: approve <index>, reject <index>, approve-all, quit"));

  let running = true;
  while (running) {
    const input = await prompt(c.cyan("> "));
    const parts = input.split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    if (cmd === "quit" || cmd === "q") {
      running = false;
    } else if (cmd === "approve-all") {
      const approved = pipeline.approveAll();
      await pipeline.save();
      console.log(c.green(`Approved ${approved.length} facts.`));
      running = false;
    } else if (cmd === "approve" && parts[1]) {
      const idx = parseInt(parts[1], 10);
      if (idx >= 0 && idx < pending.length) {
        pipeline.approveNode(pending[idx].id);
        await pipeline.save();
        console.log(c.green(`Approved: ${pending[idx].fact}`));
      } else {
        console.log(c.red("Invalid index."));
      }
    } else if (cmd === "reject" && parts[1]) {
      const idx = parseInt(parts[1], 10);
      if (idx >= 0 && idx < pending.length) {
        pipeline.rejectNode(pending[idx].id);
        await pipeline.save();
        console.log(c.red(`Rejected: ${pending[idx].fact}`));
      } else {
        console.log(c.red("Invalid index."));
      }
    } else {
      console.log(c.gray("Commands: approve <index>, reject <index>, approve-all, quit"));
    }
  }
}

async function cmdApprove(nodeId: string): Promise<void> {
  if (!nodeId) {
    console.error(c.red("Usage: memorey approve <nodeId>"));
    process.exit(1);
  }
  const pipeline = await getPipeline();
  try {
    const node = pipeline.approveNode(nodeId);
    await pipeline.save();
    console.log(c.green(`Approved: ${node.fact}`));
  } catch (err) {
    console.error(c.red(String(err)));
    process.exit(1);
  }
}

async function cmdReject(nodeId: string): Promise<void> {
  if (!nodeId) {
    console.error(c.red("Usage: memorey reject <nodeId>"));
    process.exit(1);
  }
  const pipeline = await getPipeline();
  try {
    const node = pipeline.rejectNode(nodeId);
    await pipeline.save();
    console.log(c.red(`Rejected: ${node.fact}`));
  } catch (err) {
    console.error(c.red(String(err)));
    process.exit(1);
  }
}

async function cmdEdit(nodeId: string): Promise<void> {
  if (!nodeId) {
    console.error(c.red("Usage: memorey edit <nodeId>"));
    process.exit(1);
  }

  const pipeline = await getPipeline();
  const snapshot = pipeline.exportGraph();
  const found = snapshot.nodes.find((n) => n.id === nodeId);

  if (!found) {
    console.error(c.red(`Node not found: ${nodeId}`));
    return process.exit(1) as never;
  }

  const currentFact = found.fact;
  const currentConfidence = found.confidence;
  const currentVault = found.vault;

  console.log(c.cyan("── Current Node ────────────────────────"));
  console.log(formatNode(found));
  console.log(c.gray(`  Tags: ${found.tags.join(", ") || "(none)"}`));
  console.log();

  const changes: string[] = [];

  // Edit fact
  const newFact = await prompt(`${c.cyan("New fact")} (enter to keep): `);
  if (newFact) {
    pipeline.editNodeFact(nodeId, newFact);
    changes.push(`fact: "${currentFact}" → "${newFact}"`);
  }

  // Edit confidence
  const newConf = await prompt(`${c.cyan("New confidence")} (0-1, enter to keep): `);
  if (newConf) {
    const conf = parseFloat(newConf);
    if (!isNaN(conf) && conf >= 0 && conf <= 1) {
      pipeline.updateNodeConfidence(nodeId, conf);
      changes.push(`confidence: ${currentConfidence} → ${conf}`);
    } else {
      console.log(c.red("Invalid confidence value, skipping."));
    }
  }

  // Edit vault
  const vaults = pipeline.getVaults();
  console.log(c.gray(`  Available vaults: ${vaults.map((v) => v.id).join(", ")}`));
  const newVault = await prompt(`${c.cyan("New vault")} (enter to keep): `);
  if (newVault) {
    pipeline.changeNodeVault(nodeId, newVault);
    changes.push(`vault: ${currentVault} → ${newVault}`);
  }

  if (changes.length > 0) {
    await pipeline.save();
    console.log(c.cyan("\n── Changes Applied ─────────────────────"));
    for (const change of changes) {
      console.log(`  ${c.green("✓")} ${change}`);
    }
  } else {
    console.log(c.gray("No changes made."));
  }
}

async function cmdConflicts(): Promise<void> {
  const pipeline = await getPipeline();
  const conflicts = pipeline.getPendingConflicts();

  if (conflicts.length === 0) {
    console.log(c.green("No unresolved conflicts."));
    return;
  }

  console.log(c.yellow(`── Conflicts (${conflicts.length}) ─────────────────────`));
  for (let i = 0; i < conflicts.length; i++) {
    const conflict = conflicts[i];
    if (conflict.type !== "conflict") continue;

    console.log(c.yellow(`\n[${i}] Conflict:`));
    console.log(`  ${c.cyan("Existing")} (${conflict.existingNodeId}): ${c.gray("(in graph)")}`);
    console.log(`  ${c.yellow("New fact")}: ${conflict.fact.fact}`);
    console.log(`  ${c.gray(`Reason: ${conflict.reason}`)}`);
  }

  console.log(c.gray("\nOptions: keep_existing <index>, use_new <index>, keep_both <index>, quit"));

  let running = true;
  while (running) {
    const input = await prompt(c.cyan("> "));
    const parts = input.split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const idx = parts[1] ? parseInt(parts[1], 10) : -1;

    if (cmd === "quit" || cmd === "q") {
      running = false;
    } else if (
      (cmd === "keep_existing" || cmd === "use_new" || cmd === "keep_both") &&
      idx >= 0 &&
      idx < conflicts.length
    ) {
      const resolution = cmd as "keep_existing" | "use_new" | "keep_both";
      try {
        pipeline.resolveConflict(conflicts[idx], resolution);
        await pipeline.save();
        console.log(c.green(`Resolved conflict ${idx} with: ${resolution}`));
      } catch (err) {
        console.error(c.red(String(err)));
      }
    } else {
      console.log(c.gray("Commands: keep_existing <index>, use_new <index>, keep_both <index>, quit"));
    }
  }
}

async function cmdBrief(args: string[]): Promise<void> {
  const pipeline = await getPipeline();

  let task: string | undefined;
  let format: "system_prompt" | "markdown" | "structured_json" = "system_prompt";
  let maxTokens = 1500;

  // Parse flags
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--task" && args[i + 1]) {
      task = args[++i];
    } else if (args[i] === "--format" && args[i + 1]) {
      const f = args[++i];
      if (f === "system_prompt" || f === "markdown" || f === "json") {
        format = f === "json" ? "structured_json" : f;
      }
    } else if (args[i] === "--max-tokens" && args[i + 1]) {
      maxTokens = parseInt(args[++i], 10) || 1500;
    }
  }

  const config = { format, maxTokens };
  const briefing = task
    ? pipeline.generateTaskBriefing(task, config)
    : pipeline.generateBriefing(config);

  console.log(c.cyan("── Briefing ────────────────────────────"));
  console.log(briefing.content);
  console.log(c.gray(`\n── Meta ────────────────────────────────`));
  console.log(`  Facts included: ${briefing.factsIncluded}`);
  console.log(`  Facts excluded: ${briefing.factsExcluded}`);
  console.log(`  Est. tokens:    ${briefing.estimatedTokens}`);
  console.log(`  Generated:      ${c.gray(briefing.generatedAt)}`);

  if (Object.keys(briefing.vaultBreakdown).length > 0) {
    console.log(c.gray("  Vault breakdown:"));
    for (const [vault, count] of Object.entries(briefing.vaultBreakdown)) {
      console.log(`    ${c.blue(vault)}: ${count}`);
    }
  }
}

async function cmdVaults(): Promise<void> {
  const pipeline = await getPipeline();
  const vaults = pipeline.getVaults();
  const stats = pipeline.getStats();

  console.log(c.cyan(`── Vaults (${vaults.length}) ──────────────────────`));
  for (const vault of vaults) {
    const count = stats.vaultBreakdown[vault.name] ?? 0;
    const defaultTag = vault.isDefault ? c.gray(" (default)") : c.green(" (custom)");
    const icon = vault.icon ? `${vault.icon} ` : "";
    console.log(
      `  ${icon}${c.blue(vault.id)} ${c.gray(`(${count} facts)`)}${defaultTag}`
    );
    console.log(`    ${c.dim(vault.description)}`);
  }
}

async function cmdVaultAdd(name: string, description: string): Promise<void> {
  if (!name || !description) {
    console.error(c.red("Usage: memorey vault-add <name> <description>"));
    process.exit(1);
  }

  const pipeline = await getPipeline();
  try {
    const vault = pipeline.createVault(name, description);
    await pipeline.save();
    console.log(c.green(`Vault created: ${c.blue(vault.id)}`));
    console.log(`  Name: ${vault.name}`);
    console.log(`  Description: ${vault.description}`);
  } catch (err) {
    console.error(c.red(String(err)));
    process.exit(1);
  }
}

async function cmdHistory(nodeId: string): Promise<void> {
  if (!nodeId) {
    console.error(c.red("Usage: memorey history <nodeId>"));
    process.exit(1);
  }

  const pipeline = await getPipeline();
  try {
    const history = pipeline.getNodeHistory(nodeId);
    console.log(c.cyan(`── History for ${c.gray(nodeId)} ──────────────`));
    if (history.length === 0) {
      console.log(c.gray("  No history entries."));
    } else {
      for (const entry of history) {
        console.log(formatChangelog(entry));
      }
    }
  } catch (err) {
    console.error(c.red(String(err)));
    process.exit(1);
  }
}

async function cmdStats(): Promise<void> {
  const pipeline = await getPipeline();
  const stats = pipeline.getStats();

  console.log(c.cyan("── Graph Statistics ────────────────────"));
  console.log(`  Total facts:     ${stats.totalFacts}`);
  console.log(`  Active facts:    ${c.green(String(stats.activeFacts))}`);
  console.log(`  Pending facts:   ${c.yellow(String(stats.pendingFacts))}`);
  console.log(`  Rejected facts:  ${c.red(String(stats.rejectedFacts))}`);
  console.log(`  Superseded:      ${c.gray(String(stats.supersededFacts))}`);
  console.log(`  Edges:           ${stats.edges}`);

  if (stats.oldestFact) {
    console.log(`  Oldest fact:     ${c.gray(stats.oldestFact)}`);
  }
  if (stats.newestFact) {
    console.log(`  Newest fact:     ${c.gray(stats.newestFact)}`);
  }

  if (Object.keys(stats.vaultBreakdown).length > 0) {
    console.log(c.cyan("\n── Vault Breakdown ─────────────────────"));
    for (const [vault, count] of Object.entries(stats.vaultBreakdown)) {
      console.log(`  ${c.blue(vault)}: ${count}`);
    }
  }
}

async function cmdSearch(query: string): Promise<void> {
  if (!query) {
    console.error(c.red("Usage: memorey search <query>"));
    process.exit(1);
  }

  const pipeline = await getPipeline();
  const snapshot = pipeline.exportGraph();

  // Search across all nodes
  const lower = query.toLowerCase();
  const matches = snapshot.nodes.filter(
    (n) =>
      n.fact.toLowerCase().includes(lower) ||
      n.tags.some((t) => t.toLowerCase().includes(lower))
  );

  if (matches.length === 0) {
    console.log(c.gray(`No results for "${query}".`));
    return;
  }

  console.log(c.cyan(`── Search: "${query}" (${matches.length} results) ──`));
  for (const node of matches) {
    console.log(formatNode(node));
  }
}

async function cmdExport(args: string[]): Promise<void> {
  const pipeline = await getPipeline();
  const data = pipeline.exportGraph();
  const json = JSON.stringify(data, null, 2);

  let outputPath: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) {
      outputPath = args[++i];
    }
  }

  if (outputPath) {
    await writeFile(outputPath, json, "utf-8");
    console.log(c.green(`Exported to: ${outputPath}`));
  } else {
    console.log(json);
  }
}

// ── Import / Export ──────────────────────────────────────────

async function cmdImport(args: string[]): Promise<void> {
  const filePath = args[0];
  if (!filePath) {
    console.error(c.red("Usage: memorey import <filePath> [--platform chatgpt|claude|gemini|other]"));
    process.exit(1);
  }

  let platform = "other";
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--platform" && args[i + 1]) {
      platform = args[++i];
    }
  }

  const pipeline = await getPipeline();
  const engine = new ImportEngine(pipeline);

  console.log(c.cyan(`Importing from: ${filePath}`));
  console.log(c.gray(`Platform: ${platform}`));

  const result = await engine.importFromFile(filePath, platform);
  await pipeline.save();

  console.log(c.cyan("\n── Import Results ──────────────────────"));
  console.log(`  Exchanges parsed:  ${result.exchangesParsed}`);
  console.log(`  Facts extracted:   ${result.factsExtracted}`);
  console.log(`  Facts added:       ${result.factsAdded}`);
  console.log(`  Auto-approved:     ${c.green(String(result.factsAutoApproved))}`);
  console.log(`  Pending:           ${c.yellow(String(result.factsPending))}`);
  console.log(`  Duplicates:        ${c.gray(String(result.duplicates))}`);
  console.log(`  Conflicts:         ${c.yellow(String(result.conflicts))}`);

  if (result.errors.length > 0) {
    console.log(c.red(`\n── Errors (${result.errors.length}) ─────────────────────`));
    for (const err of result.errors) {
      console.log(`  ${c.red("✗")} ${err}`);
    }
  }
}

async function cmdExportBrief(args: string[]): Promise<void> {
  const pipeline = await getPipeline();
  const engine = new ExportEngine(pipeline);

  let task: string | undefined;
  let format: "system_prompt" | "markdown" | "structured_json" = "system_prompt";
  let outputPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--task" && args[i + 1]) {
      task = args[++i];
    } else if (args[i] === "--format" && args[i + 1]) {
      const f = args[++i];
      if (f === "system_prompt" || f === "markdown" || f === "json") {
        format = f === "json" ? "structured_json" : f;
      }
    } else if (args[i] === "--output" && args[i + 1]) {
      outputPath = args[++i];
    }
  }

  const content = engine.exportBriefing({ format, taskContext: task });

  if (outputPath) {
    await writeFile(outputPath, content, "utf-8");
    console.log(c.green(`Briefing exported to: ${outputPath}`));
  } else {
    console.log(content);
  }
}

async function cmdExportGraph(args: string[]): Promise<void> {
  const pipeline = await getPipeline();
  const engine = new ExportEngine(pipeline);

  let format: "json" | "markdown" = "json";
  let outputPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && args[i + 1]) {
      const f = args[++i];
      if (f === "json" || f === "markdown") {
        format = f;
      }
    } else if (args[i] === "--output" && args[i + 1]) {
      outputPath = args[++i];
    }
  }

  const content = engine.exportGraph(format);

  if (outputPath) {
    await writeFile(outputPath, content, "utf-8");
    console.log(c.green(`Graph exported to: ${outputPath}`));
  } else {
    console.log(content);
  }
}

// ── Help ────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`
${c.cyan(c.bold("memorey"))} — CLI for testing the Memorey pipeline

${c.cyan("Commands:")}
  ${c.bold("init <userId>")}            Initialize a new graph
  ${c.bold("add")}                      Add a conversation exchange (interactive)
  ${c.bold("add-file <path>")}          Process exchanges from a JSON file
  ${c.bold("pending")}                  List and manage pending facts
  ${c.bold("approve <nodeId>")}         Approve a specific fact
  ${c.bold("reject <nodeId>")}          Reject a specific fact
  ${c.bold("edit <nodeId>")}            Edit a node interactively
  ${c.bold("conflicts")}                List and resolve conflicts
  ${c.bold("brief")}                    Generate a briefing
    ${c.gray("--task \"desc\"")}           Task context for relevance
    ${c.gray("--format system_prompt|markdown|json")}
    ${c.gray("--max-tokens 1500")}
  ${c.bold("vaults")}                   List all vaults with fact counts
  ${c.bold("vault-add <name> <desc>")}  Create a custom vault
  ${c.bold("history <nodeId>")}         Show changelog for a node
  ${c.bold("stats")}                    Show graph statistics
  ${c.bold("search <query>")}           Search facts
  ${c.bold("export")}                   Export graph as JSON
    ${c.gray("--output <path>")}         Write to file instead of stdout
  ${c.bold("import <filePath>")}        Import conversations from file
    ${c.gray("--platform chatgpt|claude|gemini|other")}
  ${c.bold("export-brief")}             Export briefing
    ${c.gray("--task \"desc\"")}           Task context for relevance
    ${c.gray("--format system_prompt|markdown|json")}
    ${c.gray("--output <path>")}         Write to file instead of stdout
  ${c.bold("export-graph")}             Export full graph
    ${c.gray("--format json|markdown")}
    ${c.gray("--output <path>")}         Write to file instead of stdout

${c.gray("Data stored in ~/.memorey/")}
`);
}

// ── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    showHelp();
    return;
  }

  try {
    switch (command) {
      case "init":
        await cmdInit(args[1]);
        break;
      case "add":
        await cmdAdd();
        break;
      case "add-file":
        await cmdAddFile(args[1]);
        break;
      case "pending":
        await cmdPending();
        break;
      case "approve":
        await cmdApprove(args[1]);
        break;
      case "reject":
        await cmdReject(args[1]);
        break;
      case "edit":
        await cmdEdit(args[1]);
        break;
      case "conflicts":
        await cmdConflicts();
        break;
      case "brief":
        await cmdBrief(args.slice(1));
        break;
      case "vaults":
        await cmdVaults();
        break;
      case "vault-add":
        await cmdVaultAdd(args[1], args.slice(2).join(" "));
        break;
      case "history":
        await cmdHistory(args[1]);
        break;
      case "stats":
        await cmdStats();
        break;
      case "search":
        await cmdSearch(args.slice(1).join(" "));
        break;
      case "export":
        await cmdExport(args.slice(1));
        break;
      case "import":
        await cmdImport(args.slice(1));
        break;
      case "export-brief":
        await cmdExportBrief(args.slice(1));
        break;
      case "export-graph":
        await cmdExportGraph(args.slice(1));
        break;
      default:
        console.error(c.red(`Unknown command: ${command}`));
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(c.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}

main();
