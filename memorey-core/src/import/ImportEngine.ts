import { readFile } from "node:fs/promises";
import type { MemoreyPipeline } from "../pipeline/MemoreyPipeline.js";
import type { ConversationParser, ImportResult } from "./types.js";
import { ChatGPTParser } from "./parsers/ChatGPTParser.js";
import { ClaudeParser } from "./parsers/ClaudeParser.js";
import { PlainTextParser } from "./parsers/PlainTextParser.js";
import { JsonParser } from "./parsers/JsonParser.js";
import { MarkdownParser } from "./parsers/MarkdownParser.js";

export class ImportEngine {
  private parsers: ConversationParser[];

  constructor(private pipeline: MemoreyPipeline) {
    // Order matters: more specific parsers first
    this.parsers = [
      new ChatGPTParser(),
      new ClaudeParser(),
      new JsonParser(),
      new MarkdownParser(),
      new PlainTextParser(),
    ];
  }

  /** Auto-detect format and import */
  async importFromString(
    content: string,
    platform: string
  ): Promise<ImportResult> {
    const parser = this.detectParser(content);
    if (!parser) {
      return {
        exchangesParsed: 0,
        factsExtracted: 0,
        factsAdded: 0,
        factsAutoApproved: 0,
        factsPending: 0,
        duplicates: 0,
        conflicts: 0,
        errors: ["No parser could handle the input format"],
      };
    }

    return this.importWithParser(content, parser, platform);
  }

  /** Import from file path */
  async importFromFile(
    filePath: string,
    platform: string
  ): Promise<ImportResult> {
    const content = await readFile(filePath, "utf-8");
    return this.importFromString(content, platform);
  }

  /** Import with explicit parser */
  async importWithParser(
    content: string,
    parser: ConversationParser,
    platform: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      exchangesParsed: 0,
      factsExtracted: 0,
      factsAdded: 0,
      factsAutoApproved: 0,
      factsPending: 0,
      duplicates: 0,
      conflicts: 0,
      errors: [],
    };

    let exchanges;
    try {
      exchanges = parser.parse(content);
    } catch (err) {
      result.errors.push(
        `Parse error: ${err instanceof Error ? err.message : String(err)}`
      );
      return result;
    }

    result.exchangesParsed = exchanges.length;

    // Process exchanges ONE AT A TIME through the pipeline
    for (let i = 0; i < exchanges.length; i++) {
      const exchange = exchanges[i];
      // Override platform if provided
      exchange.platform = platform || exchange.platform;

      try {
        const exchangeResult = await this.pipeline.processExchange(exchange);

        result.factsExtracted += exchangeResult.extracted.facts.length;
        result.factsAutoApproved += exchangeResult.reconciliation.autoApproved;
        result.factsPending += exchangeResult.reconciliation.pending;
        result.duplicates += exchangeResult.reconciliation.duplicates;
        result.conflicts += exchangeResult.reconciliation.conflicts;

        // Count added facts (add + update actions minus duplicates)
        const added = exchangeResult.reconciliation.actions.filter(
          (a) => a.type === "add" || a.type === "update"
        ).length;
        result.factsAdded += added;
      } catch (err) {
        result.errors.push(
          `Exchange ${i}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return result;
  }

  /** Find a parser that can handle this content */
  private detectParser(content: string): ConversationParser | null {
    for (const parser of this.parsers) {
      if (parser.canParse(content)) {
        return parser;
      }
    }
    return null;
  }
}
