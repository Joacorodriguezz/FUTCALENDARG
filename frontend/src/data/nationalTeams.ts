/**
 * football-data.org (y la DB) usan nombres en inglés; mostramos español y
 * banderas vía flagcdn cuando el crest de la API falta o no carga.
 *
 * iso: código para https://flagcdn.com — incluye banderas FIFA (gb-eng, etc.)
 */

export type NationalInfo = { es: string; iso: string };

const RAW: { keys: string[]; es: string; iso: string }[] = [
  { keys: ['afghanistan'], es: 'Afganistán', iso: 'af' },
  { keys: ['albania'], es: 'Albania', iso: 'al' },
  { keys: ['algeria'], es: 'Argelia', iso: 'dz' },
  { keys: ['andorra'], es: 'Andorra', iso: 'ad' },
  { keys: ['angola'], es: 'Angola', iso: 'ao' },
  { keys: ['argentina'], es: 'Argentina', iso: 'ar' },
  { keys: ['armenia'], es: 'Armenia', iso: 'am' },
  { keys: ['australia'], es: 'Australia', iso: 'au' },
  { keys: ['austria'], es: 'Austria', iso: 'at' },
  { keys: ['azerbaijan'], es: 'Azerbaiyán', iso: 'az' },
  { keys: ['bahrain'], es: 'Baréin', iso: 'bh' },
  { keys: ['bangladesh'], es: 'Bangladés', iso: 'bd' },
  { keys: ['belarus'], es: 'Bielorrusia', iso: 'by' },
  { keys: ['belgium'], es: 'Bélgica', iso: 'be' },
  { keys: ['bolivia'], es: 'Bolivia', iso: 'bo' },
  { keys: ['bosnia and herzegovina', 'bosnia-herzegovina', 'bosnia herzegovina'], es: 'Bosnia y Herzegovina', iso: 'ba' },
  { keys: ['brazil'], es: 'Brasil', iso: 'br' },
  { keys: ['bulgaria'], es: 'Bulgaria', iso: 'bg' },
  { keys: ['burkina faso'], es: 'Burkina Faso', iso: 'bf' },
  { keys: ['cabo verde', 'cape verde', 'cape verde islands'], es: 'Cabo Verde', iso: 'cv' },
  { keys: ['cameroon'], es: 'Camerún', iso: 'cm' },
  { keys: ['canada'], es: 'Canadá', iso: 'ca' },
  { keys: ['chile'], es: 'Chile', iso: 'cl' },
  { keys: ['china', 'china pr'], es: 'China', iso: 'cn' },
  { keys: ['colombia'], es: 'Colombia', iso: 'co' },
  { keys: ['congo dr', 'dr congo', 'democratic republic of congo'], es: 'RD del Congo', iso: 'cd' },
  { keys: ['congo', 'republic of congo', 'congo republic'], es: 'República del Congo', iso: 'cg' },
  { keys: ['costa rica'], es: 'Costa Rica', iso: 'cr' },
  { keys: ["cote d'ivoire", 'côte divoire', 'ivory coast', 'cote divoire'], es: 'Costa de Marfil', iso: 'ci' },
  { keys: ['croatia'], es: 'Croacia', iso: 'hr' },
  { keys: ['cuba'], es: 'Cuba', iso: 'cu' },
  { keys: ['curacao', 'curaçao'], es: 'Curazao', iso: 'cw' },
  { keys: ['cyprus'], es: 'Chipre', iso: 'cy' },
  { keys: ['czechia', 'czech republic'], es: 'Chequia', iso: 'cz' },
  { keys: ['denmark'], es: 'Dinamarca', iso: 'dk' },
  { keys: ['ecuador'], es: 'Ecuador', iso: 'ec' },
  { keys: ['egypt'], es: 'Egipto', iso: 'eg' },
  { keys: ['el salvador'], es: 'El Salvador', iso: 'sv' },
  { keys: ['england'], es: 'Inglaterra', iso: 'gb-eng' },
  { keys: ['estonia'], es: 'Estonia', iso: 'ee' },
  { keys: ['faroe islands'], es: 'Islas Feroe', iso: 'fo' },
  { keys: ['finland'], es: 'Finlandia', iso: 'fi' },
  { keys: ['france'], es: 'Francia', iso: 'fr' },
  { keys: ['north macedonia', 'macedonia'], es: 'Macedonia del Norte', iso: 'mk' },
  { keys: ['gabon'], es: 'Gabón', iso: 'ga' },
  { keys: ['gambia'], es: 'Gambia', iso: 'gm' },
  { keys: ['georgia'], es: 'Georgia', iso: 'ge' },
  { keys: ['germany'], es: 'Alemania', iso: 'de' },
  { keys: ['ghana'], es: 'Ghana', iso: 'gh' },
  { keys: ['gibraltar'], es: 'Gibraltar', iso: 'gi' },
  { keys: ['greece'], es: 'Grecia', iso: 'gr' },
  { keys: ['guatemala'], es: 'Guatemala', iso: 'gt' },
  { keys: ['guinea'], es: 'Guinea', iso: 'gn' },
  { keys: ['haiti'], es: 'Haití', iso: 'ht' },
  { keys: ['honduras'], es: 'Honduras', iso: 'hn' },
  { keys: ['hungary'], es: 'Hungría', iso: 'hu' },
  { keys: ['iceland'], es: 'Islandia', iso: 'is' },
  { keys: ['india'], es: 'India', iso: 'in' },
  { keys: ['indonesia'], es: 'Indonesia', iso: 'id' },
  { keys: ['iran'], es: 'Irán', iso: 'ir' },
  { keys: ['iraq'], es: 'Irak', iso: 'iq' },
  { keys: ['republic of ireland', 'ireland'], es: 'Irlanda', iso: 'ie' },
  { keys: ['israel'], es: 'Israel', iso: 'il' },
  { keys: ['italy'], es: 'Italia', iso: 'it' },
  { keys: ['jamaica'], es: 'Jamaica', iso: 'jm' },
  { keys: ['japan'], es: 'Japón', iso: 'jp' },
  { keys: ['jordan'], es: 'Jordania', iso: 'jo' },
  { keys: ['kazakhstan'], es: 'Kazajistán', iso: 'kz' },
  { keys: ['kenya'], es: 'Kenia', iso: 'ke' },
  { keys: ['kosovo'], es: 'Kosovo', iso: 'xk' },
  { keys: ['kuwait'], es: 'Kuwait', iso: 'kw' },
  { keys: ['latvia'], es: 'Letonia', iso: 'lv' },
  { keys: ['lebanon'], es: 'Líbano', iso: 'lb' },
  { keys: ['libya'], es: 'Libia', iso: 'ly' },
  { keys: ['liechtenstein'], es: 'Liechtenstein', iso: 'li' },
  { keys: ['lithuania'], es: 'Lituania', iso: 'lt' },
  { keys: ['luxembourg'], es: 'Luxemburgo', iso: 'lu' },
  { keys: ['malaysia'], es: 'Malasia', iso: 'my' },
  { keys: ['mali'], es: 'Malí', iso: 'ml' },
  { keys: ['malta'], es: 'Malta', iso: 'mt' },
  { keys: ['mexico'], es: 'México', iso: 'mx' },
  { keys: ['moldova'], es: 'Moldavia', iso: 'md' },
  { keys: ['montenegro'], es: 'Montenegro', iso: 'me' },
  { keys: ['morocco'], es: 'Marruecos', iso: 'ma' },
  { keys: ['myanmar'], es: 'Myanmar', iso: 'mm' },
  { keys: ['namibia'], es: 'Namibia', iso: 'na' },
  { keys: ['netherlands', 'holland'], es: 'Países Bajos', iso: 'nl' },
  { keys: ['new zealand'], es: 'Nueva Zelanda', iso: 'nz' },
  { keys: ['nicaragua'], es: 'Nicaragua', iso: 'ni' },
  { keys: ['nigeria'], es: 'Nigeria', iso: 'ng' },
  { keys: ['northern ireland'], es: 'Irlanda del Norte', iso: 'gb-nir' },
  { keys: ['norway'], es: 'Noruega', iso: 'no' },
  { keys: ['oman'], es: 'Omán', iso: 'om' },
  { keys: ['panama'], es: 'Panamá', iso: 'pa' },
  { keys: ['paraguay'], es: 'Paraguay', iso: 'py' },
  { keys: ['peru', 'perú'], es: 'Perú', iso: 'pe' },
  { keys: ['philippines'], es: 'Filipinas', iso: 'ph' },
  { keys: ['poland'], es: 'Polonia', iso: 'pl' },
  { keys: ['portugal'], es: 'Portugal', iso: 'pt' },
  { keys: ['puerto rico'], es: 'Puerto Rico', iso: 'pr' },
  { keys: ['qatar'], es: 'Catar', iso: 'qa' },
  { keys: ['romania'], es: 'Rumania', iso: 'ro' },
  { keys: ['russia'], es: 'Rusia', iso: 'ru' },
  { keys: ['rwanda'], es: 'Ruanda', iso: 'rw' },
  { keys: ['san marino'], es: 'San Marino', iso: 'sm' },
  { keys: ['saudi arabia'], es: 'Arabia Saudita', iso: 'sa' },
  { keys: ['scotland'], es: 'Escocia', iso: 'gb-sct' },
  { keys: ['senegal'], es: 'Senegal', iso: 'sn' },
  { keys: ['serbia'], es: 'Serbia', iso: 'rs' },
  { keys: ['seychelles'], es: 'Seychelles', iso: 'sc' },
  { keys: ['sierra leone'], es: 'Sierra Leona', iso: 'sl' },
  { keys: ['singapore'], es: 'Singapur', iso: 'sg' },
  { keys: ['slovakia'], es: 'Eslovaquia', iso: 'sk' },
  { keys: ['slovenia'], es: 'Eslovenia', iso: 'si' },
  { keys: ['south africa'], es: 'Sudáfrica', iso: 'za' },
  { keys: ['south korea', 'korea republic', 'republic of korea'], es: 'Corea del Sur', iso: 'kr' },
  { keys: ['spain'], es: 'España', iso: 'es' },
  { keys: ['suriname'], es: 'Surinam', iso: 'sr' },
  { keys: ['sweden'], es: 'Suecia', iso: 'se' },
  { keys: ['switzerland'], es: 'Suiza', iso: 'ch' },
  { keys: ['syria'], es: 'Siria', iso: 'sy' },
  { keys: ['tahiti'], es: 'Tahití', iso: 'pf' },
  { keys: ['taiwan'], es: 'Taiwán', iso: 'tw' },
  { keys: ['tajikistan'], es: 'Tayikistán', iso: 'tj' },
  { keys: ['tanzania'], es: 'Tanzania', iso: 'tz' },
  { keys: ['thailand'], es: 'Tailandia', iso: 'th' },
  { keys: ['togo'], es: 'Togo', iso: 'tg' },
  { keys: ['trinidad and tobago'], es: 'Trinidad y Tobago', iso: 'tt' },
  { keys: ['tunisia'], es: 'Túnez', iso: 'tn' },
  { keys: ['turkey', 'türkiye', 'turkiye'], es: 'Turquía', iso: 'tr' },
  { keys: ['ukraine'], es: 'Ucrania', iso: 'ua' },
  { keys: ['united arab emirates', 'uae'], es: 'Emiratos Árabes Unidos', iso: 'ae' },
  { keys: ['united states', 'usa', 'us', 'united states of america'], es: 'Estados Unidos', iso: 'us' },
  { keys: ['uruguay'], es: 'Uruguay', iso: 'uy' },
  { keys: ['uzbekistan'], es: 'Uzbekistán', iso: 'uz' },
  { keys: ['venezuela'], es: 'Venezuela', iso: 've' },
  { keys: ['vietnam', 'viet nam'], es: 'Vietnam', iso: 'vn' },
  { keys: ['wales'], es: 'Gales', iso: 'gb-wls' },
  { keys: ['zambia'], es: 'Zambia', iso: 'zm' },
  { keys: ['zimbabwe'], es: 'Zimbabue', iso: 'zw' },
  { keys: ['kyrgyz republic', 'kyrgyzstan'], es: 'Kirguistán', iso: 'kg' },
  { keys: ['new caledonia'], es: 'Nueva Caledonia', iso: 'nc' },
  { keys: ['hong kong'], es: 'Hong Kong', iso: 'hk' },
  { keys: ['palestine'], es: 'Palestina', iso: 'ps' },
  { keys: ['sudan'], es: 'Sudán', iso: 'sd' },
  { keys: ['south sudan'], es: 'Sudán del Sur', iso: 'ss' },
  { keys: ['north korea', 'korea dpr', "korea democratic people's republic"], es: 'Corea del Norte', iso: 'kp' },
];

function buildNationalMap(): Record<string, NationalInfo> {
  const m: Record<string, NationalInfo> = {};
  for (const row of RAW) {
    const info = { es: row.es, iso: row.iso };
    for (const k of row.keys) {
      m[normalizeNationalKey(k)] = info;
    }
  }
  return m;
}

const NATIONAL_BY_KEY = buildNationalMap();

export function normalizeNationalKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/'/g, "'")
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lookupNationalTeam(name: string): NationalInfo | undefined {
  return NATIONAL_BY_KEY[normalizeNationalKey(name)];
}

/** Nombre para mostrar en español; si no hay mapeo, devuelve el original. */
export function displayNationalTeamName(apiName: string): string {
  return lookupNationalTeam(apiName)?.es ?? apiName;
}

/** URL de bandera (PNG); vacío si no hay ISO conocido. */
export function nationalFlagUrl(apiName: string): string {
  const info = lookupNationalTeam(apiName);
  if (!info) return '';
  return `https://flagcdn.com/w80/${info.iso}.png`;
}

/** Crest para selecciones: logo de API si parece URL válida; si no, bandera. */
export function resolveNationalCrest(apiName: string, apiLogo: string | null | undefined): string {
  const u = apiLogo?.trim() ?? '';
  if (u && /^https?:\/\//i.test(u)) return u;
  return nationalFlagUrl(apiName);
}

// ── 48 selecciones oficiales del Mundial 2026 ────────────────────
// Nombres en inglés tal como los devuelve football-data.org (y se almacenan en la DB).
const WC_2026_TEAMS_RAW = [
  'Mexico', 'South Africa', 'South Korea', 'Korea Republic',
  'Czech Republic', 'Czechia', 'Canada',
  'Bosnia and Herzegovina', 'Bosnia-Herzegovina',
  'Qatar', 'Switzerland', 'Brazil', 'Morocco',
  'Haiti', 'Scotland', 'United States', 'USA',
  'Paraguay', 'Australia', 'Turkey', 'Türkiye',
  'Germany', 'Curaçao', 'Curacao',
  "Côte d'Ivoire", "Cote d'Ivoire", 'Ivory Coast',
  'Ecuador', 'Netherlands', 'Holland', 'Japan', 'Sweden', 'Tunisia',
  'Belgium', 'Egypt', 'Iran', 'New Zealand',
  'Spain', 'Cabo Verde', 'Cape Verde',
  'Saudi Arabia', 'Uruguay',
  'France', 'Senegal', 'Iraq', 'Norway',
  'Argentina', 'Algeria', 'Austria', 'Jordan',
  'Portugal', 'DR Congo', 'Congo DR', 'Democratic Republic of Congo',
  'Uzbekistan', 'Colombia',
  'England', 'Croatia', 'Ghana', 'Panama',
];

const WC_2026_SET = new Set(
  WC_2026_TEAMS_RAW.map((n) => normalizeNationalKey(n))
);

/** ¿El equipo pertenece a las 48 selecciones oficiales del Mundial 2026? */
export function isWorldCup2026Team(apiName: string): boolean {
  return WC_2026_SET.has(normalizeNationalKey(apiName));
}
