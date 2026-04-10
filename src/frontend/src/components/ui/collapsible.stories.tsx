import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./collapsible";
import { Button } from "./button";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

const meta: Meta = {
  title: "UI/Collapsible",
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <Collapsible open={open} onOpenChange={setOpen} className="w-80">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2 w-full justify-start px-2"
          >
            <ChevronRight
              className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
            />
            <span className="text-sm font-medium">Sprint SP-001</span>
            <span className="ml-auto text-xs text-muted-foreground">
              3 tasks
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 flex flex-col gap-1 mt-1">
          <div className="text-sm py-1 px-2 rounded hover:bg-muted cursor-pointer">
            TASK-001: Setup project
          </div>
          <div className="text-sm py-1 px-2 rounded hover:bg-muted cursor-pointer">
            TASK-002: Create API
          </div>
          <div className="text-sm py-1 px-2 rounded hover:bg-muted cursor-pointer">
            TASK-003: Write tests
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  },
};

export const MultipleGroups: Story = {
  render: () => (
    <div className="w-80 flex flex-col gap-1 bg-[var(--sidebar)] p-2 rounded-md">
      {["SP-001 Auth", "SP-002 Dashboard", "SP-003 API"].map((sprint, i) => (
        <Collapsible key={sprint} defaultOpen={i === 0}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 w-full justify-start px-2"
            >
              <ChevronRight className="h-4 w-4" />
              <span className="text-xs font-medium">{sprint}</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 flex flex-col gap-0.5 mt-0.5">
            {[1, 2].map((t) => (
              <div
                key={t}
                className="text-xs py-1 px-2 rounded hover:bg-sidebar-accent cursor-pointer text-muted-foreground"
              >
                Task {t}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  ),
};
