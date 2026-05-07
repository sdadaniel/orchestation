import { jsonErrorResponse } from "@/lib/errors/error-utils";
import {
  getDashboardChatBotStatePath,
  loadDashboardChatBotState,
  saveDashboardChatBotState,
  type DashboardChatBotState,
} from "@/service/dashboard-chatbot-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = loadDashboardChatBotState();
  return Response.json({
    ...state,
    path: getDashboardChatBotStatePath(),
  });
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErrorResponse("Invalid JSON body");
  }

  const b = body as Partial<DashboardChatBotState>;
  if (!b || typeof b !== "object") {
    return jsonErrorResponse("Invalid body");
  }

  const saved = saveDashboardChatBotState({
    activeSessionId:
      typeof b.activeSessionId === "string" ? b.activeSessionId : null,
    sessions: Array.isArray(b.sessions) ? (b.sessions as any) : [],
  });

  return Response.json(saved);
}

import { jsonErrorResponse } from "@/lib/errors/error-utils";
import {
  getDashboardChatBotStatePath,
  loadDashboardChatBotState,
  saveDashboardChatBotState,
  type DashboardChatBotState,
} from "@/service/dashboard-chatbot-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = loadDashboardChatBotState();
  return Response.json({
    ...state,
    path: getDashboardChatBotStatePath(),
  });
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErrorResponse("Invalid JSON body");
  }

  const b = body as Partial<DashboardChatBotState>;
  if (!b || typeof b !== "object") {
    return jsonErrorResponse("Invalid body");
  }

  const saved = saveDashboardChatBotState({
    activeSessionId:
      typeof b.activeSessionId === "string" ? b.activeSessionId : null,
    sessions: Array.isArray(b.sessions) ? (b.sessions as any) : [],
  });

  return Response.json(saved);
}

