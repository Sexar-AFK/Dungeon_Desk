import { useEffect, useRef, useState } from "react";
import { Icon } from "../../lib/Icon";

/** Confirms the non-destructive archive action and reports API failures. */
export function ArchiveCampaignDialog({
  campaignTitle,
  onClose,
  onArchive,
}: {
  campaignTitle: string;
  onClose: () => void;
  onArchive: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  async function handleArchive() {
    setIsArchiving(true);
    setError(null);
    try {
      await onArchive();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo archivar la campaña.",
      );
    } finally {
      setIsArchiving(false);
    }
  }

  return (
    <dialog
      className="campaign-dialog archive-dialog"
      ref={dialogRef}
      aria-labelledby="archive-dialog-title"
      aria-describedby="archive-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!isArchiving) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isArchiving) onClose();
      }}
    >
      <div className="dialog-topline">
        <span className="dialog-mark archive-mark">
          <Icon name="scroll" size={19} />
        </span>
        <button
          className="icon-button dialog-close"
          type="button"
          onClick={onClose}
          disabled={isArchiving}
          aria-label="Cerrar"
        >
          <Icon name="close" size={19} />
        </button>
      </div>
      <p className="eyebrow">ARCHIVAR CAMPAÑA</p>
      <h2 id="archive-dialog-title">¿Guardar esta aventura?</h2>
      <p className="dialog-intro" id="archive-dialog-description">
        <strong>{campaignTitle}</strong> dejará de aparecer entre las campañas
        activas. Sus datos se conservarán y podrás encontrarla en Archivadas.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onClose}
          disabled={isArchiving}
        >
          Cancelar
        </button>
        <button
          className="button button-danger"
          type="button"
          onClick={handleArchive}
          disabled={isArchiving}
        >
          {isArchiving ? "Archivando…" : "Archivar"}
        </button>
      </div>
    </dialog>
  );
}
