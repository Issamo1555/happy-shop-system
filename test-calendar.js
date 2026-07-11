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

console.log("Testing Google Calendar API for:", clientEmail);
console.log("Calendar ID:", calendarId);

if (!clientEmail || !privateKey || !calendarId) {
  console.error("Missing Google credentials in .env");
  process.exit(1);
}

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/calendar.events"],
});

const calendar = google.calendar({ version: 'v3', auth });

async function test() {
  try {
    const res = await calendar.events.list({
      calendarId: calendarId,
      timeMin: new Date().toISOString(),
      maxResults: 1,
      singleEvents: true,
      orderBy: 'startTime',
    });
    console.log("✅ SUCCESS! Connected to Google Calendar.");
    console.log("Upcoming events found:", res.data.items.length);
    process.exit(0);
  } catch (error) {
    console.error("❌ ERROR: Failed to connect to Google Calendar.");
    console.error(error.message);
    process.exit(1);
  }
}

test();
