import { EventEmitter } from "events";
import type { BusEvent, StreamingState } from "./types";

interface Bus {
  emitter: EventEmitter;
  /** Live buffer of the in-flight analysis, so page refreshes can replay mid-stream. */
  streaming: StreamingState;
  /** Simple mutex: only one analysis pipeline may run at a time. */
  busy: boolean;
}

const g = globalThis as unknown as { __satoshiBus?: Bus };

export function getBus(): Bus {
  if (!g.__satoshiBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(500);
    g.__satoshiBus = {
      emitter,
      streaming: { active: false, kind: null, dossierIndex: null, text: "" },
      busy: false,
    };
  }
  return g.__satoshiBus;
}

export function broadcast(event: BusEvent): void {
  getBus().emitter.emit("event", event);
}

export function beginStreaming(
  kind: "dossier" | "community" | "synthesis",
  dossierIndex: number | null
): void {
  const bus = getBus();
  bus.streaming = { active: true, kind, dossierIndex, text: "" };
}

export function appendStreaming(text: string): void {
  getBus().streaming.text += text;
}

export function endStreaming(): void {
  const bus = getBus();
  bus.streaming = { active: false, kind: null, dossierIndex: null, text: "" };
}
