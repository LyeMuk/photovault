import { Button } from "react-bootstrap";
import { IconAlertCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-5 px-3">
      <IconAlertCircle size={32} className="text-danger mb-2" />
      <p className="text-danger mb-3">{message}</p>
      {onRetry && (
        <Button variant="outline-danger" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
