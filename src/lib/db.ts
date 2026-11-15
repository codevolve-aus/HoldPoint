import { useEffect, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, setDoc, where, type Query } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './auth';
import type { Company, ItpRevision, Pack, Project, QfRecord, RoleDoc, SignOff, SignOn } from '../types';

/* ---------- dates ---------- */

export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const isoToDMY = (iso?: string) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d ? `${d}/${m}/${y}` : iso; };
export const dmyToIso = (s?: string) => { const p = String(s || '').split('/'); return p.length === 3 ? `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}` : ''; };
export const todayDMY = () => isoToDMY(todayISO());
export const nowText = () => new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

export async function audit(byEmail: string, what: string, ref = '') {
  try { await addDoc(collection(db, 'audit'), { at: serverTimestamp(), byEmail: byEmail.toLowerCase(), what, ref }); } catch { /* never block work on the log */ }
}

/* ---------- folders (the same layout as SharePoint) ---------- */

export type QaFolder = 'Project Documents' | 'Completed Documents' | 'Submitted Documents';
const safe = (s: string) => s.replace(/[\\/#?[\]*]+/g, '-').replace(/\s+/g, ' ').trim() || '-';
export const projectFolderName = (p: Pick<Project, 'jobNo' | 'name'>) => safe(`${p.jobNo} ${p.name}`);
/** Projects/2026/Client/25-0418 Project name/QA/Completed Documents */
export const folderPath = (p: Project, f: QaFolder) => `Projects/${p.year}/${safe(p.client)}/${projectFolderName(p)}/QA/${f}`;
export const fileSafe = (s: string) => s.replace(/[^\w.\- ]/g, '_');

/* ---------- live data ---------- */

function useList<T>(q: Query | null, deps: any[]): T[] | null {
  const [list, setList] = useState<T[] | null>(null);
  useEffect(() => {
    if (!q) { setList([]); return; }
    setList(null);
    return onSnapshot(q, (s) => setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T)), () => setList([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return list;
}

/** Projects made before the folder layout have no year or client: file them under the year they were made. */
function withDefaults(p: Project): Project {
  const made = (p as any).createdAt?.toDate?.() as Date | undefined;
  return { ...p, year: p.year || made?.getFullYear() || new Date().getFullYear(), client: p.client || 'No client' };
}

const regionOnly = (role: RoleDoc | null) => role?.role === 'supervisor' ? role.region : null;

export function useProjects(): Project[] | null {
  const { role } = useAuth();
  const r = regionOnly(role);
  const q = !role ? null : r ? query(collection(db, 'projects'), where('region', '==', r)) : collection(db, 'projects');
  const list = useList<Project>(q, [role?.email, r]);
  return list && list.map(withDefaults).sort((a, b) => (b.year - a.year) || a.client.localeCompare(b.client) || a.jobNo.localeCompare(b.jobNo));
}

export function useProject(pid?: string): Project | null | undefined {
  const [p, setP] = useState<Project | null | undefined>(undefined);
  useEffect(() => {
    if (!pid) { setP(null); return; }
    setP(undefined);
    return onSnapshot(doc(db, 'projects', pid), (s) => setP(s.exists() ? withDefaults({ id: s.id, ...(s.data() as object) } as Project) : null), () => setP(null));
  }, [pid]);
  return p;
}

export function useRevisions(p: Project | null | undefined): ItpRevision[] | null {
  const { role } = useAuth();
  const r = regionOnly(role);
  const q = !p ? null : r
    ? query(collection(db, 'projects', p.id, 'revisions'), where('region', '==', r), where('status', 'in', ['live', 'superseded']))
    : collection(db, 'projects', p.id, 'revisions');
  const list = useList<ItpRevision>(q, [p?.id, r]);
  return list && list.slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt) || b.rev.localeCompare(a.rev));
}

export function useRecords(projectId?: string): QfRecord[] | null {
  const { role } = useAuth();
  const r = regionOnly(role);
  const q = !projectId ? null : r
    ? query(collection(db, 'records'), where('region', '==', r), where('projectId', '==', projectId))
    : query(collection(db, 'records'), where('projectId', '==', projectId));
  return useList<QfRecord>(q, [projectId, r]);
}

/** Records with a status, across projects: the engineer's review queue, the supervisor's returned forms. */
export function useRecordsByStatus(status: string): QfRecord[] | null {
  const { role } = useAuth();
  const r = regionOnly(role);
  const q = !role || role.role === 'admin' ? null : r
    ? query(collection(db, 'records'), where('region', '==', r), where('status', '==', status))
    : query(collection(db, 'records'), where('status', '==', status));
  return useList<QfRecord>(q, [status, r, role?.email]);
}

export function useSignoffs(p: Project | null | undefined): { offs: Record<string, SignOff>; signOn: SignOn | null } | null {
  const { role } = useAuth();
  const r = regionOnly(role);
  const q = !p ? null : r ? query(collection(db, 'projects', p.id, 'signoffs'), where('region', '==', r)) : collection(db, 'projects', p.id, 'signoffs');
  const list = useList<any>(q, [p?.id, r]);
  if (!list) return null;
  const offs: Record<string, SignOff> = {}; let signOn: SignOn | null = null;
  for (const x of list) { if (x.id === 'signon') signOn = x; else offs[x.id] = x; }
  return { offs, signOn };
}

export function usePacks(p: Project | null | undefined): Pack[] | null {
  const { role } = useAuth();
  const r = regionOnly(role);
  const q = !p ? null : r ? query(collection(db, 'packs'), where('region', '==', r), where('projectId', '==', p.id)) : query(collection(db, 'packs'), where('projectId', '==', p.id));
  const list = useList<Pack>(q, [p?.id, r]);
  return list && list.slice().sort((a, b) => b.no - a.no);
}

export function useCompany(): Company {
  const [c, setC] = useState<Company>({ name: 'Contractor' });
  useEffect(() => onSnapshot(doc(db, 'settings', 'company'), (s) => s.exists() && setC({ ...(s.data() as Company), name: (s.data() as Company).name || 'Contractor' }), () => {}), []);
  return c;
}

export const saveCompany = (c: Company) => setDoc(doc(db, 'settings', 'company'), c, { merge: true });

/* ---------- records ---------- */

export const STATUS_LABEL: Record<string, string> = { draft: 'Draft', submitted: 'With engineer', returned: 'Returned', approved: 'Approved' };

export const shortCode = (code: string) => code.replace(/^QF-?/i, 'QF');
export const recordRef = (p: Project, code: string, seq: number) => `${p.jobNo}-${shortCode(code)}-${String(seq).padStart(3, '0')}`;

/** The job details printed at the top of every QF form, from the project and its ITP. Locked on the form. */
export interface FormHead { project: string; job: string; client: string; date: string; responsible: string; location: string; supervisor: string }
export const headFor = (p: Project, r: QfRecord): FormHead => ({
  project: p.name, job: p.jobNo, client: p.client, date: isoToDMY(r.date), responsible: p.responsible, location: p.location, supervisor: r.supervisorName || r.supervisorEmail
});

/** Starts a new copy of a QF form on one ITP line. Numbered per project and form: 001, 002… */
export async function createRecord(p: Project, rev: ItpRevision, itemNo: number, code: string, existing: QfRecord[], role: RoleDoc, formRev: string): Promise<string> {
  const seq = Math.max(0, ...existing.filter((r) => r.code === code).map((r) => r.seq)) + 1;
  const ref = doc(collection(db, 'records'));
  const rec: Omit<QfRecord, 'id'> = {
    projectId: p.id, region: p.region, itemNo, code, seq, ref: recordRef(p, code, seq), date: todayISO(), status: 'draft', values: {},
    itpRev: `Rev ${rev.rev}`, formRev, version: 1, supervisorEmail: role.email, supervisorName: role.name,
    history: [{ at: nowText(), by: role.email, what: `Started on ITP ${rev.itp.docId} Rev ${rev.rev}, line ${itemNo}` }],
    createdAt: serverTimestamp()
  };
  await setDoc(ref, rec);
  return ref.id;
}
