import { Partido } from '../api/client';
import { getLogoByName } from '../data/equipos';

interface Props {
  partido: Partido;
  checked: boolean;
  onToggle: () => void;
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatFecha(fecha: string): { corta: string; dia: string } {
  if (!fecha) return { corta: '--/--', dia: '---' };
  const [y, m, d] = fecha.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return {
    corta: `${d}/${m}`,
    dia: DIAS[date.getDay()],
  };
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

function TeamLogo({ nombre, logo }: { nombre: string; logo?: string | null }) {
  const src = logo || getLogoByName(nombre);
  if (!src) {
    return (
      <div className="w-10 h-10 flex items-center justify-center text-retro-gray text-xs font-retro">
        ?
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={nombre}
      className="w-10 h-10 object-contain"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

export function MatchCard({ partido, checked, onToggle }: Props) {
  const { corta, dia } = formatFecha(partido.fecha);

  return (
    <label
      className={`relative flex flex-col cursor-pointer border-2 transition-all ${
        checked
          ? 'border-retro-gold bg-retro-green/30'
          : 'border-retro-border bg-retro-card hover:border-retro-gold/50 hover:bg-retro-field'
      }`}
    >
      {/* Custom checkbox indicator */}
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="sr-only"
      />
      <div
        className={`absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center border transition-all ${
          checked
            ? 'border-retro-gold bg-retro-gold'
            : 'border-retro-border bg-retro-card'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-retro-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      <div className="flex items-center px-3 pt-3 pb-2 gap-1">
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <TeamLogo nombre={partido.equipo_local} logo={partido.logo_local} />
          <span className="font-display text-retro-white text-xs uppercase tracking-wide text-center leading-tight w-full truncate">
            {partido.equipo_local}
          </span>
        </div>

        <div className="flex flex-col items-center flex-shrink-0 px-1">
          <span className="font-retro text-retro-gray text-xs tracking-wide">
            {partido.hora || '--:--'}
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
            {partido.equipo_visitante}
          </span>
        </div>
      </div>
    </label>
  );
}
