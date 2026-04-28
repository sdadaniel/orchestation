import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toggle } from "./toggle";
import { useState } from "react";

const meta: Meta<typeof Toggle> = {
  title: "UI/Toggle",
  component: Toggle,
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Toggle>;

export const Default: Story = {
  args: { checked: false },
};

export const Checked: Story = {
  args: { checked: true },
};

export const Disabled: Story = {
  args: { checked: false, disabled: true },
};

export const Interactive: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-foreground">File Search</span>
        <Toggle checked={checked} onChange={setChecked} />
      </div>
    );
  },
};

export const ToggleList: Story = {
  render: () => {
    const [values, setValues] = useState({ a: true, b: false, c: true });
    return (
      <div className="space-y-3 w-80">
        {Object.entries({
          a: "TypeScript 타입 오류 수정",
          b: "ESLint 린트 정리",
          c: "코드 품질 검토",
        }).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{label}</span>
            <Toggle
              checked={values[key as keyof typeof values]}
              onChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
            />
          </div>
        ))}
      </div>
    );
  },
};
