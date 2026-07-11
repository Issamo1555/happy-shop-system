import Database from "better-sqlite3";
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { join } from "path";

// Manual dotenv parser
const envContent = readFileSync(join(process.cwd(), ".env"), "utf-8");
const env = {};
envContent.split("\n").forEach(line => {
  const [key, ...value] = line.split("=");
  if (key && value) env[key.trim()] = value.join("=").trim();
});

async function migrate() {
  console.log("🚀 Démarrage de la migration SQLite -> MySQL...");

  const sqlite = new Database(join(process.cwd(), "pos.db"));
  let mysqlConn;
  try {
    mysqlConn = await mysql.createConnection({
      socketPath: "/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock",
      user: "root",
      password: "root",
    });
  } catch (err) {
    mysqlConn = await mysql.createConnection({
      socketPath: "/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock",
      user: "root",
      password: "",
    });
  }

  try {
    await mysqlConn.query("CREATE DATABASE IF NOT EXISTS mums_home_pos");
    await mysqlConn.query("USE mums_home_pos");
    console.log("✅ Base de données MySQL prête.");

    const tables = [
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
      `CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'service',
        price DECIMAL(10,2) NOT NULL,
        pack_sessions INTEGER,
        duration_min INTEGER,
        bookable BOOLEAN NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        deleted BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(50) PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255),
        phone VARCHAR(20),
        email VARCHAR(255),
        is_member BOOLEAN NOT NULL DEFAULT 0,
        children_count INTEGER DEFAULT 0,
        notes TEXT,
        active BOOLEAN NOT NULL DEFAULT 1,
        deleted BOOLEAN NOT NULL DEFAULT 0,
        type VARCHAR(20) NOT NULL DEFAULT 'b2c',
        company_name VARCHAR(255),
        company_ice VARCHAR(50),
        company_if VARCHAR(50),
        company_address TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(50) PRIMARY KEY,
        cashier_id VARCHAR(50) NOT NULL,
        client_id VARCHAR(50),
        subtotal DECIMAL(10,2) NOT NULL,
        discount DECIMAL(10,2) NOT NULL DEFAULT 0,
        discount_reason VARCHAR(255),
        total DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        note TEXT,
        payment_image LONGTEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sale_items (
        id VARCHAR(50) PRIMARY KEY,
        sale_id VARCHAR(50) NOT NULL,
        product_id VARCHAR(50),
        product_name VARCHAR(255) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        quantity INTEGER NOT NULL,
        line_total DECIMAL(10,2) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
      `CREATE TABLE IF NOT EXISTS client_packs (
        id VARCHAR(50) PRIMARY KEY,
        client_id VARCHAR(50) NOT NULL,
        product_id VARCHAR(50) NOT NULL,
        sessions_total INTEGER NOT NULL,
        sessions_remaining INTEGER NOT NULL,
        purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tables) {
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
      if (tableName) await mysqlConn.query(`DROP TABLE IF EXISTS ${tableName}`);
      await mysqlConn.query(sql);
    }
    console.log("✅ Structure des tables créée.");

    const tableNames = ["users", "categories", "products", "clients", "sales", "sale_items", "appointments", "client_packs", "settings"];
    
    for (const table of tableNames) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      if (rows.length > 0) {
        console.log(`📦 Migration de ${rows.length} lignes pour la table ${table}...`);
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => "?").join(",");
        const quotedColumns = columns.map(c => `\`${c}\``).join(",");
        const insertSql = `REPLACE INTO ${table} (${quotedColumns}) VALUES (${placeholders})`;
        
        for (const row of rows) {
          const values = columns.map(col => {
            const val = row[col];
            // Format dates for MySQL (handle T, Z, and +01:00 offsets)
            if (typeof val === "string" && (val.includes("T") || (val.length > 10 && val.includes("-")))) {
              try {
                const d = new Date(val);
                if (!isNaN(d.getTime())) {
                  return d.toISOString().replace("T", " ").replace("Z", "").split(".")[0];
                }
              } catch (e) {}
            }
            return val;
          });
          await mysqlConn.execute(insertSql, values);
        }
      }
    }

    console.log("🎉 Migration terminée avec succès !");
  } catch (err) {
    console.error("❌ Erreur lors de la migration:", err);
  } finally {
    await mysqlConn.end();
  }
}

migrate();
