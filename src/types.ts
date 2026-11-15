export type Role = 'admin' | 'engineer' | 'supervisor';

export interface RoleDoc {
  email: string;
  name: string;
  role: Role;
  region: string; // supervisors: one region. engineers/admins: 'All regions'
}

/* ---------- Form templates ---------- */

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'date' | 'time'
  | 'choice' | 'checks' | 'photo' | 'signature';

export interface Check {
  min?: number;            // value must be >= min
  max?: number;            // value must be <= max
  lt?: number;             // value must be < lt
  minFrom?: string;        // value must be >= another field (same row first, then form level)
  allowed?: string[];      // choice must be one of these
  ref?: string;            // where the rule comes from, e.g. 'ITP 14'
}

export interface ShowIf { key: string; in: string[] }

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  options?: string[];
  required?: boolean;
  default?: string;
  placeholder?: string;
  check?: Check;
  showIf?: ShowIf;
  full?: boolean;          // full width on the phone
}

export interface RowRule {   // check across two fields in a repeating row
  label: string;
  a: string; b: string;      // a - b must be >= min
  min: number;
  ref?: string;
}

export interface Section {
  id: string;
  title: string;
  fields: Field[];
  repeat?: { min: number; max: number; itemLabel: string };
  rowRules?: RowRule[];
}

export interface FormTemplate {
  code: string;            // 'QF-21'
  title: string;           // title on the paper form
  rev: string;             // template revision, e.g. '1.0.1'
  revDate: string;
  sections: Section[];
}

/* ---------- Project, ITP, submissions ---------- */

export interface ItpItem {
  no: number; activity: string; criteria: string;
  reference: string; spec: string;
  forms: string[];         // QF form templates this item creates (from the reference column, confirmed by the engineer)
  inspectedBy: string[]; type: string;
}

export interface Itp {
  docId: string; rev: string; itemName: string; project: string; date?: string; notes: string[]; items: ItpItem[];
}

export interface ItpRevision { rev: string; file: string; fileName: string; publishedAt: string; publishedBy: string; items: number }

export interface Project {
  id: string;
  jobNo: string;
  name: string;
  client: string;
  region: string;
  location: string;        // site location the ITP covers
  responsible: string;
  itpAuthorisedBy: string;
  itp: Itp;                // current revision
  itpFile?: string;        // storage path of the uploaded original
  itpRevs?: ItpRevision[]; // every published revision, newest last
  status?: 'active' | 'closed';
  createdAt?: any;
}

export type Status = 'draft' | 'submitted' | 'returned' | 'approved' | 'not_needed';

export type RowValues = Record<string, any>;
export type Values = Record<string, any>; // field key -> value, or section id -> RowValues[]

export interface HistoryEntry { at: string; by: string; what: string }

export interface Submission {
  id: string;
  projectId: string;
  region: string;
  date: string;            // YYYY-MM-DD, the day of work
  formCode: string;
  templateRev: string;
  itpRev?: string;         // ITP revision the form was created under
  version: number;
  status: Status;
  header: Record<string, string>;
  values: Values;
  comments?: Record<string, string>;  // engineer comments by field path
  returnNote?: string;
  supervisorEmail: string;
  submittedAt?: string;
  decidedAt?: string;
  decidedBy?: string;
  pdfPath?: string;
  history: HistoryEntry[];
}

/* ---------- Company PDF form templates ---------- */

/** One fillable box in an uploaded company PDF form. */
export interface PdfBox {
  name: string;
  kind: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'list' | 'button' | 'signature' | 'other';
  page: number;            // 1-based
  options?: string[];      // radio / dropdown / list choices
  multiline?: boolean;
}

/** What fills a box: a source id (see sourcesFor) and, for a tick box, the option that ticks it. */
export interface BoxMap { source: string; option?: string }

/** pdfTemplates/{formCode}: the company's fillable PDF for a QF form and how its boxes map to the form's fields. */
export interface PdfTemplateDoc {
  code: string;
  file: string;            // storage path of the uploaded PDF
  fileName: string;
  boxes: PdfBox[];
  mapping: Record<string, BoxMap>; // box name -> source
  uploadedBy: string;
  uploadedAt: string;
  updatedAt?: string;
}
