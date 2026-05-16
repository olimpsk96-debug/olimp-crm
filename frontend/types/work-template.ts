export interface WorkStageTemplate {
  name?: string;
  stage_order?: number;
  title: string;
  unit: string;
  norm_per_base_unit: number;
  labor_hours_per_unit?: number;
  materials_json?: string;
  gesn_ref?: string;
  catalog_resource?: string | null;
  notes?: string;
}

export interface WorkTemplate {
  name?: string;
  template_id: string;
  title: string;
  category: string;
  base_unit: string;
  typical_volume_min?: number;
  typical_volume_max?: number;
  keywords: string;
  description?: string;
  source?: string;
  is_verified?: 0 | 1;
  usage_count?: number;
  stages_count?: number;
  stages?: WorkStageTemplate[];
  modified?: string;
}

export const CATEGORIES = [
  "АКЗ", "Огнезащита", "Усиление конструкций", "Монтаж м/к",
  "Промальп", "Кровля", "Полы", "Отделка", "Земляные работы",
  "Бетонные работы", "Демонтаж", "Прочее",
] as const;

export const SOURCES = [
  "Ручной ввод",
  "Импорт из CWICR",
  "AI-генерация (черновик)",
  "Импорт из ГЭСН",
] as const;
