import { useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { FileSpreadsheet } from 'lucide-react';

/**
 * For tools that work on ONE file: which of the loaded files to use (defaults to the first loaded).
 * const source = useSource(datasets);  source.dataset → the chosen Dataset
 */
export function useSource(datasets) {
  const options = datasets.flatMap((d, i) => (d ? [{ index: i, label: `Excel ${i + 1} · ${d.fileName}` }] : []));
  const [index, setIndex] = useState(options[0]?.index ?? 0);
  const current = datasets[index] ? index : options[0]?.index ?? 0;
  return { dataset: datasets[current], index: current, setIndex, options };
}

/** Shows the file being used; a dropdown only when both files are loaded. */
export default function SourcePicker({ source, label = 'File to use' }) {
  if (source.options.length < 2) {
    return (
      <div className="source-chip">
        <FileSpreadsheet size={16} className="text-brand" aria-hidden="true" />
        <span className="clip">{source.options[0]?.label}</span>
        <span className="muted">· {source.dataset.rowCount.toLocaleString()} rows</span>
      </div>
    );
  }
  return (
    <label className="field">
      <span>{label}</span>
      <Dropdown value={source.index} options={source.options} optionLabel="label" optionValue="index" onChange={(e) => source.setIndex(e.value)} className="w-full" />
    </label>
  );
}
