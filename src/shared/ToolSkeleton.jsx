import JobProgress from './JobProgress.jsx';

/** Suspense fallback while a tool's code chunk loads. */
export default function ToolSkeleton({ title }) {
  return (
    <div className="page">
      <JobProgress title={`Opening ${title}`} progress={null} />
    </div>
  );
}
