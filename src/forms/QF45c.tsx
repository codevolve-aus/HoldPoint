import type { CSSProperties } from 'react';
import { Area, Bare, Lines, Logo, Page, Sig, Tick, U, useForm } from './kit';

/* QF-45c Dust and Blast Profile Testing (Concrete), Rev 1.0.1 — 2 pages, A4 portrait. */

const pageStyle: CSSProperties = { padding: '18px 20px 0', fontFamily: 'Carlito, Calibri, Arial, sans-serif', fontSize: 14 };

function Head() {
  return (
    <div style={{ margin: '0 6px', borderTop: '3px solid #4A4A4A', borderBottom: '3px solid #4A4A4A', display: 'flex', alignItems: 'center', gap: 100, padding: '24px 0 22px' }}>
      <Logo w={104} h={60} style={{ marginLeft: 20 }} />
      <div style={{ fontSize: 16, lineHeight: '36px', fontFamily: 'Arial, sans-serif' }}><div><b>Document Title:</b> Dust and Blast Profile Testing</div><div><b>Document ID:</b> QF-45c</div></div>
    </div>
  );
}
function Foot({ page }: { page: number }) {
  return (
    <div style={{ position: 'absolute', left: 46, right: 40, bottom: 16, borderTop: '3px solid #4A4A4A', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 13, lineHeight: 1.75 }}>
      <div><b>Rev Date:</b> 22/07/2026<br /><b>Authorised By:</b> QA Manager</div>
      <div style={{ alignSelf: 'flex-end', fontSize: 11 }}>Page {page} of 2</div>
      <div style={{ width: 96 }}><b>Rev:</b> 1.0.1<br /><b>Status:</b> Current</div>
    </div>
  );
}

const DUST = [[22, 26, 0.8], [9, 10, 0.8], [6, 6, 0.9], [4.5, 4.5, 1], [3.3, 3.3, 1.1]];

export default function QF45c() {
  const { head, company } = useForm();
  return (
    <>
      <Page style={pageStyle}>
        <Head />
        <div style={{ padding: '18px 28px 0', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, fontWeight: 700 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', gap: 10 }}>Project:<U value={head.project} w={330} /></span>
            <span style={{ display: 'flex', gap: 4, width: 150 }}>Date:<U value={head.date} w={100} /></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', gap: 4 }}>Responsible Person:<U value={head.responsible} w={240} /></span>
            <span style={{ display: 'flex', gap: 4, width: 150 }}>Job Number:<U value={head.job} w={72} /></span>
          </div>
        </div>

        <div style={{ display: 'flex', margin: '26px 0 0', border: '1px solid #000', height: 108 }}>
          <div style={{ width: 392, borderRight: '1px solid #000', padding: '4px 8px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700 }}>DUST LEVEL-ISO 8502-3 – <span style={{ fontSize: 10.5 }}>Attach Adhesive Dust Tape Below</span></div>
            <div style={{ marginTop: 4, width: 372, border: '1px solid #555', padding: '2px 2px 0', boxSizing: 'border-box' }}>
              <div style={{ fontSize: 8, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>Dust Quantity Rating <span style={{ fontWeight: 400, color: '#555' }}>Quantité de poussière · Staubmengeneinschätzung</span></div>
              <div style={{ display: 'flex', height: 62, border: '1px solid #444' }}>
                {DUST.map(([x, y, r], i) => <div key={i} style={{ flex: 1, borderRight: i < 4 ? '1px solid #444' : 'none', backgroundImage: `radial-gradient(#111 ${r}px, transparent ${r + 0.4}px)`, backgroundSize: `${x}px ${y}px` }} />)}
              </div>
              <div style={{ display: 'flex', fontSize: 9, fontWeight: 700, fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>{[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ flex: 1 }}>{n}</span>)}</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: '4px 8px', fontSize: 11.5, fontWeight: 700, lineHeight: 1.35 }}>BLAST SURFACE PROFILE-ICRI CSP5 COMPARATOR - <span style={{ fontSize: 11 }}>Please Write in corresponding boxes Y-Yes Or N-No, for the achieved blast surface profile against the concrete surface profile comparator.</span></div>
        </div>

        <div style={{ border: '1px solid #000', borderBottom: 'none', marginTop: 10 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: 'flex', borderBottom: '1px solid #000', height: 116 }}>
              <div style={{ width: 392, borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: 26, borderBottom: '1px solid #000', padding: '0 6px', fontWeight: 700, fontSize: 14, flex: 'none' }}>
                  <span style={{ display: 'flex', alignItems: 'center', width: 236, flex: 'none' }}>Location:<Bare k={`l${i}_loc`} w="100%" label={`Location ${i + 1}`} /></span>
                  <span style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>Dust Qty Rating:<Bare k={`l${i}_dust`} w={30} label={`Location ${i + 1} dust quantity rating`} /></span>
                </div>
                <Area k={`l${i}_tape`} h={88} label={`Location ${i + 1} dust tape`} style={{ border: 'none' }} />
              </div>
              <div style={{ flex: 1, padding: '0 6px 6px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: 26, fontWeight: 700 }}><span>Blast Surface Profile Achieved&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Date:</span><Bare k={`l${i}_date`} w={120} label={`Location ${i + 1} blast profile date`} /></div>
                <div style={{ border: '1px solid #000' }}>
                  <div style={{ display: 'flex', fontSize: 10, height: 16 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <div key={n} style={{ flex: 1, borderRight: n < 10 ? '1px solid #000' : 'none', borderBottom: '1px solid #000', textAlign: 'center', lineHeight: '15px' }}>CSP{n}</div>)}
                  </div>
                  <div style={{ display: 'flex', height: 42 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <div key={n} style={{ flex: 1, minWidth: 0, borderRight: n < 10 ? '1px solid #000' : 'none', display: 'flex' }}><Bare k={`l${i}_csp${n}`} w="100%" align="center" label={`Location ${i + 1} CSP${n} (Y or N)`} style={{ fontSize: 16, textTransform: 'uppercase', height: 42, lineHeight: '42px' }} /></div>)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', height: 22, borderTop: '1px solid #000', padding: '0 8px', fontWeight: 700 }}>Location Reference:<Bare k={`l${i}_ref`} w="60%" label={`Location ${i + 1} reference`} /></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Foot page={1} />
      </Page>

      <Page style={pageStyle}>
        <Head />
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 12.5, padding: '20px 10px 0' }}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 404 }}>
              <b>Surface preparation method used:</b>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[['m_1', '-AS 1627.1', 'Cleaning using liquid solvents and/or alkaline solutions'], ['m_2', '-AS 1627.2', 'Power tool cleaning'], ['m_4', '-AS 1627.4', 'Abrasive blast cleaning'], ['m_csp', '-ICRI CSP', 'Wet Abrasive blast cleaning'], ['m_7', '-AS 1627.7', 'Hand Tool cleaning']].map(([k, c, l]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'flex-start' }}><span style={{ width: 66, flex: 'none' }}>{c}</span><span style={{ width: 280, flex: 'none' }}>{l}</span><Tick k={k} label={l} style={{ marginTop: 2 }} /></label>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>HP Wash&nbsp;&nbsp;&nbsp;<Tick k="hp" label="HP wash" /><span style={{ display: 'flex' }}>Pressure used: -<U k="hp_p" w={208} label="Pressure used" /></span></div>
            </div>
            <div style={{ flex: 1 }}>
              <b>Surface free of:</b>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 18, rowGap: 2 }}>
                {[['f_dust', '-Dust / Abrasive'], ['f_spat', '-Weld spatter'], ['f_oil', '-Oil / Contaminants'], ['f_sharp', '-Sharp edges'], ['f_flash', '-Flash rusting'], ['f_lam', '-Laminations'], ['f_slag', '-Weld slag/Porosity'], ['f_burr', '-Burrs'], ['f_grease', '-Grease']].map(([k, l]) => (
                  <label key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 4 }}>{l}<Tick k={k} label={l} /></label>
                ))}
                <span style={{ display: 'flex' }}>-Other<U k="f_other" w={70} label="Other contaminant" /></span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 30, whiteSpace: 'nowrap' }}>
            <b>Site conditions:</b>&nbsp;Chamber&nbsp;<Tick k="s_ch" label="Chamber" />&nbsp;Covered&nbsp;<Tick k="s_cov" label="Covered" />
            <span style={{ marginLeft: 40 }}>Open</span>&nbsp;<Tick k="s_open" label="Open" />
            <span style={{ marginLeft: 58 }}>Internal</span>&nbsp;<Tick k="s_int" label="Internal" />
            <span style={{ display: 'flex', marginLeft: 46 }}>Other:<U k="s_other" w={228} label="Other site condition" /></span>
          </div>
          <div style={{ padding: '0 10px 0 18px', marginTop: 30 }}>
            <span style={{ display: 'flex', alignItems: 'flex-end' }}><span><b>Remarks/Comments</b>:</span><U k="rem1" w="100%" label="Remarks and comments" /></span>
            <Lines k="rem2" lines={5} lineH={27} label="More remarks" />
          </div>
          <div style={{ borderTop: '2px solid #000', marginTop: 26 }} />
          <div style={{ textAlign: 'center', fontWeight: 700, marginTop: 56 }}>Write / sketch / insert and/or attach photo of exact location/s and description/s of all works performed<span style={{ fontWeight: 400 }}>.</span></div>
          <Area k="sketch" h={266} label="Location and description of works performed" style={{ margin: '6px 6px 0 -6px' }} />
          <div style={{ fontFamily: 'Carlito, Calibri, Arial, sans-serif', fontSize: 13.5, padding: '26px 0 0 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[[`${company.name}’s Representative:`, 'rep_co', 'Contractor representative'], ['Client Representative:', 'rep_cl', 'Client representative']].map(([t, p, who]) => (
              <div key={p} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <b>{t}</b>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 8, alignItems: 'flex-end' }}>
                  <span style={{ display: 'flex', gap: 14 }}>Name:<U k={`${p}_name`} w={196} label={`${who} name`} /></span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>Signature:<Sig k={`${p}_sig`} w={132} h={28} label={who} /></span>
                  <span style={{ display: 'flex' }}>Date:<U k={`${p}_date`} w={114} label={`${who} date`} /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Foot page={2} />
      </Page>
    </>
  );
}
