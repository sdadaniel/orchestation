import fs from "fs";
import path from "path";
import { OUTPUT_DIR } from "../lib/config/paths";

export type DashboardChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export type DashboardChatSession = {
  id: string;
  title: string;
  messages: DashboardChatMessage[];
  createdAt: number;
};

export type DashboardChatBotState = {
  version: 1;
  updatedAt: string;
  activeSessionId: string | null;
  sessions: DashboardChatSession[];
};

const CHATBOT_DIR = path.join(OUTPUT_DIR, "chatbot");
const CHATBOT_STATE_PATH = path.join(CHATBOT_DIR, "sessions.json");

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadDashboardChatBotState(): DashboardChatBotState {
  try {
    if (!fs.existsSync(CHATBOT_STATE_PATH)) {
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        activeSessionId: null,
        sessions: [],
      };
    }
    const raw = fs.readFileSync(CHATBOT_STATE_PATH, "utf-8");
    const parsed = safeParseJson<DashboardChatBotState>(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        activeSessionId: null,
        sessions: [],
      };
    }
    return parsed;
  } catch {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      activeSessionId: null,
      sessions: [],
    };
  }
}

export function saveDashboardChatBotState(
  next: Omit<DashboardChatBotState, "version" | "updatedAt">,
): DashboardChatBotState {
  const state: DashboardChatBotState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    activeSessionId: next.activeSessionId ?? null,
    sessions: Array.isArray(next.sessions) ? next.sessions : [],
  };

  try {
    fs.mkdirSync(CHATBOT_DIR, { recursive: true });
    fs.writeFileSync(CHATBOT_STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch {
    /* ignore */
  }

  return state;
}

export function getDashboardChatBotStatePath(): string {
  return CHATBOT_STATE_PATH;
}

import fs from "fs";
import path from "path";
import { OUTPUT_DIR } from "../lib/config/paths";

export type DashboardChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export type DashboardChatSession = {
  id: string;
  title: string;
  messages: DashboardChatMessage[];
  createdAt: number;
};

export type DashboardChatBotState = {
  version: 1;
  updatedAt: string;
  activeSessionId: string | null;
  sessions: DashboardChatSession[];
};

const CHATBOT_DIR = path.join(OUTPUT_DIR, "chatbot");
const CHATBOT_STATE_PATH = path.join(CHATBOT_DIR, "sessions.json");

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadDashboardChatBotState(): DashboardChatBotState {
  try {
    if (!fs.existsSync(CHATBOT_STATE_PATH)) {
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        activeSessionId: null,
        sessions: [],
      };
    }
    const raw = fs.readFileSync(CHATBOT_STATE_PATH, "utf-8");
    const parsed = safeParseJson<DashboardChatBotState>(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        activeSessionId: null,
        sessions: [],
      };
    }
    return parsed;
  } catch {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      activeSessionId: null,
      sessions: [],
    };
  }
}

export function saveDashboardChatBotState(
  next: Omit<DashboardChatBotState, "version" | "updatedAt">,
): DashboardChatBotState {
  const state: DashboardChatBotState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    activeSessionId: next.activeSessionId ?? null,
    sessions: Array.isArray(next.sessions) ? next.sessions : [],
  };

  try {
    fs.mkdirSync(CHATBOT_DIR, { recursive: true });
    fs.writeFileSync(CHATBOT_STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch {
    /* ignore */
  }

  return state;
}

export function getDashboardChatBotStatePath(): string {
  return CHATBOT_STATE_PATH;
}

