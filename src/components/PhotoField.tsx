import { useEffect, useState } from 'react';
import { photoURL, uploadPhoto } from '../lib/photos';

/** Camera button for one field. The photo is saved under this field, so it lands under the right heading. */
export default function PhotoField({ path, submissionId, fieldPath, label, onChange, readOnly }: {
  path?: string; submissionId: string; fieldPath: string; label: string; onChange: (p: string | undefined) => void; readOnly?: boolean;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { let live = true; setUrl(''); if (path) photoURL(path).then((u) => live && setUrl(u)).catch(() => live && setErr('Photo not available yet')); return () => { live = false; }; }, [path]);

  if (path) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {url ? <a href={url} target="_blank" rel="noreferrer"><img className="thumb" src={url} alt={label} /></a> : <span className="sub">{err || 'Loading photo…'}</span>}
      {!readOnly && <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => onChange(undefined)}>Remove photo</button>}
    </div>
  );
  if (readOnly) return <span className="sub">No photo</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label className="photo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
        <span>{busy ? 'Uploading…' : label}</span>
        <input type="file" accept="image/*" capture="environment" aria-label={label} disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            setBusy(true); setErr('');
            try { onChange(await uploadPhoto(submissionId, fieldPath, f)); }
            catch (x: any) { setErr(navigator.onLine ? (x?.message || 'Upload failed') : 'No signal: take the photo again when back online'); }
            finally { setBusy(false); e.target.value = ''; }
          }} />
      </label>
      {err && <span className="err">{err}</span>}
    </div>
  );
}
