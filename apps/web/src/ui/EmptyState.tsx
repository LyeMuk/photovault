import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-5 px-3">
      {icon && <div className="text-secondary mb-3">{icon}</div>}
      <h3 className="h5">{title}</h3>
      {description && <p className="text-secondary">{description}</p>}
      {action}
    </div>
  );
}
