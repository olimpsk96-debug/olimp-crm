export interface CatalogItem {
  name: string;
  item_name: string;
  code?: string;
  section?: string;
  standard?: string;
  edition?: string;
  unit: string;
  base_price: number;
  work_type?: string;
  region?: string;
  usage_count?: number;
  notes?: string;
  match_score?: number;
}

export interface CatalogStats {
  total: number;
  by_section: { section: string; cnt: number }[];
  top_used: { name: string; item_name: string; unit: string; base_price: number; usage_count: number }[];
}
