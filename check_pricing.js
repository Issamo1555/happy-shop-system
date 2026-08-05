import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'pos.db');
const db = new Database(dbPath);

try {
  const offers = db.prepare("SELECT * FROM pricing_offers").all();
  console.log("PRICING_OFFERS_LIST:", JSON.stringify(offers, null, 2));
} catch (err) {
  console.error("Error reading offers:", err.message);
}
