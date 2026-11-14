import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { audit, formsFromItp } from '../../lib/db';
import type { Project } from '../../types';

/** Every project's ITP. Each project has its own ITP; a new revision replaces it for new days only. */
export default function Itps() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  useEffect(() => onSnapshot(collection(db, 'projects'), (s) => setProjects(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) })).sort((a, b) => (a.region + a.jobNo).localeCompare(b.region + b.jobNo)))), []);

  const openFile = async (path: string) => { const w = window.open('', '_blank'); const url = await getDownloadURL(ref(storage, path)); if (w) w.location.href = url; };
  const setStatus = async (p: Project, status: 'active' | 'closed') => {
    if (status === 'closed' && !confirm(`Close the ITP for ${p.jobNo} ${p.location}? Supervisors won't be able to start new forms on it.`)) return;
    await updateDoc(doc(db, 'projects', p.id), { status });
    await audit(user!.email!, `${status === 'closed' ? 'Closed' : 'Reopened'} ITP ${p.itp.docId} ${p.itp.rev} for ${p.jobNo} ${p.location}`, p.id);
  };
  const shown = (projects || []).filter((p) => showClosed || p.status !== 'closed');

  return (
    <main className="page">
      <div className="spread">
        <div><h1>ITPs and projects</h1><div className="sub">Each project and site location has its own ITP. Upload it, check what was read, then publish to the region's supervisors.</div></div>
        <Link to="/engineer/itp/new" className="btn pri" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>+ New ITP</Link>
      </div>
      <label className="chk" style={{ alignSelf: 'flex-start' }}><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />Show closed ITPs</label>
      {projects === null && <span className="sub">Loading…</span>}
      {projects?.length === 0 && <div className="note info">No ITPs yet. Click "New ITP" and upload the project's ITP (PDF or Word).</div>}
      {shown.map((p) => (
        <section className="card" key={p.id}>
          <div className="spread">
            <div><strong style={{ fontSize: 16 }}>{p.jobNo} · {p.location}</strong><div className="sub">{p.name} · {p.client}</div></div>
            <span className={'chip ' + (p.status === 'closed' ? 'not_needed' : 'approved')}>{p.status === 'closed' ? 'Closed' : 'Active'} · {p.region}</span>
          </div>
          <div className="sub">ITP {p.itp.docId} {p.itp.rev} · {p.itp.items.length} items · forms {formsFromItp(p).map((f) => f.code).join(', ') || 'none'}</div>
          {(p.itpRevs?.length || 0) > 1 && <div className="sub">Earlier revisions: {p.itpRevs!.slice(0, -1).map((r) => `${r.rev} (${r.publishedAt})`).join(', ')}</div>}
          <div className="row">
            {p.itpFile && <button className="btn sm" onClick={() => openFile(p.itpFile!)}>Original file</button>}
            {p.status !== 'closed' && <Link className="btn sm" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} to={`/engineer/itp/new?project=${p.id}`}>Upload new revision</Link>}
            {p.status !== 'closed' ? <button className="btn sm bad" onClick={() => setStatus(p, 'closed')}>Close ITP</button> : <button className="btn sm" onClick={() => setStatus(p, 'active')}>Reopen</button>}
          </div>
        </section>
      ))}
    </main>
  );
}
