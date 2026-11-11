import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { CHAPTERS, CLOSE, HERO } from './landing/content.js';
import { LogoMark } from '../components/brand/Logo.jsx';

// The landing page: a fixed WebGL spreadsheet behind the page (landing/scene.js, loaded on demand so three.js stays out of the
// app's main chunk) and chapters of text that scroll over it. Scroll position → fractional chapter index → the world's layout
// and camera. Lenis smooths the scroll. With "reduce motion" on there is no smoothing, no idle motion and no rain.

const STOPS = [HERO, ...CHAPTERS, { ...CLOSE, cam: 'far' }];

/** Masked line that slides up into place when its chapter is shown. */
const Line = ({ children, i = 0 }) => (
  <span className="lp-mask"><span style={{ '--i': i }}>{children}</span></span>
);

function Stats({ items, big }) {
  return (
    <dl className={`lp-stats${big ? ' lp-stats--big' : ''}`}>
      {items.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

/** Name box + fx + formula, the way Excel shows the selected cell. Types each new formula out. */
function FormulaBar({ stop }) {
  const [typed, setTyped] = useState(stop.formula);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTyped(stop.formula); return undefined; }
    let n = 0;
    const id = setInterval(() => {
      n += 2;
      setTyped(stop.formula.slice(0, n));
      if (n >= stop.formula.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [stop.formula]);
  return (
    <div className="lp-fx" aria-hidden="true">
      <span className="lp-fx__ref">{stop.ref}</span>
      <span className="lp-fx__fn">fx</span>
      <span className="lp-fx__formula">{typed}<i className="lp-fx__caret" /></span>
    </div>
  );
}

export default function LandingPage({ onGetStarted }) {
  const canvasRef = useRef(null);
  const sectionsRef = useRef([]);
  const lenisRef = useRef(null);
  const worldRef = useRef(null);
  const [active, setActive] = useState(0);
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [noGL, setNoGL] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Smooth scroll, the 3D world, the preloader and the scroll → chapter mapping.
  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo(0, 0);
    const lenis = reduced ? null : new Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.9 });
    lenisRef.current = lenis;

    // Each chapter's anchor = the scroll position where it sits centred in the viewport.
    let anchors = [];
    const measure = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      anchors = sectionsRef.current.map((el, k) => (k === 0 ? 0
        : Math.min(max, Math.max(0, el.offsetTop + el.offsetHeight / 2 - window.innerHeight / 2))));
    };
    const progress = () => {
      const y = window.scrollY;
      if (!anchors.length || y <= anchors[0]) return 0;
      for (let k = 0; k < anchors.length - 1; k++) {
        if (y < anchors[k + 1]) return k + (y - anchors[k]) / Math.max(1, anchors[k + 1] - anchors[k]);
      }
      return anchors.length - 1;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);

    let raf = 0;
    let last = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const k = Math.round(progress());
      if (k !== last) { last = k; setActive(k); }
      setScrolled(window.scrollY > 40);
    };
    raf = requestAnimationFrame(tick);

    // Preloader: count to 100 while the world loads; both must finish.
    let world = null;
    let disposed = false;
    let counted = false;
    let built = false;
    const finish = () => {
      if (!counted || !built || disposed) return;
      setReady(true);
      world?.start();
    };
    const t0 = performance.now();
    const duration = reduced ? 1 : 1300;
    let craf = 0;
    const count = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      setCount(Math.round((1 - (1 - p) ** 3) * 100));
      if (p < 1) craf = requestAnimationFrame(count);
      else { counted = true; finish(); }
    };
    craf = requestAnimationFrame(count);

    import('./landing/scene.js')
      .then(({ createWorld }) => {
        if (disposed) return;
        world = createWorld(canvasRef.current, { stops: STOPS, getProgress: progress, reducedMotion: reduced });
        worldRef.current = world;
      })
      .catch(() => setNoGL(true)) // no WebGL: the page still reads, over a flat grid background
      .finally(() => { built = true; finish(); });

    const onMove = (e) => world?.setPointer(e.clientX / window.innerWidth * 2 - 1, e.clientY / window.innerHeight * 2 - 1);
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(craf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      lenis?.destroy();
      world?.dispose();
      worldRef.current = null;
      window.scrollTo(0, 0);
    };
  }, []);

  // Reveal each chapter's text as it comes into view.
  useEffect(() => {
    if (!ready) return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) e.target.classList.add('is-shown');
    }, { threshold: 0.3 });
    sectionsRef.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [ready]);

  const go = (id) => {
    const el = document.getElementById(`lp-${id}`);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { duration: 2.2 });
    else el.scrollIntoView();
  };

  // Drag to turn the cube (pointer capture, so the drag survives leaving the text block).
  const dragFrom = useRef(null);
  const onDragStart = (e) => {
    if (e.pointerType === 'touch') return; // on touch the page scrolls; the cube turns by itself
    dragFrom.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e) => {
    if (dragFrom.current === null) return;
    worldRef.current?.drag(e.clientX - dragFrom.current);
    dragFrom.current = e.clientX;
  };
  const onDragEnd = () => { dragFrom.current = null; };

  const ref = (k) => (el) => { sectionsRef.current[k] = el; };

  return (
    <div className={`lp${ready ? ' is-ready' : ''}${noGL ? ' no-gl' : ''}`}>
      <canvas ref={canvasRef} className="lp-canvas" aria-hidden="true" />
      <div className="lp-vignette" aria-hidden="true" />

      <div className={`lp-loader${ready ? ' is-done' : ''}`} aria-hidden="true">
        <span className="lp-loader__label">Loading the sheet</span>
        <span className="lp-loader__count">{count}</span>
      </div>

      <header className={`lp-nav${scrolled ? ' is-scrolled' : ''}`}>
        <a className="lp-brand" href="#/" onClick={(e) => { e.preventDefault(); go('top'); }}>
          <LogoMark size={24} /> <span>Excel Suite</span>
        </a>
        <nav className="lp-links" aria-label="Sections">
          <button type="button" onClick={() => go('compare')}>Compare<small>Two files in</small></button>
          <button type="button" onClick={() => go('clean')}>Clean<small>One file, put right</small></button>
          <button type="button" onClick={() => go('local')}>Private<small>Runs on your machine</small></button>
        </nav>
        <FormulaBar stop={STOPS[active] ?? HERO} />
        <button type="button" className="lp-cta" onClick={onGetStarted}>Open the app</button>
      </header>

      <main className="lp-main">
        <section id="lp-top" ref={ref(0)} className={`lp-ch lp-ch--hero${ready ? ' is-shown' : ''}`}>
          <div className="lp-ch__inner">
            <p className="lp-kicker lp-fade" style={{ '--i': 0 }}>A workbench for Excel and CSV files</p>
            <h1 className="lp-big">
              <Line i={1}>Every row,</Line>
              <Line i={2}>accounted</Line>
              <Line i={3}>for.</Line>
            </h1>
            <p className="lp-about lp-fade" style={{ '--i': 4 }}>
              Compare, clean and reshape spreadsheets with ten tools that run entirely in your browser. Your files are read
              on your machine and never uploaded.
            </p>
            <div className="lp-actions lp-fade" style={{ '--i': 5 }}>
              <button type="button" className="lp-btn" onClick={onGetStarted}>Open a file</button>
              <button type="button" className="lp-btn lp-btn--ghost" onClick={() => go('compare')}>See the ten tools</button>
            </div>
          </div>
          <span className="lp-scroll lp-fade" style={{ '--i': 6 }} aria-hidden="true">Scroll</span>
        </section>

        {CHAPTERS.map((c, n) => {
          const k = n + 1;
          if (c.kind === 'title') {
            return (
              <section key={k} id={`lp-${c.id}`} ref={ref(k)} className={`lp-ch lp-ch--title pos-${c.pos}`}>
                <div className="lp-ch__inner">
                  <p className="lp-ref lp-fade">{c.ref}</p>
                  <h2 className="lp-mid"><Line i={1}>{c.title}</Line></h2>
                  <p className="lp-about lp-fade" style={{ '--i': 2 }}>{c.text}</p>
                </div>
              </section>
            );
          }
          if (c.kind === 'word') {
            return (
              <section key={k} ref={ref(k)} className={`lp-ch lp-ch--word pos-${c.pos}`}>
                <div className="lp-ch__inner">
                  <p className="lp-idx lp-fade"><span className="lp-idx__cell">{c.ref}</span>{c.index}</p>
                  <p className="lp-big lp-big--word"><Line i={1}>{c.word}</Line></p>
                  <h3 className="lp-name lp-fade" style={{ '--i': 2 }}>{c.name}</h3>
                  <p className="lp-line lp-fade" style={{ '--i': 3 }}>{c.text}</p>
                  <div className="lp-fade" style={{ '--i': 4 }}><Stats items={c.stats} /></div>
                </div>
              </section>
            );
          }
          if (c.kind === 'limit') {
            return (
              <section key={k} id={`lp-${c.id}`} ref={ref(k)} className="lp-ch lp-ch--limit">
                <div className="lp-ch__inner">
                  <h2 className="lp-mid lp-mid--lines">
                    {c.lines.map((l, i) => <Line key={l} i={i}>{l}</Line>)}
                  </h2>
                  <div className="lp-fade" style={{ '--i': 5 }}><Stats items={c.stats} big /></div>
                </div>
              </section>
            );
          }
          return (
            <section
              key={k}
              id={`lp-${c.id}`}
              ref={ref(k)}
              className="lp-ch lp-ch--turn"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            >
              <div className="lp-ch__inner">
                <p className="lp-ref lp-fade">{c.ref}</p>
                <h2 className="lp-mid"><Line i={1}>{c.title}</Line></h2>
                <p className="lp-about lp-fade" style={{ '--i': 2 }}>{c.text}</p>
                <p className="lp-drag lp-fade" style={{ '--i': 3 }} aria-hidden="true"><span>&larr;</span> drag <span>&rarr;</span></p>
              </div>
            </section>
          );
        })}

        <section ref={ref(STOPS.length - 1)} className="lp-ch lp-ch--close">
          <div className="lp-ch__inner">
            <h2 className="lp-big"><Line i={0}>Open a</Line><Line i={1}>spreadsheet.</Line></h2>
            <div className="lp-actions lp-fade" style={{ '--i': 2 }}>
              <button type="button" className="lp-btn" onClick={onGetStarted}>Open the app</button>
              <span className="lp-note">No sign-up, nothing to install, nothing uploaded.</span>
            </div>
          </div>
          <footer className="lp-foot">
            <span className="lp-brand"><LogoMark size={24} /> Excel Suite</span>
            <span>Every file is read in your browser and never leaves your device.</span>
            <span className="lp-foot__mono">10 tools &middot; .xlsx .xls .csv</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
