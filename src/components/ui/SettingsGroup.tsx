import type { ReactNode } from 'react';

/** MXU section heading and card, retaining native form grouping/disabled semantics. */
export function SettingsGroup({
  title,
  disabled,
  children,
}: {
  title: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="text-sm font-semibold text-text-primary uppercase tracking-wider">
        {title}
      </legend>
      <div className="rounded-xl border border-border bg-bg-secondary p-4">{children}</div>
    </fieldset>
  );
}
