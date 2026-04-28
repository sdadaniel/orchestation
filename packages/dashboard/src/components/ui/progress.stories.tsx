import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Progress } from "./progress";

const meta: Meta<typeof Progress> = {
  title: "UI/Progress",
  component: Progress,
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100 } },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {
  args: { value: 50 },
};

export const Empty: Story = {
  args: { value: 0 },
};

export const Full: Story = {
  args: { value: 100 },
};

export const Quarter: Story = {
  args: { value: 25 },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <div>
        <p className="text-xs text-muted-foreground mb-1">0%</p>
        <Progress value={0} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">25%</p>
        <Progress value={25} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">50%</p>
        <Progress value={50} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">75%</p>
        <Progress value={75} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">100%</p>
        <Progress value={100} />
      </div>
    </div>
  ),
};
