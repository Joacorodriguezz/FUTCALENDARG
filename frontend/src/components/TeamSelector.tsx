import { useMemo, useState, useEffect, useRef, type RefObject } from 'react';
import { Team } from '../api/client';
import { getLogoByName } from '../data/equipos';
import {
  displayNationalTeamName,
  nationalFlagUrl,
  resolveNationalCrest,
} from '../data/nationalTeams';

interface Props {
  teams: Team[];
  loading: boolean;
  selected: Team | null;
  onChange: (team: Team) => void;
  /** National teams (Mundial) vs club names copy */
  variant?: 'club' | 'national';
}

function PickerContent({
  filtered,
  selected,
  search,
  setSearch,
  searchRef,
  onClose,
  onSelect,
  pickerTitle,
  searchPlaceholder,
  variant,
}: {
  filtered: Team[];
  selected: Team | null;
  search: string;
  setSearch: (v: string) => void;
  searchRef: RefObject<HTMLInputElement>;
  onClose: () => void;
  onSelect: (team: Team) => void;
  pickerTitle: string;
  searchPlaceholder: string;
  variant: 'club' | 'national';
}) {
  return (
    <>
      <div className="flex items-center justify-between px-4 pb-3 border-b border-retro-border flex-shrink-0">
        <span className="font-display text-retro-gold tracking-widest text-lg sm:text-xl">{pickerTitle}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-retro-gray hover:text-retro-white transition-colors p-1"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 flex-shrink-0">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-retro-gray"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-retro-green border border-retro-border pl-9 pr-8 py-2.5 font-retro text-retro-white placeholder-retro-gray text-sm focus:outline-none focus:border-retro-gold"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-retro-gray hover:text-retro-white"
              aria-label="Limpiar búsqueda"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-y-auto px-3 pb-6 sm:pb-4 flex-1 min-h-0">
        {filtered.length === 0 ? (
          <p className="text-center font-retro text-retro-gray text-sm uppercase tracking-widest py-8">
            Sin resultados
          </p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-2">
            {filtered.map((team) => {
              const isNational = variant === 'national';
              const label = isNational ? displayNationalTeamName(team.name) : team.name;
              const logoSrc = isNational
                ? resolveNationalCrest(team.name, team.logo)
                : (team.logo || getLogoByName(team.name) || '');
              const flagFallback = isNational ? nationalFlagUrl(team.name) : '';
              const isSelected = selected?.id === team.id;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => onSelect(team)}
                  className={`flex flex-col items-center p-2 border rounded transition-all ${
                    isSelected
                      ? 'border-retro-gold bg-retro-gold/20'
                      : 'border-transparent active:border-retro-border active:bg-retro-green-light sm:hover:border-retro-border sm:hover:bg-retro-green-light'
                  }`}
                >
                  <img
                    src={logoSrc}
                    alt=""
                    className="w-12 h-12 sm:w-11 sm:h-11 object-contain"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (flagFallback && img.src !== flagFallback) {
                        img.src = flagFallback;
                        return;
                      }
                      img.style.display = 'none';
                    }}
                  />
                  <span
                    className={`font-retro text-[9px] sm:text-[10px] uppercase tracking-tight leading-tight text-center mt-1.5 line-clamp-2 w-full ${
                      isSelected ? 'text-retro-gold' : 'text-retro-gray'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export function TeamSelector({ teams, loading, selected, onChange, variant = 'club' }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const isNational = variant === 'national';

  const sorted = useMemo(() => {
    const arr = [...teams];
    if (isNational) {
      arr.sort((a, b) =>
        displayNationalTeamName(a.name).localeCompare(displayNationalTeamName(b.name), 'es', { sensitivity: 'base' })
      );
    } else {
      arr.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }
    return arr;
  }, [teams, isNational]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) => {
      const api = t.name.toLowerCase();
      if (api.includes(q)) return true;
      if (isNational) {
        const es = displayNationalTeamName(t.name).toLowerCase();
        if (es.includes(q)) return true;
      }
      return false;
    });
  }, [sorted, search, isNational]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
      setTimeout(() => searchRef.current?.focus(), 300);
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function handleSelect(team: Team) {
    onChange(team);
    setOpen(false);
    setSearch('');
  }

  if (loading) {
    return (
      <div className="w-full bg-retro-green border-t-2 border-retro-gold">
        <div className="flex items-center justify-center px-3 py-2.5">
          <span className="font-retro text-retro-gray text-xs uppercase tracking-widest animate-pulse">
            Cargando equipos...
          </span>
        </div>
      </div>
    );
  }

  const selectedLogo = selected
    ? (isNational
        ? resolveNationalCrest(selected.name, selected.logo)
        : (selected.logo || getLogoByName(selected.name) || ''))
    : '';
  const selectedFlagFallback = selected && isNational ? nationalFlagUrl(selected.name) : '';
  const selectedLabel = selected
    ? (isNational ? displayNationalTeamName(selected.name) : selected.name)
    : '';
  const pickerTitle = isNational ? 'ELEGÍ TU SELECCIÓN' : 'ELEGÍ TU EQUIPO';
  const searchPlaceholder = isNational ? 'Buscar selección...' : 'Buscar equipo...';
  const triggerEmptyLabel = isNational ? 'SELECCIONA TU SELECCIÓN' : 'SELECCIONA TU EQUIPO';
  const ariaPickerLabel = isNational ? 'Elegí tu selección' : 'Elegí tu equipo';

  return (
    <>
      <div className="w-full bg-retro-green border-t-2 border-retro-gold px-2.5 sm:px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={
            selected
              ? `${ariaPickerLabel}: ${selectedLabel}`
              : `${ariaPickerLabel}. Abrir listado`
          }
          className="
            w-full flex items-center gap-3 sm:gap-4
            px-3 sm:px-4 py-3 min-h-[52px] sm:min-h-[56px]
            rounded-md text-left
            border-2 border-retro-gold bg-retro-card
            shadow-[0_2px_0_0_rgba(0,0,0,0.35)]
            transition-colors
            active:bg-retro-green-light active:border-retro-white
            sm:hover:bg-retro-field sm:hover:border-retro-white
            focus:outline-none focus-visible:ring-2 focus-visible:ring-retro-gold focus-visible:ring-offset-2 focus-visible:ring-offset-retro-green
          "
        >
          {selected ? (
            <>
              <img
                src={selectedLogo}
                alt=""
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain flex-shrink-0"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (selectedFlagFallback && img.src !== selectedFlagFallback) {
                    img.src = selectedFlagFallback;
                    return;
                  }
                  img.style.display = 'none';
                }}
              />
              <div className="flex-1 min-w-0">
                <span className="block font-retro text-[10px] sm:text-xs uppercase tracking-widest text-retro-gray mb-0.5">
                  {isNational ? 'Selección activa' : 'Equipo activo'}
                </span>
                <span className="font-display text-retro-gold tracking-widest text-lg sm:text-xl block truncate">
                  {selectedLabel.toUpperCase()}
                </span>
              </div>
            </>
          ) : (
            <div className="flex-1 min-w-0 flex items-start gap-3">
              <span
                className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded border border-retro-gold/50 bg-retro-green text-retro-gold font-display text-lg leading-none"
                aria-hidden
              >
                +
              </span>
              <div className="min-w-0 pt-0.5">
                <span className="font-display text-retro-gold tracking-wider text-lg sm:text-xl block leading-tight">
                  {triggerEmptyLabel}
                </span>
                <span className="mt-1 font-retro text-retro-white text-xs sm:text-sm normal-case tracking-normal block max-w-[28ch]">
                  Tocá para abrir el listado y buscar por nombre.
                </span>
              </div>
            </div>
          )}
          <span className="flex flex-col items-center gap-0.5 flex-shrink-0 text-retro-gold sm:pl-1">
            <svg
              className={`w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span className="font-retro text-[9px] uppercase tracking-widest text-retro-gray sm:text-retro-gold/90">
              Listado
            </span>
          </span>
        </button>
      </div>

      {open ? (
        <>
          {/* Mobile bottom sheet */}
          <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-black/70 transition-opacity duration-300"
              style={{ opacity: visible ? 1 : 0 }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              className="relative flex flex-col bg-retro-field rounded-t-2xl transition-transform duration-300 ease-out border-t-2 border-retro-gold/40"
              style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)', maxHeight: '82vh' }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="picker-title-mobile"
            >
              <span id="picker-title-mobile" className="sr-only">
                {ariaPickerLabel}
              </span>
              <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-retro-border" />
              </div>
              <PickerContent
                filtered={filtered}
                selected={selected}
                search={search}
                setSearch={setSearch}
                searchRef={searchRef}
                onClose={() => setOpen(false)}
                onSelect={handleSelect}
                pickerTitle={pickerTitle}
                searchPlaceholder={searchPlaceholder}
                variant={variant}
              />
            </div>
          </div>

          {/* Desktop / tablet: centered modal */}
          <div
            className="hidden sm:flex fixed inset-0 z-50 items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="picker-title-desktop"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/70 transition-opacity duration-300"
              style={{ opacity: visible ? 1 : 0 }}
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
            />
            <div
              className="relative flex flex-col bg-retro-field border-2 border-retro-gold w-full max-w-2xl max-h-[min(85vh,720px)] shadow-xl transition-all duration-300 ease-out"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'scale(1)' : 'scale(0.96)',
              }}
            >
              <span id="picker-title-desktop" className="sr-only">
                {ariaPickerLabel}
              </span>
              <div className="pt-1 flex-shrink-0 sm:pt-2" />
              <PickerContent
                filtered={filtered}
                selected={selected}
                search={search}
                setSearch={setSearch}
                searchRef={searchRef}
                onClose={() => setOpen(false)}
                onSelect={handleSelect}
                pickerTitle={pickerTitle}
                searchPlaceholder={searchPlaceholder}
                variant={variant}
              />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
