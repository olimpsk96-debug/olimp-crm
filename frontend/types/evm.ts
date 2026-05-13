export interface EVMHealth {
  level: "excellent" | "good" | "warning" | "critical" | "disaster" | "unknown";
  label: string;
  color: string;
}

export interface EVMForecast {
  project: string;
  as_of: string;
  bac: number;
  ac: number;
  ev: number;
  pv: number;
  co_approved: number;
  contract_amount: number;
  completion_pct: number;
  cpi: number;
  spi: number;
  eac: number;
  etc: number;
  vac: number;
  tcpi: number;
  health: EVMHealth;
  warnings: string[];
}
