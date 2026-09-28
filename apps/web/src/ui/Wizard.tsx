import type { ReactNode } from "react";

export interface WizardStep {
  label: string;
  content: ReactNode;
}

export interface WizardProps {
  steps: WizardStep[];
  activeIndex: number;
}

// A Tabler-style step indicator (docs/CONTEXT.md §11.2: "Backup wizard: Sources →
// Filters → Options → Review → Run", "Restore wizard: ..."). Screens own the
// active-step state and navigation buttons; this only renders the indicator + panel.
export function Wizard({ steps, activeIndex }: WizardProps) {
  return (
    <div>
      <div className="d-flex mb-3">
        {steps.map((step, i) => (
          <div key={step.label} className="flex-fill text-center position-relative">
            <div
              className={`mx-auto rounded-circle d-flex align-items-center justify-content-center ${
                i <= activeIndex ? "bg-primary text-white" : "bg-secondary-subtle text-secondary"
              }`}
              style={{ width: 28, height: 28, fontSize: 13 }}
            >
              {i + 1}
            </div>
            <div className="small mt-1 text-truncate px-1">{step.label}</div>
            {i < steps.length - 1 && (
              <div
                className={`position-absolute top-0 start-50 ${i < activeIndex ? "bg-primary" : "bg-secondary-subtle"}`}
                style={{ height: 2, width: "100%", marginTop: 13, zIndex: -1 }}
              />
            )}
          </div>
        ))}
      </div>
      <div>{steps[activeIndex]?.content}</div>
    </div>
  );
}
