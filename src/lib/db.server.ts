import Database from "better-sqlite3";
import mysql from "mysql2/promise";
import { join } from "path";
import bcrypt from "bcryptjs";

// Database Configuration
const isMySQL = false; // Force SQLite as per user request

let sqliteDb: any = null;
let mysqlPool: mysql.Pool | null = null;

if (isMySQL) {
  console.log("Using MySQL database (XAMPP/Remote)");
  mysqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "mums_home_pos",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
} else {
  console.log("Using SQLite database (pos.db)");
  const dbPath = process.env.NODE_ENV === "production"
    ? join(process.cwd(), "data", "pos.db")
    : join(process.cwd(), "pos.db");
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma("journal_mode = WAL");
}

// Unified Database Interface
export const db = {
  async execute(sql: string, params: any[] = []): Promise<any> {
    if (isMySQL && mysqlPool) {
      // Convert SQLite's ? placeholder to MySQL if needed (mysql2 uses ? too, so we're good)
      // Note: SQLite uses 1/0 for booleans, MySQL uses 1/0 (tinyint)
      const [rows] = await mysqlPool.execute(sql, params);
      return rows;
    } else {
      return sqliteDb.prepare(sql).run(...params);
    }
  },

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (isMySQL && mysqlPool) {
      const [rows] = await mysqlPool.execute(sql, params);
      return rows as any[];
    } else {
      return sqliteDb.prepare(sql).all(...params);
    }
  },

  async queryOne(sql: string, params: any[] = []): Promise<any> {
    if (isMySQL && mysqlPool) {
      const [rows] = await mysqlPool.execute(sql, params) as any[];
      return rows[0] || null;
    } else {
      return sqliteDb.prepare(sql).get(...params);
    }
  },

  // Legacy support for migrations, using a shim for .prepare().all/get/run
  prepare(sql: string) {
    return {
      all: (...params: any[]) => this.query(sql, params),
      get: (...params: any[]) => this.queryOne(sql, params),
      run: (...params: any[]) => this.execute(sql, params),
    };
  },

  // Transaction support
  transaction(callback: (...args: any[]) => any) {
    if (isMySQL && mysqlPool) {
      return async (...args: any[]) => {
        const connection = await mysqlPool.getConnection();
        try {
          await connection.beginTransaction();
          const result = await callback(...args);
          await connection.commit();
          return result;
        } catch (err) {
          await connection.rollback();
          throw err;
        } finally {
          connection.release();
        }
      };
    } else {
      // For SQLite, better-sqlite3's transaction is synchronous.
      // To support async callbacks, we need to handle BEGIN/COMMIT manually.
      return async (...args: any[]) => {
        sqliteDb.prepare("BEGIN").run();
        try {
          const result = await callback(...args);
          sqliteDb.prepare("COMMIT").run();
          return result;
        } catch (err) {
          sqliteDb.prepare("ROLLBACK").run();
          throw err;
        }
      };
    }
  },

  async getTables(): Promise<string[]> {
    if (isMySQL && mysqlPool) {
      const [rows] = await mysqlPool.execute("SHOW TABLES") as any[];
      return rows.map((r: any) => Object.values(r)[0] as string);
    } else {
      const rows = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
      return rows.map((r: any) => r.name);
    }
  }
};

export const initServerDb = async () => {
  const sqlSchema = isMySQL ? [
    `CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL,
      type VARCHAR(20) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      pack_sessions INTEGER,
      duration_min INTEGER,
      bookable BOOLEAN NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT 1,
      deleted TINYINT(1) DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(50) PRIMARY KEY,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255),
      phone VARCHAR(20),
      email VARCHAR(255),
      is_member BOOLEAN NOT NULL DEFAULT 0,
      children_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT 1,
      deleted TINYINT(1) DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS appointments (
      id VARCHAR(50) PRIMARY KEY,
      client_id VARCHAR(50),
      client_name VARCHAR(255) NOT NULL,
      product_id VARCHAR(50),
      service_name VARCHAR(255) NOT NULL,
      starts_at DATETIME NOT NULL,
      duration_min INTEGER NOT NULL DEFAULT 60,
      status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      created_by VARCHAR(50),
      google_event_id VARCHAR(255),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sales (
      id VARCHAR(50) PRIMARY KEY,
      cashier_id VARCHAR(50) NOT NULL,
      client_id VARCHAR(50),
      subtotal DECIMAL(10,2) NOT NULL,
      discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount_reason VARCHAR(255),
      total DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
      note TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sale_items (
      id VARCHAR(50) PRIMARY KEY,
      sale_id VARCHAR(50) NOT NULL,
      product_id VARCHAR(50),
      product_name VARCHAR(255) NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      line_total DECIMAL(10,2) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS client_packs (
      id VARCHAR(50) PRIMARY KEY,
      client_id VARCHAR(50) NOT NULL,
      product_id VARCHAR(50) NOT NULL,
      sessions_total INTEGER NOT NULL,
      sessions_remaining INTEGER NOT NULL,
      purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(255),
      role VARCHAR(20) NOT NULL DEFAULT 'cashier',
      avatar_url TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ] : [
    // SQLite Schema (existing one)
    `CREATE TABLE IF NOT EXISTS products (
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
    )`,
    // ... (rest of SQLite schema)
  ];

  if (isMySQL) {
    for (const q of sqlSchema) {
      await db.execute(q);
    }
  } else {
    // Original SQLite execution
    sqliteDb.exec(`
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
        active BOOLEAN NOT NULL DEFAULT 1,
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
        google_event_id TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        product_id TEXT,
        product_name TEXT NOT NULL,
        unit_price REAL NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        line_total REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS client_packs (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        sessions_total INTEGER NOT NULL,
        sessions_remaining INTEGER NOT NULL,
        purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT,
        role TEXT NOT NULL DEFAULT 'cashier',
        avatar_url TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Insert default admin
  const adminEmail = "admin@mums.home";
  const admin = await db.queryOne("SELECT id, password FROM users WHERE email = ?", [adminEmail]);
  
  if (!admin) {
    const hashedPassword = bcrypt.hashSync("admin123", 10);
    await db.execute(
      "INSERT INTO users (id, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)",
      ["admin-id", adminEmail, hashedPassword, "Administrateur", "admin"]
    );
  } else if (!admin.password.startsWith("$2")) {
    const hashedPassword = bcrypt.hashSync(admin.password, 10);
    await db.execute("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, admin.id]);
  }

  // Seed default settings
  const defaults = {
    "center_name": "CENTRE DE BIEN-ÊTRE & ACCOMPAGNEMENT",
    "center_address": "CASABLANCA, MAROC",
    "center_phone": "+212 6 XX XX XX XX",
    "center_email": "contact@mums.home",
    "member_discount_percent": "10",
    "google_calendar_id": "",
    "google_client_email": "",
    "google_private_key": "",
  };

  for (const [key, value] of Object.entries(defaults)) {
    const existing = await db.queryOne("SELECT key FROM settings WHERE key = ?", [key]);
    if (!existing) {
      await db.execute("INSERT INTO settings (key, value) VALUES (?, ?)", [key, value]);
    }
  }
};

// Auto-initialize
initServerDb().catch(console.error);
