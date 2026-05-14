import { google } from "googleapis";
import { readFileSync } from "fs";
import { join } from "path";

// Load env manually for server-side (Vite doesn't expose process.env for server)
function loadEnv() {
  try {
    const envPath = join(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf8");
    const env: Record<string, string> = {};
    content.split("\n").forEach(line => {
      const parts = line.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join("=").trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        env[key] = value.replace(/\\n/g, "\n");
      }
    });
    return env;
  } catch { return {}; }
}

const env = loadEnv();
const GOOGLE_CLIENT_EMAIL = env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = (env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const GOOGLE_CALENDAR_ID = env.GOOGLE_CALENDAR_ID || process.env.GOOGLE_CALENDAR_ID;

const isConfigured = Boolean(GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY && GOOGLE_CALENDAR_ID);

console.log("[Google Calendar] Configured:", isConfigured, "| Email:", GOOGLE_CLIENT_EMAIL || "N/A");

let auth: any = null;
let calendar: any = null;

if (isConfigured) {
  auth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
  calendar = google.calendar({ version: "v3", auth });
}

export const syncEventToGoogle = async (appt: {
  id: string;
  client_name: string;
  service_name: string;
  starts_at: string;
  duration_min: number;
  notes?: string | null;
  google_event_id?: string | null;
}, config?: { clientEmail?: string, privateKey?: string, calendarId?: string }) => {
  
  // Use config from DB if provided, else fallback to env
  const email = config?.clientEmail || GOOGLE_CLIENT_EMAIL;
  const key = (config?.privateKey || GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const calendarId = config?.calendarId || GOOGLE_CALENDAR_ID;

  if (!email || !key || !calendarId) {
    console.log("Google Calendar sync skipped: not configured");
    return appt.google_event_id || null;
  }

  try {
    const jwtAuth = new google.auth.JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/calendar.events"],
    });
    const cal = google.calendar({ version: "v3", auth: jwtAuth });

    const start = new Date(appt.starts_at);
    const end = new Date(start.getTime() + appt.duration_min * 60000);

    const eventBody = {
      summary: `${appt.client_name} - ${appt.service_name}`,
      description: appt.notes || "",
      start: { dateTime: start.toISOString(), timeZone: "Africa/Casablanca" },
      end: { dateTime: end.toISOString(), timeZone: "Africa/Casablanca" },
    };

    if (appt.google_event_id) {
      const res = await cal.events.update({
        calendarId,
        eventId: appt.google_event_id,
        requestBody: eventBody,
      });
      return res.data.id;
    } else {
      const res = await cal.events.insert({
        calendarId,
        requestBody: eventBody,
      });
      return res.data.id;
    }
  } catch (error: any) {
    console.error("[Google Calendar] Sync error:", error.message);
    return appt.google_event_id || null;
  }
};

export const deleteEventFromGoogle = async (googleEventId: string) => {
  if (!calendar || !GOOGLE_CALENDAR_ID || !googleEventId) return;
  try {
    await calendar.events.delete({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId: googleEventId,
    });
  } catch (error: any) {
    console.error("[Google Calendar] Delete error:", error.message);
  }
};

// Pull events FROM Google Calendar into local format
export const pullEventsFromGoogle = async (from: string, to: string) => {
  if (!calendar || !GOOGLE_CALENDAR_ID) return [];

  try {
    const res = await calendar.events.list({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin: new Date(from).toISOString(),
      timeMax: new Date(to + "T23:59:59").toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });
    return (res.data.items || []).map((e: any) => ({
      google_event_id: e.id,
      summary: e.summary || "Sans titre",
      starts_at: e.start?.dateTime || e.start?.date,
      ends_at: e.end?.dateTime || e.end?.date,
      description: e.description || "",
    }));
  } catch (error: any) {
    console.error("[Google Calendar] Pull error:", error.message);
    return [];
  }
};
