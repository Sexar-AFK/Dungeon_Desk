import type {
  Campaign,
  CampaignRecord,
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
  return request<{ registrationEnabled: boolean }>("/auth/config");
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

const campaignArt = [
  { art: "art-elturel", symbol: "☼" },
  { art: "art-tides", symbol: "≈" },
  { art: "art-ash", symbol: "♜" },
] as const;

/** Converts the API's persistence model into the fields the current UI needs. */
export function toCampaignView(record: CampaignRecord): Campaign {
  const artIndex = hashId(record.id) % campaignArt.length;
  const visual = campaignArt[artIndex];

  return {
    id: record.id,
    title: record.title,
    description: record.description || "",
    longDescription:
      record.description || "Todavía no se ha añadido una descripción.",
    status: statusLabels[record.status],
    statusCode: record.status,
    edition: record.edition,
    art: visual.art,
    symbol: visual.symbol,
    players: [],
    lastPlayed: formatLastUpdated(record.updatedAt),
    nextSession: "Por programar",
  };
}

/** Loads the campaign collection; current prototype filtering is client-side. */
export async function listCampaigns(): Promise<Campaign[]> {
  const records = await request<CampaignRecord[]>("/campaigns");
  return records.map(toCampaignView);
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

function hashId(id: string): number {
  return Array.from(id).reduce(
    (hash, character) => hash + character.charCodeAt(0),
    0,
  );
}

function formatLastUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin actividad reciente";

  return `Actualizada ${new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(date)}`;
}
