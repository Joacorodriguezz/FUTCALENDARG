import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getLogoByName, LP_TEAM_NAMES } from './data/equipos';
import {
  ConflictInfo,
  Partido,
  Team,
  addToCalendar,
  fetchAuthStatus,
  fetchFixtures,
  fetchTeams,
} from './api/client';
import { TeamSelector } from './components/TeamSelector';
import { MatchList } from './components/MatchList';
import { LoginModal } from './components/LoginModal';
import { ConflictModal } from './components/ConflictModal';
import ModeTabs from './components/ModeTabs';

const SESSION_KEY = 'partidos_pending';

type Toast = { type: 'success' | 'error'; message: string };

export default function App() {
  // Mode state
  const [mode, setMode] = useState<'liga' | 'mundial'>('liga');

  // Liga Profesional state
  const [team, setTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [partidos, setPartidos] = useState<Partido[]>([]);

  // World Cup state
  const [worldCupTeam, setWorldCupTeam] = useState<Team | null>(null);
  const [worldCupTeams, setWorldCupTeams] = useState<Team[]>([]);
  const [loadingWorldCupTeams, setLoadingWorldCupTeams] = useState(false);
  const [worldCupPartidos, setWorldCupPartidos] = useState<Partido[]>([]);

  // Shared state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingPartidos, setLoadingPartidos] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<ConflictInfo[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(t: Toast) {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  useEffect(() => {
    // Load Liga Profesional teams
    setLoadingTeams(true);
    fetchTeams()
      .then((teamsData) => {
        const lpTeams = teamsData.filter(t => LP_TEAM_NAMES.has(t.name));
        const wcTeams = teamsData.filter(t => t.division === 'World Cup');
        setTeams(lpTeams);
        setWorldCupTeams(wcTeams);
      })
      .catch(() => showToast({ type: 'error', message: 'Error al cargar los equipos.' }))
      .finally(() => {
        setLoadingTeams(false);
        setLoadingWorldCupTeams(false);
      });

    // Auth check + post-OAuth recovery
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');

    fetchAuthStatus().then(({ authenticated: isAuth }) => {
      setAuthenticated(isAuth);

      if (authResult === 'success' && isAuth) {
        window.history.replaceState({}, '', window.location.pathname);
        const pending = sessionStorage.getItem(SESSION_KEY);
        if (pending) {
          sessionStorage.removeItem(SESSION_KEY);
          const pendingPartidos: Partido[] = JSON.parse(pending);
          doAddToCalendar(pendingPartidos, false);
        }
      } else if (authResult === 'error') {
        window.history.replaceState({}, '', window.location.pathname);
        showToast({ type: 'error', message: 'Error al autenticarse con Google.' });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTeamSelect = useCallback(async (t: Team) => {
    if (mode === 'liga') {
      setTeam(t);
      setPartidos([]);
    } else {
      setWorldCupTeam(t);
      setWorldCupPartidos([]);
    }
    setSelected(new Set());
    setLoadingPartidos(true);
    try {
      const data = await fetchFixtures(t.id);
      if (mode === 'liga') {
        setPartidos(data);
      } else {
        setWorldCupPartidos(data);
      }
    } catch {
      showToast({ type: 'error', message: 'Error al cargar partidos. Intenta de nuevo.' });
    } finally {
      setLoadingPartidos(false);
    }
  }, [mode]);

  function togglePartido(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function doAddToCalendar(partidosToAdd: Partido[], force: boolean) {
    setLoadingCalendar(true);
    try {
      const result = await addToCalendar(partidosToAdd, force);

      if (result.duplicates.length > 0) {
        showToast({
          type: 'error',
          message: `${result.duplicates.length} partido(s) ya estaban en tu calendario.`,
        });
      }

      if (result.conflicts.length > 0) {
        setPendingConflicts(result.conflicts);
      }

      if (result.added > 0) {
        showToast({
          type: 'success',
          message: `${result.added} partido${result.added !== 1 ? 's' : ''} agregado${result.added !== 1 ? 's' : ''} al calendario.`,
        });
      }

      if (result.errors.length > 0) {
        showToast({
          type: 'error',
          message: `Error al agregar ${result.errors.length} partido(s).`,
        });
      }

      const nothingHappened =
        result.added === 0 &&
        result.errors.length === 0 &&
        result.duplicates.length === 0 &&
        result.conflicts.length === 0;

      if (nothingHappened) {
        showToast({ type: 'error', message: 'No se pudo procesar ningun partido.' });
      }

      setSelected(new Set());
    } catch (err: unknown) {
      const isUnauth = err instanceof Error && (err as Error & { status?: number }).status === 401;
      if (isUnauth) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(partidosToAdd));
        setAuthenticated(false);
        setShowLogin(true);
      } else {
        showToast({ type: 'error', message: 'Error al agregar al calendario.' });
      }
    } finally {
      setLoadingCalendar(false);
    }
  }

  function handleAddToCalendar() {
    const currentPartidos = mode === 'liga' ? partidos : worldCupPartidos;
    const toAdd = currentPartidos.filter((p) => selected.has(p.id));
    if (toAdd.length === 0) return;
    if (!authenticated) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(toAdd));
      setShowLogin(true);
    } else {
      doAddToCalendar(toAdd, false);
    }
  }

  function handleAddAll() {
    const currentPartidos = mode === 'liga' ? partidos : worldCupPartidos;
    if (currentPartidos.length === 0) return;
    if (!authenticated) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentPartidos));
      setShowLogin(true);
    } else {
      doAddToCalendar(currentPartidos, false);
    }
  }

  function handleModeChange(newMode: 'liga' | 'mundial') {
    setMode(newMode);
    setSelected(new Set());
  }

  function handleConfirmConflicts() {
    const conflictPartidos = pendingConflicts.map((c) => c.partido);
    setPendingConflicts([]);
    doAddToCalendar(conflictPartidos, true);
  }

  const currentTeam = mode === 'liga' ? team : worldCupTeam;
  const currentTeams = mode === 'liga' ? teams : worldCupTeams;
  const currentLoadingTeams = mode === 'liga' ? loadingTeams : loadingWorldCupTeams;
  const currentPartidos = mode === 'liga' ? partidos : worldCupPartidos;
  const teamLogoSrc = currentTeam ? (currentTeam.logo || getLogoByName(currentTeam.name) || '') : '';

  return (
    <div className="min-h-screen bg-retro-bg flex flex-col">
      {/* Header */}
      <header className="bg-retro-field border-b-2 border-retro-gold relative scanlines">
        <div className="px-3 py-2 flex items-center gap-3">
          <h1 className="font-display text-2xl sm:text-4xl text-retro-gold tracking-widest flex-shrink-0">
            FUTCALENDARG
          </h1>
          {currentTeam && (
            <button
              onClick={() => {
                if (mode === 'liga') {
                  setTeam(null);
                  setPartidos([]);
                } else {
                  setWorldCupTeam(null);
                  setWorldCupPartidos([]);
                }
                setSelected(new Set());
              }}
              className="ml-auto text-retro-gray font-retro text-sm uppercase tracking-wider hover:text-retro-gold transition-colors border border-retro-border px-4 py-2.5 min-h-[44px] flex items-center flex-shrink-0"
            >
              INICIO
            </button>
          )}
        </div>
        <TeamSelector
          teams={currentTeams}
          loading={currentLoadingTeams}
          selected={currentTeam}
          onChange={handleTeamSelect}
        />
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-8">
        {/* Mode Tabs */}
        <ModeTabs mode={mode} onModeChange={handleModeChange} />

        {!currentTeam ? (
          <div className="flex flex-col items-center justify-center min-h-[55vh] text-center">
            <div className="border-2 border-retro-gold p-10 max-w-xl w-full relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-retro-bg px-4">
                <span className="font-display text-retro-gold text-sm tracking-widest">
                  {mode === 'liga' ? 'LIGA PROFESIONAL ARG' : 'MUNDIAL 2026'}
                </span>
              </div>
              <div className="text-7xl mb-6 leading-none">
                {mode === 'liga' ? '⚽' : '🏆'}
              </div>
              <h2 className="font-display text-5xl text-retro-white tracking-widest mb-4 uppercase leading-tight">
                TUS PARTIDOS<br />
                <span className="text-retro-gold">EN GOOGLE CALENDAR</span>
              </h2>
              <p className="font-retro text-retro-gray text-base uppercase tracking-widest leading-relaxed">
                {mode === 'liga'
                  ? 'Selecciona tu equipo en la barra de arriba'
                  : 'Selecciona tu selección en la barra de arriba'
                }<br />
                y agrega los proximos partidos a tu calendario
              </p>
              <div className="mt-8 pt-4 border-t border-retro-border">
                <p className="font-display text-retro-gold text-lg tracking-widest animate-pulse">
                  {mode === 'liga' ? '↑ ELEGÍ TU EQUIPO ↑' : '↑ ELEGÍ TU SELECCIÓN ↑'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Selected team display */}
            <div className="flex flex-col items-center mb-6 pb-5 border-b-2 border-retro-border">
              <img
                src={teamLogoSrc}
                alt={currentTeam.name}
                className="w-20 h-20 object-contain mb-3"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <h2 className="font-display text-4xl text-retro-gold tracking-widest uppercase">
                {currentTeam.name}
              </h2>
            </div>

            {/* Loading state */}
            {loadingPartidos ? (
              <div className="flex justify-center items-center gap-3 py-16">
                <svg className="animate-spin h-6 w-6 text-retro-gold" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                <span className="font-display text-retro-gray tracking-widest text-xl uppercase">
                  Cargando partidos...
                </span>
              </div>
            ) : (
              <MatchList
                partidos={currentPartidos}
                selected={selected}
                onToggle={togglePartido}
                onAddToCalendar={handleAddToCalendar}
                onAddAll={handleAddAll}
                loading={loadingCalendar}
              />
            )}
          </div>
        )}
      </main>


      {/* Footer */}
      <footer className="border-t border-retro-border py-4 px-4 text-center">
        <p className="font-retro text-retro-gray text-xs uppercase tracking-widest">
          <a href="/terms.html" className="hover:text-retro-gold transition-colors">Condiciones de uso</a>
          <span className="mx-3 opacity-40">|</span>
          <a href="/privacy.html" className="hover:text-retro-gold transition-colors">Política de privacidad</a>
        </p>
      </footer>
      {/* Login Modal */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      {/* Conflict Modal */}
      {pendingConflicts.length > 0 && (
        <ConflictModal
          conflicts={pendingConflicts}
          onConfirm={handleConfirmConflicts}
          onCancel={() => setPendingConflicts([])}
        />
      )}

      {/* Toast — portal al body para evitar bugs de position:fixed en iOS Safari */}
      {toast && createPortal(
        <div
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          className={`fixed left-1/2 -translate-x-1/2 w-[90vw] max-w-sm px-5 py-3 font-display text-base tracking-widest shadow-lg border-2 uppercase text-center z-[9999] ${
            toast.type === 'success'
              ? 'bg-retro-green-light border-retro-gold text-retro-white'
              : 'bg-retro-red border-retro-gold text-retro-white'
          }`}
        >
          {toast.message}
        </div>,
        document.body
      )}
    </div>
  );
}
