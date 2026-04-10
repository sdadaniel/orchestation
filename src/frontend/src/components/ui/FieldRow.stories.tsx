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
