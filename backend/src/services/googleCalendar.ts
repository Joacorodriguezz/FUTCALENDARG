import { google } from 'googleapis';
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

  for (const partido of partidos) {
    try {
      const startISO = `${partido.fecha}T${partido.hora}:00`;
      const startDate = new Date(startISO);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // +2 hours

      const title = `${partido.equipo_local} vs ${partido.equipo_visitante}`;

      // --- Duplicate & conflict checks (best-effort: if the list call fails, skip checks and insert) ---
      let skipInsert = false;

      try {
        const existing = await calendar.events.list({
          calendarId: 'primary',
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
        });

        const items = existing.data.items ?? [];

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
      } catch (listErr) {
        // List call failed — log and continue with insert (checks are best-effort)
        console.warn('events.list failed for', title, ':', listErr instanceof Error ? listErr.message : listErr);
      }

      if (skipInsert) continue;

      // 3. Insert
      const event = {
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
      };

      await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
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
