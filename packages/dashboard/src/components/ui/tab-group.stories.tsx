import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Pencil, Sparkles } from "lucide-react";
import { TabGroup, TabList, Tab, TabPanel } from "./tab-group";

const meta = {
  title: "UI/TabGroup",
  component: TabGroup,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof TabGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function TabGroupWriteSuggestDemo() {
  const [tab, setTab] = useState<"write" | "suggest">("write");

  return (
    <div className="w-[min(100vw-2rem,480px)] bg-background p-4 space-y-2">
      <TabGroup value={tab} onValueChange={setTab}>
        <TabList aria-label="작성 방식">
          <Tab value="write" icon={Pencil}>
            직접 작성
          </Tab>
          <Tab value="suggest" icon={Sparkles} tone="highlight">
            추천받기
          </Tab>
        </TabList>
        <TabPanel value="write">
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            직접 작성 패널 (예시)
          </div>
        </TabPanel>
        <TabPanel value="suggest">
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            추천 패널 (예시)
          </div>
        </TabPanel>
      </TabGroup>
    </div>
  );
}

export const UnderlinePanels: Story = {
  args: {
    value: "write",
    onValueChange: () => {},
    children: null,
  },
  render: () => <TabGroupWriteSuggestDemo />,
};
