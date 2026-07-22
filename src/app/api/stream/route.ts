import { getBus } from "@/lib/bus";
import type { BusEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const bus = getBus();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller already closed
        }
      };

      const onEvent = (e: BusEvent) => send(e.type, e);
      bus.emitter.on("event", onEvent);

      // Tell the client it is connected and whether a stream is mid-flight
      // (the client replays the buffered text from /api/state).
      send("connected", { streaming: bus.streaming.active });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          /* closed */
        }
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        bus.emitter.off("event", onEvent);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
