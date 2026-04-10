import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Select } from "./select";

const meta: Meta = {
  title: "UI/Dialog",
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <Label>
              제목 <span className="text-red-400">*</span>
            </Label>
            <Input placeholder="Task 제목을 입력하세요" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>우선순위</Label>
              <Select>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>역할</Label>
              <Select>
                <option value="general">General</option>
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm">
              취소
            </Button>
            <Button size="sm">생성</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Delete Task</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-red-400">Task 삭제</DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-3">
          <DialogDescription>
            <span className="font-mono font-semibold">TASK-001</span>를
            삭제하시겠습니까?
          </DialogDescription>
          <p className="text-xs text-muted-foreground">
            이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm">
              취소
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              삭제
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  ),
};

export const NoCloseButton: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>No Close Button</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Custom Dialog</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">
            Close button is hidden.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  ),
};
