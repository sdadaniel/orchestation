import { redirect } from "next/navigation";

export default function MonitorPageView() {
  redirect("/log");
  return null;
}
