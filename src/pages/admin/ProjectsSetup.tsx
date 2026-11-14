import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { audit, formsFromItp } from '../../lib/db';
import { REGIONS } from './AdminUsers';
import itpJson from '../../data/itp-pit-internals.json';
import type { Itp, Project } from '../../types';

const ITP = itpJson as Itp;

/**
 * MVP: projects use the bundled pit-internals ITP (QF-01 Rev 0).
 * Phase 2: upload an ITP PDF/Word file and read its items and reference forms.
 */
export default function ProjectsSetup() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [f, setF] = useState({ jobNo: 'J00-001', name: 'Pit 1 internals · concrete lining', client: 'Sample Builder Pty Ltd', region: 'Sydney', location: 'Pit 1 internals', responsible: 'J. Smith', itpAuthorisedBy: 'B. Example' });
  const [msg, setMsg] = useState('');

  useEffect(() => onSnapshot(collection(db, 'projects'), (s) => setProjects(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) })))), []);

  const create = async () => {
    const id = `${f.jobNo}-${f.location}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await setDoc(doc(db, 'projects', id), { ...f, itp: ITP, createdAt: serverTimestamp() });
    await audit(user!.email!, `Published ITP ${ITP.docId} ${ITP.rev} for ${f.jobNo} ${f.location} to ${f.region}`, id);
    setMsg(`Published to ${f.region}. Supervisors in ${f.region} can now see it.`);
  };
  const forms = formsFromItp({ itp: ITP } as Project);

  return (
    <main className="page">
      <div><h1>Projects and ITPs</h1><div className="sub">Each project has one ITP per site location. Supervisors see projects in their region only.</div></div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <section className="card" style={{ flex: '1 1 380px' }}>
          <h2>Publish the ITP to a project</h2>
          <div className="note info">ITP: {ITP.docId} {ITP.rev} · {ITP.itemName} · {ITP.items.length} items. Forms it creates: {forms.map((x) => x.code).join(', ')}.</div>
          <div className="grid2">
            {([['jobNo', 'Job number'], ['client', 'Client'], ['name', 'Project'], ['location', 'Site location (ITP covers)'], ['responsible', 'Responsible person'], ['itpAuthorisedBy', 'ITP authorised by']] as const).map(([k, l]) => (
              <label key={k} className={'f' + (k === 'name' ? ' full' : '')}>{l}<input value={(f as any)[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
            ))}
            <label className="f">Region<select value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
          </div>
          <button className="btn pri" onClick={create}>Publish to {f.region} supervisors</button>
          {msg && <div className="note ok">{msg}</div>}
        </section>
        <section className="card" style={{ flex: '1 1 380px' }}>
          <h2>Published</h2>
          {projects.length === 0 && <span className="sub">None yet.</span>}
          <div className="list">
            {projects.map((p) => <div key={p.id}><strong>{p.jobNo} · {p.name}</strong><div className="sub">{p.location} · {p.region} · ITP {p.itp.docId} {p.itp.rev}</div></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
