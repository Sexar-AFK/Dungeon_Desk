import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  inviteCampaignMember,
  listCampaignInvitations,
  listCampaignMembers,
  removeCampaignMember,
  revokeCampaignInvitation,
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
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      revokeCampaignInvitation(campaignId, invitationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: invitationsKey }),
  });
  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeCampaignMember(campaignId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
  });
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "DM" | "PLAYER" }) =>
      updateCampaignMemberRole(campaignId, userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
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
                  onChange={(event) =>
                    roleMutation.mutate({
                      userId: member.userId,
                      role: event.target.value as "DM" | "PLAYER",
                    })
                  }
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
                    onClick={() => removeMutation.mutate(member.userId)}
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
