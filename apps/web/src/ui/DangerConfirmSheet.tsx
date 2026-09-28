import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export interface DangerConfirmSheetProps {
  show: boolean;
  title: string;
  body: React.ReactNode;
  /** The exact phrase the user must type, e.g. "DELETE 42". */
  requiredPhrase: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// The red, typed-confirmation dialog for permanent/irreversible actions (docs/CONTEXT.md
// §7.4: "Permanent (MTP etc.): a red dialog... the user must type DELETE <count>").
export function DangerConfirmSheet({
  show,
  title,
  body,
  requiredPhrase,
  onConfirm,
  onCancel,
}: DangerConfirmSheetProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState("");
  const canConfirm = typed === requiredPhrase;

  return (
    <Modal show={show} onHide={onCancel} centered onExited={() => setTyped("")}>
      <Modal.Header closeButton className="border-danger">
        <Modal.Title className="text-danger d-flex align-items-center gap-2">
          <IconAlertTriangle size={20} /> {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {body}
        <Form.Group className="mt-3">
          <Form.Label>
            Type <code>{requiredPhrase}</code> to confirm
          </Form.Label>
          <Form.Control value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button variant="danger" disabled={!canConfirm} onClick={onConfirm}>
          {title}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
