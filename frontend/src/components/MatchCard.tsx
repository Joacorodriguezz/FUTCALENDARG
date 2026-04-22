import { Partido, partidoEsAgregable } from '../api/client';
import { getLogoByName } from '../data/equipos';
import { displayNationalTeamName, nationalFlagUrl } from '../data/nationalTeams';

interface Props {
  partido: Partido;
  checked: boolean;
  onToggle: () => void;
}

const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function parseART(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora || '00:00'}:00-03:00`);
}

function formatFecha(fecha: string, hora: string): { corta: string; dia: string } {
  if (!fecha) return { corta: '--/--', dia: '---' };
  const date = parseART(fecha, hora);
  const dia = new Intl.DateTimeFormat('es', { weekday: 'short', timeZone: userTz })
    .format(date).replace('.', '').replace(/^\w/, c => c.toUpperCase());
  const d = new Intl.DateTimeFormat('es', { day: '2-digit', timeZone: userTz }).format(date);
  const m = new Intl.DateTimeFormat('es', { month: '2-digit', timeZone: userTz }).format(date);
  return { corta: `${d}/${m}`, dia };
}

function formatHora(fecha: string, hora: string): string {
  if (!hora) return '--:--';
  return new Intl.DateTimeFormat('es', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTz,
  }).format(parseART(fecha, hora));
}

function CompBadge({ logo, nombre }: { logo?: string | null; nombre: string }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={nombre}
        className="w-7 h-7 object-contain mt-1"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          img.style.display = 'none';
          // Show sibling text fallback
          const next = img.nextElementSibling as HTMLElement | null;
          if (next) next.style.display = 'block';
        }}
      />
    );
  }
  return (
    <span className="font-retro text-[8px] text-retro-gray uppercase tracking-tight text-center mt-1 leading-tight max-w-[60px]">
      {nombre}
    </span>
  );
}

function partidoCrestSrc(nombre: string, logo?: string | null): string {
  const u = logo?.trim() ?? '';
  if (u && /^https?:\/\//i.test(u)) return u;
  const local = getLogoByName(nombre);
  if (local) return local;
  return nationalFlagUrl(nombre) || '';
}

function TeamLogo({ nombre, logo }: { nombre: string; logo?: string | null }) {
  const primary = partidoCrestSrc(nombre, logo);
  const fallback = nationalFlagUrl(nombre);
  if (!primary) {
    return (
      <div className="w-10 h-10 flex items-center justify-center text-retro-gray text-xs font-retro">
        ?
      </div>
    );
  }
  return (
    <img
      src={primary}
      alt=""
      className="w-10 h-10 object-contain"
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        if (fallback && img.src !== fallback) {
          img.src = fallback;
          return;
        }
        img.style.display = 'none';
      }}
    />
  );
}

export function MatchCard({ partido, checked, onToggle }: Props) {
  const { corta, dia } = formatFecha(partido.fecha, partido.hora);
  const agregable = partidoEsAgregable(partido);
  const jugado = partido.estado === 'FT';

  return (
    <label
      className={`relative flex flex-col border-2 transition-all ${
        agregable ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
      } ${
        checked && agregable
          ? 'border-retro-gold bg-retro-green/30'
          : agregable
            ? 'border-retro-border bg-retro-card hover:border-retro-gold/50 hover:bg-retro-field'
            : 'border-retro-border bg-retro-card'
      }`}
    >
      {/* Custom checkbox indicator */}
      <input
        type="checkbox"
        checked={checked && agregable}
        disabled={!agregable}
        onChange={() => {
          if (agregable) onToggle();
        }}
        className="sr-only"
      />
      {!agregable && (
        <span className="absolute top-1.5 left-1.5 font-retro text-[9px] uppercase tracking-widest text-retro-gray bg-retro-bg/80 px-1.5 py-0.5 border border-retro-border">
          {jugado ? 'Final' : partido.estado === 'PP' ? 'Aplazado' : '—'}
        </span>
      )}
      <div
        className={`absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center border transition-all ${
          checked && agregable
            ? 'border-retro-gold bg-retro-gold'
            : 'border-retro-border bg-retro-card'
        }`}
      >
        {checked && agregable && (
          <svg className="w-3 h-3 text-retro-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      <div className="flex items-center px-3 pt-3 pb-2 gap-1">
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <TeamLogo nombre={partido.equipo_local} logo={partido.logo_local} />
          <span className="font-display text-retro-white text-xs uppercase tracking-wide text-center leading-tight w-full truncate">
            {displayNationalTeamName(partido.equipo_local)}
          </span>
        </div>

        <div className="flex flex-col items-center flex-shrink-0 px-1">
          <span className="font-retro text-retro-gray text-xs tracking-wide">
            {formatHora(partido.fecha, partido.hora)}
          </span>
          <span className="font-display text-retro-white text-xl tracking-widest leading-tight">
            {corta}
          </span>
          <span className="font-retro text-retro-gold text-[10px] uppercase tracking-widest">
            {dia}
          </span>
          <CompBadge logo={partido.competicion_logo} nombre={partido.competicion_nombre} />
        </div>

        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <TeamLogo nombre={partido.equipo_visitante} logo={partido.logo_visitante} />
          <span className="font-display text-retro-white text-xs uppercase tracking-wide text-center leading-tight w-full truncate">
            {displayNationalTeamName(partido.equipo_visitante)}
          </span>
        </div>
      </div>
    </label>
  );
}
