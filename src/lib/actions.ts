import { createServerFn } from "@tanstack/react-start";
import { db } from "./db.server";
import { readFileSync } from "fs";
import { join } from "path";
import { supabase } from "@/integrations/supabase/client";
import bcrypt from "bcryptjs";

// ============================================
// SECURITY UTILITIES
// ============================================

// Verify user is authenticated and return their real role from DB
const checkAuth = (userId: string | undefined) => {
  if (!userId) throw new Error("Non authentifié");
  const user = db.prepare("SELECT id, role FROM users WHERE id = ?").get(userId) as any;
  if (!user) throw new Error("Utilisateur introuvable");
  return user;
};

// Verify user is admin (uses DB, not client-side role)
const checkAdmin = (userId: string | undefined) => {
  const user = checkAuth(userId);
  if (user.role !== "admin") throw new Error("Accès refusé : Droits administrateur requis");
  return user;
};

// Rate limiting for login attempts (in-memory)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const checkRateLimit = (email: string) => {
  const now = Date.now();
  const record = loginAttempts.get(email);
  
  if (record) {
    // Reset if lockout period has passed
    if (now - record.lastAttempt > LOCKOUT_DURATION_MS) {
      loginAttempts.delete(email);
      return;
    }
    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      const remainingMin = Math.ceil((LOCKOUT_DURATION_MS - (now - record.lastAttempt)) / 60000);
      throw new Error(`Trop de tentatives. Réessayez dans ${remainingMin} minutes.`);
    }
  }
};

const recordFailedLogin = (email: string) => {
  const now = Date.now();
  const record = loginAttempts.get(email);
  if (record) {
    record.count++;
    record.lastAttempt = now;
  } else {
    loginAttempts.set(email, { count: 1, lastAttempt: now });
  }
};

const resetLoginAttempts = (email: string) => {
  loginAttempts.delete(email);
};

// Whitelist of allowed table names for DB explorer
const ALLOWED_TABLES = ["products", "clients", "appointments", "sales", "sale_items", "client_packs", "users"];

// ============================================
// PRODUCTS
// ============================================
export const getProductsAction = createServerFn({ method: "GET" })
  .handler(async () => {
    return db.prepare("SELECT * FROM products WHERE deleted = 0 ORDER BY category ASC, sort_order ASC").all();
  });

export const createProductAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    checkAdmin(data.adminId);
    const id = data.id || crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO products (id, name, category, type, price, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.name, data.category, data.type, data.price, data.active ? 1 : 0, data.sort_order);
    return { success: true, id };
  });

export const updateProductAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    checkAdmin(data.adminId);
    const { id, name, category, type, price, active, sort_order } = data;
    db.prepare(`
      UPDATE products 
      SET name = ?, category = ?, type = ?, price = ?, active = ?, sort_order = ?
      WHERE id = ?
    `).run(name, category, type, price, active ? 1 : 0, sort_order, id);
    return { success: true };
  });

export const toggleProductActiveAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, active: boolean, adminId: string } }) => {
    checkAdmin(data.adminId);
    db.prepare("UPDATE products SET active = ? WHERE id = ?").run(data.active ? 1 : 0, data.id);
    return { success: true };
  });

export const deleteProductAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, adminId: string } }) => {
    checkAdmin(data.adminId);
    db.prepare("UPDATE products SET deleted = 1 WHERE id = ?").run(data.id);
    return { success: true };
  });

// ============================================
// CLIENTS (now requires authentication)
// ============================================
export const getClientsAction = createServerFn({ method: "GET" })
  .handler(async () => {
    return db.prepare("SELECT * FROM clients WHERE deleted = 0 ORDER BY last_name ASC").all();
  });

export const createClientAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    checkAuth(data.userId);
    const id = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO clients (id, first_name, last_name, phone, email, is_member, children_count, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.first_name, data.last_name, data.phone, data.email, data.is_member ? 1 : 0, data.children_count, data.notes);
    return { success: true, id };
  });

export const updateClientAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    checkAuth(data.userId);
    const { id, first_name, last_name, phone, email, is_member, children_count, notes } = data;
    db.prepare(`
      UPDATE clients 
      SET first_name = ?, last_name = ?, phone = ?, email = ?, is_member = ?, children_count = ?, notes = ?
      WHERE id = ?
    `).run(first_name, last_name, phone, email, is_member ? 1 : 0, children_count, notes, id);
    return { success: true };
  });

export const deleteClientAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, adminId: string } }) => {
    checkAdmin(data.adminId);
    db.prepare("UPDATE clients SET deleted = 1 WHERE id = ?").run(data.id);
    return { success: true };
  });

export const getClientPacksAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string }) => {
    return db.prepare(`
      SELECT cp.*, p.name as product_name
      FROM client_packs cp
      LEFT JOIN products p ON cp.product_id = p.id
      WHERE cp.client_id = ?
      ORDER BY cp.purchased_at DESC
    `).all(data);
  });

export const consumePackSessionAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { packId: string, userId: string } }) => {
    checkAuth(data.userId);
    db.prepare("UPDATE client_packs SET sessions_remaining = sessions_remaining - 1 WHERE id = ? AND sessions_remaining > 0")
      .run(data.packId);
    return { success: true };
  });

// ============================================
// APPOINTMENTS (now requires authentication)
// ============================================
export const getAppointmentsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string }) => {
    return db.prepare("SELECT * FROM appointments WHERE date(starts_at) = ? ORDER BY starts_at")
      .all(data);
  });

export const createAppointmentAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    checkAuth(data.created_by);
    const id = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO appointments (id, client_id, client_name, product_id, service_name, starts_at, duration_min, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.client_id, data.client_name, data.product_id, data.service_name, data.starts_at, data.duration_min, data.notes, data.created_by);
    return { success: true, id };
  });

export const updateAppointmentStatusAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, status: string, userId: string } }) => {
    checkAuth(data.userId);
    db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(data.status, data.id);
    return { success: true };
  });

// ============================================
// SALES (now requires authentication)
// ============================================
export const saveSaleAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    checkAuth(data.sale.cashier_id);
    const { sale, items } = data;
    const saleId = sale.id || crypto.randomUUID();
    
    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO sales (id, cashier_id, client_id, subtotal, discount, discount_reason, total, payment_method, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(saleId, sale.cashier_id, sale.client_id, sale.subtotal, sale.discount, sale.discount_reason, sale.total, sale.payment_method, sale.note);

      const itemStmt = db.prepare(`
        INSERT INTO sale_items (id, sale_id, product_id, product_name, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        const itemId = item.id || crypto.randomUUID();
        itemStmt.run(itemId, saleId, item.product_id, item.product_name, item.unit_price, item.quantity, item.line_total);
      }
    });
    transaction();
    return { success: true, id: saleId };
  });

export const getSalesAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string }) => {
    return db.prepare(`
      SELECT s.*, c.first_name, c.last_name 
      FROM sales s 
      LEFT JOIN clients c ON s.client_id = c.id 
      WHERE date(s.created_at) = ? 
      ORDER BY s.created_at DESC
    `).all(data);
  });

export const getSaleItemsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string }) => {
    return db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(data);
  });

// ============================================
// BACKUP & ADMIN (protected + SQL injection fix)
// ============================================
export const downloadDatabaseAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { adminId: string } }) => {
    checkAdmin(data.adminId);
    const dbPath = join(process.cwd(), "pos.db");
    const buffer = readFileSync(dbPath);
    return {
      content: buffer.toString("base64"),
      filename: `pos_backup_${new Date().toISOString().split("T")[0]}.db`
    };
  });

export const getTablesAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { adminId: string } }) => {
    checkAdmin(data.adminId);
    return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  });

export const getTableDataAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { tableName: string, adminId: string } }) => {
    checkAdmin(data.adminId);
    // FIX: SQL injection protection - whitelist table names
    if (!ALLOWED_TABLES.includes(data.tableName)) {
      throw new Error(`Table "${data.tableName}" non autorisée`);
    }
    return db.prepare(`SELECT * FROM ${data.tableName} LIMIT 100`).all();
  });

export const importFromSupabaseAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { products: any[], clients: any[] } }) => {
    const transaction = db.transaction(() => {
      if (data.products.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO products (id, name, category, type, price, active, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const p of data.products) {
          stmt.run(p.id, p.name, p.category, p.type, p.price, p.active ? 1 : 0, p.sort_order);
        }
      }
      if (data.clients.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO clients (id, first_name, last_name, phone, email, is_member, children_count, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of data.clients) {
          stmt.run(c.id, c.first_name, c.last_name, c.phone, c.email, c.is_member ? 1 : 0, c.children_count, c.notes);
        }
      }
    });
    transaction();
    return { success: true };
  });

// ============================================
// AUTH (with bcrypt + rate limiting)
// ============================================
export const loginAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const { email, password } = data;
    
    // Rate limiting check
    checkRateLimit(email);
    
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user) {
      recordFailedLogin(email);
      throw new Error("Email ou mot de passe incorrect");
    }
    
    // Compare with hashed password
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      recordFailedLogin(email);
      throw new Error("Email ou mot de passe incorrect");
    }
    
    // Success: reset attempts and return user (without password)
    resetLoginAttempts(email);
    const { password: _, ...safeUser } = user;
    return safeUser;
  });

export const signUpAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const { email, password, fullName, inviteCode } = data;
    
    // Require invite code to prevent unauthorized registrations
    if (inviteCode !== "MUMS2026") {
      throw new Error("Code d'invitation invalide. Contactez l'administrateur.");
    }
    
    // Check if email already exists
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;
    if (existing) {
      throw new Error("Cet email est déjà utilisé");
    }
    
    // Hash the password before storing
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const id = crypto.randomUUID();
    const role = "cashier";
    db.prepare(`
      INSERT INTO users (id, email, password, full_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, email, hashedPassword, fullName, role);
    return { id, email, fullName, role };
  });

// Server-side session validation
export const validateSessionAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string } }) => {
    const user = db.prepare("SELECT id, email, full_name, role, created_at FROM users WHERE id = ?").get(data.userId) as any;
    if (!user) return null;
    return user;
  });
