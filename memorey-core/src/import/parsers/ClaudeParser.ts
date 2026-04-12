import type { ConversationExchange } from "../../extraction/types.js";
import type { ConversationParser } from "../types.js";

interface ClaudeMessage {
  role?: string;
  sender?: string;
  content: string | Array<{ type: string; text?: string }>;
  created_at?: string;
  timestamp?: string;
}

interface ClaudeConversation {
  uuid?: string;
  name?: string;
  chat_messages?: ClaudeMessage[];
  messages?: ClaudeMessage[];
  created_at?: string;
}

/**
 * Parses Claude conversation export format.
 * Claude exports conversations as JSON with a message array.
 */
export class ClaudeParser implements ConversationParser {
  canParse(content: string): boolean {
    try {
      const parsed = JSON.parse(content);

      // Array of conversations
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return false;
        const first = parsed[0];
        return (
          first.chat_messages !== undefined || first.messages !== undefined
        );
      }

      // Single conversation
      return (
        parsed.chat_messages !== undefined || parsed.messages !== undefined
      );
    } catch {
      return false;
    }
  }

  parse(content: string): ConversationExchange[] {
    const parsed = JSON.parse(content);

    let conversations: ClaudeConversation[];
    if (Array.isArray(parsed)) {
      conversations = parsed;
    } else {
      conversations = [parsed];
    }

    const exchanges: ConversationExchange[] = [];

    for (const conv of conversations) {
      const rawMessages = conv.chat_messages ?? conv.messages ?? [];
      const messages = rawMessages.map((msg) => ({
        role: this.normalizeRole(msg),
        text: this.extractText(msg),
        timestamp:
          msg.created_at ?? msg.timestamp ?? conv.created_at ?? new Date().toISOString(),
      }));

      // Pair user/assistant messages
      for (let i = 0; i < messages.length - 1; i++) {
        if (
          messages[i].role === "user" &&
          messages[i + 1].role === "assistant"
        ) {
          exchanges.push({
            userMessage: messages[i].text,
            assistantMessage: messages[i + 1].text,
            platform: "claude",
            timestamp: messages[i].timestamp,
            ...(conv.uuid ? { conversationId: conv.uuid } : {}),
          });
          i++;
        }
      }
    }

    return exchanges;
  }

  private normalizeRole(msg: ClaudeMessage): "user" | "assistant" | "other" {
    const role = (msg.role ?? msg.sender ?? "").toLowerCase();
    if (role === "human" || role === "user") return "user";
    if (role === "assistant") return "assistant";
    return "other";
  }

  private extractText(msg: ClaudeMessage): string {
    if (typeof msg.content === "string") return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter((block) => block.type === "text" && block.text)
        .map((block) => block.text!)
        .join("\n");
    }
    return "";
  }
}
