export type ChangeOrderStatus = "Черновик" | "На согласовании" | "Одобрен" | "Отклонён" | "Закрыт";

export type ReasonCategory =
  | "Запрос заказчика"
  | "Изменение условий объекта"
  | "Ошибка в проекте"
  | "Нормативное требование"
  | "Прочее";

export type VariationType =
  | ""
  | "Дополнительные работы"
  | "Исключение работ"
  | "Замена материалов"
  | "Продление сроков"
  | "Комбинированное";

export interface ChangeOrderItem {
  name?: string;
  work_name: string;
  unit?: string;
  qty?: number;
  unit_price?: number;
  amount?: number;
  notes?: string;
}

export interface ChangeOrder {
  name: string;
  title: string;
  status: ChangeOrderStatus;
  project: string;
  reason_category: ReasonCategory;
  variation_type?: VariationType;
  request_date?: string;
  description?: string;
  items: ChangeOrderItem[];
  contractor_amount?: number;
  engineer_amount?: number;
  approved_amount?: number;
  schedule_impact_days?: number;
  submitted_by?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  notes?: string;
}

export interface ChangeOrderStats {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
  closed: number;
  approved_total: number;
  pending_total: number;
  schedule_impact_days: number;
}
