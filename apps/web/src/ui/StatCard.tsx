import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <div className="card">
      <div className="card-body d-flex align-items-center gap-3">
        {icon && <div className="text-primary">{icon}</div>}
        <div>
          <div className="text-secondary small">{label}</div>
          <div className="h3 mb-0">{value}</div>
          {hint && <div className="text-secondary small">{hint}</div>}
        </div>
      </div>
    </div>
  );
}
