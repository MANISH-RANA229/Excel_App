// The only thing this app ever stores in the browser: whether the user ticked "Don't show this again" on the welcome note.
// Never any file, cell or result. safety.check.js allows localStorage in this file and nowhere else.
const KEY = 'excel-suite:welcome-dismissed';

export function welcomeDismissed() {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false; // storage blocked (private window, policy): the note simply shows each visit
  }
}

export function dismissWelcome() {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    /* blocked: nothing to do, the note shows again next visit */
  }
}
