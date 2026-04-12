import type { ConversationExchange } from "../../extraction/types.js";
import type { ConversationParser } from "../types.js";

/**
 * Parses our native ConversationExchange[] JSON format.
 */
export class JsonParser implements ConversationParser {
  canParse(content: string): boolean {
    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed) || parsed.length === 0) return false;
      // Check first element looks like a ConversationExchange
      const first = parsed[0];
      return (
        typeof first.userMessage === "string" &&
        typeof first.assistantMessage === "string"
      );
    } catch {
      return false;
    }
  }

  parse(content: string): ConversationExchange[] {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error("Expected a JSON array of ConversationExchange objects");
    }

    return parsed.map((item: Record<string, unknown>) => ({
      userMessage: String(item.userMessage ?? ""),
      assistantMessage: String(item.assistantMessage ?? ""),
      platform: String(item.platform ?? "other"),
      timestamp: String(item.timestamp ?? new Date().toISOString()),
      ...(item.conversationId
        ? { conversationId: String(item.conversationId) }
        : {}),
    }));
  }
}
