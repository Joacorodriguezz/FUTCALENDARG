/** Id values align with App mode state; add entries here as new competitions ship. */
export const COMPETITION_OPTIONS = [
  { id: 'liga' as const, label: 'Liga Profesional', shortLabel: 'Liga Pro' },
  { id: 'mundial' as const, label: 'Mundial 2026', shortLabel: 'Mundial' },
] as const;

export type CompetitionId = (typeof COMPETITION_OPTIONS)[number]['id'];

interface CompetitionSelectProps {
  mode: CompetitionId;
  onModeChange: (mode: CompetitionId) => void;
}

/**
 * Pestañas tipo “folder”: la pestaña activa comparte fondo con la franja del equipo abajo.
 * Con muchas competiciones, la fila puede hacer scroll horizontal (overflow-x-auto).
 */
export default function CompetitionSelect({ mode, onModeChange }: CompetitionSelectProps) {
  return (
    <div
      className="w-full border-t border-retro-border bg-retro-field px-2 sm:px-3 pt-2"
      role="tablist"
      aria-label="Competición"
    >
      <div className="flex gap-1 sm:gap-1.5 items-end overflow-x-auto pb-0 [-webkit-overflow-scrolling:touch]">
        {COMPETITION_OPTIONS.map((opt) => {
          const isActive = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              id={`tab-competition-${opt.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onModeChange(opt.id)}
              className={[
                'flex-shrink-0 min-h-[44px] px-3 sm:px-4 py-2.5 rounded-t-md font-retro text-xs sm:text-sm uppercase tracking-widest transition-colors border border-b-0',
                isActive
                  ? 'relative z-10 bg-retro-green text-retro-gold border-retro-gold border-b-transparent mb-[-1px] pb-[11px] shadow-[inset_0_2px_0_0_rgba(255,215,0,0.35)]'
                  : 'bg-retro-card/90 text-retro-gray border-retro-border hover:bg-retro-card hover:text-retro-white',
              ].join(' ')}
            >
              <span className="sm:hidden">{opt.shortLabel}</span>
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
