import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PAPER_FORMS, formFor } from '../forms/registry';
import { FormProvider, type FormApi } from '../forms/kit';
import { useCompany } from '../lib/db';
import PaperViewer from '../components/PaperViewer';

/** QF Form Templates: the master forms every ITP reference links to. Open one to see it blank; you can type into the preview, nothing is saved. */
export default function Templates() {
  const { code } = useParams();
  const company = useCompany();
  const f = code ? formFor(code) : undefined;
  const [vals, setVals] = useState<Record<string, any>>({});
  if (f) {
    const api: FormApi = {
      get: (k) => vals[k], set: (k, v) => setVals({ ...vals, [k]: v }), locked: false, company, recordId: 'preview', sign: () => alert('Signing works on real forms only.'),
      head: { project: 'Project name (from the ITP)', job: 'Job no.', client: 'Client', date: 'dd/mm/yyyy', responsible: 'Responsible person', location: 'Site location', supervisor: 'Supervisor' }
    };
    return (
      <div className="page wide" style={{ gap: 12 }}>
        <nav className="crumbs"><Link to="/templates" style={{ color: 'inherit' }}>QF Form Templates</Link><span aria-hidden="true">›</span><b>{f.code}</b></nav>
        <div className="spread"><div><h1>{f.code} {f.title}</h1><div className="sub">Rev {f.rev} · {f.pages} {f.pages === 1 ? 'page' : 'pages'} · preview only, nothing you type here is saved</div></div>
          <Link to="/templates" className="btn" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>All templates</Link></div>
        <PaperViewer pageWidth={f.pageW} maxFit={1.25}><FormProvider api={api}><f.Component /></FormProvider></PaperViewer>
      </div>
    );
  }
  return (
    <div className="page wide" style={{ maxWidth: 1100 }}>
      <nav className="crumbs"><b>QF Form Templates</b></nav>
      <div><h1>QF Form Templates</h1><div className="sub">The master forms. Each ITP line's Form link opens a new copy of one of these, laid out exactly like the paper form.</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {PAPER_FORMS.map((t) => (
          <Link key={t.code} to={`/templates/${t.code}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="spread"><span className="mono" style={{ fontWeight: 700, fontSize: 16, color: 'var(--brand)' }}>{t.code}</span><span className="sub">Rev {t.rev}</span></div>
            <div style={{ fontWeight: 600 }}>{t.title}</div>
            <div className="sub">{t.pages} {t.pages === 1 ? 'page' : 'pages'} · open to preview</div>
          </Link>
        ))}
      </div>
      <div className="note info">Forms an ITP refers to that aren't listed here (for example QF-26) are paper only: the ITP shows them, but they aren't filled in HoldPoint. Adding a form or a new revision of one is a change to HoldPoint's code.</div>
    </div>
  );
}
