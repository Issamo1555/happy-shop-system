import Database from "better-sqlite3";
import mysql from "mysql2/promise";
import { join } from "path";
import bcrypt from "bcryptjs";

// Database Configuration
const isMySQL = !!process.env.MYSQL_HOST;

let sqliteDb: any = null;
let mysqlPool: mysql.Pool | null = null;

export function initDatabase() {
  if (isMySQL) {
    if (!mysqlPool) {
      console.log("🚀 Using MySQL database (XAMPP/Remote)");
      mysqlPool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database: process.env.MYSQL_DATABASE || "mums_home_pos",
        socketPath: process.env.MYSQL_SOCKET || undefined,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        dateStrings: true
      });
    }
  } else {
    if (!sqliteDb) {
      console.log("📦 Using SQLite database (pos.db)");
      const dbPath = join(process.cwd(), "pos.db");
      sqliteDb = new Database(dbPath);
      sqliteDb.pragma("journal_mode = WAL");
    }
  }
}

export function closeDatabase() {
  if (sqliteDb) {
    console.log("🔌 Closing SQLite database connection");
    sqliteDb.close();
    sqliteDb = null;
  }
}

// Initial initialization
initDatabase();

// Unified Database Interface
export const db = {
  async execute(sql: string, params: any[] = []): Promise<any> {
    if (isMySQL && mysqlPool) {
      // Convert SQLite's ? placeholder to MySQL if needed (mysql2 uses ? too, so we're good)
      // Note: SQLite uses 1/0 for booleans, MySQL uses 1/0 (tinyint)
      const [rows] = await mysqlPool.execute(sql, params);
      return rows;
    } else {
      initDatabase();
      return sqliteDb.prepare(sql).run(...params);
    }
  },

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (isMySQL && mysqlPool) {
      const [rows] = await mysqlPool.execute(sql, params);
      // Convert 1/0 to true/false for boolean fields and ensure serializable
      const cleanRows = JSON.parse(JSON.stringify(rows, (key, value) => {
        if (typeof value === 'number' && (key === 'active' || key === 'deleted' || key === 'is_member' || key === 'bookable')) {
          return value === 1;
        }
        return value;
      }));
      return cleanRows as any[];
    } else {
      initDatabase();
      return sqliteDb.prepare(sql).all(...params);
    }
  },

  async queryOne(sql: string, params: any[] = []): Promise<any> {
    if (isMySQL && mysqlPool) {
      const [rows] = await mysqlPool.execute(sql, params) as any[];
      if (!rows[0]) return null;
      const cleanRow = JSON.parse(JSON.stringify(rows[0], (key, value) => {
        if (typeof value === 'number' && (key === 'active' || key === 'deleted' || key === 'is_member' || key === 'bookable')) {
          return value === 1;
        }
        return value;
      }));
      return cleanRow;
    } else {
      initDatabase();
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
        initDatabase();
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
      initDatabase();
      const rows = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
      return rows.map((r: any) => r.name);
    }
  }
};

// ============================================
// MULTI-TENANT: Check if tenant_id column exists
// ============================================
const hasTenantColumn = async (): Promise<boolean> => {
  try {
    if (isMySQL && mysqlPool) {
      const cols = await db.query("SHOW COLUMNS FROM users LIKE 'tenant_id'");
      return cols.length > 0;
    } else {
      const cols = await db.query("PRAGMA table_info(users)") as any[];
      return cols.some((c: any) => c.name === 'tenant_id');
    }
  } catch {
    return false;
  }
};

export const initServerDb = async () => {
  // ============================================
  // 1. CREATE ALL TABLES (including tenants)
  // ============================================
  const sqlSchema = isMySQL ? [
    // TENANTS TABLE (new for multi-tenant)
    `CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      logo_url TEXT,
      primary_color VARCHAR(20) DEFAULT '#D4A574',
      invite_code VARCHAR(50),
      active BOOLEAN NOT NULL DEFAULT 1,
      subscription_plan_id VARCHAR(50),
      subscription_end_date DATETIME,
      enabled_modules TEXT,
      payment_proof_url TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS pricing_offers (
      id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
      description TEXT,
      features TEXT,
      active BOOLEAN NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS prospects (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      email VARCHAR(255),
      city VARCHAR(100),
      specialty VARCHAR(100),
      status VARCHAR(50) DEFAULT 'nouveau',
      assigned_to VARCHAR(50),
      assigned_at DATETIME NULL,
      notes TEXT,
      callback_at VARCHAR(50),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
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
      image_url TEXT,
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
    `CREATE TABLE IF NOT EXISTS pack_consumptions (
      id VARCHAR(50) PRIMARY KEY,
      pack_id VARCHAR(50) NOT NULL,
      consumed_at DATETIME NOT NULL
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
      image_url TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS tickets (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ] : [
    // SQLite Schema
    // (empty - handled below via sqliteDb.exec)
  ];

  if (isMySQL) {
    for (const q of sqlSchema) {
      await db.execute(q);
    }
  } else {
    // Original SQLite execution
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        logo_url TEXT,
        primary_color TEXT DEFAULT '#D4A574',
        invite_code TEXT,
        active BOOLEAN NOT NULL DEFAULT 1,
        subscription_plan_id TEXT,
        subscription_end_date DATETIME,
        enabled_modules TEXT,
        payment_proof_url TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS pricing_offers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        description TEXT,
        features TEXT,
        active BOOLEAN NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS prospects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        city TEXT,
        specialty TEXT,
        status TEXT DEFAULT 'nouveau',
        assigned_to TEXT,
        assigned_at TEXT,
        notes TEXT,
        callback_at TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
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
        image_url TEXT,
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
      CREATE TABLE IF NOT EXISTS pack_consumptions (
        id TEXT PRIMARY KEY,
        pack_id TEXT NOT NULL,
        consumed_at DATETIME NOT NULL
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
        image_url TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` TEXT,
        value TEXT,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        tenant_id TEXT DEFAULT 'default-tenant',
        PRIMARY KEY (tenant_id, \`key\`)
      );
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Index pour la performance
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
      CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments(starts_at);
      CREATE INDEX IF NOT EXISTS idx_prod_cat ON products(category);
      CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(last_name, first_name);
    `);
  }

  // ============================================
  // 2. MULTI-TENANT MIGRATION
  // ============================================
  const alreadyMigrated = await hasTenantColumn();

  if (!alreadyMigrated) {
    console.log("🔄 Running multi-tenant migration — adding tenant_id to all tables...");

    // Create default tenant
    const defaultTenantId = "default-tenant";
    try {
      await db.execute(
        "INSERT INTO tenants (id, name, slug, invite_code, active) VALUES (?, ?, ?, ?, 1)",
        [defaultTenantId, "Mums'Home", "mums-home", "MUMS2026"]
      );
    } catch (e: any) {
      // Tenant might already exist if partial migration happened before
      console.log("Default tenant may already exist:", e.message);
    }

    // Add tenant_id column to all business tables
    const tablesToMigrate = [
      "products", "clients", "appointments", "sales", "sale_items",
      "client_packs", "pack_consumptions", "users", "categories", "tickets"
    ];

    for (const table of tablesToMigrate) {
      try {
        if (isMySQL) {
          await db.execute(`ALTER TABLE ${table} ADD COLUMN tenant_id VARCHAR(50) DEFAULT 'default-tenant'`);
        } else {
          await db.execute(`ALTER TABLE ${table} ADD COLUMN tenant_id TEXT DEFAULT 'default-tenant'`);
        }
        // Set existing rows to default tenant
        await db.execute(`UPDATE ${table} SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = ''`, [defaultTenantId]);
        console.log(`  ✅ ${table} — tenant_id added`);
      } catch (e: any) {
        console.log(`  ⚠️ ${table} — column may already exist: ${e.message}`);
      }
    }

    // Handle settings table: add tenant_id and change PK to composite
    try {
      if (isMySQL) {
        await db.execute("ALTER TABLE settings ADD COLUMN tenant_id VARCHAR(50) DEFAULT 'default-tenant'");
        // Change PK from `key` to (tenant_id, key)
        try {
          await db.execute("ALTER TABLE settings DROP PRIMARY KEY, ADD PRIMARY KEY (tenant_id, `key`)");
        } catch (e: any) {
          console.log("  ⚠️ settings PK change may have already been applied:", e.message);
        }
      } else {
        await db.execute("ALTER TABLE settings ADD COLUMN tenant_id TEXT DEFAULT 'default-tenant'");
      }
      await db.execute("UPDATE settings SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = ''", [defaultTenantId]);
      console.log("  ✅ settings — tenant_id added");
    } catch (e: any) {
      console.log("  ⚠️ settings — column may already exist:", e.message);
    }

    // Create indexes for tenant_id
    try {
      if (isMySQL) {
        for (const table of [...tablesToMigrate, "settings"]) {
          try {
            await db.execute(`CREATE INDEX idx_${table}_tenant ON ${table}(tenant_id)`);
          } catch { /* index may already exist */ }
        }
      } else {
        for (const table of [...tablesToMigrate, "settings"]) {
          try {
            sqliteDb.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenant_id)`);
          } catch { /* index may already exist */ }
        }
      }
    } catch { /* ignore index errors */ }

    console.log("✅ Multi-tenant migration complete!");
  }

  // ============================================
  // 3. INSERT DEFAULT ADMIN (original logic)
  // ============================================
  const adminEmail = "admin@mums.home";
  const admin = await db.queryOne("SELECT id, password FROM users WHERE email = ?", [adminEmail]);
  
  if (!admin) {
    const hashedPassword = bcrypt.hashSync("admin123", 10);
    await db.execute(
      "INSERT INTO users (id, email, password, full_name, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?)",
      ["admin-id", adminEmail, hashedPassword, "Administrateur", "admin", "default-tenant"]
    );
  } else if (!admin.password.startsWith("$2")) {
    const hashedPassword = bcrypt.hashSync(admin.password, 10);
    await db.execute("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, admin.id]);
  }

  // ============================================
  // 4. INSERT SUPER ADMIN (new for multi-tenant)
  // ============================================
  const superAdminEmail = "superadmin@posrdv.com";
  
  // Ensure system tenant exists first
  try {
    await db.execute(
      "INSERT INTO tenants (id, name, slug, invite_code, active) VALUES (?, ?, ?, ?, 1)",
      ["system-tenant", "SaaS Platform", "system", "SYSTEM2026"]
    );
  } catch (e: any) {
    // Already exists
  }

  const superAdmin = await db.queryOne("SELECT id FROM users WHERE email = ?", [superAdminEmail]);
  if (!superAdmin) {
    const hashedPassword = bcrypt.hashSync("SuperAdmin2026!", 10);
    await db.execute(
      "INSERT INTO users (id, email, password, full_name, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?)",
      ["super-admin-id", superAdminEmail, hashedPassword, "Super Admin", "super_admin", "system-tenant"]
    );
    console.log("👑 Super admin created: superadmin@posrdv.com / SuperAdmin2026!");
  } else {
    // Migrate existing super admins to the system tenant
    await db.execute(
      "UPDATE users SET tenant_id = 'system-tenant' WHERE role = 'super_admin'"
    );
  }

  // ============================================
  // 5. SEED DEFAULT SETTINGS (scoped to default tenant)
  // ============================================
  const defaults = {
    "center_name": "CENTRE DE BIEN-ÊTRE & ACCOMPAGNEMENT",
    "center_address": "CASABLANCA, MAROC",
    "center_phone": "+212 6 XX XX XX XX",
    "center_email": "contact@mums.home",
    "member_discount_percent": "10",
    "google_calendar_id": "",
    "google_client_email": "",
    "google_private_key": "",
    "center_ice": "",
    "center_if": "",
    "center_rc": "",
    "center_patente": "",
    "tva_percent": "20",
  };

  for (const [key, value] of Object.entries(defaults)) {
    const existing = await db.queryOne(
      "SELECT `key` FROM settings WHERE `key` = ? AND tenant_id = ?",
      [key, "default-tenant"]
    );
    if (!existing) {
      await db.execute(
        "INSERT INTO settings (`key`, value, tenant_id) VALUES (?, ?, ?)",
        [key, value, "default-tenant"]
      );
    }
  }

  // ============================================
  // 6. SEED DEFAULT CATEGORIES (scoped to default tenant)
  // ============================================
  const categoryCount = await db.queryOne(
    "SELECT COUNT(*) as count FROM categories WHERE tenant_id = ?",
    ["default-tenant"]
  );
  const count = categoryCount ? (Number(categoryCount.count) || 0) : 0;
  if (count === 0) {
    console.log("🌱 Seeding default categories...");
    const defaultCategories = [
      { id: "cat-cafe", name: "Café & Boissons", slug: "cafe", sort_order: 1 },
      { id: "cat-food", name: "Food Healthy", slug: "food", sort_order: 2 },
      { id: "cat-periscolaire", name: "Périscolaire", slug: "periscolaire", sort_order: 3 },
      { id: "cat-laep", name: "LAEP", slug: "laep", sort_order: 4 },
      { id: "cat-pmi", name: "PMI / Pesée", slug: "pmi", sort_order: 5 },
      { id: "cat-allaitement", name: "Allaitement", slug: "allaitement", sort_order: 6 },
      { id: "cat-perinatal", name: "Périnatal", slug: "perinatal", sort_order: 7 },
      { id: "cat-naissance", name: "Préparation naissance", slug: "naissance", sort_order: 8 },
      { id: "cat-soin", name: "Soins & Rituels", slug: "soin", sort_order: 9 },
      { id: "cat-accouchement", name: "Accouchement", slug: "accouchement", sort_order: 10 },
      { id: "cat-atelier", name: "Ateliers", slug: "atelier", sort_order: 11 },
    ];
    for (const cat of defaultCategories) {
      await db.execute(
        "INSERT INTO categories (id, name, slug, sort_order, active, tenant_id) VALUES (?, ?, ?, ?, 1, ?)",
        [cat.id, cat.name, cat.slug, cat.sort_order, "default-tenant"]
      );
    }
  }

  // 6. Prospects migration — add assigned_at column if not exists
  try {
    if (isMySQL) {
      const cols = await db.query("SHOW COLUMNS FROM prospects LIKE 'assigned_at'") as any[];
      if (cols.length === 0) {
        await db.execute("ALTER TABLE prospects ADD COLUMN assigned_at DATETIME NULL;");
        console.log("Migration: Added assigned_at column to prospects table (MySQL)");
      }
    } else {
      const cols = await db.query("PRAGMA table_info(prospects)") as any[];
      if (!cols.some((c: any) => c.name === 'assigned_at')) {
        await db.execute("ALTER TABLE prospects ADD COLUMN assigned_at TEXT;");
        console.log("Migration: Added assigned_at column to prospects table (SQLite)");
      }
    }
  } catch (err: any) {
    console.error("Migration error (assigned_at):", err.message);
  }

  // ============================================
  // 7. SEED SYSTEM TENANT SAAS PRODUCTS
  // ============================================
  try {
    // Soft-delete legacy medical services for the system tenant to avoid FK constraint failures
    await db.execute("UPDATE products SET deleted = 1 WHERE tenant_id = 'system-tenant'");
    await db.execute("UPDATE categories SET active = 0 WHERE tenant_id = 'system-tenant'");

    // Insert SaaS Categories
    const catId = "cat-saas-demo";
    if (isMySQL) {
      await db.execute(
        "INSERT IGNORE INTO categories (id, name, slug, sort_order, active, tenant_id) VALUES (?, ?, ?, ?, 1, ?)",
        [catId, "Présentations & Démos", "demos", 1, "system-tenant"]
      );
    } else {
      await db.execute(
        "INSERT OR IGNORE INTO categories (id, name, slug, sort_order, active, tenant_id) VALUES (?, ?, ?, ?, 1, ?)",
        [catId, "Présentations & Démos", "demos", 1, "system-tenant"]
      );
    }

    // Insert SaaS Products
    const saasProducts = [
      { id: "prod-demo", name: "Démonstration POSetRDV", duration: 30 },
      { id: "prod-devis", name: "Présentation Offre & Devis", duration: 20 },
      { id: "prod-setup", name: "Installation & Paramétrage", duration: 60 },
      { id: "prod-train", name: "Formation Secrétariat & Médecin", duration: 45 },
    ];

    for (const p of saasProducts) {
      if (isMySQL) {
        await db.execute(
          "INSERT IGNORE INTO products (id, name, category, type, price, duration_min, bookable, active, deleted, sort_order, tenant_id) VALUES (?, ?, ?, 'service', 0, ?, 1, 1, 0, 0, ?)",
          [p.id, p.name, "demos", p.duration, "system-tenant"]
        );
      } else {
        await db.execute(
          "INSERT OR IGNORE INTO products (id, name, category, type, price, duration_min, bookable, active, deleted, sort_order, tenant_id) VALUES (?, ?, ?, 'service', 0, ?, 1, 1, 0, 0, ?)",
          [p.id, p.name, "demos", p.duration, "system-tenant"]
        );
      }
    }
    console.log("🌱 SaaS demo products seeded for system-tenant!");
  } catch (err: any) {
    console.error("Error seeding SaaS products:", err.message);
  }
};

// Auto-initialize
initServerDb().catch(console.error);
