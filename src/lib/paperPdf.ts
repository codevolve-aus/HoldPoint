import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

const PX_TO_MM = 25.4 / 96;
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/**
 * Turns the paper pages on screen (elements with class "paper") into a PDF, one PDF page per paper page,
 * exactly as they look. Buttons and hints marked "noprint" are left out.
 * `stamp` adds a small line at the foot of every page, e.g. the approval record.
 */
export async function pagesToPdf(root: HTMLElement, stamp?: string): Promise<Blob> {
  const pages = [...root.querySelectorAll<HTMLElement>('.paper')];
  if (!pages.length) throw new Error('Nothing to print');
  const prevZoom = root.style.zoom;
  root.style.zoom = '1';
  root.classList.add('printing');
  await frame();
  try {
    await document.fonts?.ready;
    let pdf: jsPDF | null = null;
    for (let i = 0; i < pages.length; i++) {
      const el = pages[i];
      const w = el.offsetWidth, h = el.offsetHeight;
      const data = await toJpeg(el, {
        quality: 0.92, pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: false,
        style: { boxShadow: 'none', margin: '0' },
        filter: (n) => !(n instanceof HTMLElement && n.classList.contains('noprint'))
      });
      const wm = w * PX_TO_MM, hm = h * PX_TO_MM;
      const o = wm > hm ? 'landscape' : 'portrait';
      if (!pdf) pdf = new jsPDF({ unit: 'mm', format: [wm, hm], orientation: o });
      else pdf.addPage([wm, hm], o);
      pdf.addImage(data, 'JPEG', 0, 0, wm, hm, undefined, 'FAST');
      if (stamp) {
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(22, 101, 52);
        pdf.text(`${stamp} · page ${i + 1} of ${pages.length}`, 6, hm - 2.5);
        pdf.setTextColor(0);
      }
    }
    return pdf!.output('blob');
  } finally {
    root.style.zoom = prevZoom;
    root.classList.remove('printing');
  }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
