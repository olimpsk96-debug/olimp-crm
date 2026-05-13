export interface ActivityEvent {
  doctype: string;
  name: string;
  title: string;
  status: string | null;
  action: "created" | "updated" | "status_changed";
  when: string;
  when_ts: number;
  who: string;
  project: string | null;
  icon: string;
  label: string;
  href: string;
}

export interface ActivitySummary {
  total_events: number;
  days: number;
  by_type: Record<string, number>;
  top: { label: string; count: number }[];
}
