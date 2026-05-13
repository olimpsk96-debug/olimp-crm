export type EquipmentStatus = "Доступна" | "На объекте" | "На ТО" | "В ремонте" | "Списана";
export type EquipmentCategory =
  | "Подъёмники" | "АКЗ оборудование" | "Бетонные работы"
  | "Сварочное" | "Промальп" | "Грузовая техника" | "Прочее";
export type MaintenanceType = "Плановое ТО" | "Внеплановое ТО" | "Ремонт" | "Поверка" | "СРО" | "Страховка";

export interface Equipment {
  name: string;
  equipment_name: string;
  category: EquipmentCategory;
  status: EquipmentStatus;
  current_location?: string;
  responsible_person?: string;
  project?: string;
  next_maintenance_date?: string;
  insurance_expiry?: string;
  certification_expiry?: string;
  sro_expiry?: string;
  purchase_price?: number;
  depreciation_rate_pct?: number;
  rental_rate_per_day?: number;
  engine_hours?: number;
  odometer?: number;
  year_of_manufacture?: number;
  vin_number?: string;
  inventory_code?: string;
  notes?: string;
  maintenance_days_left?: number | null;
}

export interface EquipmentDetail extends Equipment {
  maintenance_logs: MaintenanceLog[];
  fuel_30d: { liters: number; amount: number };
  fuel_logs: FuelLogEntry[];
  total_maintenance_cost: number;
}

export interface MaintenanceLog {
  name: string;
  maintenance_type: MaintenanceType;
  maintenance_date: string;
  performed_by?: string;
  total_cost?: number;
  description?: string;
  next_maintenance_date?: string;
}

export interface FuelLogEntry {
  name: string;
  fuel_date: string;
  liters: number;
  total_amount?: number;
  filled_by?: string;
  odometer_reading?: number;
}

export interface EquipmentStats {
  total: number;
  available: number;
  in_use: number;
  on_maintenance: number;
  maintenance_due_7d: number;
  fuel_month: number;
}
