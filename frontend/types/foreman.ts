export type ReportStatus = "Черновик" | "Отправлен" | "Принят";
export type IncidentSeverity = "Незначительный" | "Средний" | "Тяжёлый" | "Критический";
export type IncidentStatus = "Открыт" | "В работе" | "Закрыт";

export interface ForemanReport {
  name: string;
  title: string;
  status: ReportStatus;
  project?: string;
  foreman_name?: string;
  report_date: string;
  workers_count?: number;
  brigades_info?: string;
  work_done?: string;
  issues?: string;
  has_safety_incident?: 0 | 1;
  materials_used?: string;
  equipment_used?: string;
  notes?: string;
}

export interface SafetyIncident {
  name: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  project?: string;
  incident_date: string;
  resolved_date?: string;
  description?: string;
  affected_person?: string;
  location?: string;
  measures_taken?: string;
  preventive_actions?: string;
  notes?: string;
}

export interface ForemanStats {
  reports_this_month: number;
  workers_today: number;
  open_incidents: number;
  critical_incidents: number;
}
