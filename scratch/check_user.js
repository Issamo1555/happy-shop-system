import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'pos.db');
const db = new Database(dbPath);

const email = 'issamo1555@gmail.com';
const user = db.prepare('SELECT id, email, full_name, role, password FROM users WHERE email = ?').get(email);

if (user) {
  console.log('User found:');
  console.log(JSON.stringify(user, null, 2));
} else {
  console.log('User not found.');
  const allUsers = db.prepare('SELECT email FROM users').all();
  console.log('All users in DB:');
  console.log(JSON.stringify(allUsers, null, 2));
}
