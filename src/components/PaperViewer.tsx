import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Shows paper pages (the ITP, a QF form) like a PDF viewer: fit to the screen width by default,
 * with zoom out / in. On a tablet in portrait the pages shrink to fit; pinch-zoom still works.
 */
const PaperViewer = forwardRef<HTMLDivElement, { pageWidth: number; maxFit?: number; full?: boolean; tools?: ReactNode; children: ReactNode }>(
  function PaperViewer({ pageWidth, maxFit = 1, full, tools, children }, pagesRef) {
    const scroll = useRef<HTMLDivElement>(null);
    const [w, setW] = useState(0);
    const [zoom, setZoom] = useState<'fit' | number>('fit');
    useEffect(() => {
      const el = scroll.current; if (!el) return;
      const measure = () => setW(el.clientWidth - 32);
      measure();
      const ro = new ResizeObserver(measure); ro.observe(el);
      return () => ro.disconnect();
    }, []);
    const fit = w > 0 ? Math.min(maxFit, Math.floor((w / pageWidth) * 100) / 100) : 1;
    const z = zoom === 'fit' ? fit : zoom;
    const step = (d: number) => setZoom(Math.min(2, Math.max(0.4, Math.round((z + d) * 10) / 10)));
    return (
      <div className={'viewer' + (full ? ' full' : '')}>
        <div className="viewer-bar">
          <button onClick={() => step(-0.1)} aria-label="Zoom out">−</button>
          <span className="pct" aria-live="polite">{Math.round(z * 100)}%</span>
          <button onClick={() => step(0.1)} aria-label="Zoom in">+</button>
          <button className={zoom === 'fit' ? 'on' : ''} aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>Fit width</button>
          {tools}
        </div>
        <div className="viewer-scroll" ref={scroll}>
          <div className="viewer-pages" ref={pagesRef} style={{ zoom: z } as any}>{children}</div>
        </div>
      </div>
    );
  });
export default PaperViewer;
