/** Optional player details shown when the memberships endpoint is available. */
export type Player = {
  initials: string;
  name: string;
  character: string;
  tone: string;
};

/** UI model built from the campaign API response. */
export type Campaign = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  longDescription: string;
  status: "Activa" | "En pausa" | "Finalizada" | "Archivada";
  edition: string;
  art: string;
  symbol: string;
  players: Player[];
  lastPlayed: string;
  nextSession: string;
  nextDay?: string;
  nextMonth?: string;
  nextTime?: string;
  statusCode: CampaignStatusCode;
};

/** Status values shared with the API and persisted by Prisma. */
export type CampaignStatusCode = "ACTIVE" | "PAUSED" | "FINISHED" | "ARCHIVED";

/** Payload accepted by POST /campaigns. */
export type CreateCampaignInput = {
  title: string;
  description?: string;
  edition?: string;
};

/** Fields accepted by PATCH /campaigns/:id. */
export type UpdateCampaignInput = Partial<CreateCampaignInput> & {
  status?: CampaignStatusCode;
};

/** Input used by the create/edit dialog; status is only sent while editing. */
export type CampaignSaveInput = CreateCampaignInput & {
  status?: CampaignStatusCode;
};

/** Response shape returned by the REST API. */
export type CampaignRecord = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  edition: string;
  status: CampaignStatusCode;
  createdAt: string;
  updatedAt: string;
};
