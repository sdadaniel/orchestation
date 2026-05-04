"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  useNewTaskPageGet,
  useNewTaskPageSet,
} from "../hooks/useNewTaskPage";

const NewTaskCreationRecoveryBanner = () => {
  const get = useNewTaskPageGet();
  const set = useNewTaskPageSet();
  const recovery = get.creationRecovery;

  if (!recovery) return null;

  const { variant, items, message, onDismiss } = recovery;
  const isSuccess = variant === "success";

  return (
    <div
      role="status"
      className="rounded-md border border-border bg-muted/60 px-4 py-3 space-y-3"
    >
      <div className="space-y-1">
        <Label size="section">
          {isSuccess ? "생성 완료" : "생성 중 오류"}
        </Label>
        <p className="text-sm text-muted-foreground">
          {isSuccess
            ? "다른 페이지로 이동했더라도 서버에 요청이 반영되었습니다. 아래 ID로 요청 목록에서 확인할 수 있습니다."
            : "일부 요청만 생성되었을 수 있습니다. 상세 내용을 확인한 뒤 필요하면 다시 시도하세요."}
        </p>
        {!isSuccess && message ? (
          <p className="text-sm text-destructive whitespace-pre-wrap">{message}</p>
        ) : null}
      </div>
      <ul className="text-sm space-y-1 list-none pl-0">
        {items.map((it) => (
          <li key={it.id} className="font-mono text-xs text-foreground">
            <span className="text-muted-foreground">{it.id}</span>
            {" · "}
            {it.title}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="default" onClick={set.goToTasks}>
          요청 목록으로
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          알림 닫기
        </Button>
      </div>
    </div>
  );
};

export default NewTaskCreationRecoveryBanner;
