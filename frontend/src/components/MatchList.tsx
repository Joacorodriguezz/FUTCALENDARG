import { Partido } from '../api/client';
import { MatchCard } from './MatchCard';

interface Props {
  partidos: Partido[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAddToCalendar: () => void;
  onAddAll: () => void;
  loading: boolean;
}

export function MatchList({ partidos, selected, onToggle, onAddToCalendar, onAddAll, loading }: Props) {
  if (partidos.length === 0) {
    return (
      <p className="text-retro-gray text-center font-retro uppercase tracking-widest mt-8 border border-retro-border p-6">
        No hay próximos partidos encontrados.
      </p>
    );
  }

  return (
    <div className="w-full">
      {/* Action buttons — seleccionar primero, agregar todos segundo */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <button
          onClick={onAddToCalendar}
          disabled={selected.size === 0 || loading}
          className="flex-1 bg-retro-gold text-retro-bg font-display text-xl tracking-widest py-3 border-2 border-retro-gold-dark hover:bg-retro-gold-dark hover:text-retro-white disabled:bg-retro-card disabled:text-retro-gray disabled:border-retro-border disabled:cursor-not-allowed uppercase transition-colors"
        >
          {selected.size === 0
            ? 'SELECCIONA PARTIDOS'
            : `AGREGAR AL CALENDAR (${selected.size})`}
        </button>
        <button
          onClick={onAddAll}
          disabled={loading}
          className="flex-1 bg-retro-green-light text-retro-white font-display text-xl tracking-widest py-3 border-2 border-retro-gold disabled:opacity-50 disabled:cursor-not-allowed uppercase hover:bg-retro-green transition-colors"
        >
          {loading ? 'AGREGANDO...' : `AGREGAR TODOS (${partidos.length})`}
        </button>
      </div>

      {/* Match grid — 2 cols on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {partidos.map((p) => (
          <MatchCard
            key={p.id}
            partido={p}
            checked={selected.has(p.id)}
            onToggle={() => onToggle(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
