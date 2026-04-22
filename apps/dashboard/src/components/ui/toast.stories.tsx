import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ToastProvider, useToast } from "./toast";
import { Button } from "./button";

const meta: Meta = {
  title: "UI/Toast",
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj;

function ToastDemo() {
  const { addToast } = useToast();
  return (
    <div className="flex gap-3">
      <Button
        variant="default"
        onClick={() => addToast("Task created successfully", "success")}
      >
        Success
      </Button>
      <Button
        variant="default"
        onClick={() => addToast("Failed to connect to server", "error")}
      >
        Error
      </Button>
      <Button
        variant="default"
        onClick={() => addToast("Sprint planning starts tomorrow", "info")}
      >
        Info
      </Button>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <ToastDemo />,
};
