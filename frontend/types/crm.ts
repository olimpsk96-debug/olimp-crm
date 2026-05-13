export interface CrmClient {
  name: string;
  customer_name: string;
  customer_group?: string;
  territory?: string;
  website?: string;
  mobile_no?: string;
  tenders_count: number;
  tenders_active: number;
  ks2_total: number;
  last_interaction: string | null;
  deals_active: number;
}

export interface CrmContact {
  name: string;
  full_name: string;
  designation?: string;
  mobile_no?: string;
  email_id?: string;
}

export type InteractionType = "Звонок" | "Встреча" | "Письмо" | "Тендер" | "Прочее";

export interface Interaction {
  name: string;
  customer: string;
  contact_name?: string;
  interaction_type: InteractionType;
  date: string;
  summary: string;
  result?: string;
  next_action?: string;
  next_action_date?: string;
  tender?: string;
  deal?: string;
}

export type DealStatus =
  | "Лид"
  | "Переговоры"
  | "КП отправлено"
  | "Договор"
  | "В работе"
  | "Закрыт выигран"
  | "Закрыт проигран";

export type DealSource = "Сайт" | "Рекомендация" | "Тендер" | "Холодный звонок" | "Знакомство" | "Прочее";

export interface Deal {
  name: string;
  title: string;
  customer: string;
  contact_name?: string;
  status: DealStatus;
  amount_estimated?: number;
  probability_pct?: number;
  source?: DealSource;
  expected_close_date?: string;
  tender?: string;
  description?: string;
  notes?: string;
  interactions_count?: number;
}

export interface ClientDetail {
  name: string;
  customer_name: string;
  customer_group?: string;
  territory?: string;
  website?: string;
  mobile_no?: string;
  tenders: Array<{
    name: string; title: string; status: string;
    nmck?: number; deadline_date?: string; result?: string;
  }>;
  ks2_acts: Array<{
    name: string; title: string; amount: number;
    status: string; payment_status: string; payment_due_date?: string;
  }>;
  interactions: Interaction[];
  deals: Deal[];
  contacts: CrmContact[];
}

export interface CrmStats {
  total_clients: number;
  active_deals: number;
  pipeline_amount: number;
  interactions_week: number;
  next_actions: Array<{
    name: string; customer: string; next_action: string; next_action_date: string;
  }>;
  deals_by_status: Array<{ status: string; cnt: number; total: number }>;
}
