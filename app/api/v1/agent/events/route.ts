/**
 * GET /api/v1/agent/events?taskId=xyz
 *
 * Streams real-time execution events from SoufAI Agent Engine using SSE,
 * enforcing user ownership via Turso.
 */

import { NextRequest } from "next/server";
import { SoufAIEngine } from "@/lib/agent/engine/soufAIEngine";
import { AgentRepository } from "@/lib/db";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return new Response(JSON.stringify({ error: "taskId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const task = await AgentRepository.getTask(taskId, user.role === "super_admin" ? undefined : user.id);
  if (!task) {
    return new Response(JSON.stringify({ error: "Task not found or unauthorized" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    async start(controller) {
      try {
        const pastEvents = await AgentRepository.getEventsByTaskId(taskId, 100);
        for (const evt of pastEvents) {
          const sseData = `data: ${JSON.stringify(evt)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        }
      } catch (err) {
        console.warn("Error fetching past agent events:", err);
      }

      const unsubscribe = SoufAIEngine.subscribeToTaskEvents(taskId, (evt) => {
        try {
          const sseData = `data: ${JSON.stringify(evt)}\n\n`;
          controller.enqueue(encoder.encode(sseData));

          if (evt.eventType === "agent.completed" || evt.eventType === "agent.failed") {
            setTimeout(() => {
              try {
                controller.close();
              } catch {}
            }, 1000);
          }
        } catch (err) {
          console.error("Error pushing event to SSE stream:", err);
        }
      });

      req.signal.addEventListener("abort", () => {
        unsubscribe();
      });
    },
  });

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
