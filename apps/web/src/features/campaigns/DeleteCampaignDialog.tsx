import { useEffect, useRef, useState } from "react";
import { Icon } from "../../lib/Icon";

export function DeleteCampaignDialog({
  campaignTitle,
  onClose,
  onDelete,
}: {
  campaignTitle: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  async function submit() {
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar la campaña.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <dialog
      className="campaign-dialog archive-dialog"
      ref={dialogRef}
      aria-labelledby="delete-campaign-title"
      onCancel={(event) => { event.preventDefault(); if (!isDeleting) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !isDeleting) onClose(); }}
    >
      <div className="dialog-topline">
        <span className="dialog-mark archive-mark"><Icon name="close" size={19} /></span>
        <button className="icon-button dialog-close" type="button" onClick={onClose} disabled={isDeleting} aria-label="Cerrar">
          <Icon name="close" size={19} />
        </button>
      </div>
      <p className="eyebrow">ELIMINAR CAMPAÑA ARCHIVADA</p>
      <h2 id="delete-campaign-title">Esta acción es permanente</h2>
      <p className="dialog-intro">
        Se eliminarán la campaña, sus miembros y sus invitaciones. Escribe <strong>{campaignTitle}</strong> para confirmar.
      </p>
      <label className="form-label" htmlFor="delete-campaign-confirmation">Nombre de la campaña</label>
      <input
        className="auth-input"
        id="delete-campaign-confirmation"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
        disabled={isDeleting}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button className="button button-secondary" type="button" onClick={onClose} disabled={isDeleting}>Cancelar</button>
        <button className="button button-danger" type="button" onClick={() => void submit()} disabled={isDeleting || confirmation.trim() !== campaignTitle}>
          {isDeleting ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
      </div>
    </dialog>
  );
}
