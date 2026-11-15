export type Role = 'admin' | 'engineer' | 'supervisor';

export interface RoleDoc {
  email: string;
  name: string;
  role: Role;
  region: string; // supervisors: one region. engineers/admins: 'All regions'
}

/* ---------- Projects: Year › Client › Project › QA ---------- */

export interface Project {
  id: string;
  year: number;            // the year folder
  client: string;          // the client folder
  jobNo: string;
  name: string;
  region: string;
  location: string;        // site location the ITP covers
  responsible: string;
  itpAuthorisedBy: string;
  liveRev?: string;        // id of the live ITP revision (projects/{id}/revisions/{rev})
  status?: 'active' | 'closed';
  createdAt?: any;
}

/* ---------- ITP ---------- */

export interface ItpItem {
  no: number;
  activity: string;
  spec: string;
  reference: string;
  criteria: string;
  inspectedBy: string[];   // one Sign / Date row each
  type: string;            // H, W, M (and combinations)
  forms: string[];         // QF forms this line creates, e.g. ['QF-45c']
}

export interface Itp {
  docId: string; rev: string; itemName: string; project: string; date?: string; notes: string[]; items: ItpItem[];
}

export type RevStatus = 'draft' | 'live' | 'superseded';

/** projects/{pid}/revisions/{id}: one uploaded ITP revision. Supervisors only see live and superseded ones. */
export interface ItpRevision {
  id: string;
  rev: string;
  status: RevStatus;
  region: string;          // copied from the project for the security rules
  itp: Itp;
  file: string;            // storage path of the original upload
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  supersededAt?: string;
}

/** projects/{pid}/signoffs/{itemNo}_{partyIndex}: one party's sign-off on one ITP line. */
export interface SignOff {
  itemNo: number;
  partyIndex: number;
  party: string;
  region: string;
  name?: string;
  image?: string;          // PNG data URL of the signature
  date?: string;           // dd/mm/yyyy
  signedAt?: string;
  signedBy?: string;       // email of the account the tablet was signed in with
}

/** projects/{pid}/signoffs/signon: the ITP sign-on table. */
export interface SignOn { region: string; cells: Record<string, string> } // cells['r_c'] = text or image data URL

/* ---------- QF records: one copy of a QF form per ITP line ---------- */

export type Status = 'draft' | 'submitted' | 'returned' | 'approved';

export interface HistoryEntry { at: string; by: string; what: string }

export interface QfRecord {
  id: string;
  projectId: string;
  region: string;
  itemNo: number;          // ITP line it belongs to
  code: string;            // 'QF-20b'
  seq: number;             // number of this form on the project, 1, 2, 3…
  ref: string;             // 25-0418-QF20b-004
  date: string;            // YYYY-MM-DD, day of work
  status: Status;
  values: Record<string, any>;
  itpRev: string;          // ITP revision it was made under, e.g. 'Rev B'
  formRev: string;         // paper form revision
  version: number;         // goes up each time it's resubmitted after a return
  supervisorEmail: string;
  supervisorName?: string;
  returnNote?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  pdfPath?: string;        // in Completed Documents
  packId?: string;
  packName?: string;       // 'Pack 03'
  history: HistoryEntry[];
  createdAt?: any;
}

/** packs/{id}: approved forms sent to the client, filed in Submitted Documents. */
export interface Pack {
  id: string;
  projectId: string;
  region: string;
  no: number;
  name: string;            // 'Pack 03'
  recordIds: string[];
  refs: { ref: string; code: string; itemNo: number; date: string }[];
  sentTo: string;
  note?: string;
  pdfPath: string;
  createdBy: string;
  createdAt: string;
}

/** settings/company */
export interface Company { name: string; logo?: string; repLabel?: string }
