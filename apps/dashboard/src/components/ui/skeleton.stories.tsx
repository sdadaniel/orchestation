import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "./skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: {
    className: "h-4 w-[250px]",
  },
};

export const Circle: Story = {
  args: {
    className: "h-10 w-10 rounded-full",
  },
};

export const Card: Story = {
  render: () => (
    <div className="flex items-center gap-3 p-4 border border-border rounded-lg w-80">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex flex-col gap-2 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  ),
};

export const TaskRow: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-full max-w-md">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  ),
};
