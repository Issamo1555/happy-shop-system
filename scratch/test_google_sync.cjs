const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join('=').trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
        env[key] = value.replace(/\\n/g, '\n');
    }
});

const auth = new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
});

async function testSync() {
    try {
        console.log('Authentification...');
        await auth.authorize();
        const calendar = google.calendar({ version: 'v3', auth });
        const res = await calendar.events.list({ calendarId: env.GOOGLE_CALENDAR_ID });
        console.log('✅ Succès ! Connexion établie avec l\'agenda.');
        console.log('Nombre d\'événements trouvés :', res.data.items.length);
    } catch (error) {
        console.error('❌ Erreur :', error.message);
    }
}
testSync();
