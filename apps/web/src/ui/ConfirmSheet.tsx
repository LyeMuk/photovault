import { Button, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";

export interface ConfirmSheetProps {
  show: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// A recoverable-action confirmation (docs/CONTEXT.md §7.4: "Recoverable: a confirm
// dialog"). For permanent/destructive actions, use DangerConfirmSheet instead.
export function ConfirmSheet({
  show,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const { t } = useTranslation();
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{body}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          {confirmLabel ?? t("common.confirm")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
