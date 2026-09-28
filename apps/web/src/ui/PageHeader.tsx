import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

// Every screen uses the same PageHeader (docs/CONTEXT.md §11.1 rule 3):
// title, subtitle, primary action on the right.
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="d-flex align-items-start justify-content-between px-3 pt-3 pb-2">
      <div>
        <h1 className="h3 mb-0">{title}</h1>
        {subtitle && <p className="text-secondary mb-0 small">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
