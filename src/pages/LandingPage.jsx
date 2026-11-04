import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  FileSpreadsheet,
  GitCompareArrows,
  Search,
  Sparkles,
  Zap,
  Shield,
  BarChart3,
  Table2,
  SplitSquareVertical,
  Columns3,
  FilePlus2,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Lock,
  Globe,
  Cpu,
  MousePointerClick,
  Menu,
  X,
} from 'lucide-react';

import heroImg from '../assets/hero.jpg';
import cleaningImg from '../assets/cleaning.jpg';
import comparisonImg from '../assets/comparison.jpg';

// ── Inline SVG illustration ──────────

function HeroIllustration() {
  return (
    <svg viewBox="0 0 600 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="landing__hero-svg" aria-hidden="true">
      <defs>
        <linearGradient id="hg1" x1="0" y1="0" x2="600" y2="400" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F172A" />
          <stop offset="1" stopColor="#185C37" />
        </linearGradient>
        <linearGradient id="hg2" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#107C41" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="600" height="400" rx="7" fill="url(#hg1)" />
      {[80, 160, 240, 320, 400, 480].map((x) => <line key={`v${x}`} x1={x} y1="30" x2={x} y2="370" stroke="#107C41" strokeOpacity="0.12" strokeWidth="1" />)}
      {[80, 140, 200, 260, 320].map((y) => <line key={`h${y}`} x1="30" y1={y} x2="570" y2={y} stroke="#107C41" strokeOpacity="0.12" strokeWidth="1" />)}
      <g filter="url(#glow)">
        <rect x="60" y="70" width="200" height="180" rx="7" fill="#1E293B" stroke="#107C41" strokeWidth="1.5" fillOpacity="0.85" />
        <rect x="60" y="70" width="200" height="32" rx="7" fill="#107C41" fillOpacity="0.25" />
        <text x="90" y="91" fill="#34d399" fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif">Excel 1</text>
        {[110, 134, 158, 182, 206].map((y, i) => (
          <g key={y}>
            <rect x="75" y={y} width="60" height="16" rx="3" fill="#107C41" fillOpacity={0.15 + i * 0.04} />
            <rect x="145" y={y} width="50" height="16" rx="3" fill="#475569" fillOpacity="0.3" />
            <rect x="205" y={y} width="40" height="16" rx="3" fill="#475569" fillOpacity="0.2" />
          </g>
        ))}
      </g>
      <g filter="url(#glow)">
        <rect x="340" y="100" width="200" height="180" rx="7" fill="#1E293B" stroke="#107C41" strokeWidth="1.5" fillOpacity="0.85" />
        <rect x="340" y="100" width="200" height="32" rx="7" fill="#107C41" fillOpacity="0.25" />
        <text x="370" y="121" fill="#34d399" fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif">Excel 2</text>
        {[140, 164, 188, 212, 236].map((y, i) => (
          <g key={y}>
            <rect x="355" y={y} width="55" height="16" rx="3" fill="#107C41" fillOpacity={0.2 + i * 0.03} />
            <rect x="420" y={y} width="50" height="16" rx="3" fill="#475569" fillOpacity="0.3" />
            <rect x="480" y={y} width="45" height="16" rx="3" fill="#475569" fillOpacity="0.2" />
          </g>
        ))}
      </g>
      {[[260, 118, 340, 148], [260, 142, 340, 172], [260, 166, 340, 196], [260, 190, 340, 220]].map(([x1, y1, x2, y2], i) => (
        <path key={i} d={`M${x1},${y1} C${x1 + 40},${y1} ${x2 - 40},${y2} ${x2},${y2}`} stroke="url(#hg2)" strokeWidth="1.5" strokeDasharray="4 3" opacity={0.5 + i * 0.12}>
          <animate attributeName="stroke-dashoffset" from="14" to="0" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
        </path>
      ))}
      <g filter="url(#glow)">
        <rect x="275" y="130" width="50" height="22" rx="7" fill="#107C41" />
        <text x="300" y="145" fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="Inter, sans-serif">92%</text>
      </g>
      <g filter="url(#glow)">
        <rect x="275" y="175" width="50" height="22" rx="7" fill="#D97706" />
        <text x="300" y="190" fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="Inter, sans-serif">67%</text>
      </g>
      <g filter="url(#glow)">
        <rect x="120" y="300" width="360" height="50" rx="7" fill="#1E293B" stroke="#107C41" strokeWidth="1" fillOpacity="0.9" />
        <text x="140" y="330" fill="#34d399" fontSize="12" fontWeight="600" fontFamily="Inter, sans-serif">✓ 4,892 Matched</text>
        <text x="290" y="330" fill="#FDE68A" fontSize="12" fontWeight="600" fontFamily="Inter, sans-serif">⚠ 31 Ambiguous</text>
        <text x="430" y="330" fill="#F87171" fontSize="12" fontWeight="600" fontFamily="Inter, sans-serif">✗ 12 Missing</text>
      </g>
      {[[50, 350, 2], [150, 30, 1.5], [520, 50, 2.5], [560, 360, 1.8], [300, 60, 1.2], [30, 200, 1]].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#34d399" opacity="0.5">
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

// ── Data ──────────

const TOOLS = [
  { icon: GitCompareArrows, title: 'Diff Check', desc: 'Find the best match in Excel 2 for every row in Excel 1 with word-based scoring.', color: '#107C41' },
  { icon: Search, title: 'Fuzzy Lookup', desc: 'VLOOKUP that tolerates typos — pull reference columns with confidence scores.', color: '#0284C7' },
  { icon: Table2, title: 'Compare by Key', desc: 'Side-by-side old vs. new by an ID column: see every added, removed & changed cell.', color: '#7C3AED' },
  { icon: BarChart3, title: 'Reconcile', desc: 'Match ledger vs. bank by reference, amount & date — line-by-line or by totals.', color: '#D97706' },
  { icon: Sparkles, title: 'Duplicate Finder', desc: 'Exact or fuzzy duplicate groups with keep-rules and one-click cleaning.', color: '#EC4899' },
  { icon: Zap, title: 'Data Cleaner', desc: 'Trim, fix text→number/date, change case, replace, fill blanks — all in ordered steps.', color: '#14B8A6' },
  { icon: SplitSquareVertical, title: 'Split by Column', desc: 'One file per value — download as a ZIP or a multi-sheet workbook.', color: '#F97316' },
  { icon: Calculator, title: 'Column Builder', desc: 'Add formula-free calculated columns: text, numbers, dates, IF rules, ranks.', color: '#6366F1' },
  { icon: FilePlus2, title: 'Combine Files', desc: 'Stack many files & sheets into one — columns matched by header name.', color: '#0EA5E9' },
  { icon: Columns3, title: 'Summarize', desc: 'Group & total, pivot, unpivot, or transpose — no formulas needed.', color: '#84CC16' },
];

const STEPS = [
  { num: '01', title: 'Upload your files', desc: 'Drag & drop .xlsx, .xls, or .csv files. Everything stays in your browser.', icon: FilePlus2 },
  { num: '02', title: 'Pick a tool', desc: 'Choose from 10 powerful tools — compare, clean, organize, or transform.', icon: MousePointerClick },
  { num: '03', title: 'Preview & download', desc: 'See results instantly in a live grid, then download a color-coded .xlsx.', icon: CheckCircle2 },
];

const TRUST = [
  { icon: Lock, title: '100% Private', desc: 'Files never leave your device. Zero uploads, zero tracking, zero accounts.' },
  { icon: Globe, title: 'Works Anywhere', desc: 'A browser is all you need. No install, no plugins — works on any OS.' },
  { icon: Cpu, title: 'Built for Scale', desc: 'Handles 500,000+ rows with Web Workers, typed arrays, and streaming exports.' },
];

// ── Scroll-reveal hook (direction variants) ──────────

function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/** direction: 'up' (default) | 'left' | 'right' | 'scale' | 'fade' */
function Reveal({ children, delay = 0, direction = 'up', className = '' }) {
  const [ref, visible] = useReveal();
  const cls = `reveal reveal--${direction}${visible ? ' is-visible' : ''}${className ? ' ' + className : ''}`;
  return (
    <div ref={ref} className={cls} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ── Parallax hook (scroll-speed multiplier) ──────────

function useParallax(speed = 0.15) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf;
    const onScroll = () => {
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const viewCenter = window.innerHeight / 2;
        const offset = (center - viewCenter) * speed;
        el.style.transform = `translateY(${offset}px)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [speed]);
  return ref;
}

// ── Counter animation hook ──────────

function CountUp({ end, suffix = '', duration = 1800 }) {
  const [ref, visible] = useReveal(0.3);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!visible || started.current) return;
    started.current = true;
    const num = typeof end === 'number' ? end : parseInt(end.replace(/[^0-9]/g, ''), 10) || 0;
    if (num === 0) { setValue(0); return; }
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * num));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [visible, end, duration]);

  return <strong ref={ref}>{value.toLocaleString()}{suffix}</strong>;
}

// ── Tilt-on-hover for cards (desktop only) ──────────

function useTilt() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(pointer: coarse)').matches) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
    };
    const onLeave = () => { el.style.transform = ''; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, []);
  return ref;
}

function TiltCard({ children, className }) {
  const tilt = useTilt();
  return <div ref={tilt} className={className}>{children}</div>;
}

// ── scroll-progress bar at top ──────────

function ScrollProgress() {
  const ref = useRef(null);
  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = total > 0 ? (window.scrollY / total) * 100 : 0;
      if (ref.current) ref.current.style.width = `${pct}%`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div className="landing__scroll-progress" ref={ref} />;
}

// ── Horizontal marquee for tool names ──────────

function ToolMarquee() {
  return (
    <div className="landing__marquee" aria-hidden="true">
      <div className="landing__marquee-track">
        {[...TOOLS, ...TOOLS].map((t, i) => (
          <span key={i} className="landing__marquee-item">
            <t.icon size={16} />
            {t.title}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── helpers ──────────

function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── LandingPage ──────────

export default function LandingPage({ onGetStarted }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on resize past breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const onChange = (e) => { if (e.matches) setMobileMenu(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenu ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenu]);

  const navAction = useCallback((id) => {
    setMobileMenu(false);
    scrollTo(id);
  }, []);

  const parallaxHero = useParallax(0.08);
  const parallaxImg1 = useParallax(-0.06);
  const parallaxImg2 = useParallax(0.05);

  return (
    <div className="landing">
      <ScrollProgress />

      {/* ── Sticky navbar ── */}
      <header className={`landing__nav${scrolled ? ' is-scrolled' : ''}${mobileMenu ? ' menu-open' : ''}`}>
        <a className="landing__logo" href="#/" aria-label="Excel Suite home">
          <FileSpreadsheet size={22} />
          <span>Excel Suite</span>
          <span className="landing__pro-chip">PRO</span>
        </a>
        <nav className={`landing__nav-links${mobileMenu ? ' is-open' : ''}`}>
          <button type="button" onClick={() => navAction('landing-features')}>Features</button>
          <button type="button" onClick={() => navAction('landing-how')}>How it works</button>
          <button type="button" onClick={() => navAction('landing-trust')}>Security</button>
          <button type="button" className="landing__nav-cta landing__nav-cta--mobile" onClick={() => { setMobileMenu(false); onGetStarted(); }}>
            Get Started <ArrowRight size={16} />
          </button>
        </nav>
        <button type="button" className="landing__nav-cta landing__nav-cta--desktop" onClick={onGetStarted}>
          Get Started <ArrowRight size={16} />
        </button>
        <button
          type="button"
          className="landing__hamburger"
          onClick={() => setMobileMenu((v) => !v)}
          aria-label={mobileMenu ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenu}
        >
          {mobileMenu ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile menu backdrop */}
      {mobileMenu && <div className="landing__menu-backdrop" onClick={() => setMobileMenu(false)} aria-hidden="true" />}

      {/* ── Hero ── */}
      <section className="landing__hero">
        <div className="landing__hero-bg" aria-hidden="true">
          {/* Floating orbs (parallax) */}
          <div className="landing__orb landing__orb--1" />
          <div className="landing__orb landing__orb--2" />
          <div className="landing__orb landing__orb--3" />
        </div>
        <div className="landing__hero-content">
          <div className="landing__hero-text">
            <Reveal direction="fade" delay={100}>
              <span className="landing__pill">
                <Shield size={14} /> 100% browser-based · No uploads ever
              </span>
            </Reveal>
            <Reveal delay={200}>
              <h1>
                The <span className="landing__gradient-text">smartest</span> way to<br />
                compare, clean &amp; organize<br />
                your spreadsheets
              </h1>
            </Reveal>
            <Reveal delay={350}>
              <p className="landing__hero-sub">
                10 powerful tools for Excel &amp; CSV — fuzzy matching, diff checks, reconciliation,
                deduplication, and more. Everything runs locally in your browser. Your files never leave your device.
              </p>
            </Reveal>
            <Reveal delay={450}>
              <div className="landing__hero-actions">
                <button type="button" className="landing__btn-primary landing__btn-pulse" onClick={onGetStarted}>
                  Get Started — It's Free
                  <ArrowRight size={18} />
                </button>
                <button type="button" className="landing__btn-ghost" onClick={() => scrollTo('landing-features')}>
                  Explore Features
                  <ChevronRight size={18} />
                </button>
              </div>
            </Reveal>
            <Reveal delay={550}>
              <div className="landing__hero-stats">
                <div><CountUp end={10} /><span>Powerful tools</span></div>
                <div><CountUp end={500} suffix="K+" /><span>Rows supported</span></div>
                <div><CountUp end={0} /><span>Data uploaded</span></div>
              </div>
            </Reveal>
          </div>
          <div className="landing__hero-visual" ref={parallaxHero}>
            <img src={heroImg} alt="Excel Suite — compare, merge and clean spreadsheets" className="landing__hero-img" />
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <ToolMarquee />

      {/* ── Tools / features ── */}
      <section className="landing__section" id="landing-features">
        <Reveal>
          <span className="landing__section-chip">Features</span>
          <h2 className="landing__section-title">Everything you need in one suite</h2>
          <p className="landing__section-sub">
            From fuzzy matching to reconciliation, from data cleaning to custom columns — 10 purpose-built tools that replace hours of manual work.
          </p>
        </Reveal>
        <div className="landing__tools-grid">
          {TOOLS.map((t, i) => (
            <Reveal key={t.title} delay={i * 60} direction={i % 2 === 0 ? 'up' : 'scale'}>
              <TiltCard className="landing__tool-card">
                <div className="landing__tool-icon" style={{ background: `${t.color}14`, color: t.color }}>
                  <t.icon size={22} />
                </div>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Visual showcases ── */}
      <section className="landing__showcase">
        <div className="landing__showcase-row">
          <Reveal direction="left" className="landing__showcase-text">
            <div>
              <span className="landing__section-chip">Compare &amp; Match</span>
              <h2>Find every match, catch every difference</h2>
              <p>
                Fuzzy matching powered by TF-IDF word vectors finds the best matches between your files — 
                even with typos and inconsistencies. See confidence scores, highlighted word diffs, and
                export color-coded results.
              </p>
              <ul className="landing__check-list">
                <li><CheckCircle2 size={16} /> Word-based percentage scoring</li>
                <li><CheckCircle2 size={16} /> Typo-tolerant fuzzy matching</li>
                <li><CheckCircle2 size={16} /> Side-by-side highlighted differences</li>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={150} direction="right" className="landing__showcase-img-wrap">
            <div ref={parallaxImg1}>
              <img src={comparisonImg} alt="File comparison with match percentages" className="landing__showcase-img" />
            </div>
          </Reveal>
        </div>
        <div className="landing__showcase-row landing__showcase-row--reverse">
          <Reveal direction="right" className="landing__showcase-text">
            <div>
              <span className="landing__section-chip">Clean &amp; Transform</span>
              <h2>Messy data in, clean data out</h2>
              <p>
                Automated issue detection suggests fixes before you even ask. Trim spaces, convert
                text to numbers and dates, standardize case, fill blanks, remove duplicates — 
                all in configurable, ordered steps with a live preview.
              </p>
              <ul className="landing__check-list">
                <li><CheckCircle2 size={16} /> Smart issue scanner with suggestions</li>
                <li><CheckCircle2 size={16} /> Non-destructive: originals never touched</li>
                <li><CheckCircle2 size={16} /> Detailed change log in every download</li>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={150} direction="left" className="landing__showcase-img-wrap">
            <div ref={parallaxImg2}>
              <img src={cleaningImg} alt="Data cleaning and transformation pipeline" className="landing__showcase-img" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="landing__section landing__section--dark" id="landing-how">
        <Reveal>
          <span className="landing__section-chip">How it works</span>
          <h2 className="landing__section-title">Three steps. Zero complexity.</h2>
          <p className="landing__section-sub">
            No sign-ups, no installs, no learning curve. Upload, pick a tool, and download the result.
          </p>
        </Reveal>
        <div className="landing__steps">
          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i * 150} direction="scale">
              <div className="landing__step">
                <div className="landing__step-connector" aria-hidden="true" />
                <span className="landing__step-num">{s.num}</span>
                <div className="landing__step-icon"><s.icon size={28} /></div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Trust / security ── */}
      <section className="landing__section" id="landing-trust">
        <Reveal>
          <span className="landing__section-chip">Security &amp; Performance</span>
          <h2 className="landing__section-title">Built for trust. Built for speed.</h2>
          <p className="landing__section-sub">
            Your data is sacred. Excel Suite processes everything on your machine — nothing is ever sent to a server.
          </p>
        </Reveal>
        <div className="landing__trust-grid">
          {TRUST.map((t, i) => (
            <Reveal key={t.title} delay={i * 120} direction={i === 1 ? 'up' : i === 0 ? 'left' : 'right'}>
              <TiltCard className="landing__trust-card">
                <div className="landing__trust-icon"><t.icon size={26} /></div>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="landing__cta-section">
        <Reveal direction="scale">
          <div className="landing__cta-card">
            <h2>Ready to supercharge your spreadsheets?</h2>
            <p>No sign-up required. Your files stay on your device.</p>
            <button type="button" className="landing__btn-primary landing__btn-lg landing__btn-pulse" onClick={onGetStarted}>
              Launch Excel Suite
              <ArrowRight size={20} />
            </button>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="landing__footer">
        <div className="landing__footer-inner">
          <div className="landing__footer-brand">
            <FileSpreadsheet size={18} />
            <span>Excel Suite PRO</span>
          </div>
          <p>All processing happens in your browser. Files are never uploaded.</p>
        </div>
      </footer>
    </div>
  );
}
