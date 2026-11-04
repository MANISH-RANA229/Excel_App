import { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from '../components/ui/index.js';
import { CloudOff, FileCheck, Laptop, Lock, SaveOff, Search, UserX } from 'lucide-react';
import { WELCOME } from '../pages/info/content.js';
import { dismissWelcome } from './welcomeSeen.js';

const ICONS = [CloudOff, UserX, SaveOff, FileCheck, Search]; // one per WELCOME.points entry, same order

/**
 * First thing a visitor sees: five promises about their data. Closing it (button, X, Esc) hides it for this visit;
 * ticking "Don't show this again" also remembers that one choice (welcomeSeen.js), never any data.
 */
export default function WelcomeModal({ visible, onClose, onLearnMore }) {
  const [never, setNever] = useState(false);
  const close = () => { if (never) dismissWelcome(); onClose(); };

  return (
    <Dialog
      visible={visible}
      onHide={close}
      modal
      draggable={false}
      resizable={false}
      className="welcome"
      style={{ width: 'min(520px, 94vw)' }}
      header={<span className="sr-only">Welcome to Excel Suite</span>} // the hero below is the visual title; the header only holds the close button
      footer={(
        <div className="welcome__foot">
          <label className="welcome__never">
            <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
            <span>
              {WELCOME.never}
              <small>{WELCOME.remember}</small>
            </span>
          </label>
          <div className="welcome__actions">
            <Button label="How it works" text severity="secondary" onClick={() => { close(); onLearnMore(); }} />
            <Button label="Got it" autoFocus onClick={close} />
          </div>
        </div>
      )}
    >
      <div className="welcome__body">
        <span className="welcome__hero" aria-hidden="true">
          <Laptop size={30} strokeWidth={1.75} />
          <span className="welcome__lock"><Lock size={12} strokeWidth={2.75} /></span>
        </span>
        <h2>{WELCOME.title}</h2>
        <p className="muted welcome__lead">{WELCOME.lead}</p>
        <ul className="welcome__points">
          {WELCOME.points.map(({ title, text }, i) => {
            const Icon = ICONS[i];
            return (
              <li key={title}>
                <span className="welcome__icon" aria-hidden="true"><Icon size={16} /></span>
                <span><strong>{title}.</strong> {text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
