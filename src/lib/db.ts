import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { initialValues, nowText } from './checks';
import { templateFor } from '../data/templates';
import type { Project, Submission } from '../types';

export const submissionId = (projectId: string, date: string, code: string) => `${projectId}_${date}_${code}`;

export async function audit(byEmail: string, what: string, ref = '') {
  try { await addDoc(collection(db, 'audit'), { at: serverTimestamp(), byEmail: byEmail.toLowerCase(), what, ref }); } catch { /* never block work on the log */ }
}

/** Opens today's form for a project, creating a blank one from the template the first time. */
export async function openSubmission(p: Project, date: string, code: string, email: string): Promise<Submission> {
  const id = submissionId(p.id, date, code);
  const r = doc(db, 'submissions', id);
  const snap = await getDoc(r);
  if (snap.exists()) return { id, ...(snap.data() as Omit<Submission, 'id'>) };
  const tpl = templateFor(code)!;
  const s: Omit<Submission, 'id'> = {
    projectId: p.id, region: p.region, date, formCode: code, templateRev: tpl.rev, itpRev: p.itp.rev, version: 1, status: 'draft',
    header: headerFrom(p),
    values: initialValues(tpl), comments: {}, supervisorEmail: email.toLowerCase(),
    history: [{ at: nowText(), by: email, what: `Blank form created from ITP ${p.itp.docId} ${p.itp.rev}` }]
  };
  await setDoc(r, s);
  return { id, ...s };
}

/** Header fields come from the project and its ITP, and are locked on the form. */
export const headerFrom = (p: Project): Record<string, string> => ({
  Project: p.name, 'Job number': p.jobNo, Client: p.client, 'Responsible person': p.responsible, 'Location ref.': p.location
});

/** Forms this ITP asks for, with the ITP items that reference each. */
export function formsFromItp(p: Project): { code: string; items: number[] }[] {
  const m = new Map<string, number[]>();
  for (const it of p.itp.items) for (const f of it.forms) m.set(f, [...(m.get(f) || []), it.no]);
  return [...m.entries()].map(([code, items]) => ({ code, items }));
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', returned: 'Returned', approved: 'Approved', not_needed: 'Not needed today'
};
