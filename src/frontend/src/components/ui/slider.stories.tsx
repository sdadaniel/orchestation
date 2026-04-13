import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Slider } from "./slider";
import { useState } from "react";

const meta: Meta<typeof Slider> = {
  title: "UI/Slider",
  component: Slider,
  argTypes: {
    min: { control: "number" },
    max: { control: "number" },
    value: { control: "number" },
    disabled: { control: "boolean" },
    showRange: { control: "boolean" },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: { min: 0, max: 100, value: 50 },
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState(3);
    return (
      <div className="w-80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Max parallel tasks
          </span>
          <span className="text-sm text-foreground tabular-nums">{value}</span>
        </div>
        <Slider min={1} max={10} value={value} onChange={setValue} />
      </div>
    );
  },
};

export const Temperature: Story = {
  render: () => {
    const [value, setValue] = useState(100);
    return (
      <div className="w-80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Temperature</span>
          <span className="text-sm text-foreground tabular-nums">
            {(value / 100).toFixed(2)}
          </span>
        </div>
        <Slider min={0} max={200} value={value} onChange={setValue} />
      </div>
    );
  },
};

export const Disabled: Story = {
  args: { min: 0, max: 10, value: 5, disabled: true },
};

export const NoRange: Story = {
  args: { min: 0, max: 100, value: 50, showRange: false },
};
