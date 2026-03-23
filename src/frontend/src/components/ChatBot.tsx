"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function createSession(): Session {
  return {
    id: generateId(),
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
  };
}

// localStorage 기반 세션 관리
function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("chatbot-sessions");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("chatbot-sessions", JSON.stringify(sessions));
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 초기 로드
  useEffect(() => {
    const loaded = loadSessions();
    if (loaded.length > 0) {
      setSessions(loaded);
      setActiveSessionId(loaded[0].id);
    } else {
      const first = createSession();
      setSessions([first]);
      setActiveSessionId(first.id);
    }
  }, []);

  // 세션 저장
  useEffect(() => {
    if (sessions.length > 0) saveSessions(sessions);
  }, [sessions]);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const newSession = useCallback(() => {
    const s = createSession();
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    setShowSessions(false);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh = createSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      return next;
    });
    setActiveSessionId((curr) => {
      if (curr === id) {
        const remaining = sessions.filter((s) => s.id !== id);
        return remaining[0]?.id ?? null;
      }
      return curr;
    });
  }, [sessions]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !activeSessionId || isLoading) return;

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    // 세션 업데이트 (유저 메시지 추가)
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        const updated = {
          ...s,
          messages: [...s.messages, userMsg],
          title: s.messages.length === 0 ? userMsg.content.slice(0, 30) : s.title,
        };
        return updated;
      }),
    );
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: userMsg.content,
          history: activeSession?.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })) ?? [],
        }),
      });

      const data = await res.json();
      const assistantMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: data.response ?? "응답을 받지 못했습니다.",
        timestamp: Date.now(),
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messages: [...s.messages, assistantMsg] }
            : s,
        ),
      );
    } catch {
      const errorMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: "오류가 발생했습니다. 다시 시도해주세요.",
        timestamp: Date.now(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messages: [...s.messages, errorMsg] }
            : s,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, activeSessionId, isLoading, activeSession]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
          className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* 채팅 창 */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col w-96 h-[520px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center h-10 px-3 border-b border-border bg-sidebar shrink-0">
            <button
              type="button"
              onClick={() => setShowSessions(!showSessions)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors mr-2"
            >
              {showSessions ? "Chat" : "Sessions"}
            </button>
            <span className="text-xs font-semibold flex-1 truncate">
              {activeSession?.title ?? "Chat"}
            </span>
            <button
              type="button"
              onClick={newSession}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="New session"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {showSessions ? (
            /* 세션 목록 */
            <div className="flex-1 overflow-y-auto">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-border text-xs hover:bg-muted/50 transition-colors",
                    s.id === activeSessionId && "bg-muted",
                  )}
                  onClick={() => { setActiveSessionId(s.id); setShowSessions(false); }}
                >
                  <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{s.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {s.messages.length}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            /* 메시지 영역 */
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
              {activeSession?.messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                  메시지를 입력하세요
                </div>
              )}
              {activeSession?.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                    msg.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-muted text-foreground",
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
              {isLoading && (
                <div className="mr-auto bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground">
                  <span className="animate-pulse">응답 중...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* 입력 영역 */}
          {!showSessions && (
            <div className="flex items-end gap-2 px-3 py-2 border-t border-border shrink-0">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지 입력... (Enter로 전송)"
                rows={1}
                className="flex-1 resize-none bg-muted border border-border rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-primary leading-relaxed max-h-20 overflow-y-auto"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 shrink-0 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
