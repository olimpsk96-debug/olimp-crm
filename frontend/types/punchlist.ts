export type PunchListStatus =
  | "Открыто"
  | "В работе"
  | "Выполнено"
  | "Принято заказчиком"
  | "Отменено";

export type PunchListUrgency = "Низкая" | "Средняя" | "Высокая" | "Критично";

export type PunchListItemType =
  | "Дефект"
  | "Доделка"
  | "Замечание заказчика"
  | "Корректировка проекта"
  | "Подготовка к сдаче";

export interface PunchListItem {
  name: string;
  title: string;
  project: string;
  item_type: PunchListItemType;
  urgency: PunchListUrgency;
  status: PunchListStatus;
  location?: string;
  assignee?: string;
  reported_by?: string;
  reported_date?: string;
  due_date?: string;
  completed_date?: string;
  description?: string;
  solution_notes?: string;
  photo_before?: string;
  photo_after?: string;
  cost_estimate?: number;
}

export interface PunchListStats {
  total: number;
  open: number;
  in_progress: number;
  done: number;
  overdue: number;
  critical: number;
}
