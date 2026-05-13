export type KS3Status = "Черновик" | "На подписании" | "Подписан" | "Отклонён";

export interface KS3Item {
  name?: string;
  position_number?: number;
  work_name: string;
  code?: string;
  cost_since_start?: number;
  cost_since_year?: number;
  cost_period: number;
  ks2_act_ref?: string;
  notes?: string;
}

export interface KS3LinkedAct {
  name?: string;
  ks2_act: string;
  act_number?: string;
  act_date?: string;
  act_amount?: number;
}

export interface KS3Act {
  name: string;
  title: string;
  status: KS3Status;
  act_number?: string;
  okud_code?: string;
  project: string;
  tender?: string;
  customer?: string;
  contract_number?: string;
  customer_inn?: string;
  customer_address?: string;
  contractor_inn?: string;
  contractor_address?: string;
  subcontractor_name?: string;
  period_from: string;
  period_to: string;
  report_date?: string;
  signed_date?: string;
  ks2_acts: KS3LinkedAct[];
  items: KS3Item[];
  total_since_start: number;
  total_since_year: number;
  total_period: number;
  vat_rate: number;
  vat_amount: number;
  total_with_vat: number;
  retention_pct: number;
  retention_amount: number;
  total_to_pay: number;
  signatory_customer_name?: string;
  signatory_customer_position?: string;
  signatory_contractor_name?: string;
  signatory_contractor_position?: string;
  notes?: string;
}

export interface KS3Stats {
  total: number;
  signed: number;
  draft: number;
  total_to_pay: number;
  total_retention: number;
}

export interface KS2ForKS3 {
  name: string;
  title: string;
  act_number?: string;
  act_date: string;
  amount: number;
}
