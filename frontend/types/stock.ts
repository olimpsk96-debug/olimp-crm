export type MovementType = "Приход" | "Расход" | "Перемещение" | "Инвентаризация";

export interface StockItem {
  name: string;
  item_name: string;
  item_code?: string;
  category?: string;
  unit: string;
  default_warehouse?: string;
  current_qty: number;
  min_qty?: number;
  last_price?: number;
  avg_price?: number;
  total_value?: number;
  last_movement_date?: string;
  is_low?: boolean;
  notes?: string;
  catalog_resource?: string;
}

export interface StockMovement {
  name: string;
  title: string;
  movement_type: MovementType;
  movement_date: string;
  stock_item: string;
  qty: number;
  unit_price?: number;
  amount?: number;
  warehouse?: string;
  warehouse_to?: string;
  project?: string;
  material_request?: string;
  supplier_name?: string;
  invoice_number?: string;
  responsible?: string;
  balance_after?: number;
  notes?: string;
}

export interface StockItemDetail extends StockItem {
  movements: StockMovement[];
}

export interface StockStats {
  total_items: number;
  total_value: number;
  low_stock: number;
  by_category: { category: string; cnt: number; value: number }[];
  recent_movements: { name: string; title: string; movement_type: MovementType; movement_date: string; qty: number; amount: number; project?: string }[];
  short_items: { name: string; item_name: string; unit: string; current_qty: number; min_qty: number; deficit: number }[];
}
