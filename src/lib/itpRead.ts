import { parseItpPages, parseItpRows, type PageText, type ParsedItp, type VLine } from './itpParse';

/** Reads an uploaded ITP file in the browser. PDF: text and table borders. Word (.docx): table rows. */
export async function readItpFile(file: File): Promise<ParsedItp & { previewHtml?: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return readPdf(file);
  if (name.endsWith('.docx')) return readDocx(file);
  throw new Error('Upload the ITP as a PDF or a Word (.docx) file.');
}

async function readPdf(file: File): Promise<ParsedItp> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const OPS = pdfjs.OPS as Record<string, number>;
  const pages: PageText[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = (tc.items as any[]).filter((i) => 'str' in i).map((i) => ({ str: i.str as string, x: i.transform[4] as number, y: vp.height - (i.transform[5] as number), w: i.width as number }));
    // table borders: thin vertical rectangles or vertical line segments
    const vlines: VLine[] = [];
    const ol = await page.getOperatorList();
    for (let i = 0; i < ol.fnArray.length; i++) {
      if (ol.fnArray[i] !== OPS.constructPath) continue;
      const [ops, args] = ol.argsArray[i] as [number[], number[]];
      let a = 0; let px = 0, py = 0;
      for (const op of ops) {
        if (op === OPS.rectangle) {
          const [x, y, w, h] = args.slice(a, a + 4); a += 4;
          if (Math.abs(w) < 2.5 && Math.abs(h) > 8) vlines.push({ x: x + w / 2, y0: vp.height - Math.max(y, y + h), y1: vp.height - Math.min(y, y + h) });
        } else if (op === OPS.moveTo) { px = args[a]; py = args[a + 1]; a += 2; }
        else if (op === OPS.lineTo) {
          const x = args[a], y = args[a + 1]; a += 2;
          if (Math.abs(x - px) < 1 && Math.abs(y - py) > 8) vlines.push({ x, y0: vp.height - Math.max(y, py), y1: vp.height - Math.min(y, py) });
          px = x; py = y;
        } else if (op === OPS.curveTo) a += 6; else if (op === OPS.curveTo2 || op === OPS.curveTo3) a += 4;
      }
    }
    pages.push({ width: vp.width, height: vp.height, items, vlines });
  }
  return parseItpPages(pages);
}

async function readDocx(file: File): Promise<ParsedItp & { previewHtml: string }> {
  const mammoth: any = await import('mammoth/mammoth.browser.js');
  const { value: html } = await (mammoth.default || mammoth).convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const dom = new DOMParser().parseFromString(html, 'text/html');
  dom.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  const text = (el: Element) => [...el.querySelectorAll('p, li')].map((p) => (p.textContent || '').trim()).filter(Boolean).join('\n') || (el.textContent || '').trim();
  const rows: string[][] = [];
  dom.querySelectorAll('table').forEach((t) => t.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr').forEach((tr) => rows.push([...tr.querySelectorAll(':scope > td, :scope > th')].map(text))));
  const headerLines = [...dom.body.querySelectorAll(':scope > p')].map((p) => (p.textContent || '').trim()).filter(Boolean);
  return { ...parseItpRows(rows, headerLines), previewHtml: html };
}
