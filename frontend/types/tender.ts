export type TenderStatus =
  | "Новый"
  | "Оценивается"
  | "Готовится заявка"
  | "Заявка подана"
  | "Выиграли"
  | "Проиграли"
  | "Отклонён";

export type TenderLaw = "44-ФЗ" | "223-ФЗ" | "Коммерческий";

export type WorkType = "АКЗ" | "Кровля" | "Промальп" | "Монолит" | "Усиление" | "Прочее";

export type AiRecommendation = "Подать" | "Не подавать" | "Уточнить";

export interface Tender {
  name: string;
  title: string;
  status: TenderStatus;
  customer?: string;
  tender_law?: TenderLaw;
  purchase_number?: string;
  platform_url?: string;
  work_type?: WorkType;
  region?: string;
  nmck?: number;
  our_price?: number;
  margin_pct?: number;
  deadline_date?: string;
  deadline_time?: string;
  submission_date?: string;
  ai_match_score?: number;
  ai_recommendation?: AiRecommendation;
  ai_analysis?: string;
  result?: "Выиграли" | "Проиграли" | "Отклонён";
  win_amount?: number;
  project_link?: string;
  notes?: string;
}

export interface PipelineColumn {
  id: TenderStatus;
  label: string;
  color: string;
  tenders: Tender[];
}
