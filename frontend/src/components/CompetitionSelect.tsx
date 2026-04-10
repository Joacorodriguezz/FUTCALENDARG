import { League } from '../api/client';

/** Ligas temporalmente ocultas de la UI. */
const HIDDEN_LEAGUES = new Set(['Premier League', 'Serie A']);

/** Estas ligas quedan cubiertas por la pestaña "Liga Pro" — no tienen tab propio. */
const LIGA_PRO_COMPETITIONS = new Set([
  'Liga Profesional Argentina',
  'Copa Argentina',
  'Copa Libertadores',
  'Copa Sudamericana',
]);

/** Nombres cortos para mobile. */
const SHORT_NAME_MAP: Record<string, string> = {
  'Liga Profesional Argentina':      'LPF',
  'Premier League':                  'Premier',
  'UEFA Champions League':           'Champions',
  'Serie A':                         'Serie A',
  'Primera Division':                'La Liga',
  'Bundesliga':                      'Bundesliga',
  'Ligue 1':                         'Ligue 1',
  'Eredivisie':                      'Eredivisie',
  'Campeonato Brasileiro Série A':   'Brasileirao',
  'Primeira Liga':                   'Primeira',
  'EFL Championship':                'Championship',
  'UEFA European Championship':      'Eurocopa',
  'FIFA World Cup 2026':             'Mundial',
};

function shortName(name: string): string {
  return (
    SHORT_NAME_MAP[name] ??
    name.replace(/^(UEFA|FIFA|EFL|Campeonato Brasileiro)\s+/i, '').slice(0, 12)
  );
}

interface Props {
  mode: string;
  leagues: League[];
  onModeChange: (mode: string) => void;
}

const BASE_TAB =
  'flex-shrink-0 min-h-[44px] px-3 sm:px-4 py-2.5 rounded-t-md font-retro text-xs sm:text-sm uppercase tracking-widest transition-colors border border-b-0 flex items-center gap-1.5';
const ACTIVE_TAB =
  'relative z-10 bg-retro-green text-retro-gold border-retro-gold border-b-transparent mb-[-1px] pb-[11px] shadow-[inset_0_2px_0_0_rgba(255,215,0,0.35)]';
const INACTIVE_TAB =
  'bg-retro-card/90 text-retro-gray border-retro-border hover:bg-retro-card hover:text-retro-white';

export default function CompetitionSelect({ mode, leagues, onModeChange }: Props) {
  const leagueTabs = leagues.filter(
    (l) => !LIGA_PRO_COMPETITIONS.has(l.name) && !HIDDEN_LEAGUES.has(l.name),
  );

  const ligaProLeague = leagues.find((l) => l.name === 'Liga Profesional Argentina');

  const allItems = [
    { id: 'liga', name: 'Liga Profesional Argentina', logo: ligaProLeague?.logo ?? null },
    ...leagueTabs.map((l) => ({ id: l.id, name: l.name, logo: l.logo ?? null })),
  ];

  return (
    <div
      className="w-full border-t border-retro-border bg-retro-field"
      role="tablist"
      aria-label="Competición"
    >
      {/* ── MOBILE: grilla 3 columnas ── */}
      <div className="sm:hidden px-2 pt-2 pb-1">
        <div className="grid grid-cols-3 gap-1.5">
          {allItems.map((item) => {
            const isActive = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onModeChange(item.id)}
                className={[
                  'flex flex-col items-center justify-center gap-1 px-1 py-2 rounded font-retro text-[10px] uppercase tracking-widest transition-colors border min-h-[52px] text-center leading-tight',
                  isActive
                    ? 'bg-retro-green border-retro-gold text-retro-gold shadow-[inset_0_2px_0_0_rgba(255,215,0,0.35)]'
                    : 'bg-retro-card/90 border-retro-border text-retro-gray active:bg-retro-card active:text-retro-white',
                ].join(' ')}
              >
                {item.logo ? (
                  <img
                    src={item.logo}
                    alt=""
                    aria-hidden="true"
                    className="w-5 h-5 object-contain flex-shrink-0"
                  />
                ) : (
                  <span className="text-base leading-none">⚽</span>
                )}
                <span className="line-clamp-2">{shortName(item.name)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── DESKTOP: tabs horizontales con scroll ── */}
      <div className="hidden sm:block px-3 pt-2">
        <div className="flex gap-1.5 items-end overflow-x-auto pb-0 [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'liga'}
            id="tab-competition-liga"
            tabIndex={mode === 'liga' ? 0 : -1}
            onClick={() => onModeChange('liga')}
            className={`${BASE_TAB} ${mode === 'liga' ? ACTIVE_TAB : INACTIVE_TAB}`}
          >
            {ligaProLeague?.logo && (
              <img
                src={ligaProLeague.logo}
                alt=""
                aria-hidden="true"
                className="w-4 h-4 object-contain flex-shrink-0"
              />
            )}
            <span className="sm:hidden">LPF</span>
            <span className="hidden sm:inline">Liga Profesional</span>
          </button>

          {leagueTabs.map((league) => {
            const isActive = mode === league.id;
            return (
              <button
                key={league.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                id={`tab-competition-${league.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onModeChange(league.id)}
                className={`${BASE_TAB} ${isActive ? ACTIVE_TAB : INACTIVE_TAB}`}
              >
                {league.logo && (
                  <img
                    src={league.logo}
                    alt=""
                    aria-hidden="true"
                    className="w-4 h-4 object-contain flex-shrink-0"
                  />
                )}
                {league.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
