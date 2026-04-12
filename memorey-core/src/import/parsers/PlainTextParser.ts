import type { ConversationExchange } from "../../extraction/types.js";
import type { ConversationParser } from "../types.js";

/**
 * Parses plain text conversation logs.
 * Supports "User:/Assistant:" and "Human:/AI:" formats.
 */
export class PlainTextParser implements ConversationParser {
  canParse(content: string): boolean {
    const trimmed = content.trim();
    // Check for User:/Assistant: or Human:/AI: patterns
    return (
      /^(User|Human)\s*:/m.test(trimmed) &&
      /^(Assistant|AI)\s*:/m.test(trimmed)
    );
  }

  parse(content: string): ConversationExchange[] {
    const exchanges: ConversationExchange[] = [];

    // Split into message blocks by role prefix
    const messagePattern = /^(User|Human|Assistant|AI)\s*:\s*/m;
    const parts = content.split(messagePattern).filter((s) => s.trim());

    // parts will be [role, text, role, text, ...]
    const messages: Array<{ role: "user" | "assistant"; text: string }> = [];
    for (let i = 0; i < parts.length - 1; i += 2) {
      const role = parts[i].trim().toLowerCase();
      const text = parts[i + 1].trim();
      if (role === "user" || role === "human") {
        messages.push({ role: "user", text });
      } else if (role === "assistant" || role === "ai") {
        messages.push({ role: "assistant", text });
      }
    }

    // Pair user/assistant messages
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === "user" && messages[i + 1].role === "assistant") {
        exchanges.push({
          userMessage: messages[i].text,
          assistantMessage: messages[i + 1].text,
          platform: "other",
          timestamp: new Date().toISOString(),
        });
        i++; // skip the assistant message
      }
    }

    return exchanges;
  }
}
