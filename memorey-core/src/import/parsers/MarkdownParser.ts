import type { ConversationExchange } from "../../extraction/types.js";
import type { ConversationParser } from "../types.js";

/**
 * Parses markdown conversation logs with headers:
 * ## User
 * Hello...
 * ## Assistant
 * Hi...
 */
export class MarkdownParser implements ConversationParser {
  canParse(content: string): boolean {
    const trimmed = content.trim();
    // Look for markdown headers with role names
    return (
      /^#{1,3}\s+(User|Human)\s*$/m.test(trimmed) &&
      /^#{1,3}\s+(Assistant|AI)\s*$/m.test(trimmed)
    );
  }

  parse(content: string): ConversationExchange[] {
    const exchanges: ConversationExchange[] = [];

    // Split by markdown headers (# User, ## User, ### User, etc.)
    const headerPattern = /^#{1,3}\s+(User|Human|Assistant|AI)\s*$/m;
    const parts = content.split(headerPattern).filter((s) => s.trim());

    // parts: [role, text, role, text, ...]
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
        i++;
      }
    }

    return exchanges;
  }
}
