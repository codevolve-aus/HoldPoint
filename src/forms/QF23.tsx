import type { CSSProperties } from 'react';
import { Area, Cell, Lines, Logo, Page, Sig, Tick, U, useForm } from './kit';

/* QF-23 Holiday Report, Rev 2.1.1 — 1 page, A4 portrait. */

const b: CSSProperties = { border: '1px solid #000' };
const grey: CSSProperties = { ...b, background: '#C8C8C8' };
const row = (h = 26): CSSProperties => ({ height: h });

export default function QF23() {
  const { head } = useForm();
  return (
    <Page style={{ padding: '6px 40px 0 41px', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11.5 }}>
      <div style={{ borderTop: '3px solid #4A4A4A', borderBottom: '3px solid #4A4A4A', display: 'flex', alignItems: 'center', gap: 64, padding: '10px 0 8px' }}>
        <Logo w={120} h={72} style={{ marginLeft: 30 }} />
        <div style={{ fontSize: 15, lineHeight: '38px' }}><div><b>Document Title:</b> Holiday Report</div><div><b>Document ID:</b> QF-23</div></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '18px 0 0 6px' }}>
        <div style={{ display: 'flex' }}><span style={{ width: 145 }}>Project description: -</span><U value={head.project} w={286} /><span style={{ marginLeft: 42, width: 50 }}>Date:-</span><U value={head.date} w={142} /></div>
        <div style={{ display: 'flex' }}><span style={{ width: 145 }}>Supervisor: -</span><U k="sup" w={286} label="Supervisor" /><span style={{ marginLeft: 42, width: 50 }}>Job no.:-</span><U value={head.job} w={142} /></div>
        <div style={{ display: 'flex' }}><span style={{ width: 145 }}>Responsible person:-</span><U value={head.responsible} w={286} /></div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, lineHeight: 1.2 }}>Write / sketch / insert photo and/or attach photo of exact location/s and description/s of all areas tested<br />NOTE – this area shall be completed fully, failure to do so will render this form invalid.</div>
      <Area k="sketch" h={114} label="Location and description of areas tested" style={{ marginTop: 4 }} />

      <div style={{ margin: '22px 0 2px 6px' }}>AMBIENT/SURFACE CONDITIONS:</div>
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', textAlign: 'center' }}>
        <tbody>
          <tr><td colSpan={3} style={{ ...grey, lineHeight: '12px' }}>Temperatures C°</td><td rowSpan={2} style={grey}>Relative humidity</td><td rowSpan={2} style={grey}>Dew point</td></tr>
          <tr style={{ lineHeight: '12px' }}><td style={b}>Dry bulb</td><td style={b}>Wet bulb</td><td style={b}>Surface temp</td></tr>
          {[0, 1].map((r) => <tr key={r} style={row()}>{['Dry bulb', 'Wet bulb', 'Surface temp', 'Relative humidity', 'Dew point'].map((l, i) => <Cell key={i} k={`amb_${r}_${i}`} label={`${l}, reading ${r + 1}`} style={{ fontSize: 13 }} />)}</tr>)}
          <tr><td colSpan={5} style={{ ...grey, lineHeight: '13px' }}>Coating system applied</td></tr>
          <tr style={row()}><td style={b}>Coating layer</td>{['st', 'nd', 'rd', 'th'].map((s, i) => <td key={s} style={b}>{i + 1}<sup style={{ fontSize: 7 }}>{s}</sup> coat</td>)}</tr>
          {[['prod', 'Product name'], ['gen', 'Generic type'], ['dft', 'DFT'], ['meth', 'Method of application']].map(([k, l]) => (
            <tr key={k} style={row()}><td style={b}>{l}</td>{[0, 1, 2, 3].map((i) => <Cell key={i} k={`c${i}_${k}`} label={`${l}, coat ${i + 1}`} style={{ fontSize: 13 }} />)}</tr>
          ))}
          <tr style={row()}>
            <td style={{ ...b, lineHeight: 1.15 }}>Date application<br />completed</td>
            <Cell k="date_done" label="Date application completed" style={{ fontSize: 13 }} />
            <td colSpan={2} style={b}>Time application completed</td>
            <Cell k="time_done" label="Time application completed" style={{ fontSize: 13 }} />
          </tr>
          <tr style={row()}>
            <td style={b}>Curing conditions</td>
            <td colSpan={4} style={{ ...b, padding: 0 }}>
              <div style={{ display: 'flex', height: 25, alignItems: 'stretch' }}>
                <span style={{ width: 56, borderRight: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>Elapsed<br />time</span>
                <span style={{ width: 85, borderRight: '1px solid #000', display: 'flex', alignItems: 'center' }}><U k="elapsed" w="100%" align="center" label="Elapsed curing time" style={{ borderBottom: 'none', fontSize: 13 }} /></span>
                <span style={{ width: 59, borderRight: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Max temp</span>
                <span style={{ width: 113, borderRight: '1px solid #000', display: 'flex', alignItems: 'center' }}><U k="max_t" w="100%" align="center" label="Maximum curing temperature" style={{ borderBottom: 'none', fontSize: 13 }} /></span>
                <span style={{ width: 57, borderRight: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Min temp</span>
                <span style={{ flex: 1, display: 'flex', alignItems: 'center' }}><U k="min_t" w="100%" align="center" label="Minimum curing temperature" style={{ borderBottom: 'none', fontSize: 13 }} /></span>
              </div>
            </td>
          </tr>
          <tr style={row()}><td colSpan={5} style={b}>Test equipment used</td></tr>
          <tr style={row()}><td style={b}>Type of test equipment</td><td style={b}>ID number</td><td style={b}>Type of test equipment</td><td colSpan={2} style={{ ...b, padding: 0 }}><div style={{ display: 'flex', height: 25 }}><span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #000' }}>Specified value to pass</span><span style={{ width: 66, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Pass or fail?</span></div></td></tr>
          {[['dft', 'DFT gauge'], ['har', 'Harness test'], ['spo', 'Sponge tester'], ['hv', 'High voltage tester']].map(([k, l]) => (
            <tr key={k} style={row()}>
              <td style={b}>{l}</td>
              <Cell k={`e_${k}_id`} label={`${l} ID number`} style={{ fontSize: 13 }} />
              <Cell k={`e_${k}_type`} label={`${l} type`} style={{ fontSize: 13 }} />
              <td colSpan={2} style={{ ...b, padding: 0 }}><div style={{ display: 'flex', height: 25 }}>
                <span style={{ flex: 1, minWidth: 0, borderRight: '1px solid #000', display: 'flex', alignItems: 'center' }}><U k={`e_${k}_spec`} w="100%" align="center" label={`${l} specified value to pass`} style={{ borderBottom: 'none', fontSize: 13 }} /></span>
                <span style={{ width: 66, display: 'flex', alignItems: 'center' }}><U k={`e_${k}_pf`} w="100%" align="center" label={`${l} pass or fail`} style={{ borderBottom: 'none', fontSize: 13 }} /></span>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ padding: '20px 0 0 6px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex' }}><span style={{ width: 192 }}>Percentage of the area tested:-</span><U k="pct" w={192} label="Percentage of the area tested" /></div>
        <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ width: 192 }}>Number of holidays detected: -</span><U k="num" w={192} label="Number of holidays detected" />
          <span style={{ marginLeft: 48 }}>Area marked for rework :</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 30 }}><Tick k="rw_yes" size={11} label="Area marked for rework: yes" />YES</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 10 }}><Tick k="rw_no" size={11} label="Area marked for rework: no" />NO</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ width: 240 }}>Area marked for rework have been repairs:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Tick k="rp_yes" size={11} label="Repaired: yes" />YES</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 10 }}><Tick k="rp_no" size={11} label="Repaired: no" />NO</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>Rework tested and verified to meet specification by: -<U k="v_by" w={104} label="Rework verified by" />Signed:-<Sig k="v_sig" w={86} h={24} label="Rework verified, signature" />Date:-<U k="v_date" w={110} label="Rework verified date" /></div>
        <div>
          <div style={{ display: 'flex' }}>Comments:-<U k="com1" w="100%" label="Comments" /></div>
          <Lines k="com2" lines={3} lineH={25} label="More comments" />
        </div>
        <div style={{ display: 'flex', marginTop: 8, alignItems: 'flex-end', whiteSpace: 'nowrap' }}>Responsible person signature: -<Sig k="r_sig" w={330} h={28} label="Responsible person" showName /><span style={{ marginLeft: 40 }}>Date:-</span><U k="r_date" w={150} label="Responsible person signature date" /></div>
      </div>

      <div style={{ position: 'absolute', left: 41, right: 40, bottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10.5, lineHeight: 1.75 }}>
        <div>Rev Date: 18/07/2023 6:25:57 PM<br />Authorised By: QA Manager</div>
        <div style={{ alignSelf: 'flex-end' }}>Page 1 of 1</div>
        <div style={{ width: 90 }}>Rev: 2.1.1<br />Status: Current</div>
      </div>
    </Page>
  );
}
