import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../lib/Icon";
import type { Campaign, CampaignSaveInput } from "./campaign.types";

/** Native modal dialog; the browser handles focus trapping and Escape. */
export function CampaignDialog({
  onClose,
  onSave,
  campaign,
}: {
  onClose: () => void;
  onSave: (campaign: CampaignSaveInput) => Promise<void>;
  campaign?: Campaign;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(campaign?.title ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [edition, setEdition] = useState(campaign?.edition ?? "D&D 5e · 2014");
  const [status, setStatus] = useState(campaign?.statusCode ?? "ACTIVE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const focusFrame = requestAnimationFrame(() =>
      titleInputRef.current?.focus(),
    );
    return () => {
      cancelAnimationFrame(focusFrame);
      if (dialog?.open) dialog.close();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSave({
        title: cleanTitle,
        description: description.trim() || (campaign ? "" : undefined),
        edition,
        ...(campaign ? { status } : {}),
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo crear la campaña.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      className="campaign-dialog"
      ref={dialogRef}
      aria-labelledby="campaign-dialog-title"
      aria-describedby="campaign-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSubmitting) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="dialog-topline">
        <span className="dialog-mark">
          <Icon name="sparkles" size={19} />
        </span>
        <button
          className="icon-button dialog-close"
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Cerrar"
        >
          <Icon name="close" size={19} />
        </button>
      </div>
      <p className="eyebrow">
        {campaign ? "ACTUALIZA LOS DETALLES" : "EL COMIENZO DE ALGO GRANDE"}
      </p>
      <h2 id="campaign-dialog-title">
        {campaign ? "Edita tu campaña" : "Crea tu campaña"}
      </h2>
      <p className="dialog-intro" id="campaign-dialog-description">
        {campaign
          ? "Actualiza la información que ve tu mesa."
          : "Dale nombre a la aventura. Los detalles siempre pueden cambiar más adelante."}
      </p>
      <form className="campaign-form" onSubmit={handleSubmit}>
        <label className="form-label" htmlFor="campaign-title">
          Nombre de la campaña <span>Obligatorio</span>
        </label>
        <input
          ref={titleInputRef}
          id="campaign-title"
          maxLength={60}
          disabled={isSubmitting}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ej. Los secretos de Aguasprofundas"
          required
        />
        <label className="form-label" htmlFor="campaign-edition">
          Sistema y edición
        </label>
        <select
          id="campaign-edition"
          disabled={isSubmitting}
          value={edition}
          onChange={(event) => setEdition(event.target.value)}
        >
          <option>D&amp;D 5e · 2014</option>
          <option>D&amp;D 5e · 2024</option>
          <option>Otro sistema</option>
        </select>
        {campaign && (
          <>
            <label className="form-label" htmlFor="campaign-status">
              Estado
            </label>
            <select
              id="campaign-status"
              value={status}
              disabled={isSubmitting}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
            >
              <option value="ACTIVE">Activa</option>
              <option value="PAUSED">En pausa</option>
              <option value="FINISHED">Finalizada</option>
              <option value="ARCHIVED">Archivada</option>
            </select>
          </>
        )}
        <label className="form-label" htmlFor="campaign-description">
          Una breve descripción <span>Opcional</span>
        </label>
        <textarea
          id="campaign-description"
          rows={3}
          maxLength={180}
          disabled={isSubmitting}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="¿Qué aventura espera a tu grupo?"
        />
        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={isSubmitting}
          >
            <Icon name={isSubmitting ? "clock" : "plus"} size={16} />
            {isSubmitting
              ? "Guardando…"
              : campaign
                ? "Guardar cambios"
                : "Crear campaña"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
