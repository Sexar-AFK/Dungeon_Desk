import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { ArchiveCampaignDialog } from "./features/campaigns/ArchiveCampaignDialog";
import { CampaignDialog } from "./features/campaigns/CampaignDialog";
import type {
  Campaign,
  CampaignSaveInput,
} from "./features/campaigns/campaign.types";
import {
  ApiError,
  getCurrentUser,
  getAuthConfig,
  signIn,
  signOut,
  signUp,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword as resetPasswordRequest,
  verifyEmail as verifyEmailRequest,
  type AuthenticatedUser,
  archiveCampaign as archiveCampaignRequest,
  createCampaign as createCampaignRequest,
  getCampaign,
  listCampaigns,
  updateCampaign as updateCampaignRequest,
} from "./features/campaigns/campaignsApi";
import { Icon } from "./lib/Icon";
import { ThemeToggle } from "./features/theme/ThemeToggle";
import { saveThemePreference, type Theme } from "./features/theme/theme";
import "./App.css";
import "./features/theme/theme.css";

const todayLabel = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
})
  .format(new Date())
  .toLocaleUpperCase("es-ES");

const CAMPAIGNS_QUERY_KEY = ["campaigns"] as const;

type CampaignQueryState = {
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
};

type AppProps = {
  theme: Theme;
  onToggleTheme: () => void;
  user: AuthenticatedUser;
  onSignOut: () => void;
};

/** Shared shell for all routes and the campaign query/mutation lifecycle. */
function App({ theme, onToggleTheme, user, onSignOut }: AppProps) {
  const queryClient = useQueryClient();
  const campaignsQuery = useQuery({
    queryKey: CAMPAIGNS_QUERY_KEY,
    queryFn: listCampaigns,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const navigate = useNavigate();
  const campaigns = campaignsQuery.data ?? [];
  const queryState: CampaignQueryState = {
    isLoading: campaignsQuery.isLoading,
    error: campaignsQuery.error,
    onRetry: () => void campaignsQuery.refetch(),
  };

  const createCampaignMutation = useMutation({
    mutationFn: createCampaignRequest,
    onSuccess: addCampaignToCache,
  });
  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CampaignSaveInput }) =>
      updateCampaignRequest(id, input),
    onSuccess: updateCampaignInCache,
  });
  const archiveCampaignMutation = useMutation({
    mutationFn: archiveCampaignRequest,
    onSuccess: updateCampaignInCache,
  });

  function addCampaignToCache(campaign: Campaign) {
    queryClient.setQueryData<Campaign[]>(CAMPAIGNS_QUERY_KEY, (current) => [
      campaign,
      ...(current ?? []),
    ]);
    queryClient.setQueryData(["campaign", campaign.id], campaign);
  }

  function updateCampaignInCache(campaign: Campaign) {
    queryClient.setQueryData<Campaign[]>(CAMPAIGNS_QUERY_KEY, (current) =>
      current?.map((item) => (item.id === campaign.id ? campaign : item)),
    );
    queryClient.setQueryData(["campaign", campaign.id], campaign);
  }

  function openCreateCampaign() {
    setEditingCampaign(null);
    setDialogOpen(true);
  }

  function openEditCampaign(campaign: Campaign) {
    setEditingCampaign(campaign);
    setDialogOpen(true);
  }

  async function handleSaveCampaign(input: CampaignSaveInput) {
    if (editingCampaign) {
      await updateCampaignMutation.mutateAsync({
        id: editingCampaign.id,
        input,
      });
      setDialogOpen(false);
      setEditingCampaign(null);
      return;
    }

    const campaign = await createCampaignMutation.mutateAsync(input);
    setDialogOpen(false);
    navigate(`/campaigns/${campaign.id}`);
  }

  async function handleArchiveCampaign(id: string) {
    await archiveCampaignMutation.mutateAsync(id);
  }

  return (
    <div className="app-shell">
      <Sidebar user={user} onSignOut={onSignOut} />
      <div className="main-column">
        <Topbar
          onNewCampaign={openCreateCampaign}
          theme={theme}
          onToggleTheme={onToggleTheme}
          user={user}
          onSignOut={onSignOut}
        />
        {/* Keep the first release focused on campaign discovery and details. */}
        <main className="page-content" id="main-content">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  campaigns={campaigns}
                  onNewCampaign={openCreateCampaign}
                  {...queryState}
                />
              }
            />
            <Route
              path="/campaigns"
              element={
                <CampaignsPage
                  campaigns={campaigns}
                  onNewCampaign={openCreateCampaign}
                  {...queryState}
                />
              }
            />
            <Route
              path="/campaigns/:campaignId"
              element={
                <CampaignDetail
                  onEdit={openEditCampaign}
                  onArchive={handleArchiveCampaign}
                />
              }
            />
            <Route
              path="/characters"
              element={<ComingSoon title="Personajes" />}
            />
            <Route path="/notes" element={<ComingSoon title="Notas" />} />
            <Route
              path="*"
              element={<ComingSoon title="Página no encontrada" />}
            />
          </Routes>
        </main>
        <MobileNav />
      </div>
      {dialogOpen && (
        <CampaignDialog
          onClose={() => setDialogOpen(false)}
          onSave={handleSaveCampaign}
          campaign={editingCampaign ?? undefined}
        />
      )}
    </div>
  );
}

/** Desktop navigation; mobile uses the compact bottom bar below. */
function Sidebar({ user, onSignOut }: { user: AuthenticatedUser; onSignOut: () => void }) {
  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <Link className="brand" to="/" aria-label="Dungeon Desk, inicio">
        <span className="brand-mark">
          <Icon name="dice" size={21} />
        </span>
        <span className="brand-copy">
          Dungeon<span>Desk</span>
        </span>
      </Link>

      <div className="workspace-switcher">
        <div className="workspace-avatar">DD</div>
        <div className="workspace-copy">
          <strong>Tu espacio</strong>
          <span>Mesa personal</span>
        </div>
        <Icon name="chevrons" size={16} className="muted-icon" />
      </div>

      <nav className="side-nav">
        <p className="nav-label">ESPACIO DE JUEGO</p>
        <NavItem to="/" icon="home" label="Inicio" end />
        <NavItem to="/campaigns" icon="book" label="Campañas" />
        <NavItem to="/characters" icon="users" label="Personajes" />
        <NavItem to="/notes" icon="scroll" label="Notas" />
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-tip">
          <span className="tip-icon">
            <Icon name="sparkles" size={17} />
          </span>
          <strong>Tu próxima aventura</strong>
          <p>Todo lo que necesita tu mesa, en un mismo lugar.</p>
        </div>
        <div className="profile-button">
          <span className="profile-avatar">AV</span>
          <span className="profile-copy">
            <strong title={user.email}>{user.email}</strong>
            <small>Cuenta personal</small>
          </span>
          <button className="sign-out-button" type="button" onClick={onSignOut}>
            Salir
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  to,
  icon,
  label,
  end = false,
}: {
  to: string;
  icon: "home" | "book" | "users" | "scroll";
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      className={({ isActive }) => `nav-item${isActive ? " is-active" : ""}`}
      to={to}
      end={end}
    >
      <Icon name={icon} size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

function Topbar({
  onNewCampaign,
  theme,
  onToggleTheme,
  user,
  onSignOut,
}: {
  onNewCampaign: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  user: AuthenticatedUser;
  onSignOut: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-context">
        <span>Dungeon Desk</span>
        <Icon name="chevron" size={14} />
        <strong>Tu espacio</strong>
      </div>
      <div className="topbar-actions">
        <Link
          className="icon-button search-shortcut"
          to="/campaigns"
          aria-label="Buscar campañas"
          title="Buscar campañas"
        >
          <Icon name="search" size={18} />
        </Link>
        <button
          className="icon-button notification-button"
          type="button"
          aria-label="Notificaciones disponibles más adelante"
          title="Notificaciones disponibles más adelante"
          disabled
        >
          <Icon name="bell" size={18} />
          <span className="notification-dot" />
        </button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button
          className="button button-primary topbar-create"
          type="button"
          onClick={onNewCampaign}
        >
          <Icon name="plus" size={17} />
          <span>Nueva campaña</span>
        </button>
        <span className="topbar-user-email">{user.email}</span>
        <button className="sign-out-mobile" type="button" onClick={onSignOut}>Salir</button>
      </div>
    </header>
  );
}

function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Navegación móvil">
      <MobileNavItem to="/" icon="home" label="Inicio" end />
      <MobileNavItem to="/campaigns" icon="book" label="Campañas" />
      <MobileNavItem to="/characters" icon="users" label="Personajes" />
      <MobileNavItem to="/notes" icon="scroll" label="Notas" />
    </nav>
  );
}

function MobileNavItem({
  to,
  icon,
  label,
  end = false,
}: {
  to: string;
  icon: "home" | "book" | "users" | "scroll";
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        `mobile-nav-item${isActive ? " is-active" : ""}`
      }
      to={to}
      end={end}
    >
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </NavLink>
  );
}

/** Overview page backed by the current campaign query. */
function Dashboard({
  campaigns,
  onNewCampaign,
  isLoading,
  error,
  onRetry,
}: {
  campaigns: Campaign[];
  onNewCampaign: () => void;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "Activa",
  );

  return (
    <div className="page-stack">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-dot" /> {todayLabel}
          </p>
          <h1>
            Prepara tu próxima <span>aventura.</span>
          </h1>
          <p className="welcome-copy">
            Tus mundos, historias y jugadores. Todo listo para continuar.
          </p>
        </div>
        <button
          className="button button-primary welcome-create"
          type="button"
          onClick={onNewCampaign}
        >
          <Icon name="plus" size={17} /> Crear campaña
        </button>
      </section>

      <section className="summary-grid" aria-label="Resumen de tu espacio">
        <SummaryCard
          icon="book"
          label="Campañas activas"
          value={String(activeCampaigns.length).padStart(2, "0")}
          foot="mundos en marcha"
          tone="gold"
        />
        <SummaryCard
          icon="users"
          label="Aventureros"
          value={String(
            campaigns.reduce(
              (total, campaign) => total + campaign.players.length,
              0,
            ),
          ).padStart(2, "0")}
          foot="La gestión llegará próximamente"
          tone="blue"
        />
        <SummaryCard
          icon="calendar"
          label="Próxima sesión"
          value="—"
          foot="No hay sesiones programadas"
          tone="sage"
        />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TUS MUNDOS</p>
            <h2>Campañas</h2>
          </div>
          <Link className="text-link" to="/campaigns">
            Ver todas <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        {isLoading ? (
          <LoadingState label="Cargando tus campañas…" />
        ) : error ? (
          <RequestError error={error} onRetry={onRetry} />
        ) : campaigns.length === 0 ? (
          <EmptyCampaigns onCreate={onNewCampaign} />
        ) : (
          <div className="campaign-grid dashboard-campaign-grid">
            {campaigns.slice(0, 3).map((campaign) => (
              <CampaignCard campaign={campaign} key={campaign.id} />
            ))}
            <button
              className="create-campaign-card"
              type="button"
              onClick={onNewCampaign}
            >
              <span className="create-card-icon">
                <Icon name="plus" size={20} />
              </span>
              <strong>Un mundo por descubrir</strong>
              <span>Crea una nueva campaña</span>
            </button>
          </div>
        )}
      </section>

      <section className="bottom-grid">
        <div className="panel next-session-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">EN EL CALENDARIO</p>
              <h2>Tu próxima sesión</h2>
            </div>
            <span className="panel-icon">
              <Icon name="calendar" size={18} />
            </span>
          </div>
          <div className="session-feature">
            <div className="session-date session-date-empty">
              <Icon name="calendar" size={18} />
            </div>
            <div className="session-info">
              <strong>Sin sesiones programadas</strong>
              <span>La gestión de sesiones llegará próximamente.</span>
            </div>
          </div>
          <p className="panel-footnote">
            La planificación de sesiones llegará próximamente.
          </p>
        </div>
        <div className="panel table-note-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">UN APUNTE PARA TI</p>
              <h2>Desde el escritorio</h2>
            </div>
            <span className="panel-icon note-icon">
              <Icon name="sparkles" size={18} />
            </span>
          </div>
          <p className="dm-note">
            Las notas privadas del DM aparecerán aquí cuando conectemos ese
            módulo.
          </p>
          <span className="note-meta">Notas privadas · Próximamente</span>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  foot,
  tone,
}: {
  icon: "book" | "users" | "calendar";
  label: string;
  value: string;
  foot: string;
  tone: string;
}) {
  return (
    <article className="summary-card">
      <div className={`summary-icon ${tone}`}>
        <Icon name={icon} size={18} />
      </div>
      <div className="summary-main">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{foot}</small>
      </div>
      <span className="summary-decoration" aria-hidden="true">
        ✳
      </span>
    </article>
  );
}

/** Searchable and filterable view of campaigns loaded from the API. */
function CampaignsPage({
  campaigns,
  onNewCampaign,
  isLoading,
  error,
  onRetry,
}: {
  campaigns: Campaign[];
  onNewCampaign: () => void;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todas");
  const filters = ["Todas", "Activas", "En pausa", "Finalizadas", "Archivadas"];
  const statusByFilter: Record<string, Campaign["status"]> = {
    Activas: "Activa",
    "En pausa": "En pausa",
    Finalizadas: "Finalizada",
    Archivadas: "Archivada",
  };
  const visibleCampaigns = campaigns.filter((campaign) => {
    const matchesQuery = `${campaign.title} ${campaign.description}`
      .toLocaleLowerCase("es")
      .includes(query.toLocaleLowerCase("es"));
    const matchesFilter =
      filter === "Todas" || campaign.status === statusByFilter[filter];
    return matchesQuery && matchesFilter;
  });

  return (
    <div className="page-stack campaigns-page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">TU BIBLIOTECA DE AVENTURAS</p>
          <h1>Tus campañas</h1>
          <p className="welcome-copy">
            Cada gran historia empieza alrededor de una mesa.
          </p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={onNewCampaign}
        >
          <Icon name="plus" size={17} /> Nueva campaña
        </button>
      </section>
      <div className="campaign-tools">
        <div className="filter-tabs" role="group" aria-label="Filtrar campañas">
          {filters.map((item) => (
            <button
              type="button"
              key={item}
              className={`filter-tab${filter === item ? " selected" : ""}`}
              onClick={() => setFilter(item)}
            >
              {item}
              {item === "Todas" && <span>{campaigns.length}</span>}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Icon name="search" size={17} />
          <span className="sr-only">Buscar campañas</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar campañas…"
          />
        </label>
      </div>
      {isLoading ? (
        <LoadingState label="Cargando campañas…" />
      ) : error ? (
        <RequestError error={error} onRetry={onRetry} />
      ) : visibleCampaigns.length > 0 ? (
        <div className="campaign-grid all-campaigns-grid">
          {visibleCampaigns.map((campaign) => (
            <CampaignCard campaign={campaign} key={campaign.id} />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyCampaigns onCreate={onNewCampaign} />
      ) : (
        <div className="empty-state">
          <span className="empty-state-icon">
            <Icon name="search" size={24} />
          </span>
          <h2>No encontramos campañas</h2>
          <p>Prueba con otra búsqueda o cambia el filtro seleccionado.</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("Todas");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Link to={`/campaigns/${campaign.id}`} className="campaign-card">
      <div className={`campaign-art ${campaign.art}`}>
        <div className="art-orbit orbit-one" />
        <div className="art-orbit orbit-two" />
        <span className="art-symbol" aria-hidden="true">
          {campaign.symbol}
        </span>
        <span
          className={`status-pill ${getCampaignStatusClass(campaign.status)}`}
        >
          <span />
          {campaign.status}
        </span>
        <span className="campaign-edition">{campaign.edition}</span>
      </div>
      <div className="campaign-card-body">
        <h3>{campaign.title}</h3>
        <p className="campaign-description">{campaign.description}</p>
        <div className="campaign-card-meta">
          <span>
            <Icon name="users" size={15} />
            {campaign.players.length} jugadores
          </span>
          <span>{campaign.lastPlayed}</span>
        </div>
        <div className="campaign-card-footer">
          {campaign.players.length > 0 ? (
            <div
              className="avatar-stack"
              aria-label={`${campaign.players.length} jugadores`}
            >
              {campaign.players.slice(0, 4).map((player) => (
                <span
                  key={player.initials}
                  className={`mini-avatar ${player.tone}`}
                >
                  {player.initials}
                </span>
              ))}
            </div>
          ) : (
            <span className="no-players">Sin jugadores</span>
          )}
          <span className="card-arrow">
            <Icon name="arrow-up-right" size={17} />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Loads a campaign directly so deep links and refreshes also work. */
function CampaignDetail({
  onEdit,
  onArchive,
}: {
  onEdit: (campaign: Campaign) => void;
  onArchive: (id: string) => Promise<void>;
}) {
  const { campaignId } = useParams();
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const campaignQuery = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => getCampaign(campaignId!),
    enabled: Boolean(campaignId),
  });

  if (!campaignId) return <CampaignNotFound />;
  if (campaignQuery.isLoading) {
    return <LoadingState label="Cargando campaña…" />;
  }
  if (
    campaignQuery.error instanceof ApiError &&
    campaignQuery.error.status === 404
  ) {
    return <CampaignNotFound />;
  }
  if (campaignQuery.error) {
    return (
      <RequestError
        error={campaignQuery.error}
        title="No pudimos cargar esta campaña"
        onRetry={() => void campaignQuery.refetch()}
      />
    );
  }

  const campaign = campaignQuery.data;
  if (!campaign) return <CampaignNotFound />;

  return (
    <>
      <div className="page-stack detail-page">
        <Link to="/campaigns" className="back-link">
          <Icon name="arrow-left" size={16} /> Volver a campañas
        </Link>
        <section className={`detail-hero ${campaign.art}`}>
          <div className="detail-hero-art">
            <span aria-hidden="true">{campaign.symbol}</span>
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
          </div>
          <div className="detail-hero-copy">
            <span
              className={`status-pill ${getCampaignStatusClass(campaign.status)}`}
            >
              <span />
              {campaign.status}
            </span>
            <p>
              {campaign.edition} <span>·</span> Campaña de D&D
            </p>
            <h1>{campaign.title}</h1>
            <p className="detail-description">{campaign.description}</p>
            <div className="detail-hero-actions">
              <button
                className="button button-light"
                type="button"
                onClick={() => onEdit(campaign)}
              >
                <Icon name="scroll" size={16} /> Editar detalles
              </button>
              <button
                className="button button-danger"
                type="button"
                onClick={() => setArchiveDialogOpen(true)}
                disabled={campaign.statusCode === "ARCHIVED"}
              >
                {campaign.statusCode === "ARCHIVED" ? "Archivada" : "Archivar"}
              </button>
            </div>
          </div>
        </section>
        <section className="detail-stats">
          <DetailStat
            icon="users"
            label="Jugadores"
            value={String(campaign.players.length).padStart(2, "0")}
          />
          <DetailStat
            icon="calendar"
            label="Próxima sesión"
            value={campaign.nextSession}
          />
          <DetailStat
            icon="clock"
            label="Última actividad"
            value={campaign.lastPlayed}
          />
        </section>
        <div className="detail-content-grid">
          <section className="panel detail-players">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">EL GRUPO</p>
                <h2>Jugadores</h2>
              </div>
              <button
                className="button button-quiet"
                type="button"
                disabled
                title="Disponible en una siguiente etapa"
              >
                <Icon name="plus" size={16} /> Invitar
              </button>
            </div>
            {campaign.players.length ? (
              <div className="player-list">
                {campaign.players.map((player) => (
                  <div className="player-row" key={player.initials}>
                    <span className={`player-avatar ${player.tone}`}>
                      {player.initials}
                    </span>
                    <span className="player-copy">
                      <strong>{player.name}</strong>
                      <small>{player.character}</small>
                    </span>
                    <span className="player-role">Jugador</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="detail-empty">
                <Icon name="users" size={22} />
                <p>Aún no hay jugadores en esta campaña.</p>
                <span>
                  La gestión de miembros estará disponible próximamente.
                </span>
              </div>
            )}
          </section>
          <section className="panel detail-session">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">LO QUE VIENE</p>
                <h2>Próxima sesión</h2>
              </div>
              <span className="panel-icon">
                <Icon name="calendar" size={18} />
              </span>
            </div>
            <div className="next-session-card">
              <div className="session-date session-date-empty">
                <Icon name="calendar" size={18} />
              </div>
              <div className="session-info">
                <strong>Sin sesiones programadas</strong>
                <span>La gestión de sesiones llegará próximamente.</span>
              </div>
            </div>
          </section>
        </div>
        <section className="panel campaign-about">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">EL MUNDO</p>
              <h2>Sobre esta campaña</h2>
            </div>
            <button
              className="button button-quiet"
              type="button"
              onClick={() => onEdit(campaign)}
            >
              Editar detalles
            </button>
          </div>
          <p>{campaign.longDescription}</p>
        </section>
      </div>
      {archiveDialogOpen && (
        <ArchiveCampaignDialog
          campaignTitle={campaign.title}
          onClose={() => setArchiveDialogOpen(false)}
          onArchive={() => onArchive(campaign.id)}
        />
      )}
    </>
  );
}

function DetailStat({
  icon,
  label,
  value,
}: {
  icon: "users" | "calendar" | "clock";
  label: string;
  value: string;
}) {
  return (
    <div className="detail-stat">
      <span className="detail-stat-icon">
        <Icon name={icon} size={17} />
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function RequestError({
  error,
  onRetry,
  title = "No pudimos cargar las campañas",
}: {
  error: Error;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <div className="empty-state request-error" role="alert">
      <span className="empty-state-icon">
        <Icon name="close" size={22} />
      </span>
      <h2>{title}</h2>
      <p>{error.message}</p>
      <button
        className="button button-secondary"
        type="button"
        onClick={onRetry}
      >
        Reintentar
      </button>
    </div>
  );
}

function EmptyCampaigns({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state campaign-empty-state">
      <span className="empty-state-icon">
        <Icon name="book" size={24} />
      </span>
      <h2>Tu primera aventura empieza aquí</h2>
      <p>Crea una campaña y dale forma al mundo que jugará tu mesa.</p>
      <button
        className="button button-primary"
        type="button"
        onClick={onCreate}
      >
        <Icon name="plus" size={16} /> Crear campaña
      </button>
    </div>
  );
}

function CampaignNotFound() {
  return (
    <div className="empty-state route-empty">
      <span className="empty-state-icon">
        <Icon name="search" size={24} />
      </span>
      <h1>No encontramos esa campaña</h1>
      <p>Puede que se haya archivado o que la dirección ya no sea válida.</p>
      <Link className="button button-secondary" to="/campaigns">
        Ver campañas
      </Link>
    </div>
  );
}

function getCampaignStatusClass(status: Campaign["status"]): string {
  if (status === "Activa") return "status-active";
  if (status === "En pausa") return "status-paused";
  return "status-finished";
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="empty-state route-empty">
      <span className="empty-state-icon">
        <Icon name="sparkles" size={24} />
      </span>
      <p className="eyebrow">EN PREPARACIÓN</p>
      <h1>{title}</h1>
      <p>Esta parte de Dungeon Desk estará disponible en una próxima etapa.</p>
      <Link className="button button-secondary" to="/">
        Volver al inicio
      </Link>
    </div>
  );
}

type AppRootProps = {
  initialTheme: Theme;
  hasSavedTheme: boolean;
};

function AuthGate({ theme, onToggleTheme }: Pick<AppProps, "theme" | "onToggleTheme">) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const authAction = location.pathname === "/verify-email"
    ? "verify" as const
    : location.pathname === "/reset-password"
      ? "reset" as const
      : null;
  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
    enabled: authAction === null,
  });
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
  });

  if (authAction) {
    return (
      <AuthActionScreen
        action={authAction}
        token={new URLSearchParams(location.search).get("token") ?? ""}
      />
    );
  }
  if (userQuery.isPending) {
    return <div className="auth-state">Conectando con Dungeon Desk…</div>;
  }
  if (userQuery.isError) {
    if (userQuery.error instanceof ApiError && userQuery.error.status === 401) {
      return <AuthScreen />;
    }
    return (
      <div className="auth-state" role="alert">
        <p>No se pudo comprobar la sesión: {userQuery.error.message}</p>
        <button className="button button-primary" onClick={() => void userQuery.refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <App
      theme={theme}
      onToggleTheme={onToggleTheme}
      user={userQuery.data}
      onSignOut={() => signOutMutation.mutate()}
    />
  );
}

type AuthView = "login" | "signup" | "forgot" | "resend";

function AuthScreen() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<AuthView>("login");
  const [feedback, setFeedback] = useState("");
  const authConfig = useQuery({
    queryKey: ["auth", "config"],
    queryFn: getAuthConfig,
    staleTime: Infinity,
    retry: false,
  });
  const registrationEnabled = authConfig.data?.registrationEnabled === true;
  const authMutation = useMutation<
    AuthenticatedUser | { message: string },
    Error,
    { email: string; password?: string }
  >({
    mutationFn: (credentials: { email: string; password?: string }) => {
      if (view === "signup") {
        return signUp({ email: credentials.email, password: credentials.password! });
      }
      if (view === "forgot") return requestPasswordReset(credentials.email);
      if (view === "resend") return requestEmailVerification(credentials.email);
      return signIn({ email: credentials.email, password: credentials.password! });
    },
    onSuccess: () => {
      if (view === "login") {
        void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      } else {
        setFeedback(
          view === "signup"
            ? "Si puedes registrar esa dirección, recibirás un correo para confirmarla."
            : view === "forgot"
              ? "Si existe una cuenta con esa dirección, recibirás instrucciones para restablecer la contraseña."
              : "Si hay una cuenta sin verificar con esa dirección, recibirás un enlace de confirmación.",
        );
        if (view === "signup") setView("login");
      }
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = form.get("password");
    authMutation.mutate({ email, ...(password ? { password: String(password) } : {}) });
  }

  const isPasswordEntry = view === "login" || view === "signup";
  const title = view === "signup" ? "Crea tu cuenta" : view === "forgot" ? "Recupera tu cuenta" : view === "resend" ? "Confirma tu correo" : "Te damos la bienvenida";

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand-mark"><Icon name="dice" size={24} /></div>
        <p className="auth-eyebrow">DUNGEON DESK</p>
        <h1>{title}</h1>
        <p className="auth-description">
          {view === "signup"
            ? "Regístrate y confirma tu correo para empezar."
            : view === "forgot"
              ? "Te enviaremos un enlace de un solo uso si encontramos la cuenta."
              : view === "resend"
                ? "Solicita otro enlace de confirmación."
                : "Inicia sesión para continuar con tus campañas."}
        </p>
        <label className="auth-label" htmlFor="auth-email">Correo electrónico</label>
        <input id="auth-email" className="auth-input" name="email" type="email" autoComplete="email" required maxLength={254} />
        {isPasswordEntry && (
          <>
            <label className="auth-label" htmlFor="auth-password">Contraseña</label>
            <input
              id="auth-password"
              className="auth-input"
              name="password"
              type="password"
              autoComplete={view === "signup" ? "new-password" : "current-password"}
              required
              minLength={view === "signup" ? 12 : 1}
              maxLength={128}
            />
          </>
        )}
        {authMutation.isError && <p className="auth-error" role="alert">{authMutation.error.message}</p>}
        {feedback && <p className="auth-feedback" role="status">{feedback}</p>}
        <button className="button button-primary auth-submit" type="submit" disabled={authMutation.isPending}>
          {authMutation.isPending ? "Un momento…" : view === "signup" ? "Crear cuenta" : view === "forgot" ? "Enviar instrucciones" : view === "resend" ? "Enviar confirmación" : "Iniciar sesión"}
        </button>
        {view === "login" && (
          <>
            <button className="auth-switch" type="button" onClick={() => { authMutation.reset(); setFeedback(""); setView("forgot"); }}>
              He olvidado mi contraseña
            </button>
            <button className="auth-switch" type="button" onClick={() => { authMutation.reset(); setFeedback(""); setView("resend"); }}>
              No recibí el correo de confirmación
            </button>
          </>
        )}
        {view !== "login" && (
          <button
            className="auth-switch"
            type="button"
            onClick={() => { authMutation.reset(); setFeedback(""); setView("login"); }}
          >
            {view === "signup" ? "Ya tengo una cuenta · Iniciar sesión" : "Volver a iniciar sesión"}
          </button>
        )}
        {view === "login" && registrationEnabled && (
          <button className="auth-switch" type="button" onClick={() => { authMutation.reset(); setFeedback(""); setView("signup"); }}>
            ¿Primera vez? Crear una cuenta
          </button>
        )}
      </form>
    </main>
  );
}

function AuthActionScreen({ action, token }: { action: "verify" | "reset"; token: string }) {
  const [complete, setComplete] = useState(false);
  const actionMutation = useMutation<
    { emailVerified: true } | { passwordReset: true },
    Error,
    string
  >({
    mutationFn: (password: string) =>
      action === "verify"
        ? verifyEmailRequest(token)
        : resetPasswordRequest({ token, password }),
    onSuccess: () => setComplete(true),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    actionMutation.mutate(String(form.get("password") ?? ""));
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand-mark"><Icon name="dice" size={24} /></div>
        <p className="auth-eyebrow">DUNGEON DESK</p>
        <h1>{complete ? "Todo listo" : action === "verify" ? "Confirma tu correo" : "Nueva contraseña"}</h1>
        {complete ? (
          <>
            <p className="auth-description">{action === "verify" ? "Tu dirección de correo quedó confirmada." : "La contraseña se actualizó. Las sesiones anteriores se cerraron."}</p>
            <Link className="button button-primary auth-submit" to="/">Ir a iniciar sesión</Link>
          </>
        ) : !token ? (
          <p className="auth-error" role="alert">Falta el token del enlace. Solicita uno nuevo.</p>
        ) : (
          <>
            <p className="auth-description">{action === "verify" ? "Pulsa para confirmar que controlas esta dirección." : "Elige una contraseña de al menos 12 caracteres."}</p>
            {action === "reset" && (
              <>
                <label className="auth-label" htmlFor="reset-password">Nueva contraseña</label>
                <input id="reset-password" className="auth-input" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
              </>
            )}
            {actionMutation.isError && <p className="auth-error" role="alert">{actionMutation.error.message}</p>}
            <button className="button button-primary auth-submit" type="submit" disabled={actionMutation.isPending}>
              {actionMutation.isPending ? "Un momento…" : action === "verify" ? "Confirmar correo" : "Guardar contraseña"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}

/** Owns the theme state and keeps the browser's color scheme in sync. */
function AppRoot({
  initialTheme,
  hasSavedTheme: initiallySaved,
}: AppRootProps) {
  const [theme, setTheme] = useState(initialTheme);
  const [hasSavedTheme, setHasSavedTheme] = useState(initiallySaved);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Follow system changes until the user explicitly chooses a theme.
  useEffect(() => {
    if (hasSavedTheme) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystemTheme = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", followSystemTheme);
    return () => mediaQuery.removeEventListener("change", followSystemTheme);
  }, [hasSavedTheme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    saveThemePreference(nextTheme);
    setHasSavedTheme(true);
    setTheme(nextTheme);
  }

  return (
    <BrowserRouter>
      <AuthGate theme={theme} onToggleTheme={toggleTheme} />
    </BrowserRouter>
  );
}

export default AppRoot;
