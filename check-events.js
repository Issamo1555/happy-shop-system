import fs from 'fs';
import { google } from 'googleapis';

const envStr = fs.readFileSync('.env', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  }
});

const clientEmail = env.GOOGLE_CLIENT_EMAIL;
const privateKey = env.GOOGLE_PRIVATE_KEY;
const calendarId = env.GOOGLE_CALENDAR_ID;

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/calendar.events"],
});

const calendar = google.calendar({ version: 'v3', auth });

async function checkEvents() {
  try {
    const res = await calendar.events.list({
      calendarId: calendarId,
      timeMin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    console.log("=== Evénements sur Google Calendar ===");
    if (res.data.items.length === 0) {
      console.log("Aucun événement trouvé.");
    } else {
      res.data.items.forEach(e => {
        console.log(`- ${e.summary} (Début: ${e.start.dateTime || e.start.date})`);
      });
    }
  } catch (error) {
    console.error("Erreur:", error.message);
  }
}

import Database from 'better-sqlite3';

function checkAppEvents() {
  try {
    const db = new Database('pos.db');
    const appts = db.prepare("SELECT * FROM appointments ORDER BY created_at DESC LIMIT 5").all();
    console.log("\\n=== Evénements dans l'Application (pos.db) ===");
    if (appts.length === 0) {
      console.log("Aucun événement trouvé.");
    } else {
      appts.forEach(a => {
        console.log(`- ${a.client_name} - ${a.service_name} (Google ID: ${a.google_event_id ? 'Oui' : 'Non'})`);
      });
    }
  } catch (err) {
    console.log("Erreur BD locale:", err.message);
  }
}

checkEvents().then(() => checkAppEvents());
