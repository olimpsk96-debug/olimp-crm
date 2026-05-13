export type ProjectStatus = "Подготовка" | "В работе" | "Сдача" | "Закрыт" | "На паузе" | "Отменён";

export type WorkType =
  | "АКЗ (антикоррозийная защита)"
  | "Промальп (промышленный альпинизм)"
  | "Бетонные работы"
  | "Сварочные работы"
  | "Кровельные работы"
  | "Строительно-монтажные"
  | "Прочее";

export interface ProjectListItem {
  name: string;
  title: string;
  status: ProjectStatus;
  customer: string;
  tender?: string;
  estimate?: string;
  work_type?: WorkType;
  location?: string;
  contract_amount?: number;
  planned_cost?: number;
  planned_margin_pct?: number;
  start_date?: string;
  planned_end_date?: string;
  actual_end_date?: string;
  foreman?: string;
  ks2_signed: number;
  ks2_paid: number;
  progress_pct: number;
  supply_total: number;
  days_left: number | null;
  open_incidents: number;
}

export interface ProjectMargin {
  plan_revenue: number;
  plan_cost: number;
  plan_margin: number;
  plan_margin_pct: number;
  fact_revenue: number;
  fact_cost: number;
  fact_margin: number;
  fact_margin_pct: number;
  ks2_debt: number;
}

export interface ProjectDetail {
  name: string;
  title: string;
  status: ProjectStatus;
  customer: string;
  work_type?: WorkType;
  location?: string;
  contract_number?: string;
  contract_amount: number;
  planned_cost: number;
  planned_margin_pct: number;
  start_date?: string;
  planned_end_date?: string;
  actual_end_date?: string;
  foreman?: string;
  description?: string;
  notes?: string;
  tender_ref?: string;
  estimate_ref?: string;
  progress_pct: number;
  days_left: number | null;
  margin: ProjectMargin;
  tender?: { name: string; title: string; status: string; our_price: number; nmck: number } | null;
  estimate?: { name: string; title: string; total_cost: number; total_price: number; margin_pct: number } | null;
  ks2_acts: Array<{ name: string; title: string; amount: number; payment_received: number; status: string; payment_status: string; act_date?: string; payment_due_date?: string }>;
  supply: Array<{ name: string; title: string; status: string; total_estimated?: number; needed_by_date?: string }>;
  equipment: Array<{ name: string; equipment_name: string; category: string; status: string; next_maintenance_date?: string }>;
  reports: Array<{ name: string; title?: string; report_date: string; workers_count?: number; status: string; has_safety_incident?: number }>;
  incidents: Array<{ name: string; title: string; severity: string; status: string; incident_date: string }>;
}

export interface ProjectStats {
  active: number;
  active_amount: number;
  closed: number;
  closed_amount: number;
  by_status: Array<{ status: string; cnt: number; total: number }>;
  deadline_warn: Array<{ name: string; title: string; planned_end_date: string; customer: string }>;
}
