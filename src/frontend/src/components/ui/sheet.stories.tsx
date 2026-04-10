import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "./sheet";
import { Button } from "./button";

const meta: Meta = {
  title: "UI/Sheet",
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const Right: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Sheet (Right)</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Task Detail</SheetTitle>
          <SheetDescription>View and edit task properties.</SheetDescription>
        </SheetHeader>
        <div className="p-4 text-sm text-muted-foreground">
          Sheet content goes here.
        </div>
        <SheetFooter>
          <Button variant="default" size="sm">
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const Left: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Sheet (Left)</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Browse project structure.</SheetDescription>
        </SheetHeader>
        <div className="p-4 text-sm text-muted-foreground">
          Navigation content here.
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const Bottom: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Sheet (Bottom)</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Terminal</SheetTitle>
          <SheetDescription>Command output panel.</SheetDescription>
        </SheetHeader>
        <div className="p-4 text-sm font-mono text-muted-foreground h-32">
          $ orchestrate run --sprint SP-001
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const NoCloseButton: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>No Close Button</Button>
      </SheetTrigger>
      <SheetContent side="right" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Custom Sheet</SheetTitle>
          <SheetDescription>Close button is hidden.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
