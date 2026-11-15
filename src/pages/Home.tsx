import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { STATUS_LABEL, isoToDMY, useProjects, useRecordsByStatus } from '../lib/db';
import { formFor } from '../forms/registry';
import type { Project, QfRecord } from '../types';

/** Engineer: forms waiting for review. Supervisor: forms returned to them and drafts not yet submitted. */
export default function Home() {
  const { role } = useAuth();
  const eng = role?.role === 'engineer';
  const projects = useProjects();
  const waiting = useRecordsByStatus(eng ? 'submitted' : 'returned');
  const drafts = useRecordsByStatus('draft');
  const byId = new Map((projects || []).map((p) => [p.id, p]));
  const mine = (drafts || []).filter((r) => eng || r.supervisorEmail === role?.email);

  return (
    <div className="page wide" style={{ maxWidth: 1100 }}>
      <div><h1>{eng ? 'Waiting for your review' : 'Your forms'}</h1>
        <div className="sub">{eng ? 'QF forms supervisors have submitted. Open one to approve it or return it with a note.' : 'Open a project from Folders, then the ITP in Project Documents to fill forms and sign off lines.'}</div></div>
      <List title={eng ? 'Submitted forms' : 'Returned to you'} list={waiting} byId={byId} empty={eng ? 'Nothing waiting. Submitted forms appear here.' : 'Nothing returned to you.'} />
      <List title={eng ? 'Drafts on site (not submitted yet)' : 'Drafts not submitted yet'} list={mine} byId={byId} empty="No drafts." />
      {projects?.length === 0 && (
        <div className="note info">{eng ? <>No projects yet. <Link to="/new">Start a new project</Link> by uploading its ITP.</> : 'No projects in your region yet. The engineer releases ITPs to your region.'}</div>
      )}
    </div>
  );
}

function List({ title, list, byId, empty }: { title: string; list: QfRecord[] | null; byId: Map<string, Project>; empty: string }) {
  const rows = (list || []).slice().sort((a, b) => (b.submittedAt || b.date).localeCompare(a.submittedAt || a.date));
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2>{title}{list && list.length > 0 ? ` (${list.length})` : ''}</h2>
      {list === null && <span className="sub">Loading…</span>}
      {list?.length === 0 && <span className="sub">{empty}</span>}
      {rows.length > 0 && (
        <div className="tablebox"><table>
          <thead><tr><th>Form</th><th>Project</th><th>ITP line</th><th>Day of work</th><th>Status</th></tr></thead>
          <tbody>{rows.map((r) => {
            const p = byId.get(r.projectId);
            return (
              <tr key={r.id}>
                <td><Link to={`/r/${r.id}`} className="mono" style={{ fontWeight: 600 }}>{r.ref}</Link><div className="sub">{formFor(r.code)?.title || r.code}</div></td>
                <td>{p ? `${p.jobNo} · ${p.name}` : r.projectId}<div className="sub">{p?.client} · {p?.region}</div></td>
                <td>Line {r.itemNo}</td>
                <td>{isoToDMY(r.date)}</td>
                <td><span className={'chip ' + r.status}>{STATUS_LABEL[r.status]}{r.version > 1 ? ` · v${r.version}` : ''}</span></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </section>
  );
}
