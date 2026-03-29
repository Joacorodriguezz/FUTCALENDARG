import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const LOGOS_DIR = path.resolve(__dirname, '../../../frontend/public/logos');
const COMP_DIR  = path.resolve(LOGOS_DIR, 'competencias');

// ── LOGO_MAP replicado del frontend ──────────────────────────────
// Mapea nombre de equipo (lowercase) → filename (sin extensión)
const LOGO_MAP: Record<string, string> = {
  'river plate': 'river', 'river': 'river',
  'boca juniors': 'boca', 'boca': 'boca',
  'racing club': 'racing', 'racing': 'racing',
  'independiente': 'independiente',
  'san lorenzo': 'sanlorenzo',
  'huracán': 'huracan', 'huracan': 'huracan',
  'vélez sarsfield': 'velez', 'velez sarsfield': 'velez', 'velez': 'velez',
  'estudiantes de la plata': 'estudiantes', 'estudiantes': 'estudiantes',
  'rosario central': 'rosariocentral',
  "newell's old boys": 'newells', 'newells old boys': 'newells', 'newells': 'newells',
  'lanús': 'lanus', 'lanus': 'lanus',
  'banfield': 'banfield',
  'tigre': 'tigre',
  'argentinos juniors': 'argentinos', 'argentinos': 'argentinos',
  'belgrano': 'belgrano',
  'talleres de córdoba': 'talleres', 'talleres cordoba': 'talleres', 'talleres': 'talleres',
  'defensa y justicia': 'defensa', 'defensa': 'defensa',
  'platense': 'platense',
  'unión de santa fe': 'union', 'union santa fe': 'union',
  'central córdoba sde': 'centralcordoba', 'central cordoba sde': 'centralcordoba',
  'central córdoba': 'centralcordoba', 'central cordoba (santiago del estero)': 'centralcordoba',
  'instituto': 'instituto', 'instituto (córdoba)': 'instituto', 'instituto (cordoba)': 'instituto',
  'gimnasia de mendoza': 'gimnasiamendoza', 'gimnasia mendoza': 'gimnasiamendoza',
  'deportivo riestra': 'riestra', 'riestra': 'riestra',
  'independiente rivadavia': 'independienteriv',
  'barracas central': 'barracas-central', 'barracas': 'barracas',
  'gimnasia la plata': 'gimnasia', 'gimnasia y esgrima la plata': 'gimnasia', 'gimnasia lp': 'gimnasia',
  'sarmiento junín': 'sarmiento', 'sarmiento junin': 'sarmiento', 'sarmiento': 'sarmiento',
  'atlético tucumán': 'atleticotucuman', 'atletico tucuman': 'atleticotucuman',
  'aldosivi': 'aldosivi',
  'estudiantes rc': 'estudiantesrc', 'estudiantes río cuarto': 'estudiantesrc',
  'godoy cruz': 'godoycruz',
  'colón': 'colon', 'colon': 'colon',
  'patronato': 'patronato',
  // Ascenso
  'acassuso': 'acassuso', 'agropecuario': 'agropecuario', 'all boys': 'allboys',
  'almagro': 'almagro', 'almirante brown': 'almirante', 'almirante': 'almirante',
  'armenio': 'armenio', 'atlanta': 'atlanta',
  'brown de adrogué': 'brownadrogue', 'brown de adrogue': 'brownadrogue',
  'chacarita juniors': 'chacarita', 'chacarita': 'chacarita',
  'deportivo madryn': 'deportivo_madryn', 'deportivo merlo': 'depmerlo',
  'dock sud': 'dock_sud', 'excursionistas': 'excursionistas',
  'ferro carril oeste': 'ferro', 'ferro': 'ferro', 'flandria': 'flandria',
  'gimnasia y tiro': 'gimnasia_y_tiro', 'gimnasia jujuy': 'gimnasiajujuy',
  'güemes': 'guemes', 'guemes': 'guemes',
  'deportivo laferrere': 'laferrere', 'laferrere': 'laferrere',
  'liniers': 'liniers', 'los andes': 'losandes', 'midland': 'midland',
  'mitre': 'mitre', 'morón': 'moron', 'moron': 'moron',
  'nueva chicago': 'nueva_chicago', 'quilmes': 'quilmes',
  'san martín san juan': 'sanmartinsj', 'san martín de tucumán': 'sanmartintuc',
  'san telmo': 'santelmo', 'temperley': 'temperley',
  'tristán suárez': 'tristansuarez', 'tristan suarez': 'tristansuarez',
  'uai urquiza': 'uaiurquiza',
  'villa dálmine': 'villadalmine', 'villa dalmine': 'villadalmine',
  // Brasil
  'flamengo': 'flamengo', 'fluminense': 'fluminense', 'botafogo': 'botafogo',
  'palmeiras': 'palmeiras', 'santos': 'santos',
  'são paulo': 'saopaulo', 'sao paulo': 'saopaulo',
  'corinthians': 'corinthians', 'cruzeiro': 'cruzeiro',
  'atlético mineiro': 'atlmineiro', 'atletico mineiro': 'atlmineiro',
  'internacional': 'internacional', 'grêmio': 'gremio', 'gremio': 'gremio',
  'fortaleza': 'fortaleza', 'bahia': 'bahia',
  'rb bragantino': 'rbbragantino', 'bragantino': 'rbbragantino',
  'vasco da gama': 'vasco', 'vasco': 'vasco',
  'atlético paranaense': 'atlparanaense', 'athletico paranaense': 'atlparanaense',
  // Uruguay
  'peñarol': 'penarol', 'penarol': 'penarol',
  'nacional': 'nacional-uy',
  'defensor sporting': 'defensor',
  'fénix': 'fenix', 'fenix': 'fenix',
  'cerro largo': 'cerrolargo', 'danubio': 'danubio',
  'montevideo city torque': 'montevideocity', 'montevideo city': 'montevideocity',
  // Colombia
  'atlético nacional': 'atlnacional', 'atletico nacional': 'atlnacional',
  'junior': 'junior', 'millonarios': 'millonarios', 'once caldas': 'oncecaldas',
  'deportivo cali': 'depcali', 'santa fe': 'santafe',
  'deportes tolima': 'tolima', 'tolima': 'tolima',
  'deportivo pereira': 'pereira', 'deportivo pasto': 'pasto',
  'bucaramanga': 'bucaramanga', 'atlético bucaramanga': 'bucaramanga',
  'deportivo independiente medellín': 'dim', 'independiente medellín': 'dim',
  'águilas doradas': 'aguilas_doradas', 'aguilas doradas': 'aguilas_doradas',
  // Chile
  'colo-colo': 'colocolo', 'colo colo': 'colocolo',
  'universidad de chile': 'udechile',
  'universidad católica': 'ucatolica',
  'coquimbo unido': 'coquimbo', 'huachipato': 'huachipato',
  'ñublense': 'nublense', "o'higgins": 'ohiggins',
  'palestino': 'palestino', 'cobresal': 'cobresal',
  'unión la calera': 'unionlacalera', 'union la calera': 'unionlacalera',
  // Perú
  'universitario': 'universitario', 'universitario de deportes': 'universitario',
  'alianza lima': 'alianzalima', 'sporting cristal': 'sportingcristal',
  'melgar': 'melgar', 'cienciano': 'cienciano',
  'atlético grau': 'atleticograu', 'atletico grau': 'atleticograu',
  'cusco fc': 'cusco', 'cusco': 'cusco',
  // Bolivia
  'bolívar': 'bolivar', 'bolivar': 'bolivar',
  'the strongest': 'the_strongest', 'aurora': 'aurora', 'blooming': 'blooming',
  'always ready': 'always_ready',
  // Paraguay
  'olimpia': 'olimpia', 'cerro porteño': 'cerroporteno', 'cerro porteno': 'cerroporteno',
  'guaraní': 'guarani', 'guarani': 'guarani', 'libertad': 'libertad',
  // Ecuador
  'barcelona sc': 'barcelona', 'emelec': 'emelec',
  'liga de quito': 'ligadequito', 'aucas': 'aucas',
  'delfín': 'delfin', 'delfin': 'delfin',
  // Misc
  'alianza fc': 'alianza', 'alianza': 'alianza',
  'comunicaciones': 'comunicaciones',
};

const LEAGUES_MAP: { name: string; file: string; ext: 'png' | 'svg' }[] = [
  { name: 'Liga Profesional Argentina', file: 'argentina',              ext: 'png' },
  { name: 'Copa Argentina',             file: 'copaargentina',          ext: 'png' },
  { name: 'Copa Libertadores',          file: 'libertadores',           ext: 'png' },
  { name: 'Copa Sudamericana',          file: 'copa-sulamericana-logo', ext: 'svg' },
];

// ── Helpers ──────────────────────────────────────────────────────

async function uploadToStorage(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const { error } = await supabase.storage
    .from('logos')
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed (${storagePath}): ${error.message}`);
  const { data } = supabase.storage.from('logos').getPublicUrl(storagePath);
  return data.publicUrl;
}

async function toWebP(pngPath: string, size: number): Promise<Buffer> {
  return sharp(pngPath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 85 })
    .toBuffer();
}

// ── Upload team logos ────────────────────────────────────────────

async function uploadTeamLogos() {
  console.log('\n── Logos de equipos ──');

  // Deduplicar: filename → [nombres del mapa]
  const fileToNames = new Map<string, string[]>();
  for (const [teamName, logoFile] of Object.entries(LOGO_MAP)) {
    const existing = fileToNames.get(logoFile) ?? [];
    existing.push(teamName);
    fileToNames.set(logoFile, existing);
  }

  let uploaded = 0;
  let skipped  = 0;
  let updated  = 0;

  for (const [logoFile, teamNames] of fileToNames.entries()) {
    const pngPath = path.join(LOGOS_DIR, `${logoFile}.png`);
    if (!fs.existsSync(pngPath)) { skipped++; continue; }

    const webpBuffer = await toWebP(pngPath, 64);
    const publicUrl  = await uploadToStorage(`teams/${logoFile}.webp`, webpBuffer, 'image/webp');
    uploaded++;

    for (const teamName of teamNames) {
      const { error } = await supabase
        .from('teams')
        .update({ logo: publicUrl })
        .ilike('name', teamName);
      if (!error) updated++;
    }

    process.stdout.write(`\r  subidos: ${uploaded} | actualizados en DB: ${updated}`);
  }

  console.log(`\n  Archivos no encontrados: ${skipped}`);
}

// ── Upload league logos ──────────────────────────────────────────

async function uploadLeagueLogos() {
  console.log('\n── Logos de ligas ──');

  for (const league of LEAGUES_MAP) {
    const filePath = path.join(COMP_DIR, `${league.file}.${league.ext}`);
    if (!fs.existsSync(filePath)) {
      console.log(`  Archivo no encontrado: ${league.file}.${league.ext}`);
      continue;
    }

    let buffer: Buffer;
    let contentType: string;
    let storagePath: string;

    if (league.ext === 'svg') {
      buffer      = fs.readFileSync(filePath);
      contentType = 'image/svg+xml';
      storagePath = `leagues/${league.file}.svg`;
    } else {
      buffer      = await toWebP(filePath, 48);
      contentType = 'image/webp';
      storagePath = `leagues/${league.file}.webp`;
    }

    const publicUrl = await uploadToStorage(storagePath, buffer, contentType);

    const { error } = await supabase
      .from('leagues')
      .update({ logo: publicUrl })
      .eq('name', league.name);

    console.log(`  ${league.name}: ${error ? '✗ ' + error.message : '✓'}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  await uploadTeamLogos();
  await uploadLeagueLogos();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('uploadLogos failed:', err.message);
  process.exit(1);
});
