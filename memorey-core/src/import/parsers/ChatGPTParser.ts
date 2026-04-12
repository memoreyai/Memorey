import type { ConversationExchange } from "../../extraction/types.js";
import type { ConversationParser } from "../types.js";

interface ChatGPTMessage {
  id: string;
  author: { role: string };
  content: { parts?: string[]; content_type?: string };
  create_time?: number;
}

interface ChatGPTNode {
  id: string;
  message?: ChatGPTMessage;
  parent?: string;
  children: string[];
}

interface ChatGPTConversation {
  title?: string;
  mapping: Record<string, ChatGPTNode>;
  create_time?: number;
  conversation_id?: string;
}

interface ChatGPTExport {
  conversations?: ChatGPTConversation[];
  // Single conversation format (no wrapper)
  mapping?: Record<string, ChatGPTNode>;
  conversation_id?: string;
}

/**
 * Parses ChatGPT export format.
 * ChatGPT exports a JSON file with a `conversations` array,
 * or sometimes a single conversation object with `mapping`.
 */
export class ChatGPTParser implements ConversationParser {
  canParse(content: string): boolean {
    try {
      const parsed = JSON.parse(content);
      // Array of conversations
      if (Array.isArray(parsed)) {
        return parsed.length > 0 && parsed[0].mapping !== undefined;
      }
      // Single conversation or wrapper
      return (
        parsed.mapping !== undefined ||
        (Array.isArray(parsed.conversations) && parsed.conversations.length > 0)
      );
    } catch {
      return false;
    }
  }

  parse(content: string): ConversationExchange[] {
    const parsed = JSON.parse(content) as ChatGPTExport | ChatGPTConversation[];

    let conversations: ChatGPTConversation[];

    if (Array.isArray(parsed)) {
      conversations = parsed;
    } else if (parsed.conversations) {
      conversations = parsed.conversations;
    } else if (parsed.mapping) {
      conversations = [parsed as unknown as ChatGPTConversation];
    } else {
      return [];
    }

    const exchanges: ConversationExchange[] = [];

    for (const conv of conversations) {
      const messages = this.extractMessages(conv);
      const convId = conv.conversation_id;

      // Pair user/assistant messages
      for (let i = 0; i < messages.length - 1; i++) {
        if (
          messages[i].role === "user" &&
          messages[i + 1].role === "assistant"
        ) {
          exchanges.push({
            userMessage: messages[i].text,
            assistantMessage: messages[i + 1].text,
            platform: "chatgpt",
            timestamp: messages[i].timestamp ?? new Date().toISOString(),
            ...(convId ? { conversationId: convId } : {}),
          });
          i++;
        }
      }
    }

    return exchanges;
  }

  private extractMessages(
    conv: ChatGPTConversation
  ): Array<{ role: string; text: string; timestamp?: string }> {
    const messages: Array<{
      role: string;
      text: string;
      timestamp?: string;
      createTime?: number;
    }> = [];

    for (const node of Object.values(conv.mapping)) {
      const msg = node.message;
      if (!msg) continue;
      const role = msg.author?.role;
      if (role !== "user" && role !== "assistant") continue;

      const text = msg.content?.parts?.join("\n") ?? "";
      if (!text.trim()) continue;

      const createTime = msg.create_time;
      const timestamp = createTime
        ? new Date(createTime * 1000).toISOString()
        : undefined;

      messages.push({ role, text, timestamp, createTime });
    }

    // Sort by create_time if available
    messages.sort((a, b) => (a.createTime ?? 0) - (b.createTime ?? 0));

    return messages;
  }
}
