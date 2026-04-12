import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractByRules } from "./local-rules.js";
import { ExtractionEngine } from "./ExtractionEngine.js";
import { buildExtractionPrompt, buildConflictDetectionPrompt } from "./prompts.js";
import type { ConversationExchange, ExtractedFact } from "./types.js";
import type { VaultDefinition } from "../graph/types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function makeExchange(
  userMessage: string,
  assistantMessage = "Got it!",
  platform = "claude"
): ConversationExchange {
  return {
    userMessage,
    assistantMessage,
    platform,
    timestamp: "2026-04-10T12:00:00Z",
    conversationId: "conv-test-1",
  };
}

function findFact(facts: ExtractedFact[], substring: string): ExtractedFact | undefined {
  return facts.find((f) => f.fact.toLowerCase().includes(substring.toLowerCase()));
}

// ── Rule-based extraction tests ─────────────────────────────────────

describe("extractByRules", () => {
  describe("identity statements", () => {
    it("extracts name from 'my name is X'", () => {
      const facts = extractByRules(makeExchange("Hi, my name is Vikram"));
      const nameFact = findFact(facts, "name is Vikram");
      expect(nameFact).toBeDefined();
      expect(nameFact!.vault).toBe("identity");
      expect(nameFact!.confidence).toBeGreaterThanOrEqual(0.9);
      expect(nameFact!.entities).toContain("Vikram");
    });

    it("extracts location from 'I live in X'", () => {
      const facts = extractByRules(makeExchange("I live in Bangalore"));
      const fact = findFact(facts, "lives in Bangalore");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("identity");
      expect(fact!.entities).toContain("Bangalore");
    });

    it("extracts origin from \"I'm from X\"", () => {
      const facts = extractByRules(makeExchange("I'm from Mumbai"));
      const fact = findFact(facts, "from Mumbai");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("identity");
    });

    it("extracts age from 'I'm X years old'", () => {
      const facts = extractByRules(makeExchange("I'm 28 years old"));
      const fact = findFact(facts, "28 years old");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("identity");
    });
  });

  describe("work statements", () => {
    it("extracts company from 'I work at X'", () => {
      const facts = extractByRules(makeExchange("I work at Google"));
      const fact = findFact(facts, "works at Google");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("work");
      expect(fact!.confidence).toBeGreaterThanOrEqual(0.85);
      expect(fact!.entities).toContain("Google");
    });

    it("extracts role from 'I'm a [role]'", () => {
      const facts = extractByRules(makeExchange("I'm a software engineer"));
      const fact = findFact(facts, "software engineer");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("work");
    });

    it("extracts 'I'm building X'", () => {
      const facts = extractByRules(makeExchange("I'm building a marketplace app"));
      const fact = findFact(facts, "building");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("work");
    });
  });

  describe("preference statements", () => {
    it("extracts 'I prefer X over Y'", () => {
      const facts = extractByRules(
        makeExchange("I prefer TypeScript over JavaScript")
      );
      const fact = findFact(facts, "prefers TypeScript over JavaScript");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("preferences");
      expect(fact!.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("extracts 'I like X'", () => {
      const facts = extractByRules(makeExchange("I really like functional programming"));
      const fact = findFact(facts, "likes");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("preferences");
    });

    it("extracts 'I don't like X'", () => {
      const facts = extractByRules(
        makeExchange("I don't like using Redux")
      );
      const fact = findFact(facts, "does not like");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("preferences");
    });

    it("extracts 'my favorite X is Y'", () => {
      const facts = extractByRules(
        makeExchange("my favorite language is Rust")
      );
      const fact = findFact(facts, "favorite");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("preferences");
    });

    it("extracts two preference facts from a compound statement", () => {
      const facts = extractByRules(
        makeExchange("I don't like using Redux, I prefer Zustand")
      );
      const dislike = findFact(facts, "does not like");
      const prefer = findFact(facts, "prefers Zustand");
      expect(dislike).toBeDefined();
      expect(prefer).toBeDefined();
      expect(dislike!.vault).toBe("preferences");
      expect(prefer!.vault).toBe("preferences");
    });
  });

  describe("relationship statements", () => {
    it("extracts 'my [relation] is X'", () => {
      const facts = extractByRules(makeExchange("my wife is Priya"));
      const fact = findFact(facts, "wife");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("relationships");
      expect(fact!.entities).toContain("Priya");
    });

    it("extracts 'my cofounder X and I'", () => {
      const facts = extractByRules(
        makeExchange("My cofounder Sarah and I are building a marketplace app")
      );
      const fact = findFact(facts, "cofounder");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("relationships");
      expect(fact!.entities).toContain("Sarah");
    });

    it("extracts 'I work with X'", () => {
      const facts = extractByRules(makeExchange("I work with Rahul"));
      const fact = findFact(facts, "works with Rahul");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("relationships");
    });
  });

  describe("project statements", () => {
    it("extracts 'I'm working on X'", () => {
      const facts = extractByRules(
        makeExchange("I'm working on a new API")
      );
      const fact = findFact(facts, "working on");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("projects");
    });

    it("extracts 'we're building X'", () => {
      const facts = extractByRules(
        makeExchange("we're building a marketplace app")
      );
      const fact = findFact(facts, "building");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("projects");
    });
  });

  describe("temporal statements", () => {
    it("extracts 'I recently moved from X to Y'", () => {
      const facts = extractByRules(
        makeExchange("I recently moved from Mumbai to Bangalore")
      );
      const fact = findFact(facts, "moved");
      expect(fact).toBeDefined();
      expect(fact!.fact).toContain("Mumbai");
      expect(fact!.fact).toContain("Bangalore");
      expect(fact!.entities).toContain("Mumbai");
      expect(fact!.entities).toContain("Bangalore");
    });

    it("extracts 'I used to work at X'", () => {
      const facts = extractByRules(
        makeExchange("I used to work at Microsoft")
      );
      const fact = findFact(facts, "used to work at Microsoft");
      expect(fact).toBeDefined();
      expect(fact!.vault).toBe("history");
    });
  });

  describe("compound extraction", () => {
    it("extracts identity + work facts from a single message", () => {
      const facts = extractByRules(
        makeExchange("Hi, I'm Vikram and I work at a startup")
      );
      const nameFact = findFact(facts, "Vikram");
      const workFact = findFact(facts, "work");
      expect(nameFact).toBeDefined();
      expect(workFact).toBeDefined();
      expect(nameFact!.vault).toBe("identity");
      expect(workFact!.vault).toBe("work");
    });

    it("extracts relationship + project facts from a compound message", () => {
      const facts = extractByRules(
        makeExchange(
          "My cofounder Sarah and I are building a marketplace app"
        )
      );
      const relFact = findFact(facts, "cofounder");
      const projFact = findFact(facts, "building");
      expect(relFact).toBeDefined();
      expect(projFact).toBeDefined();
      expect(relFact!.vault).toBe("relationships");
      expect(projFact!.vault).toBe("projects");
    });
  });

  describe("edge cases", () => {
    it("ignores assistant messages — only extracts from user message", () => {
      const exchange = makeExchange(
        "Hello",
        "I work at OpenAI and my name is ChatGPT"
      );
      const facts = extractByRules(exchange);
      const openai = findFact(facts, "OpenAI");
      expect(openai).toBeUndefined();
    });

    it("returns empty array for empty user message", () => {
      const facts = extractByRules(makeExchange(""));
      expect(facts).toEqual([]);
    });

    it("returns empty array for whitespace-only user message", () => {
      const facts = extractByRules(makeExchange("   "));
      expect(facts).toEqual([]);
    });

    it("captures originalExcerpt for each extracted fact", () => {
      const facts = extractByRules(makeExchange("I work at Google"));
      expect(facts.length).toBeGreaterThan(0);
      for (const fact of facts) {
        expect(fact.originalExcerpt).toBeDefined();
        expect(fact.originalExcerpt.length).toBeGreaterThan(0);
      }
    });

    it("produces confidence scores between 0 and 1", () => {
      const facts = extractByRules(
        makeExchange("I'm Vikram, I work at Google, I prefer TypeScript")
      );
      expect(facts.length).toBeGreaterThan(0);
      for (const fact of facts) {
        expect(fact.confidence).toBeGreaterThan(0);
        expect(fact.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});

// ── Prompt builder tests ────────────────────────────────────────────

describe("prompts", () => {
  const sampleVaults: VaultDefinition[] = [
    {
      id: "identity",
      name: "Identity",
      description: "Who the user is",
      isDefault: true,
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "work",
      name: "Work",
      description: "Job and company info",
      isDefault: true,
      createdAt: "2026-01-01T00:00:00Z",
    },
  ];

  describe("buildExtractionPrompt", () => {
    it("includes exchange details in the prompt", () => {
      const exchange = makeExchange("I work at Acme");
      const prompt = buildExtractionPrompt(exchange, [], sampleVaults);
      expect(prompt).toContain("I work at Acme");
      expect(prompt).toContain("claude");
      expect(prompt).toContain("JSON array");
    });

    it("includes existing facts when provided", () => {
      const exchange = makeExchange("test");
      const prompt = buildExtractionPrompt(
        exchange,
        ["User lives in London"],
        sampleVaults
      );
      expect(prompt).toContain("User lives in London");
      expect(prompt).toContain("contradictions");
    });

    it("includes vault descriptions", () => {
      const exchange = makeExchange("test");
      const prompt = buildExtractionPrompt(exchange, [], sampleVaults);
      expect(prompt).toContain('"identity"');
      expect(prompt).toContain("Who the user is");
      expect(prompt).toContain('"work"');
    });

    it("handles custom vaults", () => {
      const customVaults: VaultDefinition[] = [
        ...sampleVaults,
        {
          id: "health",
          name: "Health",
          description: "Health and fitness info",
          isDefault: false,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ];
      const prompt = buildExtractionPrompt(
        makeExchange("test"),
        [],
        customVaults
      );
      expect(prompt).toContain('"health"');
      expect(prompt).toContain("Health and fitness info");
    });
  });

  describe("buildConflictDetectionPrompt", () => {
    it("includes the new fact and existing facts", () => {
      const prompt = buildConflictDetectionPrompt("User lives in Bangalore", [
        "User lives in Mumbai",
        "User works at Google",
      ]);
      expect(prompt).toContain("User lives in Bangalore");
      expect(prompt).toContain("User lives in Mumbai");
      expect(prompt).toContain("User works at Google");
    });

    it("asks for JSON-only response", () => {
      const prompt = buildConflictDetectionPrompt("test", ["existing"]);
      expect(prompt).toContain("JSON array");
    });
  });
});

// ── ExtractionEngine tests ──────────────────────────────────────────

describe("ExtractionEngine", () => {
  describe("constructor", () => {
    it("creates engine with useLLM=false", () => {
      const engine = new ExtractionEngine({ useLLM: false });
      expect(engine).toBeDefined();
    });

    it("throws if useLLM=true but no provider config", () => {
      expect(
        () => new ExtractionEngine({ useLLM: true })
      ).toThrow("llmProvider config is required");
    });

    it("creates engine with LLM config", () => {
      const engine = new ExtractionEngine({
        useLLM: true,
        llmProvider: {
          apiKey: "test-key",
          model: "gpt-4",
        },
      });
      expect(engine).toBeDefined();
    });
  });

  describe("extract — rules only", () => {
    let engine: ExtractionEngine;

    beforeEach(() => {
      engine = new ExtractionEngine({ useLLM: false });
    });

    it("extracts facts from a simple message", async () => {
      const result = await engine.extract(
        makeExchange("I work at Google")
      );
      expect(result.facts.length).toBeGreaterThan(0);
      expect(result.source.platform).toBe("claude");
      expect(result.source.conversationId).toBe("conv-test-1");
    });

    it("returns empty facts for generic messages", async () => {
      const result = await engine.extract(
        makeExchange("Can you help me debug this code?")
      );
      expect(result.facts).toEqual([]);
    });

    it("sets correct source metadata", async () => {
      const exchange = makeExchange("I live in NYC", "Nice!", "chatgpt");
      exchange.conversationId = "conv-xyz";
      const result = await engine.extract(exchange);
      expect(result.source.platform).toBe("chatgpt");
      expect(result.source.conversationId).toBe("conv-xyz");
      expect(result.source.timestamp).toBe("2026-04-10T12:00:00Z");
    });
  });

  describe("extract — with mocked LLM", () => {
    let engine: ExtractionEngine;

    beforeEach(() => {
      engine = new ExtractionEngine({
        useLLM: true,
        llmProvider: {
          apiKey: "test-key",
          model: "gpt-4",
          baseUrl: "https://api.test.com/v1",
        },
      });
    });

    it("merges rule-based and LLM facts", async () => {
      const llmResponse = JSON.stringify([
        {
          fact: "User is interested in machine learning",
          originalExcerpt: "I'm learning ML",
          vault: "knowledge",
          confidence: 0.8,
          entities: [],
          relationships: [],
        },
      ]);

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: llmResponse } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const result = await engine.extract(
        makeExchange("I work at Google and I'm learning ML")
      );

      // Should have both rule-based (work at Google) and LLM (ML interest)
      expect(result.facts.length).toBeGreaterThanOrEqual(2);
      const workFact = findFact(result.facts, "Google");
      const mlFact = findFact(result.facts, "machine learning");
      expect(workFact).toBeDefined();
      expect(mlFact).toBeDefined();

      fetchSpy.mockRestore();
    });

    it("deduplicates overlapping facts between rules and LLM", async () => {
      const llmResponse = JSON.stringify([
        {
          fact: "User works at Google",
          originalExcerpt: "I work at Google",
          vault: "work",
          confidence: 0.9,
          entities: ["Google"],
          relationships: [],
        },
      ]);

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: llmResponse } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const result = await engine.extract(
        makeExchange("I work at Google")
      );

      // Should deduplicate — only one Google fact
      const googleFacts = result.facts.filter((f) =>
        f.fact.toLowerCase().includes("google")
      );
      expect(googleFacts.length).toBe(1);

      fetchSpy.mockRestore();
    });

    it("falls back to rule-based results on LLM error", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Network error")
      );

      // Suppress the console.error from the engine
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await engine.extract(
        makeExchange("I work at Google")
      );

      // Should still have rule-based results
      expect(result.facts.length).toBeGreaterThan(0);
      const fact = findFact(result.facts, "Google");
      expect(fact).toBeDefined();

      fetchSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it("handles LLM returning markdown-fenced JSON", async () => {
      const llmResponse = '```json\n[{"fact":"User knows Python","originalExcerpt":"I know Python","vault":"knowledge","confidence":0.85,"entities":["Python"],"relationships":[]}]\n```';

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: llmResponse } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const result = await engine.extract(
        makeExchange("I know Python")
      );

      const pythonFact = findFact(result.facts, "Python");
      expect(pythonFact).toBeDefined();

      fetchSpy.mockRestore();
    });

    it("handles LLM returning empty array", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "[]" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const result = await engine.extract(
        makeExchange("What's the weather like?")
      );

      expect(result.facts).toEqual([]);

      fetchSpy.mockRestore();
    });

    it("sends correct request to LLM endpoint", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "[]" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      await engine.extract(makeExchange("test"));

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.test.com/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
          }),
        })
      );

      const callBody = JSON.parse(
        (fetchSpy.mock.calls[0][1] as RequestInit).body as string
      );
      expect(callBody.model).toBe("gpt-4");
      expect(callBody.messages[0].role).toBe("user");

      fetchSpy.mockRestore();
    });
  });

  describe("setVaults", () => {
    it("updates vault definitions", async () => {
      const engine = new ExtractionEngine({
        useLLM: true,
        llmProvider: {
          apiKey: "test-key",
          model: "gpt-4",
          baseUrl: "https://api.test.com/v1",
        },
      });

      const customVaults: VaultDefinition[] = [
        {
          id: "health",
          name: "Health",
          description: "Health info",
          isDefault: false,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ];

      engine.setVaults(customVaults);

      // Verify that the prompt uses updated vaults by triggering LLM
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "[]" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      await engine.extract(makeExchange("test"));

      const callBody = JSON.parse(
        (fetchSpy.mock.calls[0][1] as RequestInit).body as string
      );
      const prompt = callBody.messages[0].content;
      expect(prompt).toContain('"health"');
      expect(prompt).toContain("Health info");
      // Should NOT contain default vaults since we replaced them entirely
      expect(prompt).not.toContain('"identity"');

      fetchSpy.mockRestore();
    });
  });
});
