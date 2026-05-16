export type PDFAnnotationKind = "note" | "rect" | "stamp" | "signature";

export interface PDFAnnotationItem {
  id: string;
  kind: PDFAnnotationKind;
  page: number;
  /** Координаты в % контейнера PDF (0..100). Так разметка остаётся валидной при ресайзе. */
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  color?: string;
  author?: string;
  created?: string;
}

export interface PDFAnnotationDoc {
  name?: string;
  title: string;
  reference_doctype: string;
  reference_name: string;
  pdf_file?: string;
  status?: "Черновик" | "На согласовании" | "Подписан" | "Отклонён";
  annotation_count?: number;
  signed_by?: string;
  signed_at?: string;
  signed_role?: string;
  annotations?: PDFAnnotationItem[];
  notes?: string;
  modified?: string;
  owner?: string;
}
