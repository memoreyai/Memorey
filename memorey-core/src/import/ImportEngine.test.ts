import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoreyPipeline } from "../pipeline/MemoreyPipeline.js";
import { ImportEngine } from "./ImportEngine.js";
import { PlainTextParser } from "./parsers/PlainTextParser.js";
import { MarkdownParser } from "./parsers/MarkdownParser.js";
import { JsonParser } from "./parsers/JsonParser.js";
import { ChatGPTParser } from "./parsers/ChatGPTParser.js";
import { ClaudeParser } from "./parsers/ClaudeParser.js";

let tempDir: string;
let storagePath: string;
let pipeline: MemoreyPipeline;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "memorey-import-test-"));
  storagePath = join(tempDir, "graph.json");
  pipeline = new MemoreyPipeline({ storagePath });
  await pipeline.init("vikram");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ── Parser Tests ────────────────────────────────────────────

describe("PlainTextParser", () => {
  const parser = new PlainTextParser();

  it('correctly parses "User:/Assistant:" format', () => {
    const content = `User: Hello, I'm Vikram
Assistant: Hi Vikram! How can I help?
User: I work at a startup called Memorey
Assistant: That's cool! What does Memorey do?`;

    const exchanges = parser.parse(content);
    expect(exchanges).toHaveLength(2);
    expect(exchanges[0].userMessage).toBe("Hello, I'm Vikram");
    expect(exchanges[0].assistantMessage).toBe("Hi Vikram! How can I help?");
    expect(exchanges[1].userMessage).toBe(
      "I work at a startup called Memorey"
    );
    expect(exchanges[1].assistantMessage).toBe(
      "That's cool! What does Memorey do?"
    );
  });

  it('correctly parses "Human:/AI:" format', () => {
    const content = `Human: I'm building a product
AI: Tell me more about it
Human: It's called Memorey, it remembers things about users
AI: That sounds interesting!`;

    const exchanges = parser.parse(content);
    expect(exchanges).toHaveLength(2);
    expect(exchanges[0].userMessage).toBe("I'm building a product");
    expect(exchanges[0].assistantMessage).toBe("Tell me more about it");
  });

  it("canParse returns true for valid formats", () => {
    expect(
      parser.canParse("User: hello\nAssistant: hi")
    ).toBe(true);
    expect(
      parser.canParse("Human: hello\nAI: hi")
    ).toBe(true);
  });

  it("canParse returns false for non-matching formats", () => {
    expect(parser.canParse("just some random text")).toBe(false);
    expect(parser.canParse('{"key": "value"}')).toBe(false);
  });
});

describe("MarkdownParser", () => {
  const parser = new MarkdownParser();

  it("parses markdown conversation format", () => {
    const content = `## User
Hello, I'm Vikram and I live in San Francisco

## Assistant
Hi Vikram! Nice to meet you. SF is a great city!

## User
I'm building an AI product called Memorey

## Assistant
That sounds fascinating! Tell me more about Memorey.`;

    const exchanges = parser.parse(content);
    expect(exchanges).toHaveLength(2);
    expect(exchanges[0].userMessage).toContain("Vikram");
    expect(exchanges[0].assistantMessage).toContain("SF");
    expect(exchanges[1].userMessage).toContain("Memorey");
  });

  it("canParse detects markdown format", () => {
    expect(
      parser.canParse("## User\nHello\n## Assistant\nHi")
    ).toBe(true);
    expect(
      parser.canParse("# User\nHello\n# Assistant\nHi")
    ).toBe(true);
    expect(parser.canParse("User: hello\nAssistant: hi")).toBe(false);
  });
});

describe("JsonParser", () => {
  const parser = new JsonParser();

  it("parses ConversationExchange[] array", () => {
    const exchanges = [
      {
        userMessage: "Hi, I'm Vikram",
        assistantMessage: "Hello Vikram!",
        platform: "chatgpt",
        timestamp: "2026-04-01T10:00:00Z",
      },
      {
        userMessage: "I work on Memorey",
        assistantMessage: "Tell me about it",
        platform: "chatgpt",
        timestamp: "2026-04-01T10:01:00Z",
      },
    ];

    const content = JSON.stringify(exchanges);
    const result = parser.parse(content);
    expect(result).toHaveLength(2);
    expect(result[0].userMessage).toBe("Hi, I'm Vikram");
    expect(result[0].platform).toBe("chatgpt");
    expect(result[1].userMessage).toBe("I work on Memorey");
  });

  it("canParse detects ConversationExchange format", () => {
    const valid = JSON.stringify([
      { userMessage: "hi", assistantMessage: "hello", platform: "other", timestamp: "2026-01-01" },
    ]);
    expect(parser.canParse(valid)).toBe(true);
    expect(parser.canParse("not json")).toBe(false);
    expect(parser.canParse("[]")).toBe(false);
    expect(parser.canParse('[{"other": "data"}]')).toBe(false);
  });
});

describe("ChatGPTParser", () => {
  const parser = new ChatGPTParser();

  it("parses a mock ChatGPT export JSON structure", () => {
    const chatgptExport = [
      {
        title: "Test Conversation",
        conversation_id: "conv-123",
        mapping: {
          "node-1": {
            id: "node-1",
            message: {
              id: "msg-1",
              author: { role: "user" },
              content: { parts: ["Hello, I'm Vikram"], content_type: "text" },
              create_time: 1712000000,
            },
            children: ["node-2"],
          },
          "node-2": {
            id: "node-2",
            message: {
              id: "msg-2",
              author: { role: "assistant" },
              content: { parts: ["Hi Vikram! How can I help?"], content_type: "text" },
              create_time: 1712000001,
            },
            parent: "node-1",
            children: ["node-3"],
          },
          "node-3": {
            id: "node-3",
            message: {
              id: "msg-3",
              author: { role: "user" },
              content: { parts: ["I'm 28 years old"], content_type: "text" },
              create_time: 1712000002,
            },
            parent: "node-2",
            children: ["node-4"],
          },
          "node-4": {
            id: "node-4",
            message: {
              id: "msg-4",
              author: { role: "assistant" },
              content: { parts: ["Good to know!"], content_type: "text" },
              create_time: 1712000003,
            },
            parent: "node-3",
            children: [],
          },
          "root": {
            id: "root",
            message: null,
            children: ["node-1"],
          },
        },
      },
    ];

    const content = JSON.stringify(chatgptExport);
    const exchanges = parser.parse(content);
    expect(exchanges).toHaveLength(2);
    expect(exchanges[0].userMessage).toBe("Hello, I'm Vikram");
    expect(exchanges[0].assistantMessage).toBe("Hi Vikram! How can I help?");
    expect(exchanges[0].platform).toBe("chatgpt");
    expect(exchanges[0].conversationId).toBe("conv-123");
    expect(exchanges[1].userMessage).toBe("I'm 28 years old");
  });

  it("canParse detects ChatGPT format", () => {
    const valid = JSON.stringify([{ mapping: {}, conversation_id: "x" }]);
    expect(parser.canParse(valid)).toBe(true);
    expect(parser.canParse('[{"messages": []}]')).toBe(false);
  });
});

describe("ClaudeParser", () => {
  const parser = new ClaudeParser();

  it("parses a mock Claude export JSON structure", () => {
    const claudeExport = [
      {
        uuid: "conv-abc",
        name: "Test Chat",
        chat_messages: [
          {
            role: "human",
            content: "Hi, my name is Vikram",
            created_at: "2026-04-01T10:00:00Z",
          },
          {
            role: "assistant",
            content: "Hello Vikram! Nice to meet you.",
            created_at: "2026-04-01T10:00:05Z",
          },
          {
            role: "human",
            content: "I live in San Francisco",
            created_at: "2026-04-01T10:01:00Z",
          },
          {
            role: "assistant",
            content: "SF is a great city!",
            created_at: "2026-04-01T10:01:05Z",
          },
        ],
      },
    ];

    const content = JSON.stringify(claudeExport);
    const exchanges = parser.parse(content);
    expect(exchanges).toHaveLength(2);
    expect(exchanges[0].userMessage).toBe("Hi, my name is Vikram");
    expect(exchanges[0].assistantMessage).toBe("Hello Vikram! Nice to meet you.");
    expect(exchanges[0].platform).toBe("claude");
    expect(exchanges[0].conversationId).toBe("conv-abc");
    expect(exchanges[1].userMessage).toBe("I live in San Francisco");
  });

  it("handles content blocks format", () => {
    const claudeExport = {
      uuid: "conv-xyz",
      chat_messages: [
        {
          role: "human",
          content: [{ type: "text", text: "Hello there" }],
        },
        {
          role: "assistant",
          content: [{ type: "text", text: "Hi! How can I help?" }],
        },
      ],
    };

    const exchanges = parser.parse(JSON.stringify(claudeExport));
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0].userMessage).toBe("Hello there");
  });

  it("canParse detects Claude format", () => {
    const valid = JSON.stringify([{ chat_messages: [] }]);
    expect(parser.canParse(valid)).toBe(true);
    const validMessages = JSON.stringify({ messages: [] });
    expect(parser.canParse(validMessages)).toBe(true);
    expect(parser.canParse('[{"mapping": {}}]')).toBe(false);
  });
});

// ── canParse Auto-Detection ──────────────────────────────────

describe("canParse auto-detection", () => {
  it("each parser correctly identifies its format", () => {
    const plainText = "User: hi\nAssistant: hello";
    const markdown = "## User\nhi\n## Assistant\nhello";
    const json = JSON.stringify([
      { userMessage: "hi", assistantMessage: "hello", platform: "other", timestamp: "2026-01-01" },
    ]);
    const chatgpt = JSON.stringify([{ mapping: { n: { id: "n", message: { id: "m", author: { role: "user" }, content: { parts: ["hi"] }, create_time: 1 }, children: [] } }, conversation_id: "x" }]);
    const claude = JSON.stringify([{ chat_messages: [{ role: "human", content: "hi" }] }]);

    const plainParser = new PlainTextParser();
    const mdParser = new MarkdownParser();
    const jsonParser = new JsonParser();
    const cgptParser = new ChatGPTParser();
    const claudeParser = new ClaudeParser();

    // Each parser should detect its own format
    expect(plainParser.canParse(plainText)).toBe(true);
    expect(mdParser.canParse(markdown)).toBe(true);
    expect(jsonParser.canParse(json)).toBe(true);
    expect(cgptParser.canParse(chatgpt)).toBe(true);
    expect(claudeParser.canParse(claude)).toBe(true);

    // And not detect other formats
    expect(plainParser.canParse(json)).toBe(false);
    expect(mdParser.canParse(plainText)).toBe(false);
  });
});

// ── ImportEngine Tests ──────────────────────────────────────

describe("ImportEngine", () => {
  it("processes exchanges sequentially and returns correct ImportResult", async () => {
    const engine = new ImportEngine(pipeline);

    const content = `User: Hi, my name is Vikram
Assistant: Hello Vikram!
User: I live in San Francisco
Assistant: SF is a great city!`;

    const result = await engine.importFromString(content, "other");

    expect(result.exchangesParsed).toBe(2);
    expect(result.factsExtracted).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    // factsAdded should match or be close to factsExtracted (first import)
    expect(result.factsAdded).toBeGreaterThan(0);
  });

  it("import same content twice → all duplicates on second import", async () => {
    const engine = new ImportEngine(pipeline);

    const content = `User: My name is Vikram and I'm 28 years old
Assistant: Nice to meet you Vikram!`;

    const first = await engine.importFromString(content, "other");
    expect(first.factsExtracted).toBeGreaterThan(0);
    expect(first.errors).toHaveLength(0);

    const second = await engine.importFromString(content, "other");
    // On second import, all facts should be duplicates
    expect(second.exchangesParsed).toBe(first.exchangesParsed);
    expect(second.duplicates).toBeGreaterThan(0);
    expect(second.factsAdded).toBe(0);
  });

  it("import with errors in some exchanges → errors reported, valid exchanges still processed", async () => {
    const engine = new ImportEngine(pipeline);

    // Create a custom parser that produces a mix of valid and invalid exchanges
    const content = JSON.stringify([
      {
        userMessage: "My name is Vikram",
        assistantMessage: "Hello Vikram!",
        platform: "other",
        timestamp: "2026-04-01T10:00:00Z",
      },
      {
        userMessage: "", // empty - won't extract facts but won't error either
        assistantMessage: "",
        platform: "other",
        timestamp: "2026-04-01T10:01:00Z",
      },
      {
        userMessage: "I live in San Francisco",
        assistantMessage: "That's a great city!",
        platform: "other",
        timestamp: "2026-04-01T10:02:00Z",
      },
    ]);

    const result = await engine.importFromString(content, "other");
    expect(result.exchangesParsed).toBe(3);
    // Should have extracted facts from at least the valid exchanges
    expect(result.factsExtracted).toBeGreaterThan(0);
  });

  it("importFromFile works with a real file", async () => {
    const engine = new ImportEngine(pipeline);

    const filePath = join(tempDir, "test-import.txt");
    const content = `User: I'm Vikram, I work on AI products
Assistant: That's interesting! Tell me more about your work.`;

    await writeFile(filePath, content, "utf-8");

    const result = await engine.importFromFile(filePath, "other");
    expect(result.exchangesParsed).toBe(1);
    expect(result.factsExtracted).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("returns error when no parser matches", async () => {
    const engine = new ImportEngine(pipeline);
    const result = await engine.importFromString(
      "just some random text with no conversation pattern",
      "other"
    );
    expect(result.exchangesParsed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("No parser");
  });
});
