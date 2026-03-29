import { ConflictInfo } from '../api/client';

interface Props {
  conflicts: ConflictInfo[];
  onConfirm: () => void;
  onCancel: () => void;
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatFechaLarga(fecha: string, hora: string): string {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const dia = DIAS[date.getDay()];
  return `${dia} ${d}/${m} · ${hora || '--:--'}`;
}

export function ConflictModal({ conflicts, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-retro-field border-2 border-retro-gold p-8 w-full max-w-md mx-4 shadow-2xl">
        <h2 className="font-display text-2xl text-retro-gold tracking-widest mb-2 uppercase">
          Horario ocupado
        </h2>
        <p className="font-retro text-retro-gray text-sm mb-4 tracking-wide">
          Los siguientes partidos chocan con eventos ya programados en tu calendario:
        </p>

        <ul className="mb-6 flex flex-col gap-2 max-h-60 overflow-y-auto">
          {conflicts.map((c, i) => (
            <li key={i} className="border border-retro-border p-3">
              <div className="font-display text-retro-white text-sm tracking-wide uppercase">
                {c.partido.equipo_local} vs {c.partido.equipo_visitante}
              </div>
              <div className="font-retro text-retro-gold text-xs mt-0.5">
                {formatFechaLarga(c.partido.fecha, c.partido.hora)}
              </div>
              <div className="font-retro text-retro-gray text-xs mt-1">
                Choca con:{' '}
                <span className="text-retro-white">{c.conflictingEvents.join(', ')}</span>
              </div>
            </li>
          ))}
        </ul>

        <p className="font-retro text-retro-white text-sm mb-5 tracking-wide">
          ¿Querés agregarlos igual?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-retro-gold text-retro-bg font-display text-lg tracking-widest py-2.5 border-2 border-retro-gold-dark hover:bg-retro-gold-dark hover:text-retro-white uppercase transition-colors"
          >
            Sí, agregar igual
          </button>
          <button
            onClick={onCancel}
            className="flex-1 font-display text-lg tracking-widest py-2.5 border-2 border-retro-border text-retro-gray hover:border-retro-gray hover:text-retro-white uppercase transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
