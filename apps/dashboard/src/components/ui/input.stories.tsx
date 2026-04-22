import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  argTypes: {
    size: { control: "select", options: ["default", "sm"] },
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: "Task 제목을 입력하세요", size: "default" },
};

export const Small: Story = {
  args: { placeholder: "Search...", size: "sm" },
};

export const Disabled: Story = {
  args: { placeholder: "Disabled", disabled: true },
};

export const WithValue: Story = {
  args: { defaultValue: "TASK-001: Setup project", size: "default" },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-80">
      <Input placeholder="Default size" size="default" />
      <Input placeholder="Small size" size="sm" />
    </div>
  ),
};
