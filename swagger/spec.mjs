/** @type {import('openapi3-ts').OpenAPIObject} */
export default {
  openapi: "3.0.3",
  info: {
    title: "Orchestration API",
    description:
      "태스크 오케스트레이션 플랫폼 API — 태스크 관리, 스프린트, 문서, 오케스트레이션 제어",
    version: "1.0.0",
  },
  servers: [{ url: "http://localhost:3000/api", description: "Local dev" }],
  tags: [
    { name: "Tasks", description: "태스크 CRUD 및 실행 관리" },
    { name: "Sprints", description: "스프린트 관리" },
    { name: "Docs", description: "문서 트리 관리" },
    { name: "PRDs", description: "PRD 문서 관리" },
    { name: "Orchestrate", description: "오케스트레이션 실행/중지/로그" },
    { name: "Auto-Improve", description: "자동 개선 실행/중지" },
    { name: "Chat", description: "AI 챗봇" },
    { name: "System", description: "모니터링, 설정, 비용, 실행 이력" },
  ],
  paths: {
    // ─── Tasks ───
    "/tasks": {
      get: {
        tags: ["Tasks"],
        summary: "전체 태스크 목록 조회",
        responses: {
          200: {
            description: "태스크 배열",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Task" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Tasks"],
        summary: "새 태스크 생성",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string", example: "로그인 페이지 구현" },
                  priority: {
                    type: "string",
                    enum: ["critical", "high", "medium", "low"],
                    default: "medium",
                  },
                  role: { type: "string", default: "general" },
                  depends_on: {
                    type: "array",
                    items: { type: "string" },
                    example: ["TASK-001"],
                  },
                  sprint: { type: "string", example: "SPRINT-001" },
                  scope: {
                    type: "array",
                    items: { type: "string" },
                    example: ["src/frontend/src/app/login/"],
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "생성된 태스크",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Task" },
              },
            },
          },
          400: {
            description: "유효성 검증 실패",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/tasks/{id}": {
      put: {
        tags: ["Tasks"],
        summary: "태스크 수정",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", pattern: "^TASK-\\d{3}$" },
            example: "TASK-001",
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: ["pending", "in_progress", "in_review", "done"],
                  },
                  priority: {
                    type: "string",
                    enum: ["critical", "high", "medium", "low"],
                  },
                  title: { type: "string" },
                  depends_on: { type: "array", items: { type: "string" } },
                  role: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "수정된 태스크",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Task" },
              },
            },
          },
          400: { description: "유효성 검증 실패 또는 의존성 미충족" },
          404: { description: "태스크 없음" },
        },
      },
      delete: {
        tags: ["Tasks"],
        summary: "태스크 삭제",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "TASK-001",
          },
        ],
        responses: {
          200: {
            description: "삭제 완료",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { deleted: { type: "string" } },
                },
              },
            },
          },
          404: { description: "태스크 없음" },
        },
      },
    },
    "/tasks/{id}/run": {
      post: {
        tags: ["Tasks"],
        summary: "태스크 실행 시작",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "실행 시작됨" } },
      },
      get: {
        tags: ["Tasks"],
        summary: "태스크 실행 상태 조회",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "실행 상태" } },
      },
      delete: {
        tags: ["Tasks"],
        summary: "태스크 실행 중지",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "중지됨" } },
      },
    },
    "/tasks/{id}/logs": {
      get: {
        tags: ["Tasks"],
        summary: "태스크 실행 로그 조회",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "로그 배열",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "object" } },
              },
            },
          },
        },
      },
    },
    "/tasks/{id}/result": {
      get: {
        tags: ["Tasks"],
        summary: "태스크 결과(리뷰/산출물) 조회",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "태스크 결과 요약" } },
      },
    },
    "/tasks/lastmod": {
      get: {
        tags: ["Tasks"],
        summary: "태스크 디렉터리 최종 수정 시각",
        responses: {
          200: {
            description: "lastMod 타임스탬프",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { lastMod: { type: "number" } },
                },
              },
            },
          },
        },
      },
    },
    "/tasks/watch": {
      get: {
        tags: ["Tasks"],
        summary: "태스크 변경 감지 (SSE)",
        description:
          "Server-Sent Events 스트림으로 태스크 파일 변경 이벤트를 실시간 전달",
        responses: {
          200: {
            description: "SSE 스트림",
            content: { "text/event-stream": {} },
          },
        },
      },
    },
    "/tasks/analyze": {
      post: {
        tags: ["Tasks"],
        summary: "AI 기반 태스크 분석/분해",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "분해된 태스크 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tasks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          priority: { type: "string" },
                          criteria: {
                            type: "array",
                            items: { type: "string" },
                          },
                          scope: { type: "array", items: { type: "string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── Requests (legacy) ───
    "/requests": {
      get: {
        tags: ["Tasks"],
        summary: "전체 요청 목록 조회 (legacy)",
        responses: { 200: { description: "요청 배열" } },
      },
      post: {
        tags: ["Tasks"],
        summary: "새 요청 생성 (legacy)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  priority: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "생성됨" } },
      },
    },
    "/requests/{id}": {
      get: {
        tags: ["Tasks"],
        summary: "요청 상세 + 로그/리뷰 (legacy)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "요청 상세" } },
      },
      put: {
        tags: ["Tasks"],
        summary: "요청 수정 (legacy)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  title: { type: "string" },
                  priority: { type: "string" },
                  content: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "수정됨" } },
      },
      delete: {
        tags: ["Tasks"],
        summary: "요청 삭제 (legacy)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "삭제됨" } },
      },
    },
    "/requests/{id}/reorder": {
      post: {
        tags: ["Tasks"],
        summary: "요청 정렬 순서 변경 (legacy)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["direction"],
                properties: {
                  direction: { type: "string", enum: ["up", "down"] },
                },
              },
            },
          },
        },
        responses: { 200: { description: "정렬 완료" } },
      },
    },

    // ─── Sprints ───
    "/sprints": {
      get: {
        tags: ["Sprints"],
        summary: "전체 스프린트 목록 조회",
        responses: { 200: { description: "스프린트 배열" } },
      },
      post: {
        tags: ["Sprints"],
        summary: "새 스프린트 생성",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  goal: { type: "string" },
                  status: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "생성된 스프린트" } },
      },
    },

    // ─── Docs ───
    "/docs": {
      get: {
        tags: ["Docs"],
        summary: "문서 트리 전체 조회",
        responses: { 200: { description: "문서 트리" } },
      },
      post: {
        tags: ["Docs"],
        summary: "새 문서/폴더 생성",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "type"],
                properties: {
                  title: { type: "string" },
                  type: { type: "string", enum: ["doc", "folder"] },
                  parentId: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "생성된 노드" } },
      },
    },
    "/docs/{id}": {
      get: {
        tags: ["Docs"],
        summary: "문서 상세 조회",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "문서 내용",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    type: { type: "string" },
                    file: { type: "string" },
                    content: { type: "string" },
                    parentPath: { type: "string" },
                    readonly: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ["Docs"],
        summary: "문서 수정",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "수정 완료" } },
      },
      delete: {
        tags: ["Docs"],
        summary: "문서 삭제",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "삭제 완료" } },
      },
    },
    "/docs/reorder": {
      put: {
        tags: ["Docs"],
        summary: "문서 순서/위치 변경",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id"],
                properties: {
                  id: { type: "string" },
                  parentId: { type: "string" },
                  index: { type: "number" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "정렬 완료" } },
      },
    },

    // ─── PRDs ───
    "/prds": {
      get: {
        tags: ["PRDs"],
        summary: "전체 PRD 목록 조회",
        responses: { 200: { description: "PRD 배열" } },
      },
    },
    "/prds/{id}": {
      put: {
        tags: ["PRDs"],
        summary: "PRD 내용 수정",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: { content: { type: "string" } },
              },
            },
          },
        },
        responses: { 200: { description: "수정 완료" } },
      },
    },

    // ─── Orchestrate ───
    "/orchestrate/run": {
      post: {
        tags: ["Orchestrate"],
        summary: "오케스트레이션 실행",
        responses: {
          200: {
            description: "실행 시작",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    status: { type: "string" },
                    startedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/orchestrate/status": {
      get: {
        tags: ["Orchestrate"],
        summary: "오케스트레이션 상태 조회",
        responses: {
          200: {
            description: "현재 상태",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    startedAt: { type: "string", format: "date-time" },
                    finishedAt: { type: "string", format: "date-time" },
                    exitCode: { type: "number" },
                    taskResults: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/orchestrate/stop": {
      post: {
        tags: ["Orchestrate"],
        summary: "오케스트레이션 중지",
        responses: {
          200: {
            description: "중지됨",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    status: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/orchestrate/logs": {
      get: {
        tags: ["Orchestrate"],
        summary: "오케스트레이션 로그 조회",
        description:
          "폴링(since 파라미터) 또는 SSE 스트리밍(stream=true) 모드 지원",
        parameters: [
          {
            name: "since",
            in: "query",
            schema: { type: "number" },
            description: "이 타임스탬프 이후 로그만 조회",
          },
          {
            name: "stream",
            in: "query",
            schema: { type: "string", enum: ["true"] },
            description: "SSE 스트리밍 모드 활성화",
          },
        ],
        responses: {
          200: {
            description: "로그 데이터 (JSON 또는 SSE 스트림)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    logs: { type: "array", items: { type: "object" } },
                    total: { type: "number" },
                    status: { type: "string" },
                    finishedAt: { type: "string" },
                    taskResults: { type: "object" },
                  },
                },
              },
              "text/event-stream": {},
            },
          },
        },
      },
    },

    // ─── Auto-Improve ───
    "/auto-improve/run": {
      post: {
        tags: ["Auto-Improve"],
        summary: "자동 개선 실행",
        responses: {
          200: {
            description: "실행 시작",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    status: { type: "string" },
                    startedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auto-improve/status": {
      get: {
        tags: ["Auto-Improve"],
        summary: "자동 개선 상태 조회",
        responses: {
          200: {
            description: "현재 상태",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    startedAt: { type: "string" },
                    finishedAt: { type: "string" },
                    exitCode: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auto-improve/stop": {
      post: {
        tags: ["Auto-Improve"],
        summary: "자동 개선 중지",
        responses: { 200: { description: "중지됨" } },
      },
    },

    // ─── Chat ───
    "/chat": {
      post: {
        tags: ["Chat"],
        summary: "AI 챗봇 메시지 전송",
        description: "SSE 스트리밍으로 응답 반환",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  message: {
                    type: "string",
                    example: "현재 진행 중인 태스크 알려줘",
                  },
                  history: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        role: {
                          type: "string",
                          enum: ["user", "assistant"],
                        },
                        content: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "SSE 텍스트 스트림",
            content: { "text/plain": {} },
          },
        },
      },
    },

    // ─── System ───
    "/plans": {
      get: {
        tags: ["System"],
        summary: "플랜 목록 조회",
        responses: { 200: { description: "플랜 배열" } },
      },
    },
    "/costs": {
      get: {
        tags: ["System"],
        summary: "비용 로그 조회",
        responses: { 200: { description: "비용 데이터" } },
      },
    },
    "/run-history": {
      get: {
        tags: ["System"],
        summary: "실행 이력 조회",
        responses: { 200: { description: "실행 이력" } },
      },
    },
    "/monitor": {
      get: {
        tags: ["System"],
        summary: "시스템 모니터링 (CPU, 메모리, 프로세스)",
        responses: {
          200: {
            description: "시스템 상태",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cpu: { type: "object" },
                    loadAvg: { type: "array", items: { type: "number" } },
                    memory: { type: "object" },
                    processCount: { type: "number" },
                    threadCount: { type: "number" },
                    claudeProcesses: {
                      type: "array",
                      items: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/settings": {
      get: {
        tags: ["System"],
        summary: "설정 조회",
        responses: { 200: { description: "설정 객체" } },
      },
      put: {
        tags: ["System"],
        summary: "설정 수정",
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { 200: { description: "수정된 설정" } },
      },
    },
  },
  components: {
    schemas: {
      Task: {
        type: "object",
        properties: {
          id: { type: "string", example: "TASK-001" },
          title: { type: "string", example: "로그인 페이지 구현" },
          status: {
            type: "string",
            enum: [
              "pending",
              "in_progress",
              "in_review",
              "done",
              "failed",
              "rejected",
              "stopped",
            ],
          },
          priority: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
          depends_on: { type: "array", items: { type: "string" } },
          role: { type: "string" },
          sprint: { type: "string" },
          scope: { type: "array", items: { type: "string" } },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
};
