import { google, calendar_v3 } from 'googleapis';
import { Partido } from '../types/partido';

export interface ConflictInfo {
  partido: Partido;
  conflictingEvents: string[];
}

export async function addPartidosToCalendar(
  accessToken: string,
  partidos: Partido[],
  force = false
): Promise<{ added: number; errors: string[]; duplicates: string[]; conflicts: ConflictInfo[] }> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth });

  let added = 0;
  const errors: string[] = [];
  const duplicates: string[] = [];
  const conflicts: ConflictInfo[] = [];

  // Pre-compute time windows for all partidos
  const windows = partidos.map((p) => {
    const startDate = new Date(`${p.fecha}T${p.hora}:00-03:00`);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    return { startDate, endDate };
  });

  // Single events.list call covering the entire batch — reduces N API calls to 1
  let batchItems: calendar_v3.Schema$Event[] = [];
  try {
    const batchMin = new Date(Math.min(...windows.map((w) => w.startDate.getTime())));
    const batchMax = new Date(Math.max(...windows.map((w) => w.endDate.getTime())));

    const existing = await calendar.events.list({
      calendarId: 'primary',
      timeMin: batchMin.toISOString(),
      timeMax: batchMax.toISOString(),
      singleEvents: true,
      maxResults: 2500,
    });
    batchItems = existing.data.items ?? [];
  } catch (listErr) {
    // List call failed — skip duplicate/conflict checks and proceed with inserts
    console.warn('events.list batch call failed, skipping checks:', listErr instanceof Error ? listErr.message : listErr);
  }

  for (let i = 0; i < partidos.length; i++) {
    const partido = partidos[i];
    const { startDate, endDate } = windows[i];
    const title = `${partido.equipo_local} vs ${partido.equipo_visitante}`;

    try {
      let skipInsert = false;

      // Filter batch items to those overlapping this partido's 2-hour window
      const items = batchItems.filter((e) => {
        const eStart = e.start?.dateTime ? new Date(e.start.dateTime).getTime() : 0;
        const eEnd = e.end?.dateTime ? new Date(e.end.dateTime).getTime() : Infinity;
        return eStart < endDate.getTime() && eEnd > startDate.getTime();
      });

      // 1. Duplicate check — always applies, even when force=true
      const isDuplicate = items.some(
        (e) => e.summary?.toLowerCase() === title.toLowerCase()
      );
      if (isDuplicate) {
        duplicates.push(title);
        skipInsert = true;
      }

      // 2. Conflict check — only when force=false and no duplicate
      if (!skipInsert && !force) {
        const otherEvents = items.filter(
          (e) => e.summary?.toLowerCase() !== title.toLowerCase()
        );
        if (otherEvents.length > 0) {
          conflicts.push({
            partido,
            conflictingEvents: otherEvents.map((e) => e.summary ?? 'Evento sin titulo'),
          });
          skipInsert = true;
        }
      }

      if (skipInsert) continue;

      // 3. Insert
      await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: title,
          description: partido.competicion,
          location: partido.estadio,
          start: {
            dateTime: startDate.toISOString(),
            timeZone: 'America/Argentina/Buenos_Aires',
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: 'America/Argentina/Buenos_Aires',
          },
        },
      });

      added++;
    } catch (err) {
      console.error('Calendar event error:', JSON.stringify(err instanceof Error ? { message: err.message, stack: err.stack } : err, null, 2));
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${partido.equipo_local} vs ${partido.equipo_visitante}: ${msg}`);
    }
  }

  return { added, errors, duplicates, conflicts };
}
