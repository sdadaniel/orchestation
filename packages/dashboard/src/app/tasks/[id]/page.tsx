import TaskDetailPageView from "@/views/tasks/[id]";

export default function TasksIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <TaskDetailPageView params={params} />;
}
