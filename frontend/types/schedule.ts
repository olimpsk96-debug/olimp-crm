// Типы для модуля графиков работ (Schedule Task / Gantt)

export type TaskStatus = "Запланирована" | "В работе" | "Выполнена" | "Отменена";

export interface ScheduleTask {
  name: string;
  project: string;
  parent_task?: string | null;
  is_section?: 0 | 1;
  is_critical?: 0 | 1;
  title: string;
  status: TaskStatus;
  start_date?: string | null;
  end_date?: string | null;
  duration_days?: number;
  progress: number;
  assignee?: string;
  subcontractor?: string | null;
  order_idx?: number;
  predecessor?: string | null;
  estimate_item_link?: string;
  notes?: string;
}

export interface ScheduleBounds {
  start: string;
  end: string;
  total_days: number;
}

export interface ScheduleResponse {
  project: string;
  tasks: ScheduleTask[];
  bounds: ScheduleBounds | null;
}

export interface ScheduleSummary {
  total: number;
  planned: number;
  in_progress: number;
  done: number;
  overdue: number;
  critical_count: number;
  avg_progress: number;
}
