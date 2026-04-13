import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox } from "./checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "UI/Checkbox",
  component: Checkbox,
  argTypes: {
    disabled: { control: "boolean" },
    checked: { control: "boolean" },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: {},
};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const WithLabel: Story = {
  render: () => (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <Checkbox />
      <span className="font-mono">TASK-001</span>
    </label>
  ),
};

export const DependencyList: Story = {
  render: () => (
    <div className="max-h-32 overflow-y-auto bg-muted border border-border rounded p-2 space-y-1 w-60">
      {["TASK-001", "TASK-002", "TASK-003", "TASK-004"].map((id, i) => (
        <label
          key={id}
          className="flex items-center gap-2 text-xs cursor-pointer hover:bg-background/50 rounded px-1 py-0.5"
        >
          <Checkbox defaultChecked={i < 2} />
          <span className="font-mono">{id}</span>
        </label>
      ))}
    </div>
  ),
};
