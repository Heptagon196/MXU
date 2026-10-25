import { type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/** Matches MXU's expandable task-settings cards. Native details preserves keyboard support. */
export function CollapsibleSection({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details
      open={open}
      className="group rounded-xl border border-border bg-bg-secondary overflow-hidden"
    >
      <summary className="list-none cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3 hover:bg-bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        <ChevronRight
          aria-hidden="true"
          className="w-4 h-4 shrink-0 text-text-secondary transition-transform duration-200 group-open:rotate-90"
        />
      </summary>
      <div className="px-4 pb-4 pt-2">{children}</div>
    </details>
  );
}
