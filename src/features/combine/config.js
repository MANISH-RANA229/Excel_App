export const defaultConfig = () => ({ onlyCommon: false, addFile: true, addSheet: true, addRow: false, overrides: {} });

/** Engine options. `loaded` = the sources that are read, in order; overrides are stored per source key. */
export const toOptions = (config, loaded) => ({
  onlyCommon: config.onlyCommon, addFile: config.addFile, addSheet: config.addSheet, addRow: config.addRow,
  overrides: loaded.map((s) => config.overrides[s.key] ?? {}),
});

/** The first thing the user still has to fix, or null when the settings can run. */
export function validate({ loaded, pending, plan }) {
  if (pending) return `${pending} file${pending === 1 ? ' is' : 's are'} still loading, failed to load, or ${pending === 1 ? 'has' : 'have'} no data rows. Wait, or remove ${pending === 1 ? 'it' : 'them'}.`;
  if (loaded < 2) return 'Add at least two files, or two sheets of one file.';
  if (!plan.targets.length) return 'These files have no column in common. Join the columns that mean the same thing below, or untick “Only columns found in every file”.';
  return null;
}

const quoted = (names, max = 4) => `${names.slice(0, max).map((n) => `“${n}”`).join(', ')}${names.length > max ? ` and ${names.length - max} more` : ''}`;

/** Things worth knowing about the combined result, as plain sentences (results page and Notes sheet). */
export function notesOf(stats) {
  const where = (s) => `${s.file}${s.sheet ? ` (${s.sheet})` : ''}`;
  return [
    ...stats.sources.filter((s) => s.missing.length).map((s) => `${where(s)} has no ${quoted(s.missing)}, so those cells are blank.`),
    ...stats.sources.filter((s) => s.dropped.length).map((s) => `${where(s)}: ${quoted(s.dropped)} left out because not every file has it.`),
    ...stats.mixedFormats.map((n) => `“${n}” has different number formats in different files; the first one is used.`),
    ...stats.mixedKinds.map((n) => `“${n}” is a number or date in some files and text in others.`),
  ];
}
