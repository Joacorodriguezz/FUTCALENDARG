import { useMemo, useState, useEffect, useRef } from 'react';
import { Team } from '../api/client';
import { getLogoByName } from '../data/equipos';

interface Props {
  teams: Team[];
  loading: boolean;
  selected: Team | null;
  onChange: (team: Team) => void;
}

export function TeamSelector({ teams, loading, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [teams]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) => t.name.toLowerCase().includes(q));
  }, [sorted, search]);

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
      <div className="w-full bg-retro-green border-t border-retro-border">
        <div className="flex items-center justify-center px-3 py-2.5">
          <span className="font-retro text-retro-gray text-xs uppercase tracking-widest animate-pulse">
            Cargando equipos...
          </span>
        </div>
      </div>
    );
  }

  const selectedLogo = selected
    ? selected.logo || getLogoByName(selected.name) || ''
    : '';

  return (
    <>
      {/* Mobile trigger */}
      <div className="sm:hidden w-full bg-retro-green border-t border-retro-border">
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-retro-green-light transition-colors"
        >
          {selected ? (
            <>
              <img
                src={selectedLogo}
                alt={selected.name}
                className="w-7 h-7 object-contain flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="font-display text-retro-gold tracking-widest text-lg flex-1 text-left truncate">
                {selected.name.toUpperCase()}
              </span>
            </>
          ) : (
            <span className="font-display text-retro-gray tracking-widest text-base flex-1 text-left">
              SELECCIONA TU EQUIPO
            </span>
          )}
          <svg
            className="w-4 h-4 text-retro-gray flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Desktop bar */}
      <div className="hidden sm:flex w-full bg-retro-green border-t border-retro-border items-center overflow-x-auto team-bar px-2 py-1.5 gap-0.5">
        {sorted.map((team) => {
          const logoSrc = team.logo || getLogoByName(team.name) || '';
          return (
            <button
              key={team.id}
              onClick={() => onChange(team)}
              title={team.name}
              className={`flex-shrink-0 flex flex-col items-center px-2 py-1 border transition-all ${
                selected?.id === team.id
                  ? 'border-retro-gold bg-retro-gold/20'
                  : 'border-transparent hover:border-retro-border hover:bg-retro-green-light'
              }`}
            >
              <img
                src={logoSrc}
                alt={team.name}
                className="w-8 h-8 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </button>
          );
        })}
      </div>

      {/* Bottom sheet (mobile only) */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
            onClick={() => setOpen(false)}
          />
          {/* Sheet panel */}
          <div
            className="relative flex flex-col bg-retro-field rounded-t-2xl transition-transform duration-300 ease-out"
            style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)', maxHeight: '82vh' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-retro-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-retro-border flex-shrink-0">
              <span className="font-display text-retro-gold tracking-widest text-xl">ELEGÍ TU EQUIPO</span>
              <button
                onClick={() => setOpen(false)}
                className="text-retro-gray hover:text-retro-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
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
                  placeholder="Buscar equipo..."
                  className="w-full bg-retro-green border border-retro-border pl-9 pr-8 py-2.5 font-retro text-retro-white placeholder-retro-gray text-sm focus:outline-none focus:border-retro-gold"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-retro-gray hover:text-retro-white"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Grid */}
            <div className="overflow-y-auto px-3 pb-8 flex-1">
              {filtered.length === 0 ? (
                <p className="text-center font-retro text-retro-gray text-sm uppercase tracking-widest py-8">
                  Sin resultados
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {filtered.map((team) => {
                    const logoSrc = team.logo || getLogoByName(team.name) || '';
                    const isSelected = selected?.id === team.id;
                    return (
                      <button
                        key={team.id}
                        onClick={() => handleSelect(team)}
                        className={`flex flex-col items-center p-2 border rounded transition-all ${
                          isSelected
                            ? 'border-retro-gold bg-retro-gold/20'
                            : 'border-transparent active:border-retro-border active:bg-retro-green-light'
                        }`}
                      >
                        <img
                          src={logoSrc}
                          alt={team.name}
                          className="w-12 h-12 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span
                          className={`font-retro text-[9px] uppercase tracking-tight leading-tight text-center mt-1.5 line-clamp-2 w-full ${
                            isSelected ? 'text-retro-gold' : 'text-retro-gray'
                          }`}
                        >
                          {team.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
