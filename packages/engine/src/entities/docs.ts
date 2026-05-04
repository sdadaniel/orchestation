export interface NoticeEntity {
  id: string;
  display_id: string | null;
  display_number: number | null;
  legacy_notice_key: string | null;
  title: string | null;
  content: string | null;
  type: "info" | "warning" | "error" | string;
  read: number | null;
  created: string;
  updated: string;
}

export interface DocEntity {
  id: string;
  title: string | null;
  content: string | null;
  category: string | null;
  updated: string;
}
