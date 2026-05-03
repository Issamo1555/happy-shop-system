import Database from "better-sqlite3";
import { join } from "path";

// In production (Docker), store DB in /app/data for volume persistence
// In development, store in the project root
const dbPath = process.env.NODE_ENV === "production"
  ? join(process.cwd(), "data", "pos.db")
  : join(process.cwd(), "pos.db");
export const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

export const initServerDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      type TEXT NOT NULL,
      price REAL NOT NULL,
      pack_sessions INTEGER,
      duration_min INTEGER,
      bookable BOOLEAN NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT 1,
      deleted INTEGER DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT,
      phone TEXT,
      email TEXT,
      is_member BOOLEAN NOT NULL DEFAULT 0,
      children_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      deleted INTEGER DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      client_name TEXT NOT NULL,
      product_id TEXT,
      service_name TEXT NOT NULL,
      starts_at DATETIME NOT NULL,
      duration_min INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      created_by TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      cashier_id TEXT NOT NULL,
      client_id TEXT,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      discount_reason TEXT,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      note TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      line_total REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS client_packs (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      sessions_total INTEGER NOT NULL,
      sessions_remaining INTEGER NOT NULL,
      purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'cashier',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Insert default admin if not exists
    INSERT OR IGNORE INTO users (id, email, password, full_name, role)
    VALUES ('admin-id', 'admin@mums.home', 'admin123', 'Administrateur', 'admin');
  `);
};

// Auto-initialize when the server starts
initServerDb();
