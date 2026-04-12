import type { MemoreyEvent, EventHandler } from "./types.js";

export class EventBus {
  private handlers: Map<string, Set<Function>> = new Map();
  private anyHandlers: Set<(event: MemoreyEvent) => void> = new Set();

  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  on<T extends MemoreyEvent["type"]>(type: T, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  /** Subscribe to all events. Returns an unsubscribe function. */
  onAny(handler: (event: MemoreyEvent) => void): () => void {
    this.anyHandlers.add(handler);
    return () => {
      this.anyHandlers.delete(handler);
    };
  }

  /** Emit an event to all matching handlers. */
  emit(event: MemoreyEvent): void {
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        handler(event);
      }
    }

    for (const handler of this.anyHandlers) {
      handler(event);
    }
  }

  /** Remove all handlers. */
  clear(): void {
    this.handlers.clear();
    this.anyHandlers.clear();
  }
}
