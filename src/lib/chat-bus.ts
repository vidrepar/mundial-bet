import { EventEmitter } from "node:events";
import type { ChatEvent } from "./chat-bus.types";

/* in-process pub/sub for the group chat. The app runs as a single long-lived
 * Node process (standalone) on one container, so an in-memory emitter is all we
 * need to fan events out to every open SSE connection — no broker required. */
declare global {
  // eslint-disable-next-line no-var
  var __mundialChatBus: EventEmitter | undefined;
}

const bus = globalThis.__mundialChatBus ?? new EventEmitter();
bus.setMaxListeners(0);
globalThis.__mundialChatBus = bus;

export function emitChat(event: ChatEvent): void {
  bus.emit("event", event);
}

export function onChat(listener: (event: ChatEvent) => void): () => void {
  bus.on("event", listener);
  return () => {
    bus.off("event", listener);
  };
}
