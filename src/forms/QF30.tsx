import { Lines, Logo, Page, Sig, Tick, U, useForm } from './kit';

/* QF-30 Adhesion Report Form, Rev 4.0.2 — 1 page, A4 portrait. */

export default function QF30() {
  const { head, company } = useForm();
  const L = ({ children }: { children: React.ReactNode }) => <div style={{ display: 'flex', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>{children}</div>;
  return (
    <Page style={{ padding: '34px 40px 0 41px', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12 }}>
      <div style={{ borderTop: '3px solid #4A4A4A', borderBottom: '3px solid #4A4A4A', display: 'flex', alignItems: 'center', gap: 64, padding: '6px 0' }}>
        <Logo w={120} h={76} style={{ marginLeft: 30 }} />
        <div style={{ fontSize: 15, lineHeight: '36px' }}><div><b>Document Title:</b> Adhesion Report Form</div><div><b>Document ID:</b> QF-30</div></div>
      </div>

      <div style={{ padding: '10px 0 0 7px', display: 'flex', flexDirection: 'column', gap: 5, lineHeight: '17px' }}>
        <L>Project:<U value={head.project} w={320} /><span style={{ marginLeft: 38 }}>Date:</span><U value={head.date} w={110} style={{ marginLeft: 4 }} /></L>
        <L>Supervisor:<U k="sup" w={298} label="Supervisor" /><span style={{ marginLeft: 58 }}>Job no:</span><U value={head.job} w={102} style={{ marginLeft: 4 }} /></L>
        <L>{company.name} inspector:<U k="insp" w={400} label="Inspector" /></L>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 2 }}><span>Location</span><span style={{ marginLeft: 120 }}>of</span><span>area/s</span></div>
        <L>tested:<U k="loc" w={448} label="Location of areas tested" /></L>
        <L><span style={{ marginTop: 18 }}>Description of coating type/s:</span><U k="desc1" w="100%" label="Description of coating types" /></L>
        <U k="desc2" w={360} label="Description of coating types, line 2" style={{ marginTop: 4 }} />
        <L><span style={{ marginTop: 10 }}>Surface temperature of area tested:</span><U k="stemp" w={142} label="Surface temperature of area tested" />Thickness of coating:<U k="thick" w={120} align="right" label="Thickness of coating in micrometres" /><span style={{ textDecoration: 'underline' }}>µm</span></L>
        <L>Test equipment used:<U k="eq" w="100%" label="Test equipment used" /></L>
        <L>Test equipment ID numbers:<U k="eqId" w="100%" label="Test equipment ID numbers" /></L>
        <div style={{ textAlign: 'center', fontWeight: 700 }}>Curing time:</div>
        <L>Coating completion date:<U k="cDate" w={160} label="Coating completion date" /><span style={{ marginLeft: 30 }}>Coating temperature:</span><U k="cTemp" w="100%" label="Coating temperature" /></L>
        <L><span style={{ display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>Paint deemed to be cured:<Tick k="cured" size={12} label="Paint deemed to be cured" />Yes, method used to determine if coating is fully cured</span><U k="cureM1" w="100%" label="Method used to determine cure" /></L>
        <U k="cureM2" w="100%" label="Cure method, line 2" style={{ marginTop: 4 }} />

        <div style={{ textAlign: 'center', fontWeight: 700, marginTop: 6 }}>Test procedure used:</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 22 }}>
          <label style={{ display: 'flex', alignItems: 'center', fontWeight: 700 }}><span style={{ width: 32, fontWeight: 400 }}>1.</span><Tick k="t1" size={12} label="Knife test" style={{ marginRight: 6 }} />AS 1580.408.2 Methods of test – Adhesion, Knife test: -</label>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Method A<Tick k="t1a" size={12} label="Knife test method A" style={{ margin: '0 26px 0 2px' }} />Method&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;B</span>
        </div>
        <div style={{ paddingLeft: 6 }}><Tick k="t1b" size={12} label="Knife test method B" /></div>
        <L>Adhesion classification of coating (As per table 1 of AS 1580.408.2):<U k="t1c" w="100%" label="Knife test adhesion classification" /></L>
        <div style={{ textAlign: 'right', fontWeight: 700, paddingRight: 72 }}>DFT:&nbsp; -&nbsp; Cutter Size</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 22 }}>
          <label style={{ display: 'flex', alignItems: 'center', fontWeight: 700 }}><span style={{ width: 32, fontWeight: 400 }}>2.</span><Tick k="t2" size={12} label="Crosscut test" style={{ marginRight: 6 }} />AS 1580.408.4 Methods of test – Adhesion, Crosscut: -</label>
          <div style={{ width: 186, display: 'flex', flexDirection: 'column', gap: 4, whiteSpace: 'nowrap' }}>
            <label style={{ display: 'flex', alignItems: 'center' }}><Tick k="cutA" size={12} label="Under 50 micrometres, 11 x 1 mm" style={{ marginRight: 8 }} />&lt;50&nbsp;&nbsp;µm:- 11 X 1 mm</label>
            <label style={{ display: 'flex', alignItems: 'center' }}><Tick k="cutB" size={12} label="50 to 125 micrometres, 6 x 2 mm" style={{ marginRight: 8 }} />&gt;50&nbsp;&nbsp;µm - 125&nbsp;&nbsp;µm 6 X 2 mm</label>
          </div>
        </div>
        <L>Tape used?<U k="tape" w="100%" label="Tape used" /></L>
        <L>Adhesion classification of coating (As per table 1 of AS 1580.408.5):<U k="t2c" w="100%" label="Crosscut adhesion classification" /></L>

        <label style={{ display: 'flex', alignItems: 'center', fontWeight: 700, paddingLeft: 22, marginTop: 18 }}><span style={{ width: 32, fontWeight: 400 }}>3.</span><Tick k="t3" size={12} label="Pull off test" style={{ marginRight: 6 }} />AS 1580.408.5 Methods of test – Adhesion, Pull off test:-</label>
        <L><span style={{ width: 128 }}>Specified pressure:</span><U k="sp" w={104} label="Specified pressure" /><span style={{ marginLeft: 48, width: 130 }}>Specified dolly size:</span><U k="dolly" w="100%" label="Specified dolly size" /></L>
        <L><span style={{ width: 128 }}>Number tests performed:</span><U k="n" w={104} label="Number of tests performed" /><span style={{ marginLeft: 48, width: 150 }}>Average pull off pressure:</span><U k="avg" w="100%" label="Average pull off pressure" /></L>
        <div style={{ textAlign: 'center', fontWeight: 700 }}>Conclusion</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>Coating is deemed to have: -<span style={{ marginLeft: 20 }}>Passed</span><Tick k="pass" size={12} label="Passed" style={{ marginLeft: 4 }} /><span style={{ marginLeft: 74 }}>Failed</span><Tick k="fail" size={12} label="Failed" style={{ marginLeft: 4 }} /></div>
        <div>
          <L>Comments / remarks:<U k="rem1" w="100%" label="Comments and remarks" /></L>
          <Lines k="rem2" lines={5} lineH={23} label="More comments" />
        </div>
        <div style={{ textAlign: 'center', color: '#DC2626', marginTop: 6 }}>Take photos of all test areas for verification purposes</div>
        <L><span style={{ marginTop: 8 }}>Signed:</span><Sig k="sig" w={164} h={28} label="Signed" /></L>
        <div style={{ paddingLeft: 2 }}>On behalf of {company.name}</div>
      </div>

      <div style={{ position: 'absolute', left: 41, right: 40, bottom: 22, borderTop: '3px solid #4A4A4A', paddingTop: 2, display: 'flex', fontFamily: "'Times New Roman', Times, serif", fontSize: 12, lineHeight: 1.35 }}>
        <div style={{ width: 210 }}><b>Rev Date:</b> 16/09/2024 8:51:02 AM<br /><b>Authorised By:</b> QA Manager</div>
        <div style={{ width: 200, alignSelf: 'flex-end', fontSize: 10 }}>Page 1 of 1</div>
        <div><b>Rev:</b> 4.0.2<br /><b>Status:</b> Current</div>
      </div>
    </Page>
  );
}
