import { useState } from 'react';
import type { Field, FormTemplate, Section, Values } from '../types';
import { isoToDMY, rowRuleMessages, specMessage, visible } from '../lib/checks';
import PhotoField from './PhotoField';
import SignaturePad from './SignaturePad';

interface Props {
  tpl: FormTemplate;
  values: Values;
  submissionId: string;
  header: Record<string, string>;
  dateText: string;
  onChange?: (v: Values) => void;          // omitted = read-only
  missing?: Set<string>;                    // field paths to highlight as missing
  comments?: Record<string, string>;        // engineer comments by field path
  onComment?: (path: string, text: string) => void; // engineer mode
  signerName?: string;
}

/** Renders any QF form from its template: on the phone for the supervisor, read-only for the engineer. */
export default function FormRenderer(p: Props) {
  const ro = !p.onChange;
  const set = (key: string, v: any) => p.onChange?.({ ...p.values, [key]: v });
  const setRow = (sec: Section, i: number, key: string, v: any) => {
    const rows = [...(p.values[sec.id] || [])]; rows[i] = { ...rows[i], [key]: v }; set(sec.id, rows);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <section className="card">
        <div className="spread"><h2>Job details</h2><span className="sub">From the ITP · locked</span></div>
        <div className="grid2" style={{ fontSize: 14 }}>
          {Object.entries(p.header).map(([k, v]) => <div key={k}><div className="sub">{k}</div><div style={{ fontWeight: 600 }}>{v}</div></div>)}
          <div><div className="sub">Date</div><div style={{ fontWeight: 600 }}>{p.dateText}</div></div>
        </div>
      </section>

      {p.tpl.sections.map((sec) => (
        <section className="card" key={sec.id}>
          <div className="spread"><h2>{sec.title}</h2>{sec.repeat && <span className="sub">{(p.values[sec.id] || []).length} of up to {sec.repeat.max}</span>}</div>
          {sec.repeat ? (
            <>
              {(p.values[sec.id] || []).map((row: Record<string, any>, i: number) => (
                <div className="rep" key={i}>
                  <div className="spread">
                    <strong style={{ fontSize: 13 }}>{sec.repeat!.itemLabel} {i + 1}</strong>
                    {!ro && (p.values[sec.id] || []).length > sec.repeat!.min && (
                      <button type="button" className="link" onClick={() => set(sec.id, (p.values[sec.id] || []).filter((_: any, j: number) => j !== i))}>Remove</button>
                    )}
                  </div>
                  <FieldGrid fields={sec.fields} scope={row} all={p.values} pathPrefix={`${sec.id}.${i}.`} props={p} onSet={(k, v) => setRow(sec, i, k, v)} />
                  {rowRuleMessages(sec, row).map((m) => <div key={m} className="specmsg">{m}</div>)}
                </div>
              ))}
              {!ro && (p.values[sec.id] || []).length < sec.repeat.max && (
                <button type="button" className="btn" style={{ borderStyle: 'dashed', borderColor: '#B8BDB5' }}
                  onClick={() => set(sec.id, [...(p.values[sec.id] || []), {}])}>+ Add {sec.repeat.itemLabel.toLowerCase()}</button>
              )}
            </>
          ) : (
            <FieldGrid fields={sec.fields} scope={p.values} all={p.values} pathPrefix="" props={p} onSet={set} />
          )}
        </section>
      ))}
    </div>
  );
}

function FieldGrid({ fields, scope, all, pathPrefix, props, onSet }: {
  fields: Field[]; scope: Record<string, any>; all: Values; pathPrefix: string; props: Props; onSet: (k: string, v: any) => void;
}) {
  return (
    <div className="grid2">
      {fields.filter((f) => visible(f, scope)).map((f) => {
        const path = pathPrefix + f.key;
        const spec = specMessage(f, scope[f.key], scope, all);
        return (
          <div key={f.key} className={f.full || f.type === 'photo' || f.type === 'signature' || f.type === 'checks' || f.type === 'textarea' ? 'full' : ''}
            style={props.missing?.has(path) ? { outline: '2px solid #FCA5A5', outlineOffset: 4, borderRadius: 6 } : undefined}>
            <FieldInput f={f} value={scope[f.key]} path={path} props={props} onSet={(v) => onSet(f.key, v)} />
            {spec && <div className="specmsg">Out of spec: {spec}</div>}
            {props.missing?.has(path) && <div className="err">Required</div>}
            <CommentBox path={path} props={props} />
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({ f, value, path, props, onSet }: { f: Field; value: any; path: string; props: Props; onSet: (v: any) => void }) {
  const ro = !props.onChange;
  const lab = <span className={f.required ? 'req' : ''}>{f.label}{f.unit && f.type === 'number' ? ` (${f.unit})` : ''}</span>;
  const id = 'f_' + path.replace(/\W/g, '_');

  if (ro && !['photo', 'signature'].includes(f.type)) {
    const shown = Array.isArray(value) ? value.join(', ') : f.type === 'date' && value ? isoToDMY(value) : value;
    return <div><div className="sub">{f.label}{f.unit && f.type === 'number' ? ` (${f.unit})` : ''}</div><div className="reviewval">{shown === undefined || shown === '' ? '—' : String(shown)}</div></div>;
  }

  switch (f.type) {
    case 'choice':
      return (
        <div className="f" role="group" aria-labelledby={id + '_l'}>
          <div id={id + '_l'} style={{ fontSize: 12, color: '#4B5259', marginBottom: 4 }}>{lab}</div>
          {(f.options || []).length > 4 ? (
            <select id={id} value={value ?? ''} onChange={(e) => onSet(e.target.value)} aria-label={f.label}>
              <option value="" disabled>Select</option>
              {f.options!.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <div className="pills">
              {f.options!.map((o) => <button type="button" key={o} className={'pill' + (value === o ? ' on' : '')} aria-pressed={value === o} onClick={() => onSet(o)}>{o}</button>)}
            </div>
          )}
        </div>
      );
    case 'checks': {
      const arr: string[] = Array.isArray(value) ? value : [];
      return (
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, color: '#4B5259', marginBottom: 4 }}>{lab}</legend>
          <div className="grid2" style={{ gap: 0 }}>
            {f.options!.map((o) => (
              <label className="chk" key={o}><input type="checkbox" checked={arr.includes(o)} onChange={(e) => onSet(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} />{o}</label>
            ))}
          </div>
        </fieldset>
      );
    }
    case 'photo':
      return <div><div style={{ fontSize: 12, color: '#4B5259', marginBottom: 4 }}>{lab}</div>
        <PhotoField path={value} submissionId={props.submissionId} fieldPath={path} label={ro ? f.label : 'Take photo'} onChange={onSet} readOnly={ro} /></div>;
    case 'signature':
      return <div><div style={{ fontSize: 12, color: '#4B5259', marginBottom: 4 }}>{lab}</div>
        <SignaturePad value={value} onChange={onSet} readOnly={ro} defaultName={props.signerName} /></div>;
    case 'textarea':
      return <label className="f" htmlFor={id}>{lab}<textarea id={id} value={value ?? ''} onChange={(e) => onSet(e.target.value)} /></label>;
    default:
      return (
        <label className="f" htmlFor={id}>{lab}
          <input id={id} value={value ?? ''} placeholder={f.placeholder}
            type={f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}
            inputMode={f.type === 'number' ? 'decimal' : undefined}
            onChange={(e) => onSet(e.target.value)} />
        </label>
      );
  }
}

function CommentBox({ path, props }: { path: string; props: Props }) {
  const existing = props.comments?.[path];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(existing || '');
  if (!props.onComment) return existing ? <div className="cmt" style={{ marginTop: 6 }}><strong>Engineer:</strong> {existing}</div> : null;
  return (
    <div className="comment">
      {existing && !open && <div className="cmt"><strong>Your comment:</strong> {existing} <button type="button" className="link" onClick={() => setOpen(true)}>Edit</button></div>}
      {!existing && !open && <button type="button" className="link" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={() => setOpen(true)}>+ Comment</button>}
      {open && (
        <div className="row">
          <input aria-label="Comment to supervisor" value={text} onChange={(e) => setText(e.target.value)} placeholder="What should the supervisor fix?" style={{ flex: 1 }} />
          <button type="button" className="btn sm pri" onClick={() => { props.onComment!(path, text.trim()); setOpen(false); }}>Save</button>
        </div>
      )}
    </div>
  );
}
