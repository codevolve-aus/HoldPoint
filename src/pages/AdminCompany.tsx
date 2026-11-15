import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { audit, saveCompany, useCompany } from '../lib/db';

/** Company name and logo, printed on the ITP and every QF form. */
export default function AdminCompany() {
  const { user } = useAuth();
  const c = useCompany();
  const [name, setName] = useState(c.name);
  const [logo, setLogo] = useState<string | undefined>(c.logo);
  const [msg, setMsg] = useState('');
  useEffect(() => { setName(c.name); setLogo(c.logo); }, [c.name, c.logo]);

  const pick = async (f: File) => {
    // Kept small so it can live in the settings document and print on every page.
    const url = URL.createObjectURL(f);
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, 480 / img.width, 240 / img.height);
    const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    setLogo(cv.toDataURL('image/png'));
  };
  const save = async () => {
    await saveCompany({ name: name.trim() || 'Contractor', logo: logo || '' });
    await audit(user!.email!, 'Updated company name and logo');
    setMsg('Saved. The ITP and QF forms now show this name and logo.');
  };

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div><h1>Company</h1><div className="sub">Printed in the header of the ITP and every QF form, and on client pack cover sheets.</div></div>
      <section className="card">
        <label className="f">Company name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Example Coatings Pty Ltd" /></label>
        <div className="f">Logo
          <div className="row">
            {logo ? <img src={logo} alt="Company logo" style={{ maxHeight: 80, maxWidth: 240, border: '1px solid var(--line)', borderRadius: 8, padding: 6, background: '#fff' }} /> : <span className="sub">No logo yet: forms show a placeholder box.</span>}
            <label className="btn sm" style={{ display: 'inline-flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>Choose image
              <input type="file" accept="image/png,image/jpeg" style={{ position: 'absolute', inset: 0, opacity: 0 }} onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
            </label>
            {logo && <button className="link" onClick={() => setLogo(undefined)}>Remove</button>}
          </div>
        </div>
        <button className="btn pri" onClick={save}>Save</button>
        {msg && <div className="toast">{msg}</div>}
      </section>
    </div>
  );
}
