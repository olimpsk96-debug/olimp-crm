// Типы для модуля рисков

export type RiskStatus = "Открыт" | "В работе" | "Снижен" | "Закрыт" | "Реализовался";

export type RiskCategory =
  | "Финансовый" | "Технический" | "Срочный" | "Качество" | "Безопасность"
  | "Регуляторный" | "Поставщик" | "Заказчик" | "Погодный";

export type RiskResponse = "Принять" | "Снизить" | "Передать" | "Избежать";

// Probability/Impact приходят как "1 — Очень низкая" / "5 — Критическое"
export type ProbabilityLevel = string;
export type ImpactLevel = string;

export interface ProjectRisk {
  name: string;
  title: string;
  project: string;
  category: RiskCategory;
  status: RiskStatus;
  probability: ProbabilityLevel;
  impact: ImpactLevel;
  risk_score: number;
  impact_amount: number;
  contingency_amount: number;
  response_strategy?: RiskResponse;
  mitigation_plan?: string;
  trigger_events?: string;
  actual_outcome?: string;
  owner_full_name?: string;
  detected_date?: string;
  target_resolution_date?: string;
  linked_estimate?: string | null;
  notes?: string;
}

export interface RiskSummary {
  total: number;
  open_count: number;
  materialized: number;
  red_zone: number;
  yellow_zone: number;
  green_zone: number;
  contingency_total: number;
  max_exposure: number;
}

export interface MatrixCell {
  p: number;
  i: number;
  score: number;
  count: number;
  items: { name: string; title: string; risk_score: number; impact_amount: number }[];
}
