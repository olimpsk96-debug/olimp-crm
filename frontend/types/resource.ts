export type ResourceType = "Material" | "Labor" | "Equipment" | "Abstract Material";

export interface CatalogResource {
  name: string;
  resource_code: string;
  resource_name: string;
  resource_type: ResourceType;
  unit?: string;
  price_avg: number;
  price_min?: number;
  price_max?: number;
  currency?: string;
  parent_collection?: string;
  parent_category?: string;
  usage_count?: number;
}

export interface ResourceStats {
  total: number;
  loaded: boolean;
  by_type: Record<ResourceType, number>;
  by_collection: { parent_collection: string; cnt: number }[];
}
