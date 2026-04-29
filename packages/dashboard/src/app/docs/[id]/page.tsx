import DocsPageView from "@/views/docs/[id]";

export default function DocsIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <DocsPageView params={params} />;
}
