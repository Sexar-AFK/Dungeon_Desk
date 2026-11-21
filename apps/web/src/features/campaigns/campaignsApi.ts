import type {
  Campaign,
  CampaignRecord,
  CampaignDashboardRecord,
  DashboardCampaign,
  IncomingCampaignInvitation,
  CampaignIcon,
  CampaignThemeColor,
  CampaignStatusCode,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "./campaign.types";

const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
const apiUrl = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(
  /\/$/,
  "",
);

export type AuthenticatedUser = {
  id: string;
  email: string;
  createdAt: string;
};

export function getAuthConfig() {
  return request<{
    registrationEnabled: boolean;
    emailDelivery: "smtp" | "file";
  }>("/auth/config");
}

export function getCurrentUser() {
  return request<AuthenticatedUser>("/auth/me");
}

export function signIn(input: { email: string; password: string }) {
  return request<AuthenticatedUser>("/auth/sign-in", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signUp(input: { email: string; password: string }) {
  return request<{ message: string }>("/auth/sign-up", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyEmail(token: string) {
  return request<{ emailVerified: true }>("/auth/email/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function requestEmailVerification(email: string) {
  return request<{ message: string }>("/auth/email/verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function requestPasswordReset(email: string) {
  return request<{ message: string }>("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(input: { token: string; password: string }) {
  return request<{ passwordReset: true }>("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signOut() {
  return request<void>("/auth/sign-out", { method: "POST" });
}

const statusLabels: Record<CampaignStatusCode, Campaign["status"]> = {
  ACTIVE: "Activa",
  PAUSED: "En pausa",
  FINISHED: "Finalizada",
  ARCHIVED: "Archivada",
};

const campaignArt: Record<CampaignThemeColor, string> = {
  GOLD: "art-gold",
  BLUE: "art-blue",
  SAGE: "art-sage",
  ROSE: "art-rose",
  VIOLET: "art-violet",
};
const campaignIcons: Record<CampaignIcon, string> = {
  SUN: "☼",
  WAVE: "≈",
  TOWER: "♜",
  MOON: "☾",
  STAR: "✦",
};

/** Converts the API's persistence model into the fields the current UI needs. */
export function toCampaignView(record: CampaignRecord): Campaign {
  return {
    id: record.id,
    ownerId: record.ownerId,
    title: record.title,
    description: record.description || "",
    longDescription:
      record.description || "Todavía no se ha añadido una descripción.",
    status: statusLabels[record.status],
    statusCode: record.status,
    edition: record.edition,
    art: campaignArt[record.themeColor],
    symbol: campaignIcons[record.icon],
    players: [],
    lastPlayed: formatLastUpdated(record.updatedAt),
    nextSession: "Por programar",
    initialLevel: record.initialLevel,
    themeColor: record.themeColor,
    icon: record.icon,
    tags: record.tags,
    playerCanViewDescription: record.playerCanViewDescription,
    updatedAt: record.updatedAt,
  };
}

/** Loads the campaign collection; current prototype filtering is client-side. */
export async function listCampaigns(): Promise<Campaign[]> {
  const records = await request<CampaignRecord[]>("/campaigns");
  return records.map(toCampaignView);
}

/** Loads the role-aware campaign summaries used by the home dashboard. */
export async function getCampaignDashboard(): Promise<DashboardCampaign[]> {
  const records = await request<CampaignDashboardRecord[]>("/campaigns/dashboard");
  return records.map((record) => ({
    ...toCampaignView(record),
    role: record.role,
    playerCount: record.playerCount,
    pendingInvitationCount: record.pendingInvitationCount,
  }));
}

/** Creates a campaign and returns its UI-ready representation. */
export async function createCampaign(
  input: CreateCampaignInput,
): Promise<Campaign> {
  const record = await request<CampaignRecord>("/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return toCampaignView(record);
}

/** Loads the persisted detail for a campaign. */
export async function getCampaign(id: string): Promise<Campaign> {
  const record = await request<CampaignRecord>(
    `/campaigns/${encodeURIComponent(id)}`,
  );
  return toCampaignView(record);
}

/** Updates campaign metadata and returns the latest saved version. */
export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput,
): Promise<Campaign> {
  const record = await request<CampaignRecord>(
    `/campaigns/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return toCampaignView(record);
}

/** Archives a campaign without deleting its stored data. */
export async function archiveCampaign(id: string): Promise<Campaign> {
  const record = await request<CampaignRecord>(
    `/campaigns/${encodeURIComponent(id)}/archive`,
    { method: "PATCH" },
  );
  return toCampaignView(record);
}

export function deleteCampaign(id: string, confirmation: string) {
  return request<{ deleted: true }>(`/campaigns/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmation }),
  });
}

export async function transferCampaignOwnership(id: string, targetUserId: string) {
  const record = await request<CampaignRecord>(
    `/campaigns/${encodeURIComponent(id)}/owner`,
    { method: "PATCH", body: JSON.stringify({ targetUserId }) },
  );
  return toCampaignView(record);
}

export function leaveCampaign(id: string) {
  return request<{ left: true }>(`/campaigns/${encodeURIComponent(id)}/leave`, {
    method: "POST",
  });
}

export type CampaignMember = {
  userId: string;
  email: string;
  role: "DM" | "PLAYER";
  createdAt: string;
};

export type CampaignInvitation = {
  id: string;
  email: string;
  role: "PLAYER";
  createdAt: string;
  expiresAt: string;
};

export type CreatedCampaignInvitation = CampaignInvitation & {
  delivery: "smtp" | "file";
};

export function listCampaignMembers(campaignId: string) {
  return request<CampaignMember[]>(
    `/campaigns/${encodeURIComponent(campaignId)}/members`,
  );
}

export function listCampaignInvitations(campaignId: string) {
  return request<CampaignInvitation[]>(
    `/campaigns/${encodeURIComponent(campaignId)}/invitations`,
  );
}

export function inviteCampaignMember(campaignId: string, email: string) {
  return request<CreatedCampaignInvitation>(
    `/campaigns/${encodeURIComponent(campaignId)}/invitations`,
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

export function revokeCampaignInvitation(
  campaignId: string,
  invitationId: string,
) {
  return request<{ revoked: true }>(
    `/campaigns/${encodeURIComponent(campaignId)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
    { method: "POST" },
  );
}

export function updateCampaignMemberRole(
  campaignId: string,
  userId: string,
  role: "DM" | "PLAYER",
) {
  return request<CampaignMember>(
    `/campaigns/${encodeURIComponent(campaignId)}/members/${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify({ role }) },
  );
}

export function removeCampaignMember(campaignId: string, userId: string) {
  return request<{ removed: true }>(
    `/campaigns/${encodeURIComponent(campaignId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}

export function respondToCampaignInvitation(
  token: string,
  decision: "accept" | "reject",
) {
  return request<{ accepted: true; campaignId: string } | { rejected: true }>(
    `/campaign-invitations/${decision}`,
    { method: "POST", body: JSON.stringify({ token }) },
  );
}

export function listIncomingCampaignInvitations() {
  return request<IncomingCampaignInvitation[]>("/campaign-invitations/pending");
}

export function respondToIncomingCampaignInvitation(
  invitationId: string,
  decision: "accept" | "reject",
) {
  return request<{ accepted: true; campaignId: string } | { rejected: true }>(
    `/campaign-invitations/${encodeURIComponent(invitationId)}/${decision}`,
    { method: "POST" },
  );
}

/** Lets the detail page distinguish a missing record from other failures. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new Error(
      `No se pudo conectar con la API (${apiUrl}). Comprueba que el backend esté iniciado.`,
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(" ")
      : body?.message;
    throw new ApiError(
      message || `La API respondió con el estado ${response.status}.`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function formatLastUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin actividad reciente";

  return `Actualizada ${new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(date)}`;
}
