"use client";

import Link from "next/link";

type OverviewCardProps = {
  label: string;
  count: number;
  color: string;
  href: string;
};

const OverviewCard = ({ label, count, color, href }: OverviewCardProps) => {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-primary hover:bg-card/70"
    >
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{count}</div>
    </Link>
  );
};

export default OverviewCard;
