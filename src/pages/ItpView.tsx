import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { audit, createRecord, isoToDMY, nowText, STATUS_LABEL, todayDMY, useCompany, useProject, useRecords, useRevisions, useSignoffs } from '../lib/db';
import { formFor } from '../forms/registry';
import Crumbs from '../components/Crumbs';
import ItpPaper from '../components/ItpPaper';
import PaperViewer from '../components/PaperViewer';
import SignatureModal, { type SignResult } from '../components/SignatureModal';
import { releaseRevision } from './ProjectDocs';
import type { ItpItem, ItpRevision } from '../types';

/** The live ITP form: sign and date each line, and open the QF forms each line refers to. */
export default function ItpView() {
  const { pid, rid } = useParams();
  const nav = useNavigate();
  const { role, user } = useAuth();
  const eng = role?.role === 'engineer';
  const p = useProject(pid);
  const revs = useRevisions(p);
  const [rev, setRev] = useState<ItpRevision | null | undefined>(undefined);
  const so = useSignoffs(p);
  const records = useRecords(p?.id);
  const company = useCompany();
  const pagesRef = useRef<HTMLDivElement>(null);
  const [signing, setSigning] = useState<{ item?: ItpItem; i?: number; cell?: string } | null>(null);
  const [pick, setPick] = useState<{ item: ItpItem; code: string } | null>(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!pid || !rid) return;
    return onSnapshot(doc(db, 'projects', pid, 'revisions', rid), (s) => setRev(s.exists() ? ({ id: s.id, ...(s.data() as object) } as ItpRevision) : null), () => setRev(null));
  }, [pid, rid]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 5000); return () => clearTimeout(t); }, [toast]);

  // What changed from the live revision, shown on a draft so the engineer sees it before releasing.
  const live = revs?.find((r) => r.status === 'live');
  const changed = useMemo(() => {
    if (!rev || rev.status !== 'draft' || !live) return undefined;
    const out: Record<number, 'new' | 'changed'> = {};
    for (const it of rev.itp.items) {
      const old = live.itp.items.find((x) => x.no === it.no);
      if (!old) out[it.no] = 'new';
      else if (['activity', 'spec', 'criteria', 'reference', 'type'].some((k) => (old as any)[k] !== (it as any)[k]) || old.inspectedBy.join() !== it.inspectedBy.join() || old.forms.join() !== it.forms.join()) out[it.no] = 'changed';
    }
    return out;
  }, [rev, live]);

  if (p === undefined || rev === undefined) return <div className="page wide"><span className="sub">Loading…</span></div>;
  if (!p || !rev) return <div className="page wide"><div className="note bad">This ITP isn't available.</div></div>;

  const editable = rev.status === 'live' && p.status !== 'closed' && (eng || role?.role === 'supervisor');
  const offs = so?.offs || {};
  const who = { email: user!.email!, name: role?.name || user!.email! };

  const saveSign = async (r: SignResult) => {
    const s = signing!; setSigning(null);
    if (s.cell) {
      await setDoc(doc(db, 'projects', p.id, 'signoffs', 'signon'), { region: p.region, cells: { [s.cell]: r.image } }, { merge: true });
      await audit(who.email, `ITP sign-on signed by ${r.name} on ${p.jobNo}`, p.id);
      return;
    }
    const it = s.item!, i = s.i!, party = it.inspectedBy[i] || '';
    await setDoc(doc(db, 'projects', p.id, 'signoffs', `${it.no}_${i}`), {
      itemNo: it.no, partyIndex: i, party, region: p.region, name: r.name, image: r.image, date: r.date, signedAt: nowText(), signedBy: who.email
    }, { merge: true });
    await audit(who.email, `ITP ${rev.itp.docId} Rev ${rev.rev} line ${it.no} signed by ${r.name} (${party})`, p.id);
    setToast(/H/.test(it.type) && !/supervis|contractor|mcelligott/i.test(party) ? `Hold point on line ${it.no} released by ${r.name} (${party}).` : `Line ${it.no} signed by ${r.name}.`);
  };
  const saveDate = async (it: ItpItem, i: number, dmy: string) => {
    await setDoc(doc(db, 'projects', p.id, 'signoffs', `${it.no}_${i}`), { itemNo: it.no, partyIndex: i, party: it.inspectedBy[i] || '', region: p.region, date: dmy }, { merge: true });
  };
  const saveSignOn = async (cell: string, kind: 'text' | 'sign', value?: string) => {
    if (kind === 'sign') { setSigning({ cell }); return; }
    await setDoc(doc(db, 'projects', p.id, 'signoffs', 'signon'), { region: p.region, cells: { [cell]: value || '' } }, { merge: true });
  };
  const approve = async () => {
    if (!confirm(`Release ${rev.itp.docId} Rev ${rev.rev} to ${p.region} supervisors?${live ? ` Rev ${live.rev} will be superseded; QF records and sign-offs stay on their lines.` : ''}`)) return;
    setBusy('Releasing…');
    try { await releaseRevision(p, rev, revs || [], who); setToast(`Rev ${rev.rev} is live. ${p.region} supervisors can now fill it.`); }
    catch (e: any) { setToast(e?.message || 'Could not release'); } finally { setBusy(''); }
  };
  const pdf = async () => {
    setBusy('Making the PDF…');
    try { const { download, pagesToPdf } = await import('../lib/paperPdf');
      download(await pagesToPdf(pagesRef.current!, `${rev.itp.docId} Rev ${rev.rev} · ${p.jobNo} · printed ${nowText()} by ${who.name} · HoldPoint`), `${rev.itp.docId} Rev ${rev.rev} - ${p.jobNo} - ${todayDMY().replace(/\//g, '-')}.pdf`); }
    catch (e: any) { setToast(e?.message || 'Could not make the PDF'); } finally { setBusy(''); }
  };
  const newRecord = async (it: ItpItem, code: string) => {
    setBusy('Starting the form…');
    try { const id = await createRecord(p, rev, it.no, code, records || [], role!, formFor(code)!.rev); nav(`/r/${id}`); }
    catch (e: any) { setToast(e?.message || 'Could not start the form'); setBusy(''); }
  };

  const pickList = pick ? (records || []).filter((r) => r.itemNo === pick.item.no && r.code === pick.code).sort((a, b) => a.seq - b.seq) : [];

  return (
    <div className="page wide" style={{ gap: 12 }}>
      <Crumbs p={p} leaf={['Project Documents', `/p/${p.id}/docs`]} extra={`${rev.itp.docId} Rev ${rev.rev}`} />
      <div className="spread">
        <Link to={`/p/${p.id}/docs`} className="link" style={{ display: 'inline-flex', alignItems: 'center' }}>‹ Project Documents</Link>
        <span className="sub">{editable ? 'Tap Sign to sign a line on screen, tap a date to change it, tap a Form link to fill that QF form for the line.' : rev.status === 'draft' ? 'Draft: check it against the original, then approve and release it.' : 'Read-only revision.'}</span>
      </div>
      {rev.status === 'draft' && eng && (
        <div className="note warn" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div><strong>Draft Rev {rev.rev}. Supervisors can't see it yet.</strong>{changed && Object.keys(changed).length ? ` ${Object.values(changed).filter((x) => x === 'new').length} new and ${Object.values(changed).filter((x) => x === 'changed').length} changed lines compared with Rev ${live!.rev} (marked on the ITP).` : ''}{records?.length ? ` The ${records.length} QF records already filed stay on their lines.` : ''}</div>
          <button className="btn ok" disabled={!!busy} onClick={approve}>Approve &amp; release to {p.region} supervisors</button>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
      {busy && <div className="note info" role="status">{busy}</div>}
      <PaperViewer ref={pagesRef} pageWidth={1123} tools={<button onClick={pdf} disabled={!!busy}>Download PDF</button>}>
        <ItpPaper project={p} rev={rev} company={company} offs={offs} signOn={so?.signOn || null} records={records || []} editable={editable} changed={changed}
          onSign={(item, i) => setSigning({ item, i })} onDate={saveDate} onForm={(item, code) => setPick({ item, code })} onSignOn={saveSignOn} />
      </PaperViewer>

      {signing && (
        <SignatureModal
          title={signing.cell ? 'ITP sign-on' : `Sign line ${signing.item!.no} · ${signing.item!.inspectedBy[signing.i!] || 'Inspection'}`}
          sub={signing.cell ? 'Responsible inspectors sign on to the ITP.' : signing.item!.activity.split('\n')[0].slice(0, 160)}
          criteria={signing.item?.criteria}
          askDate={!signing.cell}
          defaultName={signing.item && /supervis|contractor/i.test(signing.item.inspectedBy[signing.i!] || '') ? who.name : ''}
          defaultDate={signing.item ? offs[`${signing.item.no}_${signing.i}`]?.date || todayDMY() : undefined}
          onCancel={() => setSigning(null)} onConfirm={saveSign} />
      )}

      {pick && (
        <div className="scrim" role="presentation" onClick={(e) => e.target === e.currentTarget && setPick(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={`Line ${pick.item.no} Form ${pick.code}`}>
            <header>
              <div><div className="mono" style={{ fontWeight: 700, color: 'var(--brand)' }}>Line {pick.item.no} · Form {pick.code}</div><div className="sub" style={{ marginTop: 2 }}>{formFor(pick.code)?.title}</div></div>
              <button className="iconbtn" aria-label="Close" onClick={() => setPick(null)}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" stroke="#15181C" strokeWidth="1.8" strokeLinecap="round" /></svg></button>
            </header>
            <div className="body">
              {pickList.map((r) => (
                <Link key={r.id} to={`/r/${r.id}`} className="pickrow">
                  <span><span className="mono" style={{ fontWeight: 600 }}>{r.ref}</span><br /><span className="sub">Day of work {isoToDMY(r.date)} · {r.itpRev}</span></span>
                  <span className={'chip ' + r.status}>{STATUS_LABEL[r.status]}</span>
                </Link>
              ))}
              {pickList.length === 0 && <span className="sub">No {pick.code} on this line yet.</span>}
              {editable && role?.role === 'supervisor' && <button className="newbtn" disabled={!!busy} onClick={() => newRecord(pick.item, pick.code)}>+ New {pick.code} for line {pick.item.no}</button>}
              {editable && eng && <span className="sub">Supervisors start QF forms on site.</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
