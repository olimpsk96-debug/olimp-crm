// Типы для модуля субподрядных тендеров (Subcontract Bid Request + Proposal)

export type BidRequestStatus =
  | "Черновик"
  | "Отправлено"
  | "Приём предложений"
  | "Сравнение"
  | "Присуждён"
  | "Отменён";

export type ProposalStatus =
  | "Получено"
  | "На рассмотрении"
  | "Выбрано"
  | "Отклонено";

export type SubWorkType = "АКЗ" | "Кровля" | "Промальп" | "Монолит" | "Усиление" | "Комплексный" | "";

export interface SubcontractBidItem {
  name?: string;
  item_code?: string;
  item_name: string;
  unit?: string;
  qty: number;
  our_unit_price: number;
  our_amount?: number;
  work_type?: SubWorkType;
  source_estimate_item?: string;
  notes?: string;
}

export interface SubcontractBidRequest {
  name: string;
  title: string;
  project: string;
  estimate?: string | null;
  status: BidRequestStatus;
  work_type?: SubWorkType;
  sent_date?: string | null;
  deadline_date?: string | null;
  work_start_date?: string | null;
  work_end_date?: string | null;
  total_target_amount: number;
  best_proposal_amount: number;
  savings_amount: number;
  savings_pct: number;
  awarded_to?: string | null;
  proposals_count: number;
  description?: string;
  created_by_full_name?: string;
  creation?: string;
  items?: SubcontractBidItem[];
  proposals?: Proposal[];
}

export interface ProposalItem {
  name?: string;
  linked_bid_item?: string;
  item_name: string;
  unit?: string;
  qty: number;
  supplier_unit_price: number;
  supplier_amount?: number;
  supplier_notes?: string;
}

export interface Proposal {
  name: string;
  bid_request?: string;
  supplier: string;
  supplier_name_snapshot?: string;
  status: ProposalStatus;
  received_date?: string | null;
  valid_until?: string | null;
  total_amount: number;
  vs_target_pct: number;
  delivery_terms?: string;
  payment_terms?: string;
  contact_phone?: string;
  attachment_file?: string;
  notes?: string;
  items?: ProposalItem[];
}

export interface BidStats {
  total: number;
  active: number;
  awarded: number;
  cancelled: number;
  total_savings: number;
  total_target_amount: number;
  proposals_total: number;
}

export interface ComparisonRow {
  bid_item: {
    name: string;
    item_code?: string;
    item_name: string;
    unit?: string;
    qty: number;
    our_unit_price: number;
    our_amount: number;
    work_type?: SubWorkType;
  };
  prices: Record<string, { unit_price: number; amount: number; notes?: string } | null>;
  cheapest_proposal: string | null;
}

export interface ComparisonView {
  bid_request: {
    name: string;
    title: string;
    project: string;
    status: BidRequestStatus;
    total_target_amount: number;
    best_proposal_amount: number;
    savings_amount: number;
    savings_pct: number;
    awarded_to: string | null;
  };
  proposals: Array<{
    name: string;
    supplier: string;
    supplier_name_snapshot?: string;
    status: ProposalStatus;
    total_amount: number;
    vs_target_pct: number;
    received_date?: string;
  }>;
  rows: ComparisonRow[];
}
