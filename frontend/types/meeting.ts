export type MeetingStatus = "Запланирована" | "Проведена" | "Отменена";
export type MeetingItemStatus = "Открыто" | "В работе" | "Выполнено" | "Отменено";
export type MeetingType = "Утренняя планёрка" | "Еженедельная" | "С заказчиком" | "С поставщиком" | "По ОТ-ТБ" | "Разбор инцидента" | "Прочая";

export interface MeetingAttendee {
  name?: string;
  full_name: string;
  role?: string;
  company?: string;
  presence?: "Был" | "Не был" | "Опоздал";
}

export interface MeetingItem {
  name?: string;
  idx?: number;
  topic: string;
  decision?: string;
  responsible?: string;
  due_date?: string;
  status: MeetingItemStatus;
  notes?: string;
}

export interface Meeting {
  name: string;
  title: string;
  status: MeetingStatus;
  meeting_type: MeetingType;
  project?: string;
  meeting_date: string;
  start_time?: string;
  duration_min?: number;
  location?: string;
  attendees: MeetingAttendee[];
  items: MeetingItem[];
  agenda_notes?: string;
}

export interface OpenMeetingItem {
  meeting: string;
  meeting_title: string;
  meeting_date: string;
  project?: string;
  item_idx: number;
  topic: string;
  decision?: string;
  responsible?: string;
  due_date?: string;
  status: MeetingItemStatus;
  overdue: boolean;
  days_to_due?: number | null;
}

export interface MeetingStats {
  days: number;
  total_meetings: number;
  held: number;
  items_by_status: Record<string, number>;
  overdue_items: number;
}
