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
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionsRef = useRef<Session[]>([]);

  // 초기 로드 — 빈 세션은 제거하고 로드
  useEffect(() => {
    const loaded = loadSessions().filter((s) => s.messages.length > 0);
    setSessions(loaded);
    setActiveSessionId(loaded[0]?.id ?? null);
  }, []);

  // sessionsRef를 항상 최신 sessions와 동기화
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // 세션 저장 — 메시지가 있는 세션만 저장
  useEffect(() => {
    const withMessages = sessions.filter((s) => s.messages.length > 0);
    saveSessions(withMessages);
  }, [sessions]);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const newSession = useCallback(() => {
    // 이미 빈 세션(activeSession)이 있으면 새로 만들지 않음
    if (activeSession && activeSession.messages.length === 0) return;
    // activeSessionId를 null로 설정하면 "새 채팅" 모드
    setActiveSessionId(null);
  }, [activeSession]);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveSessionId((curr) => {
      if (curr === id) {
        const remaining = sessions.filter((s) => s.id !== id);
        return remaining[0]?.id ?? null;
      }
      return curr;
    });
  }, [sessions]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    // activeSessionId가 null이면 새 세션 생성 (첫 메시지 시점)
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const newSess = createSession();
      newSess.title = userMsg.content.slice(0, 30);
      newSess.messages = [userMsg];
      currentSessionId = newSess.id;
      setSessions((prev) => [newSess, ...prev]);
      setActiveSessionId(currentSessionId);
    } else {
      // 기존 세션에 메시지 추가
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== currentSessionId) return s;
          return {
            ...s,
            messages: [...s.messages, userMsg],
            title: s.messages.length === 0 ? userMsg.content.slice(0, 30) : s.title,
          };
        }),
      );
    }
    setInput("");
    setIsStreaming(true);

    // 어시스턴트 메시지를 빈 상태로 먼저 추가
    const assistantMsgId = generateId();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId
          ? { ...s, messages: [...s.messages, assistantMsg] }
          : s,
      ),
    );

    try {
      // sessionsRef에서 최신 messages를 읽어 stale closure 문제 방지
      const latestSession = sessionsRef.current.find(
        (s) => s.id === currentSessionId,
      );
      const latestMessages = latestSession?.messages ?? [];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: userMsg.content,
          history: latestMessages
            .filter((m) => m.id !== assistantMsgId)
            .map((m) => ({
              role: m.role,
              content: m.content,
            })),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("ReadableStream not supported");
      }

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        // 어시스턴트 메시지 content를 점진적으로 업데이트
        const updatedContent = accumulated;
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: updatedContent }
                      : m,
                  ),
                }
              : s,
          ),
        );
      }

      // 스트리밍 완료 후 빈 응답 처리
      if (!accumulated.trim()) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: "응답을 받지 못했습니다." }
                      : m,
                  ),
                }
              : s,
          ),
        );
      }
    } catch {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: "오류가 발생했습니다. 다시 시도해주세요." }
                    : m,
                ),
              }
            : s,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, activeSessionId, isStreaming]);

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
          onClick={() => {
            setIsOpen(true);
            // 항상 새 채팅 모드로 시작
            setActiveSessionId(null);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* 채팅 창 — 2-column */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex w-[600px] h-[520px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden">

          {/* 좌: 세션 목록 */}
          <div className="w-44 shrink-0 flex flex-col border-r border-border bg-sidebar">
            <div className="flex items-center justify-between h-9 px-2.5 border-b border-border shrink-0">
              <span className="text-[11px] font-semibold text-sidebar-foreground">Sessions</span>
              <button
                type="button"
                onClick={newSession}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                title="New session"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "group flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer text-[11px] hover:bg-muted/50 transition-colors border-b border-border",
                    s.id === activeSessionId && "bg-muted",
                  )}
                  onClick={() => setActiveSessionId(s.id)}
                >
                  <MessageSquare className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{s.title}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    className="p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 우: 대화 */}
          <div className="flex-1 flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center h-9 px-3 border-b border-border shrink-0">
              <span className="text-xs font-semibold flex-1 truncate">
                {activeSession?.title ?? "Chat"}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 메시지 */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
              {(!activeSession || activeSession.messages.length === 0) && (
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
                  <div className="whitespace-pre-wrap">
                    {msg.content}
                    {isStreaming && msg.role === "assistant" && msg.content === "" && (
                      <span className="animate-pulse">▍</span>
                    )}
                  </div>
                </div>
              ))}
              {isStreaming && activeSession?.messages.at(-1)?.role === "assistant" && (activeSession?.messages.at(-1)?.content ?? "") !== "" && (
                <span className="text-xs text-muted-foreground animate-pulse ml-1">▍</span>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 */}
            <div className="flex items-end gap-2 px-3 py-2 border-t border-border shrink-0">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지 입력... (Enter로 전송)"
                rows={1}
                disabled={isStreaming}
                className="flex-1 resize-none bg-muted border border-border rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-primary leading-relaxed max-h-20 overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 shrink-0 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
