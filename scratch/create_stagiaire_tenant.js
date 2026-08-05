import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const db = new Database("pos.db");

const tenantId = "tenant-test-stagiaire";
const tenantName = "Mams Hair - Sandbox Test";
const slug = "mams-hair-test";
const adminEmail = "stagiaire@mamshair.com";
const adminPassword = "Stagiaire2026!";
const adminName = "Stagiaire Testeur";

console.log("Creating isolated test tenant for intern...");

// 1. Check if tenant already exists
const existingTenant = db.prepare("SELECT id FROM tenants WHERE id = ? OR slug = ?").get(tenantId, slug);
if (existingTenant) {
  console.log("Tenant already exists. Updating/resetting user...");
  // Check user
  let user = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
  const hash = bcrypt.hashSync(adminPassword, 10);
  if (user) {
    db.prepare("UPDATE users SET password = ?, role = 'admin', tenant_id = ? WHERE email = ?")
      .run(hash, tenantId, adminEmail);
    console.log("Updated password and role for existing user:", adminEmail);
  } else {
    const userId = crypto.randomUUID();
    db.prepare("INSERT INTO users (id, email, password, full_name, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run(userId, adminEmail, hash, adminName, "admin", tenantId);
    console.log("Created user:", adminEmail);
  }
} else {
  // Insert tenant
  const defaultModules = '["caisse", "catalogue", "clients", "agenda", "historique", "tickets", "crm"]';
  db.prepare(`
    INSERT INTO tenants (id, name, slug, logo_url, primary_color, invite_code, active, enabled_modules)
    VALUES (?, ?, ?, null, '#D4A574', null, 1, ?)
  `).run(tenantId, tenantName, slug, defaultModules);
  console.log("Tenant created:", tenantName);

  // Insert user
  const hash = bcrypt.hashSync(adminPassword, 10);
  const userId = crypto.randomUUID();
  db.prepare("INSERT INTO users (id, email, password, full_name, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run(userId, adminEmail, hash, adminName, "admin", tenantId);
  console.log("User created:", adminEmail);

  // Insert settings
  const defaults = {
    "center_name": tenantName,
    "center_address": "Adresse Test",
    "center_phone": "0600000000",
    "center_email": adminEmail,
    "member_discount_percent": "10",
    "tva_percent": "20",
  };
  for (const [key, value] of Object.entries(defaults)) {
    db.prepare("INSERT INTO settings (`key`, value, tenant_id) VALUES (?, ?, ?)").run(key, value, tenantId);
  }

  // Seed sample categories & products
  const cat1 = crypto.randomUUID();
  const cat2 = crypto.randomUUID();
  db.prepare("INSERT INTO categories (id, name, slug, sort_order, active, tenant_id) VALUES (?, ?, ?, 0, 1, ?)").run(cat1, "Coiffure & Coupe", "coiffure", tenantId);
  db.prepare("INSERT INTO categories (id, name, slug, sort_order, active, tenant_id) VALUES (?, ?, ?, 1, 1, ?)").run(cat2, "Soins Capillaires", "soins", tenantId);

  const prod1 = crypto.randomUUID();
  const prod2 = crypto.randomUUID();
  db.prepare("INSERT INTO products (id, name, category, type, price, duration_min, bookable, tenant_id) VALUES (?, ?, 'coiffure', 'service', 250, 45, 1, ?)").run(prod1, "Coupe + Brushing (Test)", tenantId);
  db.prepare("INSERT INTO products (id, name, category, type, price, duration_min, bookable, tenant_id) VALUES (?, ?, 'soins', 'service', 400, 60, 1, ?)").run(prod2, "Soin Kératine (Test)", tenantId);

  // Seed sample client
  const client1 = crypto.randomUUID();
  db.prepare("INSERT INTO clients (id, first_name, last_name, phone, email, tenant_id) VALUES (?, ?, ?, ?, ?, ?)").run(client1, "Client", "Testeur", "0612345678", "client.test@example.com", tenantId);

  console.log("Sample test data seeded successfully.");
}

console.log("\n=== RECAP CRENEAUX & ACCÈS STAGIAIRE ===");
console.log("Tenant:", tenantName);
console.log("Email:", adminEmail);
console.log("Mot de passe:", adminPassword);
console.log("Rôle:", "Admin (Isolé sur son propre espace Sandbox)");
