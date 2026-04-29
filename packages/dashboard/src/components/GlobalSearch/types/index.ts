export type SearchResultItem = {
  type: "task" | "doc";
  id: string;
  displayId: string;
  title: string;
  status?: string;
  href: string;
};
