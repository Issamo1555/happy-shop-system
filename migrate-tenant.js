import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Configuration
// You can pass these via environment variables or hardcode them here for the one-off migration
const config = {
  source: {
    host: process.env.SOURCE_DB_HOST || "localhost",
    user: process.env.SOURCE_DB_USER || "root",
    password: process.env.SOURCE_DB_PASSWORD || "",
    database: process.env.SOURCE_DB_NAME || "temp_mums_home",
  },
  target: {
    host: process.env.TARGET_DB_HOST || "localhost",
    user: process.env.TARGET_DB_USER || "root",
    password: process.env.TARGET_DB_PASSWORD || "",
    database: process.env.TARGET_DB_NAME || "crm_smartcodai",
  },
  tenantId: process.env.TARGET_TENANT_ID || "mums-home"
};

const tablesToMigrate = [
  "categories",
  "products",
  "users",
  "clients",
  "appointments",
  "sales",
  "sale_items",
  "client_packs",
  "pack_consumptions",
  "prospects",
  "settings",
  "tickets"
];

async function runMigration() {
  console.log("🚀 Starting Tenant Migration Script...");
  console.log(`📦 Source DB: ${config.source.database}`);
  console.log(`🎯 Target DB: ${config.target.database}`);
  console.log(`🏢 Target Tenant ID: ${config.tenantId}\n`);

  let sourceDb;
  let targetDb;

  try {
    sourceDb = await mysql.createConnection(config.source);
    targetDb = await mysql.createConnection(config.target);

    for (const table of tablesToMigrate) {
      console.log(`\n⏳ Migrating table: ${table}...`);
      
      // 1. Fetch all rows from source
      let rows;
      try {
        [rows] = await sourceDb.execute(`SELECT * FROM ${table}`);
      } catch (err) {
        console.warn(`⚠️ Table ${table} does not exist in source DB or error reading: ${err.message}`);
        continue;
      }

      if (rows.length === 0) {
        console.log(`  ℹ️ No rows found in ${table}, skipping.`);
        continue;
      }

      // 1.5 Fetch target columns
      let targetColumns = [];
      try {
        const [colRows] = await targetDb.execute(`SHOW COLUMNS FROM ${table}`);
        targetColumns = colRows.map(c => c.Field);
      } catch (err) {
        console.warn(`⚠️ Could not fetch columns for ${table} in target DB: ${err.message}`);
        continue;
      }

      // 2. Process rows and insert into target
      let successCount = 0;
      let skipCount = 0;

      for (const row of rows) {
        // Inject or override tenant_id
        row.tenant_id = config.tenantId;

        // Filter row keys to only those that exist in target table
        const filteredKeys = Object.keys(row).filter(k => targetColumns.includes(k));
        const columns = filteredKeys.map(c => `\`${c}\``);
        const values = filteredKeys.map(k => row[k]);
        const placeholders = values.map(() => "?").join(", ");

        const query = `INSERT IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

        try {
          const [result] = await targetDb.execute(query, values);
          if (result.affectedRows === 0) {
            skipCount++; // Insert ignored (probably duplicate ID)
          } else {
            successCount++;
          }
        } catch (insertErr) {
          console.error(`  ❌ Failed to insert row into ${table}:`, insertErr.message);
        }
      }

      console.log(`  ✅ ${table}: ${successCount} rows inserted, ${skipCount} skipped (duplicates).`);
    }

    console.log("\n🎉 Migration completed successfully!");

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
  } finally {
    if (sourceDb) await sourceDb.end();
    if (targetDb) await targetDb.end();
  }
}

runMigration();
