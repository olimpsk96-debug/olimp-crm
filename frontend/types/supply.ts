export type SupplyStatus =
  | "Черновик"
  | "Отправлена"
  | "Одобрена"
  | "Закупается"
  | "Получена"
  | "Отменена";

export type SupplyPriority = "Обычная" | "Срочная" | "Критическая";

export interface SupplyItem {
  name?: string;
  item_name: string;
  specification?: string;
  unit?: string;
  qty?: number;
  unit_price_estimated?: number;
  amount_estimated?: number;
  supplier_suggestion?: string;
}

export interface MaterialRequest {
  name: string;
  title: string;
  status: SupplyStatus;
  priority: SupplyPriority;
  project?: string;
  requested_by?: string;
  request_date?: string;
  needed_by_date?: string;
  total_estimated?: number;
  notes?: string;
  items?: SupplyItem[];
}
