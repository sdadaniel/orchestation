import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { Input } from "./input";

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
  argTypes: {
    size: { control: "select", options: ["default", "sm"] },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: { children: "제목", size: "default" },
};

export const Small: Story = {
  args: { children: "Status", size: "sm" },
};

export const WithRequired: Story = {
  render: () => (
    <Label>
      제목 <span className="text-red-400">*</span>
    </Label>
  ),
};

export const WithInput: Story = {
  render: () => (
    <div className="space-y-1 w-80">
      <Label>
        제목 <span className="text-red-400">*</span>
      </Label>
      <Input placeholder="Task 제목을 입력하세요" />
    </div>
  ),
};

export const SmallWithInput: Story = {
  render: () => (
    <div className="space-y-1 w-60">
      <Label size="sm">Status</Label>
      <Input size="sm" defaultValue="in_progress" />
    </div>
  ),
};
