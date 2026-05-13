export type EstimateStatus = "Базовая" | "Скорректированная" | "Утверждена" | "Архив";

export interface EstimateItem {
  name?: string;
  is_section?: 0 | 1;
  section_title?: string;
  item_code?: string;
  item_name: string;
  unit?: string;
  qty?: number;
  base_unit_price?: number;
  base_amount?: number;
  our_unit_price?: number;
  our_amount?: number;
  deviation_pct?: number;
  work_type?: string;
  notes?: string;
}

export interface Estimate {
  name: string;
  title: string;
  status: EstimateStatus;
  version?: number;
  project?: string;
  tender?: string;
  estimate_date?: string;
  base_total?: number;
  our_total?: number;
  margin_pct?: number;
  margin_amount?: number;
  overhead_pct?: number;
  profit_pct?: number;
  import_source?: string;
  imported_at?: string;
  items?: EstimateItem[];
  notes?: string;
}
