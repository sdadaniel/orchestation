import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Plus, Trash2, Settings, ChevronRight } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "ghost",
        "sidebar",
        "sidebarActive",
        "sidebarDisabled",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon", "sidebar"],
    },
    disabled: { control: "boolean" },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: "Button",
    variant: "default",
    size: "default",
  },
};

export const Ghost: Story = {
  args: {
    children: "Ghost Button",
    variant: "ghost",
  },
};

export const Small: Story = {
  args: {
    children: "Small",
    variant: "default",
    size: "sm",
  },
};

export const Large: Story = {
  args: {
    children: "Large Button",
    variant: "default",
    size: "lg",
  },
};

export const Icon: Story = {
  args: {
    variant: "ghost",
    size: "icon",
    children: <Settings className="h-4 w-4" />,
  },
};

export const WithIcon: Story = {
  args: {
    variant: "default",
    children: (
      <>
        <Plus className="h-4 w-4" />
        New Task
      </>
    ),
  },
};

export const Disabled: Story = {
  args: {
    children: "Disabled",
    variant: "default",
    disabled: true,
  },
};

export const Sidebar: Story = {
  args: {
    variant: "sidebar",
    size: "sidebar",
    children: (
      <>
        <ChevronRight className="h-3.5 w-3.5" />
        Sidebar Item
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-[220px] bg-[var(--sidebar)] p-2 rounded-md">
        <Story />
      </div>
    ),
  ],
};

export const SidebarActive: Story = {
  args: {
    variant: "sidebarActive",
    size: "sidebar",
    children: (
      <>
        <ChevronRight className="h-3.5 w-3.5" />
        Active Item
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-[220px] bg-[var(--sidebar)] p-2 rounded-md">
        <Story />
      </div>
    ),
  ],
};

export const SidebarDisabled: Story = {
  args: {
    variant: "sidebarDisabled",
    size: "sidebar",
    children: (
      <>
        <Trash2 className="h-3.5 w-3.5" />
        Disabled Item
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-[220px] bg-[var(--sidebar)] p-2 rounded-md">
        <Story />
      </div>
    ),
  ],
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="default">Default</Button>
        <Button variant="default" size="sm">
          Small
        </Button>
        <Button variant="default" size="lg">
          Large
        </Button>
        <Button variant="default" size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost">Ghost</Button>
        <Button variant="default" disabled>
          Disabled
        </Button>
      </div>
      <div className="w-[220px] bg-[var(--sidebar)] p-2 rounded-md flex flex-col gap-1">
        <Button variant="sidebar" size="sidebar">
          <ChevronRight className="h-3.5 w-3.5" /> Sidebar
        </Button>
        <Button variant="sidebarActive" size="sidebar">
          <ChevronRight className="h-3.5 w-3.5" /> Active
        </Button>
        <Button variant="sidebarDisabled" size="sidebar">
          <Trash2 className="h-3.5 w-3.5" /> Disabled
        </Button>
      </div>
    </div>
  ),
};
