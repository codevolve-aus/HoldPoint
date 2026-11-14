import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isoToDMY, validate } from '../../lib/checks';
import { templateFor } from '../../data/templates';
import { REGIONS } from '../admin/AdminUsers';
import type { Submission } from '../../types';

/** Everything supervisors have submitted and not yet decided, grouped by project and day. */
export default function Queue() {
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [region, setRegion] = useState('All');
  useEffect(() => onSnapshot(query(collection(db, 'submissions'), where('status', '==', 'submitted')),
    (s) => setSubs(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Submission, 'id'>) })))), []);

  const shown = (subs || []).filter((s) => region === 'All' || s.region === region).sort((a, b) => b.date.localeCompare(a.date));
  const groups = new Map<string, Submission[]>();
  shown.forEach((s) => { const k = `${s.region}|${s.header['Job number']}|${s.header['Location ref.']}|${s.date}`; groups.set(k, [...(groups.get(k) || []), s]); });

  return (
    <main className="page">
      <div className="spread">
        <div><h1>Review queue</h1><div className="sub">Forms submitted by supervisors. Open one to approve or return it.</div></div>
        <div className="pills">{['All', ...REGIONS].map((r) => <button key={r} className={'pill' + (region === r ? ' on' : '')} onClick={() => setRegion(r)}>{r}</button>)}</div>
      </div>
      {subs === null && <span className="sub">Loading…</span>}
      {subs && groups.size === 0 && <div className="note ok">Nothing waiting{region !== 'All' ? ` in ${region}` : ''}.</div>}
      {[...groups.entries()].map(([k, list]) => {
        const [reg, job, loc, date] = k.split('|');
        return (
          <section className="card" key={k}>
            <div className="spread"><h2>{job} · {loc}</h2><span className="sub">{reg} · {isoToDMY(date)} · {list[0].supervisorEmail}</span></div>
            <div className="list">
              {list.map((s) => {
                const tpl = templateFor(s.formCode)!; const issues = validate(tpl, s.values); const spec = issues.filter((i) => i.kind === 'spec').length;
                return (
                  <Link key={s.id} to={`/engineer/review/${s.id}`} className="clickrow">
                    <div><strong>{s.formCode} · {tpl.title}</strong><div className="sub">v{s.version} · submitted {s.submittedAt}</div></div>
                    <span className={'chip ' + (spec ? 'returned' : 'approved')}>{spec ? `${spec} out of spec` : 'All in spec'}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
