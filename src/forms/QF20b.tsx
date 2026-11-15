import type { CSSProperties } from 'react';
import { Area, Bare, Cell, Logo, Page, Sig, Tick, TickL, U, useForm } from './kit';

/* QF-20b Daily Coating Inspection Report (Trowel & Plural), Rev 1.0.1 — 2 pages, A4 portrait. */

const b: CSSProperties = { border: '1px solid #000' };
const grey: CSSProperties = { ...b, background: '#C8C8C8' };

function Head() {
  return (
    <div style={{ borderTop: '3px solid #4A4A4A', borderBottom: '3px solid #4A4A4A', display: 'flex', alignItems: 'center', gap: 60, padding: '8px 0 10px' }}>
      <Logo w={104} h={54} style={{ marginLeft: 10 }} />
      <div style={{ fontSize: 16, lineHeight: '36px' }}><div><b>Document Title:</b> Daily Coating Inspection Report (Trowel &amp; Plural)</div><div><b>Document ID:</b> QF-20b</div></div>
    </div>
  );
}
function Foot({ page }: { page: number }) {
  return (
    <div style={{ position: 'absolute', left: 26, right: 26, bottom: 16, borderTop: '3px solid #4A4A4A', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12.5, lineHeight: 1.35 }}>
      <div><b>Rev Date:</b> 26-10-2026<br /><b>Authorised By:</b> QA Manager</div>
      <div style={{ alignSelf: 'flex-end', marginBottom: -16 }}>Page {page} of 2</div>
      <div style={{ width: 130 }}><b>Rev:</b> 1.0.1<br /><b>Status:</b> Current</div>
    </div>
  );
}

const AMB = ['Actual time', 'Sky (S/O/C)', 'Rain (L/M/H)', 'Wind direction', 'Wind speed (L/M/H)', 'Dry bulb temp', 'Wet bulb temp', 'Surface temp', 'Dew point temp', 'Relative humidity %', 'Surface temp above dew point', 'OK to paint Y/N'];
const PREP_ROWS = ['Pre-Cleaning', 'Hand Tool Cleaning', 'Power Tool Cleaning', 'HP Washing Cleaning', 'Wet Abrasive Blast'];
const PREP_COLS = ['Standard specified', 'Class of finish specified', 'Grade of substrate', 'Equipment used', 'Surface profile required', 'Solvents, abrasive type, size and pressure used'];
const STEPS: [string, string, string][] = [['1', 'st', ' / Prime: Spot'], ['2', 'nd/', ' / Intermediate: Spot'], ['3', 'rd', ' / Top/Finish: Spot']];
const METHODS = ['Brush', 'Roller', 'Conventional spray', 'Airless spray', 'Plural or Grout pump spray', 'Trowel Application'];
const COAT_TOP: [string, string, number?][] = [['gen', 'Generic Type:'], ['brand', 'Brand Name:'], ['ba', 'Batch Number (Part A):'], ['bb', 'Batch number (Part B):'], ['col', 'Colour:'], ['thin', '% Thinner used'], ['start', 'Start time of application'], ['fin', 'Finish time of application', 31]];
const COAT_BOTTOM: [string, string, number?][] = [['wfs', 'Wet film specified'], ['wfa', 'Wet film achieved'], ['rs', 'Part A /Part B Specified Ratio', 31], ['ra', 'Ratio achieved']];

export default function QF20b() {
  const { head } = useForm();
  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13, display: 'contents' }}>
      {/* ---------- page 1 ---------- */}
      <Page style={{ padding: '20px 26px 0', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13 }}>
        <Head />
        <div style={{ padding: '14px 4px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', gap: 2, fontWeight: 700 }}>Project Name:<U value={head.project} w={360} /></span>
            <span style={{ display: 'flex', gap: 2, fontWeight: 700 }}>Date:<U value={head.date} w={120} /></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', gap: 2, fontWeight: 700 }}>Responsible person:<U value={head.responsible} w={320} /></span>
            <span style={{ display: 'flex', gap: 2, fontWeight: 700 }}>Job No:<U value={head.job} w={110} /></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', rowGap: 8 }}>
            {[['id_moist', 'Moisture Meter ID #.'], ['id_hammer', 'Shmidt Hammer ID #.'], ['id_prof', 'Surface Profile ID #.'], ['id_hyg', 'Digital hygrometer ID #.'], ['id_cond', 'Conductivity gauge ID #.'], ['id_dft', 'DFT gauge ID #.']].map(([k, l]) => (
              <span key={k} style={{ display: 'flex', gap: 4, whiteSpace: 'nowrap' }}>{l}<U k={k} w={70} label={l} /></span>
            ))}
          </div>
          <div style={{ textAlign: 'center', fontWeight: 700, marginTop: 4 }}>Write / sketch / insert and/or attach photo of exact location/s and description/s of all works performed<span style={{ fontWeight: 400 }}>.</span></div>
          <Area k="sketch" h={106} label="Location and description of works performed" style={{ margin: '0 4px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, paddingLeft: 22, whiteSpace: 'nowrap' }}>
            <span><b>Site conditions</b>:</span>
            {[['sc_ch', 'Chamber'], ['sc_cov', 'Covered'], ['sc_open', 'Open'], ['sc_int', 'Internal']].map(([k, l]) => <TickL key={k} k={k}>{l}</TickL>)}
            <TickL k="sc_oth">Other:<U k="sc_other" w={180} label="Other site condition" /></TickL>
          </div>
        </div>

        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 10, fontSize: 10.5, tableLayout: 'fixed' }}>
          <colgroup>{[8.6, 9.2, 9.2, 7.7, 9.6, 7.7, 7.9, 8.1, 8.1, 9, 7.9, 7].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
          <tbody>
            <tr><td rowSpan={3} style={{ ...grey, textAlign: 'center' }}>Actual<br />Time</td><td colSpan={4} style={{ ...grey, textAlign: 'center', height: 20, fontSize: 12 }}>Weather Observations</td><td colSpan={7} style={{ ...grey, textAlign: 'center', fontSize: 12 }}>Temperatures (°C) and Relative Humidity</td></tr>
            <tr><td colSpan={11} style={{ ...grey, textAlign: 'center', height: 20, fontSize: 13 }}>Ambient Conditions to be taken every 2 hours from the first reading</td></tr>
            <tr style={{ height: 46 }}>
              <td style={{ ...grey, padding: '2px 6px', lineHeight: 1.25 }}>S=Sunny<br />O=Overcast<br /><b>C=Cloudy</b></td>
              <td style={{ ...grey, padding: '2px 6px', lineHeight: 1.25 }}>Rain<br />L=Light<br />M=Moderate<br />H=Heavy</td>
              <td style={{ ...grey, textAlign: 'center' }}>Wind<br />direction.</td>
              <td style={{ ...grey, padding: '2px 6px', lineHeight: 1.25 }}>Wind speed.<br />L=Low<br />M=Moderate<br />H=High</td>
              {['Dry bulb<br>temp', 'Wet bulb<br>temp', 'Surface<br>temp', 'Dew point<br>temp', 'Relative<br>humidity<br>%', 'Surface<br>temp<br>above<br>dew point', 'OK to<br>Paint?<br>Y / N'].map((t) => <td key={t} style={{ ...grey, textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: t }} />)}
            </tr>
            {[0, 1, 2, 3, 4, 5, 6].map((r) => (
              <tr key={r} style={{ height: 23 }}>{AMB.map((l, c) => <Cell key={c} k={`amb_${r}_${c}`} label={`${l}, reading ${r + 1}`} h={22} style={{ fontSize: 12 }} />)}</tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: 4, padding: '6px 0 0 26px', alignItems: 'center', whiteSpace: 'nowrap' }}>
          Soluble Salt Test:&nbsp; Time Taken:<U k="salt_t1" w={84} label="Salt test 1 time taken" />
          &nbsp;&nbsp;Result:<U k="salt_r1" w={84} label="Salt test 1 result" />
          Time Taken:<U k="salt_t2" w={100} label="Salt test 2 time taken" />
          &nbsp;&nbsp;&nbsp;Result:<U k="salt_r2" w={66} label="Salt test 2 result" />
        </div>
        <div style={{ textAlign: 'center', fontWeight: 700, marginTop: 2 }}>SURFACE PREPERATION</div>
        <div style={{ textAlign: 'center', fontSize: 12.5 }}>STANDARDS &amp; PROFILE TO BE RECORDED AS SPECIFIED IN THE ITP</div>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 10.5, tableLayout: 'fixed' }}>
          <colgroup>{[18.4, 15, 7.6, 7.6, 26.4, 7.6, 17.4].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
          <tbody>
            <tr style={{ height: 54, textAlign: 'center' }}>
              {['Surface Preparation<br>Method', 'Standard<br>Specified', 'Class Of<br>Finish<br>Specified', 'Grade of<br>Substrate', 'Equipment Used', 'Surface<br>Profile<br>Required', 'Solvents / Abrasive Type /<br>Size and Pressure Used'].map((t) => <td key={t} style={{ ...grey, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: t }} />)}
            </tr>
            {PREP_ROWS.map((m, r) => (
              <tr key={m} style={{ height: 24 }}>
                <td style={{ ...b, padding: '0 4px', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>{m}</td>
                {PREP_COLS.map((l, c) => <Cell key={c} k={`sp_${r}_${c}`} label={`${m}: ${l}`} align="left" h={23} style={{ fontSize: 12 }} />)}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: '16px 0 0 26px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <b>Prior to surface preparation the surface is free of:</b>
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 20, rowGap: 9, maxWidth: 720 }}>
            {[['fr_oil', 'Oil / Contaminants'], ['fr_grease', 'Grease'], ['fr_sharp', 'Sharp edges'], ['fr_slag', 'Weld slag/Porosity'], ['fr_spat', 'Weld spatter'], ['fr_burr', 'Burrs'], ['fr_lam', 'Laminations'], ['fr_glue', 'Adhesives / Glue']].map(([k, l]) => <TickL key={k} k={k}>{l}</TickL>)}
            <span style={{ display: 'inline-flex', marginLeft: -4 }}>Other<U k="fr_other" w={108} label="Other contaminant" /></span>
          </div>
          <b style={{ marginTop: 12 }}>Surface Preparation Check<span style={{ fontWeight: 400 }}>:</span></b>
          <div style={{ display: 'flex' }}>
            <span style={{ display: 'flex', gap: 4, width: 400 }}>Specified Surface Profile:<Bare k="chk_spec" w={150} label="Specified surface profile" /></span>
            <span style={{ display: 'flex', gap: 4 }}>Actual Surface Profile Achieved:<Bare k="chk_act" w={120} label="Actual surface profile achieved" /></span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: 12.5 }}>Specified Surface Preparation has been achieved and uniform&nbsp;<Tick k="chk_ok" label="Specified surface preparation achieved" style={{ marginRight: 4 }} />Yes - If No, rework to achieve the Specified Surface Preparation.</span>
        </div>
        <Foot page={1} />
      </Page>

      {/* ---------- page 2 ---------- */}
      <Page style={{ padding: '20px 26px 0', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12.5 }}>
        <Head />
        <div style={{ padding: '14px 0 0 26px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 20 }}><b>Pre-Painting Checks:</b><span style={{ display: 'flex', gap: 4, fontWeight: 700 }}>Date:<U k="pp_date" w={150} label="Pre-painting checks date" /></span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 12, rowGap: 11, alignItems: 'center' }}>
            <b style={{ width: 128 }}>Surface is free of:</b>
            {[['pf_dust', 'Dust'], ['pf_deb', 'Debris'], ['pf_spent', 'Spent abrasive'], ['pf_flash', 'Flash rusting'], ['pf_over', 'Overspray'], ['pf_grease', 'Grease/Oil'], ['pf_eff', 'Efflorescence'], ['pf_lait', 'Laitance'], ['pf_bug', 'Bug holes are exposed'], ['pf_void', 'Voids'], ['pf_loose', 'Loose materials etc.']].map(([k, l]) => <TickL key={k} k={k} gap={4}>{l}</TickL>)}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <b style={{ width: 128, flex: 'none' }}>Previous coatings:</b>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', gap: 12, whiteSpace: 'nowrap' }}>{[['pc_min', 'Minimum recoat time has elapsed'], ['pc_max', 'Maximum recoat time is not exceeded'], ['pc_miss', 'No paint misses.']].map(([k, l]) => <TickL key={k} k={k} gap={4}>{l}</TickL>)}</div>
              <div style={{ display: 'flex', gap: 12, whiteSpace: 'nowrap' }}>{[['pc_dft', 'Dry Film Thickness is achieved as per ITP'], ['pc_runs', 'No runs or sags'], ['pc_delam', 'No delamination'], ['pc_pin', 'No pin holing.']].map(([k, l]) => <TickL key={k} k={k} gap={4}>{l}</TickL>)}</div>
              <div style={{ lineHeight: '26px', marginTop: -4 }}><b>Note:</b> If required, DFT of any remaining former / dated sound existing coating has been recorded, surfaces abraded as specified and edges feathered back as per ITP.&nbsp;
                <TickL k="note_req" gap={4}>Required</TickL>&nbsp; <TickL k="note_no" gap={4}>Not required.</TickL>
              </div>
            </div>
          </div>
        </div>

        <table style={{ borderCollapse: 'collapse', width: 738, margin: '12px 0 0 6px', tableLayout: 'fixed', fontSize: 12.5 }}>
          <colgroup><col style={{ width: 141 }} /><col /><col /><col /></colgroup>
          <tbody>
            <tr>
              <td style={{ ...b, padding: '0 8px' }}>Coating system step:</td>
              {[0, 1, 2].map((c) => (
                <td key={c} style={{ ...b, padding: '2px 4px', textAlign: 'right', lineHeight: '16px', whiteSpace: 'nowrap', fontSize: 11.5, letterSpacing: -0.1 }}>
                  {STEPS.map(([n, sup, rest], i) => (
                    <div key={i}>{n}<sup style={{ fontSize: 8 }}>{sup}</sup>{rest}<Tick k={`st_${c}_${i}_s`} label={`Column ${c + 1} coat ${i + 1} spot`} size={12} style={{ margin: '0 6px 0 1px' }} />Full<Tick k={`st_${c}_${i}_f`} label={`Column ${c + 1} coat ${i + 1} full`} size={12} style={{ marginLeft: 1 }} /></div>
                  ))}
                </td>
              ))}
            </tr>
            {COAT_TOP.map(([k, l, h]) => <tr key={k} style={{ height: h || 27 }}><td style={{ ...b, padding: '0 6px', lineHeight: 1.1, fontSize: 12, letterSpacing: -0.2 }}>{l}</td>{[0, 1, 2].map((c) => <Cell key={c} k={`ct_${c}_${k}`} label={`${l} column ${c + 1}`} align="left" style={{ padding: '0 6px' }} />)}</tr>)}
            <tr>
              <td style={{ ...b, padding: '0 8px' }}>Method of application<br />used:</td>
              {[0, 1, 2].map((c) => (
                <td key={c} style={{ ...b, padding: '3px 8px', textAlign: 'right', lineHeight: '15px', whiteSpace: 'nowrap' }}>
                  {METHODS.map((m, i) => <div key={m}>{m} <Tick k={`ma_${c}_${i}`} label={`${m} column ${c + 1}`} size={12} style={{ marginLeft: 2 }} /></div>)}
                </td>
              ))}
            </tr>
            {COAT_BOTTOM.map(([k, l, h]) => <tr key={k} style={{ height: h || 27 }}><td style={{ ...b, padding: '0 6px', lineHeight: 1.1, fontSize: 12, letterSpacing: -0.2 }}>{l}</td>{[0, 1, 2].map((c) => <Cell key={c} k={`ct_${c}_${k}`} label={`${l} column ${c + 1}`} align="left" style={{ padding: '0 6px' }} />)}</tr>)}
            <TestRow h={44} p="adh" name="Adhesion">
              <div><span style={{ display: 'inline-flex', alignItems: 'center' }}>Adhesion testing: - Fully Cured Dry After 7 Days&nbsp;<Tick k="adh_cured" label="Fully cured dry after 7 days" /></span></div>
              <span style={{ display: 'flex', gap: 4 }}>Method used: AS 3894.3 METHOD (A, B, C)<U k="adh_method" w={200} label="Adhesion method used" /></span>
            </TestRow>
            <TestRow h={52} p="moist" name="Moisture">
              <div><span style={{ display: 'inline-flex', alignItems: 'center' }}>Moisture testing: - New concrete has cured for 28 days&nbsp;<Tick k="moist_cured" label="New concrete cured for 28 days" /></span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Method used: ASTM D 4263 Plastic sheet<Tick k="moist_sheet" label="Plastic sheet" /> Digital meter<Tick k="moist_meter" label="Digital meter" /><U k="moist_pct" w={52} label="Moisture reading" />%<span style={{ display: 'inline-block', width: 36, borderBottom: '1px solid #000', height: 14 }} /></div>
            </TestRow>
            <TestRow h={60} p="oth" name="Other testing">
              <span style={{ display: 'flex', gap: 4 }}>Other testing performed:<U k="oth_what" w={336} label="Other testing performed" /></span>
              <span style={{ display: 'flex', gap: 4 }}>Specify method used:<U k="oth_method" w={352} label="Other testing method" /></span>
            </TestRow>
          </tbody>
        </table>

        <div style={{ padding: '24px 0 0 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ display: 'flex', gap: 4 }}><span><b>Remarks/Comments</b>:</span><U k="remarks" w={626} label="Remarks and comments" /></span>
          <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end' }}>
            <span style={{ display: 'flex', alignItems: 'flex-end', whiteSpace: 'nowrap' }}><b>Responsible Person</b><Sig k="sig_resp" w={196} label="Responsible person" showName /></span>
            <span style={{ display: 'flex', alignItems: 'flex-end', whiteSpace: 'nowrap' }}><b>Client representative</b><Sig k="sig_client" w={210} label="Client representative" showName /></span>
          </div>
        </div>
        <Foot page={2} />
      </Page>
    </div>
  );
}

function TestRow({ h, p, name, children }: { h: number; p: string; name: string; children: React.ReactNode }) {
  return (
    <tr style={{ height: h }}>
      <td colSpan={4} style={{ border: '1px solid #000', padding: 0 }}>
        <div style={{ display: 'flex', height: h }}>
          <div style={{ width: 501, flex: 'none', borderRight: '1px solid #000', padding: '4px 8px', lineHeight: '20px', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>{children}</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 46, padding: '0 8px' }}>
            {[['na', 'N/A'], ['pass', 'Pass'], ['fail', 'Fail']].map(([s, l]) => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center' }}>{l}&nbsp;&nbsp;<Tick k={`${p}_${s}`} label={`${name} ${l}`} /></span>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}
