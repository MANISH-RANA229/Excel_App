import { GitCompareArrows } from 'lucide-react';
import DiffCheck from './diffcheck/DiffCheck.jsx';

// Tool registry: add a folder under features/ and one entry here.
export const tools = [
  {
    id: 'diffcheck',
    title: 'Diff Check',
    description: 'Compare one column from each file word by word. Finds the best matching row in Excel 2 for every row in Excel 1, with a match % and colour-coded result file.',
    icon: GitCompareArrows,
    Component: DiffCheck,
  },
];
