import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useSearchParams,
  useParams,
} from "react-router-dom";
import { ArchiveCampaignDialog } from "./features/campaigns/ArchiveCampaignDialog";
import { CampaignMembersPanel } from "./features/campaigns/CampaignMembersPanel";
import { CampaignDialog } from "./features/campaigns/CampaignDialog";
import { DeleteCampaignDialog } from "./features/campaigns/DeleteCampaignDialog";
import { IncomingCampaignInvitations } from "./features/campaigns/IncomingCampaignInvitations";
import type {
  Campaign,
  CampaignSaveInput,
  DashboardCampaign,
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
  deleteCampaign as deleteCampaignRequest,
  createCampaign as createCampaignRequest,
  getCampaign,
  getCampaignDashboard,
  listCampaigns,
  updateCampaign as updateCampaignRequest,
  listCampaignMembers,
  respondToCampaignInvitation,
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
const DASHBOARD_QUERY_KEY = ["campaign-dashboard"] as const;

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
  const dashboardQuery = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: getCampaignDashboard,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const navigate = useNavigate();
  const campaigns = campaignsQuery.data ?? [];
  const hasDmCampaigns = dashboardQuery.data?.some((campaign) => campaign.role === "DM") ?? false;
  const hasPlayerCampaigns = dashboardQuery.data?.some((campaign) => campaign.role === "PLAYER") ?? false;
  const workspaceRole = hasDmCampaigns && hasPlayerCampaigns
    ? "DM y jugador"
    : hasDmCampaigns
      ? "Dungeon Master"
      : hasPlayerCampaigns
        ? "Jugador"
        : "Tu mesa";
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
  const deleteCampaignMutation = useMutation({
    mutationFn: ({ id, confirmation }: { id: string; confirmation: string }) =>
      deleteCampaignRequest(id, confirmation),
    onSuccess: async (_result, variables) => {
      queryClient.removeQueries({ queryKey: ["campaign", variables.id] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CAMPAIGNS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY }),
      ]);
      navigate("/campaigns");
    },
  });

  function addCampaignToCache(campaign: Campaign) {
    queryClient.setQueryData<Campaign[]>(CAMPAIGNS_QUERY_KEY, (current) => [
      campaign,
      ...(current ?? []),
    ]);
    queryClient.setQueryData(["campaign", campaign.id], campaign);
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
  }

  function updateCampaignInCache(campaign: Campaign) {
    queryClient.setQueryData<Campaign[]>(CAMPAIGNS_QUERY_KEY, (current) =>
      current?.map((item) => (item.id === campaign.id ? campaign : item)),
    );
    queryClient.setQueryData(["campaign", campaign.id], campaign);
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
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

  async function handleDeleteCampaign(id: string, confirmation: string) {
    await deleteCampaignMutation.mutateAsync({ id, confirmation });
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        onSignOut={onSignOut}
        workspaceRole={workspaceRole}
        hasDmCampaigns={hasDmCampaigns}
        hasPlayerCampaigns={hasPlayerCampaigns}
      />
      <div className="main-column">
        <Topbar
          onNewCampaign={openCreateCampaign}
          theme={theme}
          onToggleTheme={onToggleTheme}
          user={user}
          onSignOut={onSignOut}
          workspaceRole={workspaceRole}
        />
        {/* Keep the first release focused on campaign discovery and details. */}
        <main className="page-content" id="main-content">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  campaigns={dashboardQuery.data ?? []}
                  onNewCampaign={openCreateCampaign}
                  isLoading={dashboardQuery.isLoading}
                  error={dashboardQuery.error}
                  onRetry={() => void dashboardQuery.refetch()}
                />
              }
            />
            <Route
              path="/campaigns"
              element={
                <CampaignsPage
                  campaigns={campaigns}
                  dashboardCampaigns={dashboardQuery.data ?? []}
                  dashboardLoading={dashboardQuery.isLoading}
                  dashboardError={dashboardQuery.error}
                  onRetryDashboard={() => void dashboardQuery.refetch()}
                  onNewCampaign={openCreateCampaign}
                  {...queryState}
                />
              }
            />
            <Route
              path="/campaigns/:campaignId"
              element={
              <CampaignDetail
                currentUserId={user.id}
                onEdit={openEditCampaign}
                onArchive={handleArchiveCampaign}
                onDelete={handleDeleteCampaign}
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
function Sidebar({
  user,
  onSignOut,
  workspaceRole,
  hasDmCampaigns,
  hasPlayerCampaigns,
}: {
  user: AuthenticatedUser;
  onSignOut: () => void;
  workspaceRole: string;
  hasDmCampaigns: boolean;
  hasPlayerCampaigns: boolean;
}) {
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
          <span>{workspaceRole}</span>
        </div>
        <Icon name="chevrons" size={16} className="muted-icon" />
      </div>

      <nav className="side-nav">
        <p className="nav-label">ESPACIO DE JUEGO</p>
        <NavItem to="/" icon="home" label="Inicio" end />
        <NavItem to="/campaigns" icon="book" label="Campañas" excludeSearchKey="role" />
        {hasDmCampaigns && (
          <NavItem
            to="/campaigns?role=DM"
            icon="scroll"
            label="Como DM"
            activeSearch={{ key: "role", value: "DM" }}
          />
        )}
        {hasPlayerCampaigns && (
          <NavItem
            to="/campaigns?role=PLAYER"
            icon="users"
            label="Como jugador"
            activeSearch={{ key: "role", value: "PLAYER" }}
          />
        )}
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
  activeSearch,
  excludeSearchKey,
}: {
  to: string;
  icon: "home" | "book" | "users" | "scroll";
  label: string;
  end?: boolean;
  activeSearch?: { key: string; value: string };
  excludeSearchKey?: string;
}) {
  const location = useLocation();
  return (
    <NavLink
      className={({ isActive }) => {
        const search = new URLSearchParams(location.search);
        const searchMatches = activeSearch
          ? search.get(activeSearch.key) === activeSearch.value
          : !excludeSearchKey || !search.has(excludeSearchKey);
        return `nav-item${isActive && searchMatches ? " is-active" : ""}`;
      }}
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
  workspaceRole,
}: {
  onNewCampaign: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  user: AuthenticatedUser;
  onSignOut: () => void;
  workspaceRole: string;
}) {
  const location = useLocation();
  const context = location.pathname.startsWith("/campaigns/")
    ? "Detalle de campaña"
    : location.pathname === "/campaigns"
      ? "Campañas"
      : location.pathname === "/characters"
        ? "Personajes"
        : location.pathname === "/notes"
          ? "Notas"
          : workspaceRole;

  return (
    <header className="topbar">
      <div className="topbar-context">
        <span>Dungeon Desk</span>
        <Icon name="chevron" size={14} />
        <strong>{context}</strong>
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

/** Home page with sections derived from the user's role in each campaign. */
function Dashboard({
  campaigns,
  onNewCampaign,
  isLoading,
  error,
  onRetry,
}: {
  campaigns: DashboardCampaign[];
  onNewCampaign: () => void;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const dmCampaigns = campaigns.filter((campaign) => campaign.role === "DM");
  const playerCampaigns = campaigns.filter(
    (campaign) => campaign.role === "PLAYER",
  );
  const activeDmCampaigns = dmCampaigns.filter((campaign) => campaign.statusCode === "ACTIVE");
  const activePlayerCampaigns = playerCampaigns.filter((campaign) => campaign.statusCode === "ACTIVE");
  const pendingInvitations = dmCampaigns
    .filter((campaign) => campaign.statusCode !== "ARCHIVED")
    .reduce(
    (total, campaign) => total + campaign.pendingInvitationCount,
    0,
  );

  return (
    <div className="page-stack">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-dot" /> {todayLabel}
          </p>
          <h1>
            Tu mesa, <span>desde aquí.</span>
          </h1>
          <p className="welcome-copy">
            Campañas y accesos rápidos según tu papel en cada aventura.
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

      <IncomingCampaignInvitations />

      {!isLoading && !error && campaigns.length > 0 && (
        <section className="summary-grid" aria-label="Resumen de tus campañas">
          {dmCampaigns.length > 0 && (
            <>
              <SummaryCard
                icon="book"
                label="Campañas activas como DM"
                value={String(activeDmCampaigns.length).padStart(2, "0")}
                foot="campañas que administras"
                tone="gold"
              />
              <SummaryCard
                icon="users"
                label="Jugadores"
                value={String(
                  activeDmCampaigns.reduce((total, campaign) => total + campaign.playerCount, 0),
                ).padStart(2, "0")}
                foot="en tus campañas como DM"
                tone="blue"
              />
              <SummaryCard
                icon="calendar"
                label="Invitaciones pendientes"
                value={String(pendingInvitations).padStart(2, "0")}
                foot="en tus campañas como DM"
                tone="sage"
              />
            </>
          )}
          {activePlayerCampaigns.length > 0 && dmCampaigns.length === 0 && (
            <SummaryCard
              icon="book"
              label="Campañas activas como jugador"
              value={String(activePlayerCampaigns.length).padStart(2, "0")}
              foot="aventuras en las que participas"
              tone="blue"
            />
          )}
        </section>
      )}

      {isLoading ? (
        <LoadingState label="Preparando tu espacio de juego…" />
      ) : error ? (
        <RequestError
          error={error}
          title="No pudimos preparar tu dashboard"
          onRetry={onRetry}
        />
      ) : campaigns.length === 0 ? (
        <EmptyCampaigns onCreate={onNewCampaign} />
      ) : (
        <>
          {dmCampaigns.length > 0 && (
            <DashboardCampaignSection
              title="Campañas que diriges"
              eyebrow="ESPACIO DEL DM"
              campaigns={dmCampaigns}
            />
          )}
          {playerCampaigns.length > 0 && (
            <DashboardCampaignSection
              title="Campañas en las que juegas"
              eyebrow="ESPACIO DEL JUGADOR"
              campaigns={playerCampaigns}
            />
          )}
        </>
      )}
    </div>
  );
}

function DashboardCampaignSection({
  title,
  eyebrow,
  campaigns,
}: {
  title: string;
  eyebrow: string;
  campaigns: DashboardCampaign[];
}) {
  const visibleCampaigns = campaigns
    .filter((campaign) => campaign.statusCode !== "ARCHIVED")
    .slice(0, 3);

  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <Link className="text-link" to="/campaigns">
          Ver todas <Icon name="arrow-right" size={16} />
        </Link>
      </div>
      {visibleCampaigns.length === 0 ? (
        <div className="empty-state campaign-empty-state">
          <span className="empty-state-icon"><Icon name="book" size={24} /></span>
          <h2>No hay campañas activas aquí</h2>
          <p>Tus campañas archivadas siguen disponibles en el listado completo.</p>
          <Link className="button button-secondary" to="/campaigns">Ver campañas</Link>
        </div>
      ) : (
        <div className="campaign-grid dashboard-campaign-grid">
          {visibleCampaigns.map((campaign) => (
            <CampaignCard
              campaign={campaign}
              playerCount={campaign.playerCount}
              key={campaign.id}
            />
          ))}
          {campaigns.some((campaign) => campaign.statusCode === "ARCHIVED") && (
            <Link className="create-campaign-card" to="/campaigns">
              <span className="create-card-icon"><Icon name="arrow-right" size={20} /></span>
              <strong>Ver todas las campañas</strong>
              <span>Incluye campañas archivadas</span>
            </Link>
          )}
        </div>
      )}
      {campaigns.some((campaign) => campaign.pendingInvitationCount > 0) && (
        <p className="dashboard-invitation-note" role="status">
          {campaigns.reduce((total, campaign) => total + campaign.pendingInvitationCount, 0)} invitaciones pendientes. Abre una campaña para gestionar sus miembros.
        </p>
      )}
    </section>
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
  dashboardCampaigns,
  dashboardLoading,
  dashboardError,
  onRetryDashboard,
  onNewCampaign,
  isLoading,
  error,
  onRetry,
}: {
  campaigns: Campaign[];
  dashboardCampaigns: DashboardCampaign[];
  dashboardLoading: boolean;
  dashboardError: Error | null;
  onRetryDashboard: () => void;
  onNewCampaign: () => void;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [sortOrder, setSortOrder] = useState<"updated" | "name" | "level">("updated");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRole = searchParams.get("role");
  const roleFilter = requestedRole === "DM" || requestedRole === "PLAYER"
    ? requestedRole
    : null;
  const dashboardById = new Map(
    dashboardCampaigns.map((campaign) => [campaign.id, campaign]),
  );
  const filters = ["Todas", "Activas", "En pausa", "Finalizadas", "Archivadas"];
  const statusByFilter: Record<string, Campaign["status"]> = {
    Activas: "Activa",
    "En pausa": "En pausa",
    Finalizadas: "Finalizada",
    Archivadas: "Archivada",
  };
  const sourceCampaigns = roleFilter
    ? dashboardCampaigns.filter((campaign) => campaign.role === roleFilter)
    : campaigns;
  const visibleCampaigns = sourceCampaigns.filter((campaign) => {
    const matchesQuery = `${campaign.title} ${campaign.description} ${"tags" in campaign ? campaign.tags.join(" ") : ""}`
      .toLocaleLowerCase("es")
      .includes(query.toLocaleLowerCase("es"));
    const matchesFilter =
      filter === "Todas" || campaign.status === statusByFilter[filter];
    return matchesQuery && matchesFilter;
  }).sort((first, second) => {
    if (sortOrder === "name") return first.title.localeCompare(second.title, "es");
    if (sortOrder === "level") return second.initialLevel - first.initialLevel;
    return Date.parse(second.updatedAt) - Date.parse(first.updatedAt);
  });
  const requestError = error ?? (roleFilter ? dashboardError : null);
  const retryRequest = error ? onRetry : onRetryDashboard;

  return (
    <div className="page-stack campaigns-page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">TU BIBLIOTECA DE AVENTURAS</p>
          <h1>
            {roleFilter === "DM"
              ? "Campañas que diriges"
              : roleFilter === "PLAYER"
                ? "Campañas en las que juegas"
                : "Tus campañas"}
          </h1>
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
      <div className="filter-tabs role-filter-tabs" role="group" aria-label="Filtrar por rol">
        <button
          type="button"
          className={`filter-tab${roleFilter === null ? " selected" : ""}`}
          aria-pressed={roleFilter === null}
          onClick={() => setSearchParams({})}
        >
          Todos los roles
        </button>
        {dashboardCampaigns.some((campaign) => campaign.role === "DM") && (
          <button
            type="button"
            className={`filter-tab${roleFilter === "DM" ? " selected" : ""}`}
            aria-pressed={roleFilter === "DM"}
            onClick={() => setSearchParams({ role: "DM" })}
          >
            Como DM
          </button>
        )}
        {dashboardCampaigns.some((campaign) => campaign.role === "PLAYER") && (
          <button
            type="button"
            className={`filter-tab${roleFilter === "PLAYER" ? " selected" : ""}`}
            aria-pressed={roleFilter === "PLAYER"}
            onClick={() => setSearchParams({ role: "PLAYER" })}
          >
            Como jugador
          </button>
        )}
      </div>
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
              {item === "Todas" && <span>{sourceCampaigns.length}</span>}
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
        <label className="sort-field">
          <span>Ordenar</span>
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}>
            <option value="updated">Más recientes</option>
            <option value="name">Nombre A–Z</option>
            <option value="level">Nivel inicial</option>
          </select>
        </label>
      </div>
      {isLoading || (roleFilter !== null && dashboardLoading) ? (
        <LoadingState label="Cargando campañas…" />
      ) : requestError ? (
        <RequestError error={requestError} onRetry={retryRequest} />
      ) : visibleCampaigns.length > 0 ? (
        <div className="campaign-grid all-campaigns-grid">
          {visibleCampaigns.map((campaign) => (
            <CampaignCard
              campaign={campaign}
              playerCount={dashboardById.get(campaign.id)?.playerCount ?? campaign.players.length}
              key={campaign.id}
            />
          ))}
        </div>
      ) : campaigns.length === 0 && !roleFilter ? (
        <EmptyCampaigns onCreate={onNewCampaign} />
      ) : sourceCampaigns.length === 0 && roleFilter ? (
        <div className="empty-state campaign-empty-state">
          <span className="empty-state-icon"><Icon name="book" size={24} /></span>
          <h2>No hay campañas con este rol</h2>
          <p>Elige otro rol o vuelve a ver todas tus campañas.</p>
          <button className="button button-secondary" type="button" onClick={() => setSearchParams({})}>
            Ver todos los roles
          </button>
        </div>
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

function CampaignCard({
  campaign,
  playerCount = campaign.players.length,
}: {
  campaign: Campaign;
  playerCount?: number;
}) {
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
        {campaign.tags.length > 0 && (
          <div className="campaign-card-tags" aria-label="Etiquetas">
            {campaign.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        )}
        <div className="campaign-card-meta">
          <span>
            <Icon name="users" size={15} />
            {playerCount} {playerCount === 1 ? "jugador" : "jugadores"}
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
          ) : playerCount > 0 ? (
            <span className="no-players">{playerCount} en la mesa</span>
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
  currentUserId,
  onEdit,
  onArchive,
  onDelete,
}: {
  currentUserId: string;
  onEdit: (campaign: Campaign) => void;
  onArchive: (id: string) => Promise<void>;
  onDelete: (id: string, confirmation: string) => Promise<void>;
}) {
  const { campaignId } = useParams();
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const campaignQuery = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => getCampaign(campaignId!),
    enabled: Boolean(campaignId),
  });
  const membersQuery = useQuery({
    queryKey: ["campaign-members", campaignId],
    queryFn: () => listCampaignMembers(campaignId!),
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
  const currentMembership = membersQuery.data?.find((member) => member.userId === currentUserId);
  const canManageCampaign = currentMembership?.role === "DM";
  const canDeleteCampaign = campaign.ownerId === currentUserId && campaign.statusCode === "ARCHIVED";
  const playerCount = membersQuery.data?.filter((member) => member.role === "PLAYER").length ?? 0;

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
              {campaign.edition} <span>·</span> Nivel inicial {campaign.initialLevel}
            </p>
            <h1>{campaign.title}</h1>
            <p className="detail-description">{campaign.description}</p>
            {campaign.tags.length > 0 && (
              <div className="campaign-tag-list" aria-label="Etiquetas de campaña">
                {campaign.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            )}
            <div className="detail-hero-actions">
              {canManageCampaign && <button
                className="button button-light"
                type="button"
                onClick={() => onEdit(campaign)}
              >
                <Icon name="scroll" size={16} /> Editar detalles
              </button>}
              {canManageCampaign && <button
                className="button button-danger"
                type="button"
                onClick={() => setArchiveDialogOpen(true)}
                disabled={campaign.statusCode === "ARCHIVED"}
              >
                {campaign.statusCode === "ARCHIVED" ? "Archivada" : "Archivar"}
              </button>}
              {canDeleteCampaign && (
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Eliminar definitivamente
                </button>
              )}
            </div>
          </div>
        </section>
        <section className="detail-stats">
          <DetailStat
            icon="users"
            label="Jugadores"
            value={String(playerCount).padStart(2, "0")}
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
          <CampaignMembersPanel
            campaignId={campaign.id}
            currentUserId={currentUserId}
            ownerId={campaign.ownerId}
          />
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
            {canManageCampaign && (
              <button
                className="button button-quiet"
                type="button"
                onClick={() => onEdit(campaign)}
              >
                Editar detalles
              </button>
            )}
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
      {deleteDialogOpen && (
        <DeleteCampaignDialog
          campaignTitle={campaign.title}
          onClose={() => setDeleteDialogOpen(false)}
          onDelete={() => onDelete(campaign.id, campaign.title)}
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
      <p>Crea una campaña para dirigir o acepta una invitación por correo para unirte a una mesa.</p>
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
  const invitationAction = location.pathname === "/accept-invitation";
  const authAction = location.pathname === "/verify-email"
    ? "verify" as const
    : location.pathname === "/reset-password"
      ? "reset" as const
      : null;
  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
    enabled: authAction === null && !invitationAction,
  });
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      queryClient.removeQueries({
        predicate: (query) =>
          [
            "campaigns",
            "campaign-dashboard",
            "campaign",
            "campaign-members",
            "campaign-invitations",
            "incoming-campaign-invitations",
          ].includes(String(query.queryKey[0])),
      });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  if (authAction) {
    return (
      <AuthActionScreen
        action={authAction}
        token={new URLSearchParams(location.search).get("token") ?? ""}
      />
    );
  }
  if (invitationAction) {
    return <InvitationActionScreen token={new URLSearchParams(location.search).get("token") ?? ""} />;
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
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>("login");
  const [feedback, setFeedback] = useState("");
  const authConfig = useQuery({
    queryKey: ["auth", "config"],
    queryFn: getAuthConfig,
    staleTime: Infinity,
    retry: false,
  });
  const registrationEnabled = authConfig.data?.registrationEnabled === true;
  const emailDeliveryHint = authConfig.data
    ? authConfig.data.emailDelivery === "smtp"
      ? " Revisa también la carpeta de correo no deseado."
      : " En este entorno no se envía por Internet: revisa apps/api/var/mail en el PC anfitrión."
    : "";
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
        const pendingInvitation = sessionStorage.getItem("pendingCampaignInvitation");
        if (pendingInvitation) {
          sessionStorage.removeItem("pendingCampaignInvitation");
          navigate(`/accept-invitation?token=${encodeURIComponent(pendingInvitation)}`);
        }
      } else {
        const message =
          view === "signup"
            ? "Si puedes registrar esa dirección, recibirás un correo para confirmarla."
            : view === "forgot"
              ? "Si existe una cuenta con esa dirección, recibirás instrucciones para restablecer la contraseña."
              : "Si hay una cuenta sin verificar con esa dirección, recibirás un enlace de confirmación.";
        setFeedback(`${message}${emailDeliveryHint}`);
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

function InvitationActionScreen({ token }: { token: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const invitationMutation = useMutation({
    mutationFn: (decision: "accept" | "reject") => respondToCampaignInvitation(token, decision),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      await queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["incoming-campaign-invitations"] });
      if ("campaignId" in result) {
        await queryClient.invalidateQueries({ queryKey: ["campaign-members", result.campaignId] });
        navigate(`/campaigns/${result.campaignId}`);
      } else {
        navigate("/");
      }
    },
  });

  if (!token) {
    return <InvitationMessage title="Enlace incompleto" message="Falta el código de invitación. Solicita al DM que envíe una nueva invitación." />;
  }
  if (userQuery.isPending) return <div className="auth-state">Comprobando tu sesión…</div>;
  if (userQuery.isError) {
    if (userQuery.error instanceof ApiError && userQuery.error.status === 401) {
      return (
        <InvitationMessage
          title="Tienes una invitación"
          message="Inicia sesión con el correo al que se envió la invitación para aceptarla."
          action={(
            <button
              className="button button-primary auth-submit"
              type="button"
              onClick={() => {
                sessionStorage.setItem("pendingCampaignInvitation", token);
                navigate("/");
              }}
            >
              Iniciar sesión
            </button>
          )}
        />
      );
    }
    return <InvitationMessage title="No pudimos comprobar tu sesión" message={userQuery.error.message} />;
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand-mark"><Icon name="users" size={24} /></div>
        <p className="auth-eyebrow">DUNGEON DESK</p>
        <h1>Invitación a campaña</h1>
        <p className="auth-description">Sesión iniciada como {userQuery.data.email}. Solo la cuenta con el correo invitado puede aceptar.</p>
        {invitationMutation.error && <p className="auth-error" role="alert">{invitationMutation.error.message}</p>}
        <button className="button button-primary auth-submit" type="button" disabled={invitationMutation.isPending} onClick={() => invitationMutation.mutate("accept")}>
          Aceptar invitación
        </button>
        <button className="auth-switch" type="button" disabled={invitationMutation.isPending} onClick={() => invitationMutation.mutate("reject")}>
          Rechazar invitación
        </button>
        <button className="auth-switch" type="button" onClick={() => navigate("/")}>Volver al inicio</button>
      </section>
    </main>
  );
}

function InvitationMessage({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand-mark"><Icon name="users" size={24} /></div>
        <p className="auth-eyebrow">DUNGEON DESK</p>
        <h1>{title}</h1>
        <p className="auth-description">{message}</p>
        {action}
      </section>
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
