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
