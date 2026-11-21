import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../lib/Icon";
import type {
  Campaign,
  CampaignIcon,
  CampaignSaveInput,
  CampaignThemeColor,
} from "./campaign.types";

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
  const [initialLevel, setInitialLevel] = useState(campaign?.initialLevel ?? 1);
  const [themeColor, setThemeColor] = useState<CampaignThemeColor>(campaign?.themeColor ?? "GOLD");
  const [icon, setIcon] = useState<CampaignIcon>(campaign?.icon ?? "SUN");
  const [tags, setTags] = useState(campaign?.tags.join(", ") ?? "");
  const [playerCanViewDescription, setPlayerCanViewDescription] = useState(
    campaign?.playerCanViewDescription ?? true,
  );
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
          initialLevel,
          themeColor,
          icon,
          tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          playerCanViewDescription,
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
          maxLength={80}
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
        <label className="form-label" htmlFor="campaign-initial-level">
          Nivel inicial
        </label>
        <input
          id="campaign-initial-level"
          type="number"
          min={1}
          max={20}
          value={initialLevel}
          disabled={isSubmitting}
          onChange={(event) => setInitialLevel(Number(event.target.value))}
          required
        />
        <div className="campaign-settings-row">
          <label className="form-label" htmlFor="campaign-theme-color">Color</label>
          <select
            id="campaign-theme-color"
            value={themeColor}
            disabled={isSubmitting}
            onChange={(event) => setThemeColor(event.target.value as CampaignThemeColor)}
          >
            <option value="GOLD">Dorado</option>
            <option value="BLUE">Azul</option>
            <option value="SAGE">Salvia</option>
            <option value="ROSE">Rosa</option>
            <option value="VIOLET">Violeta</option>
          </select>
          <label className="form-label" htmlFor="campaign-icon">Icono</label>
          <select
            id="campaign-icon"
            value={icon}
            disabled={isSubmitting}
            onChange={(event) => setIcon(event.target.value as CampaignIcon)}
          >
            <option value="SUN">☼ Sol</option>
            <option value="WAVE">≈ Ola</option>
            <option value="TOWER">♜ Torre</option>
            <option value="MOON">☾ Luna</option>
            <option value="STAR">✦ Estrella</option>
          </select>
        </div>
        <label className="form-label" htmlFor="campaign-tags">
          Etiquetas <span>Separadas por comas · hasta 8</span>
        </label>
        <input
          id="campaign-tags"
          maxLength={240}
          value={tags}
          disabled={isSubmitting}
          onChange={(event) => setTags(event.target.value)}
          placeholder="Fantasía, intriga, semanal"
        />
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
              {campaign.statusCode === "ARCHIVED" && <option value="ARCHIVED" disabled>Archivada</option>}
              <option value="ACTIVE">Activa</option>
              <option value="PAUSED">En pausa</option>
              <option value="FINISHED">Finalizada</option>
            </select>
          </>
        )}
        <label className="form-label" htmlFor="campaign-description">
          Una breve descripción <span>Opcional</span>
        </label>
        <textarea
          id="campaign-description"
          rows={3}
          maxLength={500}
          disabled={isSubmitting}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="¿Qué aventura espera a tu grupo?"
        />
        <label className="campaign-visibility-toggle">
          <input
            type="checkbox"
            checked={playerCanViewDescription}
            disabled={isSubmitting}
            onChange={(event) => setPlayerCanViewDescription(event.target.checked)}
          />
          <span>
            <strong>Mostrar descripción a los jugadores</strong>
            <small>El acceso a la campaña sigue limitado a sus miembros.</small>
          </span>
        </label>
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
