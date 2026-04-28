import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageLayout, PageHeader } from "./page-layout";

const meta: Meta<typeof PageLayout> = {
  title: "UI/PageLayout",
  component: PageLayout,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PageLayout>;

export const Default: Story = {
  render: () => (
    <PageLayout>
      <PageHeader title="Tasks">
        <button className="filter-pill active">New Task</button>
      </PageHeader>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Page content goes here</p>
      </div>
    </PageLayout>
  ),
};

export const WithoutAction: Story = {
  render: () => (
    <PageLayout>
      <PageHeader title="Documents" />
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          No action button in header
        </p>
      </div>
    </PageLayout>
  ),
};

export const SettingsStyle: Story = {
  render: () => (
    <PageLayout>
      <PageHeader title="Settings">
        <button className="filter-pill active">Save</button>
      </PageHeader>
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            API Key
          </label>
          <div className="mt-1.5 bg-muted border border-border rounded-md px-3 py-2.5 text-sm">
            sk-ant-***
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Model
          </label>
          <div className="mt-1.5 bg-muted border border-border rounded-md px-3 py-2.5 text-sm">
            claude-sonnet-4.6
          </div>
        </div>
      </div>
    </PageLayout>
  ),
};
