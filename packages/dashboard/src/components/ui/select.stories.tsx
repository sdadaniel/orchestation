import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Select } from "./select";

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  argTypes: {
    size: { control: "select", options: ["default", "sm", "inline"] },
    disabled: { control: "boolean" },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: { size: "default" },
  render: (args) => (
    <Select {...args}>
      <option value="pending">Pending</option>
      <option value="in_progress">In Progress</option>
      <option value="in_review">In Review</option>
      <option value="done">Done</option>
    </Select>
  ),
};

export const Small: Story = {
  render: () => (
    <Select size="sm">
      <option value="critical">Critical</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </Select>
  ),
};

export const Inline: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Status:</span>
      <Select size="inline">
        <option value="">Select</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In Progress</option>
      </Select>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-80">
      <Select size="default">
        <option>Default size</option>
      </Select>
      <Select size="sm">
        <option>Small size</option>
      </Select>
      <Select size="inline">
        <option>Inline size</option>
      </Select>
    </div>
  ),
};
