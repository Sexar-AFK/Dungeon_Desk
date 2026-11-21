import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listIncomingCampaignInvitations,
  respondToIncomingCampaignInvitation,
} from "./campaignsApi";
import { Icon } from "../../lib/Icon";

const INCOMING_INVITATIONS_KEY = ["incoming-campaign-invitations"] as const;

export function IncomingCampaignInvitations() {
  const queryClient = useQueryClient();
  const invitationsQuery = useQuery({
    queryKey: INCOMING_INVITATIONS_KEY,
    queryFn: listIncomingCampaignInvitations,
  });
  const responseMutation = useMutation({
    mutationFn: ({ invitationId, decision }: { invitationId: string; decision: "accept" | "reject" }) =>
      respondToIncomingCampaignInvitation(invitationId, decision),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: INCOMING_INVITATIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign-dashboard"] }),
      ]);
    },
  });

  if (invitationsQuery.isPending || (!invitationsQuery.error && invitationsQuery.data?.length === 0)) {
    return null;
  }

  if (invitationsQuery.error) {
    return (
      <section className="panel incoming-invitations" aria-labelledby="incoming-invitations-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">INVITACIONES</p>
            <h2 id="incoming-invitations-title">No pudimos cargar tus invitaciones</h2>
          </div>
        </div>
        <p className="member-feedback" role="alert">{invitationsQuery.error.message}</p>
        <button className="button button-secondary" type="button" onClick={() => void invitationsQuery.refetch()}>
          Reintentar
        </button>
      </section>
    );
  }

  return (
    <section className="panel incoming-invitations" aria-labelledby="incoming-invitations-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">TE HAN INVITADO</p>
          <h2 id="incoming-invitations-title">Invitaciones a campañas</h2>
        </div>
        <span className="panel-icon"><Icon name="users" size={18} /></span>
      </div>
      {invitationsQuery.data?.map((invitation) => (
        <div className="incoming-invitation" key={invitation.id}>
          <div>
            <strong>{invitation.campaign.title}</strong>
            <span>Invitación de {invitation.invitedBy.email}</span>
            <small>
              Caduca {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}
            </small>
          </div>
          <div className="incoming-invitation-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={responseMutation.isPending}
              onClick={() => responseMutation.mutate({ invitationId: invitation.id, decision: "accept" })}
            >
              Aceptar
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={responseMutation.isPending}
              onClick={() => responseMutation.mutate({ invitationId: invitation.id, decision: "reject" })}
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
      {responseMutation.error && <p className="member-feedback" role="alert">{responseMutation.error.message}</p>}
    </section>
  );
}
