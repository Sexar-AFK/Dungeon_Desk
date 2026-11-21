import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import {
  inviteCampaignMember,
  listCampaignInvitations,
  listCampaignMembers,
  leaveCampaign,
  removeCampaignMember,
  revokeCampaignInvitation,
  transferCampaignOwnership,
  updateCampaignMemberRole,
} from "./campaignsApi";

export function CampaignMembersPanel({
  campaignId,
  currentUserId,
  ownerId,
}: {
  campaignId: string;
  currentUserId: string;
  ownerId: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const membersKey = ["campaign-members", campaignId] as const;
  const invitationsKey = ["campaign-invitations", campaignId] as const;
  const membersQuery = useQuery({
    queryKey: membersKey,
    queryFn: () => listCampaignMembers(campaignId),
  });
  const invitationsQuery = useQuery({
    queryKey: invitationsKey,
    queryFn: () => listCampaignInvitations(campaignId),
    enabled:
      membersQuery.data?.some(
        (member) => member.userId === currentUserId && member.role === "DM",
      ) ?? false,
  });
  const isDm =
    membersQuery.data?.some(
      (member) => member.userId === currentUserId && member.role === "DM",
    ) ?? false;
  const canManageRoles = currentUserId === ownerId;

  const inviteMutation = useMutation({
    mutationFn: (inviteEmail: string) =>
      inviteCampaignMember(campaignId, inviteEmail),
    onSuccess: async (invitation) => {
      setEmail("");
      setFeedback(
        invitation.delivery === "smtp"
          ? `El servidor SMTP aceptó la invitación para ${invitation.email}. Si no aparece, revisa el correo no deseado.`
          : "La invitación no se envió por Internet. El mensaje está en apps/api/var/mail para entregarlo de forma privada.",
      );
      await queryClient.invalidateQueries({ queryKey: invitationsKey });
      await queryClient.invalidateQueries({ queryKey: ["campaign-dashboard"] });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      revokeCampaignInvitation(campaignId, invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invitationsKey });
      await queryClient.invalidateQueries({ queryKey: ["campaign-dashboard"] });
    },
  });
  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeCampaignMember(campaignId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: membersKey });
      await queryClient.invalidateQueries({ queryKey: ["campaign-dashboard"] });
    },
  });
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "DM" | "PLAYER" }) =>
      updateCampaignMemberRole(campaignId, userId, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: membersKey });
      await queryClient.invalidateQueries({ queryKey: ["campaign-dashboard"] });
    },
  });
  const transferMutation = useMutation({
    mutationFn: (targetUserId: string) => transferCampaignOwnership(campaignId, targetUserId),
    onSuccess: async (campaign) => {
      queryClient.setQueryData(["campaign", campaignId], campaign);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: membersKey }),
        queryClient.invalidateQueries({ queryKey: ["campaign-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
      ]);
    },
  });
  const leaveMutation = useMutation({
    mutationFn: () => leaveCampaign(campaignId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["campaign", campaignId] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
      ]);
      navigate("/campaigns");
    },
  });

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    inviteMutation.mutate(email.trim());
  }

  return (
    <section className="panel detail-players campaign-members-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">EL GRUPO</p>
          <h2>Miembros de la campaña</h2>
        </div>
        <span className="player-role">
          {membersQuery.data?.length ?? 0} miembros
        </span>
      </div>
      {currentUserId !== ownerId && (
        <button
          className="member-remove-button leave-campaign-button"
          type="button"
          disabled={leaveMutation.isPending}
          onClick={() => {
            if (window.confirm("¿Quieres abandonar esta campaña? Podrás volver a unirte mediante una nueva invitación.")) {
              leaveMutation.mutate();
            }
          }}
        >
          {leaveMutation.isPending ? "Saliendo…" : "Abandonar campaña"}
        </button>
      )}
      {leaveMutation.error && <p className="member-feedback" role="alert">{leaveMutation.error.message}</p>}

      {membersQuery.isPending ? (
        <p className="member-feedback">Cargando miembros…</p>
      ) : membersQuery.error ? (
        <p className="member-feedback" role="alert">
          {membersQuery.error.message}
        </p>
      ) : membersQuery.data?.length ? (
        <div className="player-list">
          {membersQuery.data.map((member) => (
            <div className="player-row" key={member.userId}>
              <span className="player-avatar art-elturel" aria-hidden="true">
                {member.email.slice(0, 2).toUpperCase()}
              </span>
              <span className="player-copy">
                <strong>{member.email}</strong>
                <small>
                  {member.userId === ownerId
                    ? "Propietario"
                    : member.role === "DM"
                      ? "Dungeon Master"
                      : "Jugador"}
                </small>
              </span>
              {canManageRoles && member.userId !== ownerId ? (
                <select
                  className="member-role-select"
                  aria-label={`Rol de ${member.email}`}
                  value={member.role}
                  disabled={roleMutation.isPending}
                  onChange={(event) => {
                    const nextRole = event.target.value as "DM" | "PLAYER";
                    if (nextRole !== member.role && window.confirm(`¿Cambiar el rol de ${member.email}?`)) {
                      roleMutation.mutate({ userId: member.userId, role: nextRole });
                    }
                  }}
                >
                  <option value="PLAYER">Jugador</option>
                  <option value="DM">DM</option>
                </select>
              ) : (
                <span className="player-role">
                  {member.role === "DM" ? "DM" : "Jugador"}
                </span>
              )}
              {isDm &&
                member.userId !== ownerId &&
                (member.role !== "DM" || currentUserId === ownerId) && (
                  <button
                    className="member-remove-button"
                    type="button"
                    disabled={removeMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`¿Quitar a ${member.email} de esta campaña?`)) {
                        removeMutation.mutate(member.userId);
                      }
                    }}
                    aria-label={`Eliminar a ${member.email} de la campaña`}
                  >
                    Quitar
                  </button>
                )}
            </div>
          ))}
        </div>
      ) : (
        <div className="detail-empty">
          <p>Aún no hay miembros en esta campaña.</p>
        </div>
      )}

      {isDm && (
        <>
          {canManageRoles && membersQuery.data?.some((member) => member.role === "DM" && member.userId !== ownerId) && (
            <form
              className="member-invite-form transfer-owner-form"
              onSubmit={(event) => {
                event.preventDefault();
                const targetUserId = String(new FormData(event.currentTarget).get("targetUserId"));
                const target = membersQuery.data?.find((member) => member.userId === targetUserId);
                if (target && window.confirm(`Transferir la propiedad de la campaña a ${target.email}?`)) {
                  transferMutation.mutate(target.userId);
                }
              }}
            >
              <label htmlFor={`transfer-owner-${campaignId}`}>Transferir propiedad</label>
              <div>
                <select id={`transfer-owner-${campaignId}`} name="targetUserId" required defaultValue="">
                  <option value="" disabled>Selecciona un DM</option>
                  {membersQuery.data.filter((member) => member.role === "DM" && member.userId !== ownerId).map((member) => (
                    <option key={member.userId} value={member.userId}>{member.email}</option>
                  ))}
                </select>
                <button className="button button-secondary" type="submit" disabled={transferMutation.isPending}>
                  {transferMutation.isPending ? "Transfiriendo…" : "Transferir"}
                </button>
              </div>
              {transferMutation.error && <p className="member-feedback" role="alert">{transferMutation.error.message}</p>}
            </form>
          )}
          <form className="member-invite-form" onSubmit={submitInvite}>
            <label htmlFor={`invite-email-${campaignId}`}>
              Invitar por correo
            </label>
            <div>
              <input
                id={`invite-email-${campaignId}`}
                type="email"
                maxLength={254}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jugador@ejemplo.com"
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending ? "Enviando…" : "Invitar"}
              </button>
            </div>
          </form>
          {feedback && (
            <p className="member-feedback" role="status">
              {feedback}
            </p>
          )}
          {inviteMutation.error && (
            <p className="member-feedback" role="alert">
              {inviteMutation.error.message}
            </p>
          )}
          {roleMutation.error && (
            <p className="member-feedback" role="alert">
              {roleMutation.error.message}
            </p>
          )}
          {removeMutation.error && (
            <p className="member-feedback" role="alert">
              {removeMutation.error.message}
            </p>
          )}
          {invitationsQuery.data?.map((invitation) => (
            <div className="pending-invitation" key={invitation.id}>
              <span>
                {invitation.email}
                <small>
                  Pendiente · caduca{" "}
                  {new Intl.DateTimeFormat("es-ES", {
                    dateStyle: "medium",
                  }).format(new Date(invitation.expiresAt))}
                </small>
              </span>
              <button
                className="member-remove-button"
                type="button"
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate(invitation.id)}
              >
                Revocar
              </button>
            </div>
          ))}
          {invitationsQuery.error && (
            <p className="member-feedback" role="alert">
              {invitationsQuery.error.message}
            </p>
          )}
          {revokeMutation.error && (
            <p className="member-feedback" role="alert">
              {revokeMutation.error.message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
