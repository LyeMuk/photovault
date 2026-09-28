import { Toast, ToastContainer } from "react-bootstrap";
import { useToastStore } from "./toastStore";

// Renders the global toast queue (docs/CONTEXT.md §11.1 rule 4). Mount once, near
// the root of AppShell's consumer (App.tsx) — never per-screen.
export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <ToastContainer
      position="bottom-center"
      className="p-3"
      style={{ zIndex: 1080, marginBottom: "var(--pv-tab-bar-height)" }}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          bg={toast.variant}
          onClose={() => dismiss(toast.id)}
          autohide
          delay={4000}
        >
          <Toast.Body
            className={toast.variant === "warning" || toast.variant === "info" ? "" : "text-white"}
          >
            {toast.text}
          </Toast.Body>
        </Toast>
      ))}
    </ToastContainer>
  );
}
