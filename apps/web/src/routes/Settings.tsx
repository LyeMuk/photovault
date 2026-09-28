import { useState } from "react";
import { Form, ListGroup } from "react-bootstrap";
import { PageHeader } from "@/ui";

type ThemeChoice = "system" | "light" | "dark";

function applyTheme(choice: ThemeChoice) {
  if (choice === "system") {
    localStorage.removeItem("pv-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-bs-theme", prefersDark ? "dark" : "light");
  } else {
    localStorage.setItem("pv-theme", choice);
    document.documentElement.setAttribute("data-bs-theme", choice);
  }
}

// docs/CONTEXT.md §11.2 Settings screen. Only the theme toggle is wired up in
// Phase 0 — vault management, faces, LAN mode, etc. land with their own phases.
export default function Settings() {
  const [theme, setTheme] = useState<ThemeChoice>(
    () => (localStorage.getItem("pv-theme") as ThemeChoice | null) ?? "system",
  );

  const onChange = (choice: ThemeChoice) => {
    setTheme(choice);
    applyTheme(choice);
  };

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="px-3">
        <h3 className="h6 text-secondary text-uppercase">Appearance</h3>
        <ListGroup className="mb-4">
          {(["system", "light", "dark"] as const).map((choice) => (
            <ListGroup.Item key={choice}>
              <Form.Check
                type="radio"
                id={`theme-${choice}`}
                name="theme"
                label={choice[0].toUpperCase() + choice.slice(1)}
                checked={theme === choice}
                onChange={() => onChange(choice)}
              />
            </ListGroup.Item>
          ))}
        </ListGroup>

        <h3 className="h6 text-secondary text-uppercase">Coming later</h3>
        <ListGroup>
          <ListGroup.Item disabled>Vault management (Phase 1)</ListGroup.Item>
          <ListGroup.Item disabled>Faces on/off, delete all face data (Phase 5)</ListGroup.Item>
          <ListGroup.Item disabled>LAN mode (Phase 7)</ListGroup.Item>
        </ListGroup>
      </div>
    </div>
  );
}
