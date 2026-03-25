import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge, StatusBadge, PriorityBadge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  argTypes: {
    size: { control: "select", options: ["default", "sm", "md"] },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: "Badge",
    className: "bg-blue-500/15 text-blue-400",
  },
};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="pending" />
      <StatusBadge status="in_progress" />
      <StatusBadge status="reviewing" />
      <StatusBadge status="done" />
    </div>
  ),
};

export const AllPriorities: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <PriorityBadge priority="high" />
      <PriorityBadge priority="medium" />
      <PriorityBadge priority="low" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-16">sm</span>
        <PriorityBadge priority="high" size="sm" />
        <StatusBadge status="in_progress" size="sm" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-16">default</span>
        <PriorityBadge priority="high" size="default" />
        <StatusBadge status="in_progress" size="default" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-16">md</span>
        <PriorityBadge priority="high" size="md" />
        <StatusBadge status="in_progress" size="md" />
      </div>
    </div>
  ),
};

export const TaskRow: Story = {
  render: () => (
    <div className="flex items-center gap-2 px-3 py-2 border border-border rounded">
      <span className="font-mono text-[11px] text-muted-foreground">TASK-001</span>
      <span className="text-sm flex-1">Setup project infrastructure</span>
      <PriorityBadge priority="high" />
      <StatusBadge status="in_progress" />
    </div>
  ),
};
