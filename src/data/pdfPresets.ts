import type { BoxMap } from '../types';

/*
 * Ready-made box mappings for the company's own fillable PDFs, keyed by form code and box name.
 * When an engineer uploads a PDF whose boxes have these names, they are mapped straight away
 * (the engineer can still change any of them). Boxes not listed fall back to name matching.
 */

type Preset = () => Record<string, BoxMap>;

/** QF-20b Daily Coating Inspection Report (Trowel & Plural): "QF-20b Daily Coating Inspection Report - fillable.pdf". */
const QF20B: Preset = () => {
  const m: Record<string, BoxMap> = {};
  const set = (box: string, source: string, extra: Partial<BoxMap> = {}) => { m[box] = { source, ...extra }; };

  // Job details and instruments
  set('Project Name', 'h:Project'); set('Job No', 'h:Job number'); set('Date', 'h:Date'); set('Responsible person', 'h:Responsible person');
  set('Moisture Meter ID No', 'f:id_moisture'); set('Shmidt Hammer ID No', 'f:id_schmidt'); set('Surface Profile ID No', 'f:id_profile');
  set('Conductivity gauge ID No', 'f:id_conduct'); set('Digital hygrometer ID No', 'f:id_hygro'); set('DFT gauge ID No', 'f:id_dft');
  set('Photo or sketch and description of works', 'f:sketch'); // the photo is placed over this box

  // Site conditions
  for (const o of ['Chamber', 'Covered', 'Open', 'Internal', 'Other']) set(`Site conditions - ${o}`, 'f:site', { option: o });
  set('Site conditions - Other describe', 'f:site_other');

  // Weather and ambient readings: 7 rows on paper. The app's one "Sky / rain" value splits into the
  // paper's Weather (S/O/C) and Rain (L/M/H) columns, written as the letter code.
  const SKY = ['S Sunny', 'O Overcast', 'C Cloudy'];
  const RAIN = ['L Light rain', 'M Moderate rain', 'H Heavy rain'];
  for (let i = 0; i < 7; i++) {
    const b = `Ambient row ${i + 1} - `, s = `r:ambient:${i}:`;
    set(`${b}Time`, `${s}time`);
    set(`${b}Weather`, `${s}rain`, { format: 'code', when: { source: `${s}rain`, in: SKY } });
    set(`${b}Rain`, `${s}rain`, { format: 'code', when: { source: `${s}rain`, in: RAIN } });
    set(`${b}Wind direction`, `${s}wind_dir`);
    set(`${b}Wind speed`, `${s}wind_speed`, { format: 'code' });
    set(`${b}Dry bulb temp`, `${s}dry`, { format: 'plain' });
    set(`${b}Wet bulb temp`, `${s}wet`, { format: 'plain' });
    set(`${b}Surface temp`, `${s}surface`, { format: 'plain' });
    set(`${b}Dew point temp`, `${s}dew`, { format: 'plain' });
    set(`${b}Relative humidity`, `${s}rh`, { format: 'plain' });
    set(`${b}Surface temp above dew point`, `${s}@0`, { format: 'plain' });
    set(`${b}OK to paint`, `${s}ok_to_paint`);
  }

  // Soluble salt test: the app records one test (row 1 on paper).
  set('Soluble salt test 1 - Time taken', 'f:salt_time'); set('Soluble salt test 1 - Result', 'f:salt_result');

  // Surface preparation: one row per method on paper; only the row of the method used is filled.
  const PREP: [string, string][] = [['Pre-Cleaning', 'Pre-cleaning'], ['Hand Tool Cleaning', 'Hand tool cleaning'], ['Power Tool Cleaning', 'Power tool cleaning'],
    ['HP Washing Cleaning', 'HP washing cleaning'], ['Wet Abrasive Blast', 'Wet abrasive blast']];
  for (const [row, method] of PREP) {
    const when = { source: 'f:prep_method', in: [method] };
    set(`${row} - Standard specified`, 'f:prep_standard', { when });
    set(`${row} - Class of finish specified`, 'f:prep_grade', { when });
    set(`${row} - Grade of substrate`, 'f:prep_substrate', { when });
    set(`${row} - Equipment used`, 'f:prep_equipment', { when });
    set(`${row} - Surface profile required`, 'f:profile_spec', { when });
    set(`${row} - Solvents / abrasive type, size and pressure`, 'f:prep_abrasive', { when });
  }

  // Prior to surface preparation the surface is free of
  const FREE: [string, string][] = [['Oil / Contaminants', 'Oil / contaminants'], ['Grease', 'Grease'], ['Sharp edges', 'Sharp edges'],
    ['Weld slag/Porosity', 'Weld slag / porosity'], ['Weld spatter', 'Weld spatter'], ['Burrs', 'Burrs'], ['Laminations', 'Laminations'], ['Adhesives / Glue', 'Adhesives / glue']];
  for (const [box, o] of FREE) set(`Free of - ${box}`, 'f:prep_free', { option: o });

  // Surface preparation check: "achieved" is ticked when the actual profile is within the ITP's allowed range.
  set('Specified Surface Profile', 'f:profile_spec'); set('Actual Surface Profile Achieved', 'f:profile_actual');
  set('Specified surface preparation achieved - Yes', 'f:profile_actual', { when: { source: 'f:profile_actual', in: ['CSP1', 'CSP2', 'CSP3'] } });

  // Pre-painting checks
  set('Pre-painting checks date', 'h:Date');
  const PRE: [string, string][] = [['Dust', 'Dust'], ['Debris', 'Debris'], ['Spent abrasive', 'Spent abrasive'], ['Flash rusting', 'Flash rusting'], ['Overspray', 'Overspray'],
    ['Grease/Oil', 'Grease / oil'], ['Efflorescence', 'Efflorescence'], ['Laitance', 'Laitance'], ['Bug holes are exposed', 'Bug holes are exposed'], ['Voids', 'Voids'], ['Loose materials etc', 'Loose materials']];
  for (const [box, o] of PRE) set(box, 'f:prepaint_free', { option: o });

  // Coating applied today: 3 coats on paper. "Coat N - <type> - Spot/Full" is ticked for that coat's type and coverage.
  const TYPES = ['1st / Prime', '2nd / Intermediate', '3rd / Top/Finish'];
  const METHODS = ['Brush', 'Roller', 'Conventional spray', 'Airless spray', 'Plural or Grout pump spray', 'Trowel Application'];
  for (let i = 0; i < 3; i++) {
    const b = `Coat ${i + 1} - `, s = `r:coats:${i}:`;
    for (const type of TYPES) for (const cov of ['Spot', 'Full']) set(`${b}${type} - ${cov}`, `${s}coverage`, { option: cov, when: { source: `${s}coating_type`, in: [type] } });
    set(`${b}Generic Type`, `${s}generic`); set(`${b}Brand Name`, `${s}brand`);
    set(`${b}Batch Number Part A`, `${s}batch_a`); set(`${b}Batch number Part B`, `${s}batch_b`);
    set(`${b}Colour`, `${s}colour`); set(`${b}% Thinner used`, `${s}thinner`);
    set(`${b}Start time of application`, `${s}start`); set(`${b}Finish time of application`, `${s}finish`);
    for (const me of METHODS) set(`${b}Method - ${me}`, `${s}method`, { option: me });
    set(`${b}Wet film specified`, `${s}wft_spec`); set(`${b}Wet film achieved`, `${s}wft_achieved`);
    set(`${b}Part A /Part B Specified Ratio`, `${s}ratio_spec`); set(`${b}Ratio achieved`, `${s}ratio_achieved`);
  }

  // Testing: the heading tick box means the test was done (Pass or Fail).
  const DONE = ['Pass', 'Fail'];
  set('Adhesion testing - Fully cured dry after 7 days', 'f:adhesion', { when: { source: 'f:adhesion', in: DONE } });
  for (const o of ['N/A', 'Pass', 'Fail']) set(`Adhesion testing - ${o}`, 'f:adhesion', { option: o });
  set('Adhesion method used AS 38943 A, B, C', 'f:adhesion_method');
  set('Moisture testing - New concrete cured 28 days', 'f:moisture', { when: { source: 'f:moisture', in: DONE } });
  for (const o of ['N/A', 'Pass', 'Fail']) set(`Moisture testing - ${o}`, 'f:moisture', { option: o });
  set('Moisture reading %', 'f:moisture_reading', { format: 'plain' });
  set('Moisture method - ASTM D 4263 Plastic sheet', 'f:moisture_method', { option: 'ASTM D 4263 Plastic sheet' });
  set('Moisture method - Digital meter', 'f:moisture_method', { option: 'Digital meter' });
  for (const o of ['N/A', 'Pass', 'Fail']) set(`Other testing - ${o}`, 'f:other_test', { option: o });
  set('Other testing performed', 'f:other_performed'); set('Specify method used', 'f:other_method');

  // Remarks and sign-off names (the signature images go on the added pages: the paper form has no picture boxes)
  set('Remarks/Comments', 'f:remarks');
  set('Responsible Person', 'f:sign_responsible#name');
  set('Client representative', 'f:sign_client#name');
  return m;
};

export const PDF_PRESETS: Record<string, Preset> = { 'QF-20b': QF20B };
