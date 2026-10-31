import { getBand } from './bands.js';

export default function BandTag({ pct }) {
  const band = getBand(pct);
  return (
    <span className="band-tag" style={{ background: band.bg, color: band.fg }} title={band.label}>
      <strong>{pct}%</strong>
      <span>{band.label}</span>
    </span>
  );
}
