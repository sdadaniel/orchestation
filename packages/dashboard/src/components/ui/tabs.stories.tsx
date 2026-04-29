import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { FileText, Monitor, Terminal } from "lucide-react";
import { Tabs } from "./tabs";

const meta = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

function TabsPreview() {
  const [activeKey, setActiveKey] = useState<"detail" | "logs" | "terminal">(
    "detail",
  );

  return (
    <div className="w-[480px] bg-background p-4">
      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={[
          { key: "detail", label: "Content", icon: FileText },
          { key: "logs", label: "로그", icon: Terminal },
          { key: "terminal", label: "Terminal", icon: Monitor },
        ]}
      />
    </div>
  );
}

export const Default: Story = {
  args: {
    items: [],
    activeKey: "detail",
    onChange: () => {},
  },
  render: () => <TabsPreview />,
};
