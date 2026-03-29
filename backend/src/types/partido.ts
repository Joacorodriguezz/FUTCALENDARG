export interface Partido {
  id: string;
  equipo_local: string;
  equipo_visitante: string;
  logo_local?: string | null;
  logo_visitante?: string | null;
  fecha: string;   // YYYY-MM-DD
  hora: string;    // HH:MM
  competicion: string;       // round (Fecha 7, etc.)
  competicion_nombre: string; // league name (Liga Profesional Argentina, etc.)
  competicion_logo?: string | null;
  estadio?: string;
}
