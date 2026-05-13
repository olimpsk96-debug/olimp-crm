export type KS2Status = "Черновик" | "На подписании" | "Подписан" | "Отклонён";
export type PaymentStatus = "Ожидает" | "Частично" | "Оплачено";

export interface KS2Item {
  name?: string;
  work_name: string;
  unit?: string;
  qty?: number;
  unit_price?: number;
  amount?: number;
  estimate_ref?: string;
}

export interface KS2Act {
  name: string;
  title: string;
  status: KS2Status;
  act_number?: string;
  project?: string;
  tender?: string;
  customer?: string;
  contract_number?: string;
  period_from?: string;
  period_to?: string;
  act_date?: string;
  signed_date?: string;
  amount?: number;
  payment_status?: PaymentStatus;
  payment_due_date?: string;
  payment_received?: number;
  notes?: string;
  items?: KS2Item[];
}
