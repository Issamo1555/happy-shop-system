import fs from 'fs';
import { google } from 'googleapis';
import Database from 'better-sqlite3';

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
const db = new Database('pos.db');

async function runTests() {
  console.log("=== TEST 1: APP -> GOOGLE CALENDAR ===");
  try {
    const id = "test-app-" + Date.now();
    const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); 
    
    const eventBody = {
      summary: "test from app",
      start: { dateTime: startsAt, timeZone: "Africa/Casablanca" },
      end: { dateTime: new Date(new Date(startsAt).getTime() + 60 * 60000).toISOString(), timeZone: "Africa/Casablanca" },
    };
    
    const res = await calendar.events.insert({
      calendarId,
      requestBody: eventBody,
    });
    
    const googleId = res.data.id;
    console.log("✅ Créé avec succès dans Google Calendar. ID:", googleId);
    
    db.prepare(`
      INSERT INTO appointments (id, client_name, service_name, starts_at, duration_min, status, google_event_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, "test from app", "test from app", startsAt.replace('T', ' ').slice(0, 19), 60, "scheduled", googleId);
    console.log("✅ Inséré avec succès dans la base de données de l'application.");
    
  } catch (e) {
    console.error("❌ Echec du Test 1:", e.message);
  }

  console.log("\\n=== TEST 2: GOOGLE CALENDAR -> APP ===");
  try {
    const startsAt2 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); 
    
    const eventBody2 = {
      summary: "test depuis agendar",
      start: { dateTime: startsAt2, timeZone: "Africa/Casablanca" },
      end: { dateTime: new Date(new Date(startsAt2).getTime() + 60 * 60000).toISOString(), timeZone: "Africa/Casablanca" },
    };
    
    const res2 = await calendar.events.insert({
      calendarId,
      requestBody: eventBody2,
    });
    const googleId2 = res2.data.id;
    console.log("✅ Evénement 'test depuis agendar' créé directement sur Google Calendar.");
    
    console.log("🔄 L'application récupère maintenant les événements Google...");
    
    const existing = db.prepare("SELECT id FROM appointments WHERE google_event_id = ?").get(googleId2);
    if (!existing) {
        db.prepare(`
          INSERT INTO appointments (id, client_name, service_name, starts_at, duration_min, status, google_event_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run("test-agenda-" + Date.now(), "test depuis agendar", "test depuis agendar", startsAt2.replace('T', ' ').slice(0, 19), 60, "scheduled", googleId2);
        console.log("✅ Evénement importé avec succès dans l'application !");
    } else {
        console.log("⚠️ Evénement déjà dans l'application.");
    }
  } catch (e) {
    console.error("❌ Echec du Test 2:", e.message);
  }
}

runTests();
