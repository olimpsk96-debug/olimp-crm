export interface CashEvent {
  name: string;
  title: string;
  amount: number;
  due_date: string | null;
  days_left: number | null;
  overdue: boolean;
  type: "income" | "expense";
  customer?: string;
  project?: string;
}

export interface MonthForecast {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface CashflowDashboard {
  current_balance: number;
  total_incoming: number;
  total_outgoing: number;
  projected_balance: number;
  incoming: CashEvent[];
  outgoing: CashEvent[];
  monthly_forecast: MonthForecast[];
}
