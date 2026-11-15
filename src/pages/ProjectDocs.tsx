import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, deleteDoc, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { audit, nowText, useProject, useRecords, useRevisions } from '../lib/db';
import Crumbs from '../components/Crumbs';
import type { ItpRevision, Project } from '../types';

/**
 * Project Documents: the project's ITP revisions.
 * Engineer: upload a revision (it's a draft), check it, then approve & release it to the region's supervisors.
 * Supervisor: sees the live revision only, and opens it to fill.
 */
export default function ProjectDocs() {
  const { pid } = useParams();
  const { role, user } = useAuth();
  const eng = role?.role === 'engineer';
  const p = useProject(pid);
  const revs = useRevisions(p);
  const records = useRecords(p?.id);
  const [msg, setMsg] = useState('');

  if (p === undefined) return <div className="page wide"><span className="sub">Loading…</span></div>;
  if (p === null) return <div className="page wide"><div className="note bad">This project doesn't exist or isn't in your region.</div></div>;

  const live = revs?.find((r) => r.status === 'live');
  const who = () => ({ email: user!.email!, name: role?.name || user!.email! });
  const open = async (path: string) => { const w = window.open('', '_blank'); const url = await getDownloadURL(ref(storage, path)); if (w) w.location.href = url; };
  const removeDraft = async (r: ItpRevision) => {
    if (!confirm(`Delete draft Rev ${r.rev}? The uploaded file stays in storage.`)) return;
    await deleteDoc(doc(db, 'projects', p.id, 'revisions', r.id));
    await audit(user!.email!, `Deleted draft ITP Rev ${r.rev} for ${p.jobNo}`, p.id);
  };
  const setStatus = async (status: 'active' | 'closed') => {
    if (status === 'closed' && !confirm(`Close ${p.jobNo} ${p.name}? Supervisors won't be able to start new forms.`)) return;
    await updateDoc(doc(db, 'projects', p.id), { status });
    await audit(user!.email!, `${status === 'closed' ? 'Closed' : 'Reopened'} project ${p.jobNo}`, p.id);
    setMsg(status === 'closed' ? 'Project closed.' : 'Project reopened.');
  };

  return (
    <div className="page wide" style={{ maxWidth: 1200 }}>
      <Crumbs p={p} leaf={['Project Documents']} />
      <div className="spread" style={{ alignItems: 'flex-end' }}>
        <div><h1>Project Documents</h1><div className="sub">{p.jobNo} · {p.name} · {p.client} · {p.location} · {p.region}{p.status === 'closed' ? ' · Closed' : ''}</div></div>
        {eng && <div className="row">
          {p.status !== 'closed' && <Link to={`/p/${p.id}/upload`} className="btn pri" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 11V2.5M4.5 6 8 2.5 11.5 6M2.5 11.5v2h11v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Upload ITP{live ? ' revision' : ''}</Link>}
          {p.status !== 'closed' ? <button className="btn bad" onClick={() => setStatus('closed')}>Close project</button> : <button className="btn" onClick={() => setStatus('active')}>Reopen</button>}
        </div>}
      </div>
      {msg && <div className="toast" role="status">{msg}</div>}

      {revs === null && <span className="sub">Loading…</span>}
      {eng && revs?.length === 0 && (p as any).itp?.items?.length > 0 && (
        <div className="note warn" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>This project was set up in the previous version of HoldPoint. Its ITP ({(p as any).itp.docId} {(p as any).itp.rev}) can be brought into Project Documents as the live revision.</span>
          <button className="btn sm" onClick={() => importLegacy(p, who())}>Bring it in</button>
        </div>
      )}
      {revs?.length === 0 && <div className="note info">{eng ? 'No ITP yet. Upload the project\'s ITP; it stays a draft until you approve and release it.' : 'The engineer hasn\'t released an ITP for this project yet.'}</div>}
      {revs && revs.length > 0 && (
        <div className="tablebox"><table>
          <thead><tr><th>Document</th><th>Rev</th><th>Status</th><th>Lines</th><th>QF records</th><th></th></tr></thead>
          <tbody>{revs.map((r) => {
            const linked = (records || []).filter((x) => x.itpRev === `Rev ${r.rev}`).length;
            const total = (records || []).length;
            return (
              <tr key={r.id}>
                <td>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flex: 'none', marginTop: 1 }}><path d="M5 2h7l4 4v12H5z" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round" /><path d="M12 2v4h4" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                    <div><div style={{ fontWeight: 600 }}>{r.itp.docId} · {r.fileName}</div>
                      <div className="sub">Uploaded {r.uploadedAt} by {r.uploadedBy}{r.approvedAt ? ` · released ${r.approvedAt} by ${r.approvedBy}` : ''}</div></div>
                  </div>
                </td>
                <td className="mono" style={{ fontWeight: 600 }}>{r.rev}</td>
                <td><RevChip r={r} />
                  <div className="sub" style={{ marginTop: 4, maxWidth: 260 }}>{r.status === 'draft' ? 'Only engineers can see it. Check it, then approve it to release it.' : r.status === 'live' ? 'Supervisors fill this revision.' : 'Kept for the record.'}</div></td>
                <td>{r.itp.items.length}</td>
                <td>{r.status === 'live' ? `${total} on this project` : r.status === 'draft' ? (total ? `${total} carry over` : '—') : (linked ? `${linked} made under it` : '—')}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    {(r.status !== 'superseded' || eng) && <Link to={`/p/${p.id}/itp/${r.id}`} className={'btn sm' + (r.status !== 'superseded' ? ' pri' : '')} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                      {r.status === 'draft' ? 'Review & approve' : r.status === 'live' ? (eng ? 'Open ITP' : 'Open ITP form') : 'View'}</Link>}
                    {eng && r.file && <button className="btn sm" onClick={() => open(r.file)}>Original file</button>}
                    {eng && r.status === 'draft' && <button className="btn sm bad" onClick={() => removeDraft(r)}>Delete</button>}
                  </div>
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      {!eng && live && <p className="sub" style={{ margin: 0 }}>Open the ITP to sign off lines and fill the QF forms each line refers to. Forms you start are saved against that ITP line.</p>}
    </div>
  );
}

export function RevChip({ r }: { r: ItpRevision }) {
  return <span className={'chip ' + (r.status === 'draft' ? 'draftrev' : r.status)}>{r.status === 'draft' ? 'Draft' : r.status === 'live' ? 'Live' : 'Superseded'}</span>;
}

/** Approve & release: this revision goes live, the previous live one is superseded. */
export async function releaseRevision(p: Project, r: ItpRevision, all: ItpRevision[], who: { email: string; name: string }) {
  const at = nowText();
  const b = writeBatch(db);
  for (const x of all) if (x.status === 'live' && x.id !== r.id) b.update(doc(db, 'projects', p.id, 'revisions', x.id), { status: 'superseded', supersededAt: at });
  b.update(doc(db, 'projects', p.id, 'revisions', r.id), { status: 'live', approvedAt: at, approvedBy: who.name });
  b.update(doc(db, 'projects', p.id), { liveRev: r.id });
  await b.commit();
  await audit(who.email, `Approved and released ITP ${r.itp.docId} Rev ${r.rev} for ${p.jobNo} to ${p.region} supervisors`, p.id);
}

/** A project from the previous version kept its ITP on the project itself: copy it in as the live revision. */
async function importLegacy(p: Project, who: { email: string; name: string }) {
  const old = (p as any).itp; const at = nowText();
  const rev = String(old.rev || '0').replace(/^\s*rev(ision)?\.?\s*/i, '');
  const ref = doc(collection(db, 'projects', p.id, 'revisions'));
  await setDoc(ref, {
    rev, status: 'live', region: p.region, itp: { ...old, rev }, file: (p as any).itpFile || '', fileName: ((p as any).itpFile || 'ITP').split('/').pop(),
    uploadedBy: 'Previous version', uploadedAt: at, approvedBy: who.name, approvedAt: at
  });
  await updateDoc(doc(db, 'projects', p.id), { liveRev: ref.id, year: p.year, client: p.client });
  await audit(who.email, `Brought ITP ${old.docId} ${old.rev} into Project Documents for ${p.jobNo}`, p.id);
}
