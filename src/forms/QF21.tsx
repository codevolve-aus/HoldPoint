import type { CSSProperties } from 'react';
import { Area, Cell, Logo, Page, U, useForm, INK } from './kit';

/* QF-21 Wet Film Thickness Gauges Readings Report, Rev 1.0.1 — 1 page, US Letter portrait. */

const b: CSSProperties = { border: '1px solid #000', padding: '0 3px' };

export default function QF21() {
  const { head, locked } = useForm();
  return (
    <Page w={816} h={1056} style={{ padding: '76px 0 0 67px', fontFamily: 'Carlito, Calibri, Arial, sans-serif', fontSize: 13 }}>
      <div style={{ width: 661, display: 'flex', justifyContent: 'center', marginBottom: 18 }}><Logo w={126} h={82} /></div>
      <table style={{ borderCollapse: 'collapse', width: 661, tableLayout: 'fixed', fontSize: 12.5 }}>
        <colgroup>{[87, 88, 72, 75, 88, 85, 90, 76].map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <tbody>
          <tr style={{ height: 24 }}>
            <td colSpan={6} style={{ border: '2px solid #000', textAlign: 'center', fontSize: 16, paddingLeft: 20 }}>WET FILM THICKNESS GAUGES READINGS REPORT</td>
            <td colSpan={2} style={{ border: '2px solid #000', textAlign: 'center', fontSize: 13 }}>Document ID: Form QF-21</td>
          </tr>
          <tr style={{ height: 19 }}>
            <td style={b}>CLIENT:</td><td colSpan={2} style={b}><U value={head.client} w="100%" style={{ borderBottom: 'none' }} /></td>
            <td style={b}>JOB No.</td><td colSpan={2} style={b}><U value={head.job} w="100%" style={{ borderBottom: 'none' }} /></td>
            <td style={b}>DATE:</td><td style={b}><U value={head.date} w="100%" style={{ borderBottom: 'none' }} /></td>
          </tr>
          <tr style={{ height: 19 }}>
            <td style={b}>PROJECT:</td><td colSpan={3} style={b}><U value={head.project} w="100%" style={{ borderBottom: 'none' }} /></td>
            <td colSpan={2} style={b}>READINGS LOCATION:</td><Cell k="where" colSpan={2} label="Readings location" align="left" />
          </tr>
          <tr style={{ height: 19 }}>
            <td colSpan={2} style={b}>RESPONSIBLE PERSON:</td><td colSpan={3} style={b}><U value={head.responsible} w="100%" style={{ borderBottom: 'none' }} /></td>
            <td colSpan={2} style={b}>SPECIFIED WFT:</td>
            <td style={{ border: '1px solid #000', padding: '0 3px 0 0' }}><span style={{ display: 'flex', alignItems: 'center' }}><U k="wft" w="100%" align="right" label="Specified wet film thickness" style={{ borderBottom: 'none' }} />µm</span></td>
          </tr>
        </tbody>
      </table>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', width: 661, marginTop: 2 }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
          <div key={n} style={{ height: 177, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 12.5, marginLeft: [-30, -10, 10][(n - 1) % 3] }}>Gauge {n}.</div>
            <Area k={`g${n}_photo`} h={110} label={`Gauge ${n} photo`} style={{ width: 170, border: locked ? 'none' : '1px dashed #93C5FD' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: '#4B5563' }}>Reading<U k={`g${n}`} w={52} align="center" label={`Gauge ${n} reading in micrometres`} style={{ borderBottomColor: '#9CA3AF', color: INK }} />µm</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 67, width: 661, top: 957, borderTop: '2px solid #000', paddingTop: 28, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, lineHeight: 1.45 }}>
        <div><b>Authorised By:</b><br />QA Manager</div>
        <div style={{ alignSelf: 'flex-end' }}>Page 1 of 1</div>
        <div style={{ textAlign: 'right' }}><b>Status:</b> Current<br /><b>Rev:</b> 1.0.1</div>
      </div>
    </Page>
  );
}
