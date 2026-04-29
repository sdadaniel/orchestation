export interface NoticeEntity {
  id: number;
  notice_id: string | null;
  title: string | null;
  content: string | null;
  type: "info" | "warning" | "error" | string;
  created: string;
}

export interface DocEntity {
  id: string;
  title: string | null;
  content: string | null;
  category: string | null;
  updated: string;
}
