# Phase 3: Frontend 컴포넌트 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CLAUDE.md 디자인 시스템 완전 준수 — raw HTML 제거, 반복 패턴 컴포넌트화, PageLayout 통일. 기능 변경 없음.

**Architecture:** 기존 `@/components/ui/` 컴포넌트 활용. `FieldRow`, `SettingSection` 두 개의 새 컴포넌트 추출. 새 컴포넌트에는 Storybook stories 필수.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Next.js App Router

**전제조건:** Phase 2 완료

---

## File Map

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/frontend/src/app/tasks/[id]/TaskMetadata.tsx` | Modify | raw `<select>` → `<Select size="inline">` |
| `src/frontend/src/components/ui/FieldRow.tsx` | Create | Label + Input/Select 조합 컴포넌트 |
| `src/frontend/src/components/ui/FieldRow.stories.tsx` | Create | Storybook story |
| `src/frontend/src/components/ui/SettingSection.tsx` | Create | `<Label size="section">` + children 섹션 래퍼 |
| `src/frontend/src/components/ui/SettingSection.stories.tsx` | Create | Storybook story |
| `src/frontend/src/app/settings/page.tsx` | Refactor | FieldRow + SettingSection 사용 |
| `src/frontend/src/app/monitor/page.tsx` | Modify | PageLayout + PageHeader 추가 |

---

### Task 1: raw `<select>` → `<Select size="inline">` (TaskMetadata.tsx)

**Files:**
- Modify: `src/frontend/src/app/tasks/[id]/TaskMetadata.tsx`

- [ ] **Step 1: 현재 `<select>` 블록 확인**

```bash
grep -n "select" src/frontend/src/app/tasks/\\[id\\]/TaskMetadata.tsx | head -20
```
Expected: line 38 에 raw `<select>` 존재

- [ ] **Step 2: import에 Select 추가**

```typescript
// 기존 ui import에 Select 추가:
import { Select } from "@/components/ui/select";
```

- [ ] **Step 3: raw `<select>` 블록 교체 (lines 38-46 근방)**

```tsx
// 제거:
<select
  value={task.status}
  onChange={(e) => onStatusChange(e.target.value)}
  className="text-xs font-medium bg-transparent border-none outline-none cursor-pointer hover:text-primary transition-colors"
>
  {["pending", "stopped", "in_progress", "reviewing", "done", "failed", "rejected"].map((s) => (
    <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
  ))}
</select>

// 교체:
<Select
  value={task.status}
  onChange={(e) => onStatusChange(e.target.value)}
  size="inline"
  className="text-xs font-medium"
>
  {["pending", "stopped", "in_progress", "reviewing", "done", "failed", "rejected"].map((s) => (
    <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
  ))}
</Select>
```

- [ ] **Step 4: Select 컴포넌트에 `size="inline"` 이 없으면 확인**

```bash
grep -n '"inline"' src/frontend/src/components/ui/select.tsx
```

`inline` size가 없으면 select.tsx에 추가합니다:
```typescript
// select.tsx의 size variants에 추가:
inline: "bg-transparent border-none outline-none cursor-pointer hover:text-primary transition-colors p-0 h-auto text-inherit",
```

- [ ] **Step 5: 타입 체크**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | grep "TaskMetadata" | head -10
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/frontend/src/app/tasks/\\[id\\]/TaskMetadata.tsx src/frontend/src/components/ui/select.tsx
git commit -m "fix: replace raw <select> with Select component in TaskMetadata"
```

---

### Task 2: `FieldRow` 컴포넌트 생성

**반복 패턴 (settings/page.tsx에서 4회 이상):**
```tsx
<div className="space-y-1.5">
  <Label htmlFor="...">Field Name</Label>
  <Input ... />
  <p className="text-xs text-muted-foreground/60">description</p>
</div>
```

**Files:**
- Create: `src/frontend/src/components/ui/FieldRow.tsx`
- Create: `src/frontend/src/components/ui/FieldRow.stories.tsx`

- [ ] **Step 1: `FieldRow.tsx` 생성**

```typescript
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface FieldRowProps {
  label: string;
  htmlFor?: string;
  description?: string;
  children: ReactNode;
}

/**
 * 라벨 + 입력 필드 + 설명 텍스트 조합 패턴.
 * settings, 폼 등에서 반복되는 space-y-1.5 패턴을 추출.
 */
export function FieldRow({ label, htmlFor, description, children }: FieldRowProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {description && (
        <p className="text-xs text-muted-foreground/60">{description}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `FieldRow.stories.tsx` 생성**

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { FieldRow } from "./FieldRow";
import { Input } from "./input";
import { Select } from "./select";

const meta: Meta<typeof FieldRow> = {
  title: "UI/FieldRow",
  component: FieldRow,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof FieldRow>;

export const WithInput: Story = {
  args: {
    label: "API Key",
    htmlFor: "apiKey",
    description: "Anthropic API key for the engine",
  },
  render: (args) => (
    <FieldRow {...args}>
      <Input id="apiKey" type="password" placeholder="sk-ant-api03-..." />
    </FieldRow>
  ),
};

export const WithSelect: Story = {
  args: {
    label: "Model",
    description: "Claude model to use for tasks",
  },
  render: (args) => (
    <FieldRow {...args}>
      <Select defaultValue="claude-sonnet-4-6">
        <option value="claude-haiku-4-5-20251001">claude-haiku-4.5</option>
        <option value="claude-sonnet-4-6">claude-sonnet-4.6</option>
      </Select>
    </FieldRow>
  ),
};

export const WithoutDescription: Story = {
  args: { label: "Branch", htmlFor: "branch" },
  render: (args) => (
    <FieldRow {...args}>
      <Input id="branch" placeholder="main" />
    </FieldRow>
  ),
};
```

- [ ] **Step 3: 타입 체크**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | grep "FieldRow" | head -10
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/frontend/src/components/ui/FieldRow.tsx src/frontend/src/components/ui/FieldRow.stories.tsx
git commit -m "feat: add FieldRow UI component — label+input+description pattern"
```

---

### Task 3: `SettingSection` 컴포넌트 생성

**반복 패턴 (settings/page.tsx에서 4회):**
```tsx
<div className="space-y-4">
  <Label size="section">Section Title</Label>
  {/* fields */}
</div>
```

**Files:**
- Create: `src/frontend/src/components/ui/SettingSection.tsx`
- Create: `src/frontend/src/components/ui/SettingSection.stories.tsx`

- [ ] **Step 1: `SettingSection.tsx` 생성**

```typescript
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface SettingSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * 설정 섹션 그룹 패턴.
 * Label(size="section") + space-y-4 필드 그룹 조합 추출.
 */
export function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <div className="space-y-4">
      <Label size="section">{title}</Label>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: `SettingSection.stories.tsx` 생성**

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { SettingSection } from "./SettingSection";
import { FieldRow } from "./FieldRow";
import { Input } from "./input";

const meta: Meta<typeof SettingSection> = {
  title: "UI/SettingSection",
  component: SettingSection,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof SettingSection>;

export const Default: Story = {
  args: { title: "API Configuration" },
  render: (args) => (
    <SettingSection {...args}>
      <FieldRow label="API Key" description="Anthropic API key">
        <Input type="password" placeholder="sk-ant-api03-..." />
      </FieldRow>
      <FieldRow label="Base Branch">
        <Input placeholder="main" />
      </FieldRow>
    </SettingSection>
  ),
};
```

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/components/ui/SettingSection.tsx src/frontend/src/components/ui/SettingSection.stories.tsx
git commit -m "feat: add SettingSection UI component — section label+fields pattern"
```

---

### Task 4: `settings/page.tsx` — `FieldRow` + `SettingSection` 적용

**Files:**
- Modify: `src/frontend/src/app/settings/page.tsx`

- [ ] **Step 1: import 추가**

```typescript
import { FieldRow } from "@/components/ui/FieldRow";
import { SettingSection } from "@/components/ui/SettingSection";
```

- [ ] **Step 2: API Configuration 섹션 교체**

```tsx
// 기존:
<div className="space-y-4">
  <Label size="section">API Configuration</Label>

  <div className="space-y-1.5">
    <Label>Name</Label>
    <Input value="Orchestration" readOnly className="cursor-default" />
    <p className="text-xs text-muted-foreground/60 font-mono">sdadaniel/orchestation</p>
  </div>

  <div className="space-y-1.5">
    <Label htmlFor="apiKey">API Key</Label>
    <div className="flex items-center gap-2">
      <Input id="apiKey" type={showApiKey ? "text" : "password"} ... />
      <Button ...>{...}</Button>
    </div>
    <p className="text-xs text-muted-foreground/60">Anthropic API key...</p>
  </div>

  <div className="space-y-1.5">
    <Label>Model</Label>
    <Select ...>...</Select>
  </div>

  <div className="space-y-1.5">
    <Label>Base branch</Label>
    <Input ... />
    <p className="text-xs text-muted-foreground/60">Default branch...</p>
  </div>
</div>

// 교체:
<SettingSection title="API Configuration">
  <FieldRow label="Name" description="sdadaniel/orchestation">
    <Input value="Orchestration" readOnly className="cursor-default font-mono" />
  </FieldRow>

  <FieldRow label="API Key" htmlFor="apiKey" description="Anthropic API key for Orchestrate Engine and Night Worker">
    <div className="flex items-center gap-2">
      <Input
        id="apiKey"
        type={showApiKey ? "text" : "password"}
        value={draft.apiKey}
        onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
        placeholder="sk-ant-api03-..."
        className="font-mono flex-1"
      />
      <Button variant="ghost" size="icon" onClick={() => setShowApiKey(!showApiKey)} className="text-muted-foreground hover:text-foreground">
        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  </FieldRow>

  <FieldRow label="Model">
    <Select value={draft.model} onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}>
      <option value="claude-haiku-4-5-20251001">claude-haiku-4.5</option>
      <option value="claude-sonnet-4-6">claude-sonnet-4.6</option>
      <option value="claude-opus-4-6">claude-opus-4.6</option>
    </Select>
  </FieldRow>

  <FieldRow label="Base branch" description="Default branch for pull requests and base comparisons">
    <Input
      value={draft.baseBranch}
      onChange={(e) => setDraft((prev) => ({ ...prev, baseBranch: e.target.value }))}
      placeholder="main"
      className="font-mono"
    />
  </FieldRow>
</SettingSection>
```

- [ ] **Step 3: 나머지 섹션 (Source Paths, Worker, Execution) 동일 패턴 적용**

settings/page.tsx를 읽고 남은 섹션들에 동일하게 `<SettingSection>` + `<FieldRow>` 패턴을 적용합니다.
- `<Label size="section">` → `<SettingSection title="...">`
- `<div className="space-y-1.5"><Label>...</Label>...</div>` → `<FieldRow label="...">`

- [ ] **Step 4: 타입 체크**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | grep "settings" | head -10
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/app/settings/page.tsx
git commit -m "refactor: settings/page.tsx — apply FieldRow + SettingSection components"
```

---

### Task 5: `monitor/page.tsx` — PageLayout + PageHeader 적용

**Files:**
- Modify: `src/frontend/src/app/monitor/page.tsx`

- [ ] **Step 1: PageLayout, PageHeader import 확인**

```bash
grep -r "PageLayout\|PageHeader" src/frontend/src/app/settings/page.tsx | head -5
```
위 명령으로 settings/page.tsx에서 PageLayout import 경로를 확인합니다.

- [ ] **Step 2: monitor/page.tsx 수정**

```tsx
"use client";

import { MonitorDashboard } from "@/components/monitor/MonitorDashboard";
import { PageLayout } from "@/components/PageLayout";     // 경로는 Step 1에서 확인
import { PageHeader } from "@/components/PageHeader";     // 경로는 Step 1에서 확인

export default function MonitorPage() {
  return (
    <PageLayout>
      <PageHeader title="Monitor" />
      <MonitorDashboard />
    </PageLayout>
  );
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | grep "monitor" | head -10
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/frontend/src/app/monitor/page.tsx
git commit -m "refactor: monitor/page.tsx — apply PageLayout + PageHeader"
```

---

### Task 6: 최종 검증

- [ ] **Step 1: raw HTML 요소 없는지 확인**

```bash
grep -rn "<input\b\|<select\b\|<textarea\b" src/frontend/src/app/ --include="*.tsx"
```
Expected: no output

- [ ] **Step 2: 이중 보더 패턴 없는지 확인 (border 카드 안에 Input)**

```bash
grep -B5 "<Input\|<Select\|<Textarea" src/frontend/src/app/**/*.tsx 2>/dev/null | grep "border" | grep -v "border-b\|border-t\|border-border"
```
Expected: no suspicious double-border patterns

- [ ] **Step 3: 타입 체크 + 빌드**

```bash
cd src/frontend && npx tsc --noEmit && echo "✅ tsc passed"
```
Expected: `✅ tsc passed`

- [ ] **Step 4: Storybook 빌드 확인**

```bash
cd src/frontend && npx storybook build --quiet 2>&1 | tail -5
```
Expected: build succeeds without errors

- [ ] **Step 5: 최종 Commit**

```bash
git add -A
git status
# 변경 없으면 skip
```
