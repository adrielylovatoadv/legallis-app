import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getTicketById } from "@/lib/suporte";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const ticket = getTicketById(id);
  if (!ticket) return new Response("Not found", { status: 404 });
  if (ticket.userId !== session.user.id && session.user.role !== "admin" && session.user.plan !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  let lastCount = ticket.messages.length;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial message count
      const initialData = `data: ${JSON.stringify({ type: "init", count: lastCount })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initialData));

      const interval = setInterval(() => {
        if (closed) { clearInterval(interval); return; }
        try {
          const current = getTicketById(id);
          if (!current) { clearInterval(interval); controller.close(); return; }

          if (current.messages.length > lastCount) {
            const newMessages = current.messages.slice(lastCount);
            lastCount = current.messages.length;
            const data = `data: ${JSON.stringify({ type: "messages", messages: newMessages, status: current.status })}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          }
        } catch {
          clearInterval(interval);
          try { controller.close(); } catch { /* already closed */ }
        }
      }, 2000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
