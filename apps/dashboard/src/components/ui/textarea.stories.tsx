import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "UI/Textarea",
  component: Textarea,
  argTypes: {
    size: { control: "select", options: ["default", "sm"] },
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
    rows: { control: "number" },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: { placeholder: "Sprint 목표를 입력하세요", rows: 3 },
};

export const Small: Story = {
  args: { placeholder: "메모...", size: "sm", rows: 2 },
};

export const Disabled: Story = {
  args: { placeholder: "Disabled", disabled: true, rows: 3 },
};

export const WithContent: Story = {
  args: {
    defaultValue:
      "# Task Description\n\nThis is a multi-line task description with markdown support.",
    rows: 5,
  },
};
