import type { FormTemplate, Field } from '../types';

/*
 * Form templates for the MVP. Each QF form is data, not code: the form engine
 * renders it on the phone, checks values against the specs, and builds the PDF.
 * Specs and limits come from the ITP (QF-01 Rev 0, pit internals).
 * In a later phase these move to the database and are edited on the Admin page.
 */

const t = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, type: 'text', ...extra });
const n = (key: string, label: string, unit = '', extra: Partial<Field> = {}): Field => ({ key, label, type: 'number', unit, ...extra });
const c = (key: string, label: string, options: string[], extra: Partial<Field> = {}): Field => ({ key, label, type: 'choice', options, ...extra });
const photo = (key: string, label: string, required = true): Field => ({ key, label, type: 'photo', required, full: true });
const sign = (key: string, label: string, required = true): Field => ({ key, label, type: 'signature', required, full: true });
const area = (key: string, label: string): Field => ({ key, label, type: 'textarea', full: true });

const CSP = ['CSP1', 'CSP2', 'CSP3', 'CSP4', 'CSP5', 'CSP6', 'CSP7', 'CSP8', 'CSP9', 'CSP10'];
const SITE = ['Chamber', 'Covered', 'Open', 'Internal', 'Other'];
const NAPF = ['N/A', 'Pass', 'Fail'];
const siteFields = [
  c('site', 'Site conditions', SITE, { required: true, full: true }),
  t('site_other', 'Describe the site condition', { showIf: { key: 'site', in: ['Other'] }, full: true })
];

export const TEMPLATES: FormTemplate[] = [
  {
    code: 'QF-45c', title: 'Dust and Blast Profile Testing (Concrete)', rev: '1.0.1', revDate: '22/07/2026',
    sections: [
      {
        id: 'locations', title: 'Locations tested', repeat: { min: 1, max: 6, itemLabel: 'Location' },
        fields: [
          t('location', 'Location (any description)', { required: true, full: true, placeholder: 'e.g. North wall, lower half' }),
          t('location_ref', 'Location reference', { placeholder: 'e.g. Grid A1 to A3' }),
          { key: 'date', label: 'Date', type: 'date', default: 'today', required: true },
          photo('dust_photo', 'Dust tape photo (ISO 8502-3)'),
          n('dust_rating', 'Dust quantity rating', '0 to 5', { required: true, check: { max: 2, ref: 'project limit' } }),
          c('csp', 'Blast surface profile achieved (ICRI CSP comparator)', CSP, { required: true, full: true, check: { allowed: ['CSP1', 'CSP2', 'CSP3'], ref: 'ITP 8' } })
        ]
      },
      {
        id: 'prep', title: 'Surface preparation method used',
        fields: [
          { key: 'methods', label: 'Method', type: 'checks', full: true, required: true,
            options: ['-AS 1627.1 Solvent / alkaline cleaning', '-AS 1627.2 Power tool cleaning', '-AS 1627.4 Abrasive blast cleaning', '-ICRI CSP Wet abrasive blast cleaning', '-AS 1627.7 Hand tool cleaning'] },
          n('hp_pressure', 'HP wash pressure used', 'psi', { check: { min: 3000, max: 5000, ref: 'ITP 7' } })
        ]
      },
      {
        id: 'free', title: 'Surface free of',
        fields: [{ key: 'free_of', label: 'Surface free of', type: 'checks', full: true,
          options: ['Dust / abrasive', 'Oil / contaminants', 'Flash rusting', 'Weld slag / porosity', 'Grease', 'Weld spatter', 'Sharp edges', 'Laminations', 'Burrs'] }]
      },
      { id: 'site', title: 'Site conditions', fields: siteFields },
      { id: 'remarks', title: 'Remarks', fields: [area('remarks', 'Remarks / comments')] },
      { id: 'sketch', title: 'Photo or sketch of exact location', fields: [photo('sketch', 'Photo or sketch of exact location/s')] },
      { id: 'sign', title: 'Sign-off', fields: [sign('sign_company', 'Company representative'), sign('sign_client', 'Client representative', false)] }
    ]
  },
  {
    code: 'QF-20b', title: 'Daily Coating Inspection Report (Trowel & Plural)', rev: '1.0.1', revDate: '26/10/2026',
    sections: [
      {
        id: 'instruments', title: 'Instruments used',
        fields: [t('id_moisture', 'Moisture meter ID'), t('id_schmidt', 'Schmidt hammer ID'), t('id_profile', 'Surface profile ID'),
          t('id_hygro', 'Digital hygrometer ID'), t('id_conduct', 'Conductivity gauge ID'), t('id_dft', 'DFT gauge ID')]
      },
      { id: 'sketch', title: 'Photo or sketch of exact location', fields: [photo('sketch', 'Photo or sketch of works performed')] },
      { id: 'site', title: 'Site conditions', fields: siteFields },
      {
        id: 'ambient', title: 'Weather and ambient readings (every 2 hours)', repeat: { min: 1, max: 8, itemLabel: 'Reading' },
        rowRules: [{ label: 'Surface temperature above dew point', a: 'surface', b: 'dew', min: 3, ref: 'coating spec' }],
        fields: [
          { key: 'time', label: 'Time', type: 'time', required: true },
          c('rain', 'Sky / rain', ['S Sunny', 'O Overcast', 'C Cloudy', 'L Light rain', 'M Moderate rain', 'H Heavy rain']),
          t('wind_dir', 'Wind direction'),
          c('wind_speed', 'Wind speed', ['L Low', 'M Moderate', 'H High']),
          n('dry', 'Dry bulb', '°C', { required: true }), n('wet', 'Wet bulb', '°C', { required: true }),
          n('rh', 'Relative humidity', '%', { required: true }), n('surface', 'Surface temp', '°C', { required: true }),
          n('dew', 'Dew point', '°C', { required: true }),
          c('ok_to_paint', 'OK to paint?', ['Y', 'N'], { required: true })
        ]
      },
      { id: 'salt', title: 'Soluble salt test', fields: [{ key: 'salt_time', label: 'Time taken', type: 'time' }, t('salt_result', 'Result', { placeholder: 'mg/m²' })] },
      {
        id: 'prep', title: 'Surface preparation',
        fields: [c('prep_method', 'Method', ['Pre-cleaning', 'Hand tool cleaning', 'Power tool cleaning', 'HP washing cleaning', 'Wet abrasive blast'], { full: true }),
          t('prep_standard', 'Standard specified'), t('prep_grade', 'Class / grade of finish'), t('prep_substrate', 'Substrate', { default: 'Concrete' }),
          t('prep_equipment', 'Equipment used'), t('prep_abrasive', 'Solvent / abrasive type, size and pressure', { full: true })]
      },
      {
        id: 'prepfree', title: 'Prior to surface preparation the surface is free of',
        fields: [{ key: 'prep_free', label: 'Free of', type: 'checks', full: true, options: ['Oil / contaminants', 'Grease', 'Sharp edges', 'Weld slag / porosity', 'Weld spatter', 'Burrs', 'Laminations', 'Adhesives / glue'] }]
      },
      {
        id: 'prepcheck', title: 'Surface preparation check',
        fields: [t('profile_spec', 'Specified surface profile', { default: 'CSP1 to CSP3' }),
          c('profile_actual', 'Actual surface profile achieved', CSP, { required: true, check: { allowed: ['CSP1', 'CSP2', 'CSP3'], ref: 'ITP 8' } })]
      },
      {
        id: 'prepaint', title: 'Pre-painting checks · surface is free of',
        fields: [{ key: 'prepaint_free', label: 'Free of', type: 'checks', full: true, options: ['Dust', 'Debris', 'Spent abrasive', 'Flash rusting', 'Overspray', 'Grease / oil', 'Efflorescence', 'Laitance', 'Bug holes are exposed', 'Voids', 'Loose materials'] }]
      },
      {
        id: 'coats', title: 'Coating applied today', repeat: { min: 1, max: 3, itemLabel: 'Coating entry' },
        fields: [
          c('coating_type', 'Coating type', ['1st / Prime', '2nd / Intermediate', '3rd / Top/Finish'], { required: true }),
          c('coverage', 'Coating coverage', ['Spot', 'Full'], { required: true }),
          t('generic', 'Generic type'), t('brand', 'Brand name'),
          t('batch_a', 'Batch no. (Part A)', { required: true }), t('batch_b', 'Batch no. (Part B)', { required: true }),
          t('colour', 'Colour'), n('thinner', '% thinner used', '%'),
          { key: 'start', label: 'Start time', type: 'time' }, { key: 'finish', label: 'Finish time', type: 'time' },
          c('method', 'Method of application', ['Brush', 'Roller', 'Conventional spray', 'Airless spray', 'Plural or Grout pump spray', 'Trowel Application'], { required: true, full: true }),
          n('wft_spec', 'Wet film specified', 'µm', { required: true, placeholder: '125 primer · 210 FLAKELINE' }),
          n('wft_achieved', 'Wet film achieved', 'µm', { required: true, check: { minFrom: 'wft_spec', ref: 'ITP 14, 16, 18, 20' } }),
          t('ratio_spec', 'Part A / Part B specified ratio'), t('ratio_achieved', 'Ratio achieved')
        ]
      },
      {
        id: 'testing', title: 'Testing',
        fields: [
          c('adhesion', 'Adhesion testing (fully cured, dry after 7 days)', NAPF, { full: true }),
          t('adhesion_method', 'Method used: AS 3894.3 method (A, B, C)', { showIf: { key: 'adhesion', in: ['Pass', 'Fail'] }, full: true }),
          c('moisture', 'Moisture testing (new concrete cured 28 days)', NAPF, { full: true }),
          c('moisture_method', 'Method used', ['ASTM D 4263 Plastic sheet', 'Digital meter'], { showIf: { key: 'moisture', in: ['Pass', 'Fail'] } }),
          n('moisture_reading', 'Reading', '%', { showIf: { key: 'moisture', in: ['Pass', 'Fail'] }, check: { lt: 6, ref: 'ITP 11' } }),
          c('other_test', 'Other testing', NAPF, { full: true }),
          t('other_performed', 'Other testing performed', { showIf: { key: 'other_test', in: ['Pass', 'Fail'] }, full: true }),
          t('other_method', 'Specify method used', { showIf: { key: 'other_test', in: ['Pass', 'Fail'] }, full: true })
        ]
      },
      { id: 'remarks', title: 'Remarks', fields: [area('remarks', 'Remarks / comments')] },
      { id: 'sign', title: 'Sign-off', fields: [sign('sign_responsible', 'Responsible person'), sign('sign_client', 'Client representative', false)] }
    ]
  },
  {
    code: 'QF-21', title: 'Wet Film Thickness Gauges Readings Report', rev: '1.0.1', revDate: '22/07/2026',
    sections: [
      {
        id: 'readings', title: 'Readings',
        fields: [t('readings_location', 'Readings location', { required: true, full: true, placeholder: 'e.g. Floor, east half' }),
          c('wft_spec', 'Specified WFT (µm)', ['125', '210'], { required: true, full: true })]
      },
      {
        id: 'gauges', title: 'Gauges', repeat: { min: 1, max: 12, itemLabel: 'Gauge' },
        fields: [photo('comb_photo', 'Photo of the WFT comb'), n('reading', 'Reading', 'µm', { required: true, check: { minFrom: 'wft_spec', ref: 'ITP 14, 16, 18, 20' } })]
      },
      { id: 'sign', title: 'Sign-off', fields: [sign('sign_responsible', 'Responsible person')] }
    ]
  },
  {
    code: 'QF-23', title: 'Holiday Test Report', rev: '1.0.1', revDate: '22/07/2026',
    sections: [
      { id: 'sketch', title: 'Photo or sketch of areas tested', fields: [photo('sketch', 'Photo or sketch of areas tested')] },
      {
        id: 'conditions', title: 'Ambient and surface conditions',
        fields: [n('dry', 'Dry bulb', '°C'), n('wet', 'Wet bulb', '°C'), n('surface', 'Surface temp', '°C'), n('rh', 'Relative humidity', '%'), n('dew', 'Dew point', '°C')]
      },
      {
        id: 'system', title: 'Coating system applied',
        fields: [t('product', 'Product name', { default: 'CEILCOTE® 662 FLAKELINE' }), t('generic', 'Generic type', { default: 'Novolac epoxy' }),
          n('dft', 'Total DFT', 'µm', { check: { min: 650, ref: 'ITP 20' } }), { key: 'completed', label: 'Date final coat completed', type: 'date' },
          n('cure_days', 'Elapsed curing time', 'days', { required: true, check: { min: 5, ref: 'ITP 21' } }),
          n('cure_max', 'Curing max temp', '°C'), n('cure_min', 'Curing min temp', '°C')]
      },
      {
        id: 'equipment', title: 'Test equipment used',
        fields: [t('hv_id', 'High voltage tester ID', { required: true }), n('voltage', 'Test voltage', 'V', { required: true, check: { min: 2600, ref: 'ITP 21' } })]
      },
      {
        id: 'results', title: 'Results',
        fields: [n('pct_tested', '% of area tested', '%', { required: true, check: { min: 100, ref: 'ITP 21' } }),
          n('holidays', 'Holidays detected', '', { required: true }),
          c('marked', 'Area marked for rework', ['Yes', 'No']), c('repaired', 'Rework repaired', ['Yes', 'No']),
          t('verified_by', 'Rework verified by')]
      },
      { id: 'comments', title: 'Comments', fields: [area('comments', 'Comments')] },
      { id: 'sign', title: 'Sign-off', fields: [sign('sign_rework', 'Rework verification', false), sign('sign_responsible', 'Responsible person')] }
    ]
  },
  {
    code: 'QF-30', title: 'Adhesion Report Form', rev: '1.0.1', revDate: '22/07/2026',
    sections: [
      {
        id: 'area', title: 'Area and coating',
        fields: [t('inspector', 'Contractor inspector', { required: true }), t('location', 'Location of areas tested', { required: true }),
          t('coating', 'Description of coating types', { default: 'CEILCOTE® 662 FLAKELINE', full: true }),
          n('surface', 'Surface temp', '°C'), n('thickness', 'Coating thickness', 'µm'),
          t('equipment', 'Test equipment used'), t('equipment_id', 'Test equipment ID nos.'),
          { key: 'completed', label: 'Coating completion date', type: 'date' }]
      },
      {
        id: 'procedure', title: 'Test procedure used',
        fields: [c('procedure', 'Procedure', ['AS 1580.408.2 Knife test', 'AS 1580.408.4 Cross-cut', 'AS 3894.3 Pull-off (Method C)'], { required: true, full: true }),
          n('pressure_spec', 'Specified pressure', 'MPa', { default: '2' }), n('dolly', 'Specified dolly size', 'mm', { default: '50' }),
          n('tests', 'Number of tests (1 per 50 m²)', '', { required: true }),
          n('average', 'Average pull-off', 'MPa', { required: true, check: { minFrom: 'pressure_spec', ref: 'ITP 22' } })]
      },
      { id: 'photos', title: 'Photos of all test areas', repeat: { min: 1, max: 10, itemLabel: 'Test area' }, fields: [photo('photo', 'Test area photo')] },
      { id: 'result', title: 'Conclusion', fields: [c('result', 'Result', ['Passed', 'Failed'], { required: true }), area('comments', 'Comments / remarks')] },
      { id: 'sign', title: 'Sign-off', fields: [sign('sign_contractor', 'Signed on behalf of the contractor')] }
    ]
  }
];

export const templateFor = (code: string) => TEMPLATES.find((x) => x.code === code);
