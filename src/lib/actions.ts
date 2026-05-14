import { createServerFn } from "@tanstack/react-start";
import { db } from "./db.server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { supabase } from "@/integrations/supabase/client";
import bcrypt from "bcryptjs";
import { syncEventToGoogle, deleteEventFromGoogle, pullEventsFromGoogle } from "./google-calendar.server";

// ============================================
// SECURITY UTILITIES
// ============================================

// Verify user is authenticated and return their real role from DB
const checkAuth = async (userId: string | undefined) => {
  if (!userId) throw new Error("Non authentifié");
  const user = await db.prepare("SELECT id, role FROM users WHERE id = ?").get(userId) as any;
  if (!user) throw new Error("Utilisateur introuvable");
  return user;
};

// Verify user is admin (uses DB, not client-side role)
const checkAdmin = async (userId: string | undefined) => {
  const user = await checkAuth(userId);
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
const ALLOWED_TABLES = ["products", "clients", "appointments", "sales", "sale_items", "client_packs", "users", "categories", "settings"];

// ============================================
// PRODUCTS
// ============================================
export const getProductsAction = createServerFn({ method: "GET" })
  .handler(async () => {
    return await db.prepare("SELECT * FROM products WHERE deleted = 0 ORDER BY category ASC, sort_order ASC").all();
  });

export const createProductAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    console.log("Creating product with data:", data);
    await checkAdmin(data.adminId);
    const id = data.id || crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO products (id, name, category, type, price, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(id, data.name, data.category, data.type, data.price, data.active ? 1 : 0, data.sort_order);
    return { success: true, id };
  });

export const updateProductAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    console.log("Updating product with data:", data);
    await checkAdmin(data.adminId);
    const { id, name, category, type, price, active, sort_order } = data;
    await db.prepare(`
      UPDATE products 
      SET name = ?, category = ?, type = ?, price = ?, active = ?, sort_order = ?
      WHERE id = ?
    `).run(name, category, type, price, active ? 1 : 0, sort_order, id);
    return { success: true };
  });

export const toggleProductActiveAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, active: boolean, adminId: string } }) => {
    await checkAdmin(data.adminId);
    await db.prepare("UPDATE products SET active = ? WHERE id = ?").run(data.active ? 1 : 0, data.id);
    return { success: true };
  });

// CATEGORIES
// ============================================
export const getCategoriesAction = createServerFn({ method: "GET" })
  .handler(async () => {
    return await db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all();
  });

export const createCategoryAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    await checkAdmin(data.adminId);
    const id = crypto.randomUUID();
    const slug = data.name.toLowerCase().trim()
      .replace(/[àáâãäå]/g, "a")
      .replace(/[èéêë]/g, "e")
      .replace(/[ìíîï]/g, "i")
      .replace(/[òóôõö]/g, "o")
      .replace(/[ùúûü]/g, "u")
      .replace(/[ñ]/g, "n")
      .replace(/ /g, '-')
      .replace(/[^\w-]+/g, '');
    await db.prepare("INSERT INTO categories (id, name, slug, sort_order, active) VALUES (?, ?, ?, ?, ?)")
      .run(id, data.name, slug, Number(data.sort_order) || 0, data.active !== false ? 1 : 0);
    return { success: true, id };
  });

export const updateCategoryAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    await checkAdmin(data.adminId);
    const { id, name, sort_order, active } = data;
    const slug = name.toLowerCase().trim()
      .replace(/[àáâãäå]/g, "a")
      .replace(/[èéêë]/g, "e")
      .replace(/[ìíîï]/g, "i")
      .replace(/[òóôõö]/g, "o")
      .replace(/[ùúûü]/g, "u")
      .replace(/[ñ]/g, "n")
      .replace(/ /g, '-')
      .replace(/[^\w-]+/g, '');
    await db.prepare("UPDATE categories SET name = ?, slug = ?, sort_order = ?, active = ? WHERE id = ?")
      .run(name, slug, Number(sort_order) || 0, active ? 1 : 0, id);
    return { success: true };
  });

export const deleteCategoryAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, adminId: string } }) => {
    await checkAdmin(data.adminId);
    const category = await db.prepare("SELECT slug FROM categories WHERE id = ?").get(data.id) as any;
    if (category) {
       const product = await db.prepare("SELECT id FROM products WHERE category = ? LIMIT 1").get(category.slug) as any;
       if (product) throw new Error("Impossible de supprimer une catégorie utilisée par des produits.");
    }
    await db.prepare("DELETE FROM categories WHERE id = ?").run(data.id);
    return { success: true };
  });

// SETTINGS
// ============================================
export const getSettingsAction = createServerFn({ method: "GET" })
  .handler(async () => {
    const rows = await db.prepare("SELECT * FROM settings").all() as any[];
    const result = Object.fromEntries(rows.map(r => [r.key, r.value]));
    console.log("Server fetched settings:", result);
    return result;
  });

export const updateSettingsAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { settings: Record<string, string>, adminId: string } }) => {
    await checkAdmin(data.adminId);
    console.log("Saving settings for admin:", data.adminId, data.settings);
    for (const [key, value] of Object.entries(data.settings)) {
      await db.prepare("REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
        .run(key, value === null ? null : String(value));
    }
    return { success: true };
  });

export const deleteProductAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, adminId: string } }) => {
    await checkAdmin(data.adminId);
    await db.prepare("UPDATE products SET deleted = 1 WHERE id = ?").run(data.id);
    return { success: true };
  });

// ============================================
// CLIENTS (now requires authentication)
// ============================================
export const getClientsAction = createServerFn({ method: "GET" })
  .handler(async () => {
    return await db.prepare("SELECT * FROM clients WHERE deleted = 0 ORDER BY last_name ASC").all();
  });

export const createClientAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    await checkAuth(data.userId);
    const id = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO clients (id, first_name, last_name, phone, email, is_member, children_count, notes, active, type, company_name, company_ice, company_if, company_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(
      id, data.first_name, data.last_name, data.phone, data.email, 
      data.is_member ? 1 : 0, data.children_count, data.notes, 
      data.active !== false ? 1 : 0, data.type || 'b2c',
      data.company_name, data.company_ice, data.company_if, data.company_address
    );
    return { success: true, id };
  });

export const updateClientAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    await checkAuth(data.userId);
    const { id, first_name, last_name, phone, email, is_member, children_count, notes, active, type, company_name, company_ice, company_if, company_address } = data;
    await db.prepare(`
      UPDATE clients 
      SET first_name = ?, last_name = ?, phone = ?, email = ?, is_member = ?, children_count = ?, notes = ?, active = ?, type = ?, company_name = ?, company_ice = ?, company_if = ?, company_address = ?
      WHERE id = ?
    `).run(first_name, last_name, phone, email, is_member ? 1 : 0, children_count, notes, active ? 1 : 0, type || 'b2c', company_name, company_ice, company_if, company_address, id);
    return { success: true };
  });

export const toggleClientActiveAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, active: boolean, userId: string } }) => {
    await checkAuth(data.userId);
    await db.prepare("UPDATE clients SET active = ? WHERE id = ?").run(data.active ? 1 : 0, data.id);
    return { success: true };
  });

export const deleteClientAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, adminId: string } }) => {
    await checkAdmin(data.adminId);
    await db.prepare("UPDATE clients SET deleted = 1 WHERE id = ?").run(data.id);
    return { success: true };
  });

export const getClientPacksAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string }) => {
    return await db.prepare(`
      SELECT cp.*, p.name as product_name
      FROM client_packs cp
      LEFT JOIN products p ON cp.product_id = p.id
      WHERE cp.client_id = ?
      ORDER BY cp.purchased_at DESC
    `).all(data);
  });

export const consumePackSessionAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { packId: string, userId: string } }) => {
    await checkAuth(data.userId);
    await db.prepare("UPDATE client_packs SET sessions_remaining = sessions_remaining - 1 WHERE id = ? AND sessions_remaining > 0")
      .run(data.packId);
    return { success: true };
  });

// ============================================
// APPOINTMENTS (now requires authentication)
// ============================================
export const getAppointmentsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string }) => {
    return await db.prepare("SELECT * FROM appointments WHERE date(starts_at) = ? ORDER BY starts_at")
      .all(data);
  });

export const getAppointmentsRangeAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: { from: string; to: string } }) => {
    return await db.prepare("SELECT * FROM appointments WHERE date(starts_at) >= ? AND date(starts_at) <= ? ORDER BY starts_at")
      .all(data.from, data.to);
  });

// Helper to get Google Config for sync
async function getGoogleConfig() {
  const rows = await db.prepare("SELECT key, value FROM settings WHERE key LIKE 'google_%'").all() as any[];
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    clientEmail: s.google_client_email,
    privateKey: s.google_private_key,
    calendarId: s.google_calendar_id
  };
}

export const createAppointmentAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    await checkAuth(data.created_by);
    const id = crypto.randomUUID();
    const startsAt = data.starts_at;
    const createdAt = data.created_at || new Date().toLocaleString('sv-SE').replace(' ', 'T');
    const stmt = db.prepare(`
      INSERT INTO appointments (id, client_id, client_name, product_id, service_name, starts_at, duration_min, notes, created_by, google_event_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Sync to Google Calendar
    const googleConfig = await getGoogleConfig();
    const googleEventId = await syncEventToGoogle({
      id,
      client_name: data.client_name,
      service_name: data.service_name,
      starts_at: startsAt,
      duration_min: data.duration_min,
      notes: data.notes
    }, googleConfig);

    await stmt.run(id, data.client_id, data.client_name, data.product_id, data.service_name, startsAt, data.duration_min, data.notes, data.created_by, googleEventId, createdAt);
    return { success: true, id, googleEventId };
  });

export const updateAppointmentStatusAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, status: string, userId: string } }) => {
    await checkAuth(data.userId);
    
    const appt = await db.prepare("SELECT * FROM appointments WHERE id = ?").get(data.id) as any;
    if (!appt) throw new Error("Rendez-vous introuvable");

    await db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(data.status, data.id);
    
    // If cancelled or no-show, remove from Google Calendar
    if ((data.status === "cancelled" || data.status === "no_show") && appt.google_event_id) {
      await deleteEventFromGoogle(appt.google_event_id);
      await db.prepare("UPDATE appointments SET google_event_id = NULL WHERE id = ?").run(data.id);
    } 
    // If it was cancelled and now re-scheduled, we could re-sync, but for now we'll just handle deletion
    
    return { success: true };
  });

export const syncFromGoogleAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { from: string; to: string } }) => {
    const events = await pullEventsFromGoogle(data.from, data.to);
    let imported = 0;
    for (const evt of events) {
      const existing = await db.prepare("SELECT id FROM appointments WHERE google_event_id = ?").get(evt.google_event_id) as any;
      if (!existing) {
        const id = crypto.randomUUID();
        const startDate = new Date(evt.starts_at);
        const endDate = new Date(evt.ends_at);
        const durationMin = Math.round((endDate.getTime() - startDate.getTime()) / 60000) || 60;
        await db.prepare(`
          INSERT INTO appointments (id, client_name, service_name, starts_at, duration_min, notes, google_event_id, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')
        `).run(id, evt.summary, evt.summary, evt.starts_at, durationMin, evt.description, evt.google_event_id);
        imported++;
      }
    }
    return { success: true, imported, total: events.length };
  });

export const updateAppointmentAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    try {
      const appt = await db.prepare("SELECT * FROM appointments WHERE id = ?").get(data.id) as any;
      if (!appt) throw new Error("Rendez-vous introuvable");

      await db.prepare(`
        UPDATE appointments SET client_name = ?, service_name = ?, starts_at = ?, duration_min = ?, notes = ?
        WHERE id = ?
      `).run(data.client_name, data.service_name, data.starts_at, data.duration_min, data.notes, data.id);

      // Sync update to Google Calendar
      const googleConfig = await getGoogleConfig();
      if (appt.google_event_id || googleConfig.calendarId) {
        const newGoogleId = await syncEventToGoogle({
          id: data.id,
          client_name: data.client_name,
          service_name: data.service_name,
          starts_at: data.starts_at,
          duration_min: data.duration_min,
          notes: data.notes,
          google_event_id: appt.google_event_id,
        }, googleConfig);
        
        if (newGoogleId && newGoogleId !== appt.google_event_id) {
          await db.prepare("UPDATE appointments SET google_event_id = ? WHERE id = ?").run(newGoogleId, data.id);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error("Error in updateAppointmentAction:", err);
      throw err;
    }
  });

export const deleteAppointmentAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, userId: string } }) => {
    await checkAuth(data.userId);
    const appt = await db.prepare("SELECT google_event_id FROM appointments WHERE id = ?").get(data.id) as any;
    
    if (appt?.google_event_id) {
      await deleteEventFromGoogle(appt.google_event_id);
    }
    
    await db.prepare("DELETE FROM appointments WHERE id = ?").run(data.id);
    return { success: true };
  });

// ============================================
// SALES (now requires authentication)
// ============================================
export const saveSaleAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    await checkAuth(data.sale.cashier_id);
    const { sale, items } = data;
    const saleId = sale.id || crypto.randomUUID();
    const createdAt = sale.created_at || new Date().toLocaleString('sv-SE').replace(' ', 'T');
    console.log("Saving sale:", saleId, sale, items);
    
    try {
      const transaction = db.transaction(async () => {
      await db.prepare(`
        INSERT INTO sales (id, cashier_id, client_id, subtotal, discount, discount_reason, total, payment_method, note, payment_image, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(saleId, sale.cashier_id, sale.client_id, sale.subtotal, sale.discount, sale.discount_reason, sale.total, sale.payment_method, sale.note, sale.payment_image, createdAt);

      const itemStmt = db.prepare(`
        INSERT INTO sale_items (id, sale_id, product_id, product_name, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        const itemId = item.id || crypto.randomUUID();
        await itemStmt.run(itemId, saleId, item.product_id, item.product_name, item.unit_price, item.quantity, item.line_total);
      }
    });
      await transaction();
      return { success: true, id: saleId };
    } catch (err: any) {
      console.error("Error in saveSaleAction:", err);
      throw err;
    }
  });

export const updateSalePaymentAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, payment_method: string, note?: string | null, payment_image?: string | null, userId: string } }) => {
    await checkAuth(data.userId);
    await db.prepare(`
      UPDATE sales 
      SET payment_method = ?, note = ?, payment_image = ?
      WHERE id = ?
    `).run(data.payment_method, data.note, data.payment_image, data.id);
    return { success: true };
  });

export const getSalesAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string | { start: string, end: string } }) => {
    if (typeof data === "string") {
      return await db.prepare(`
        SELECT s.*, c.first_name, c.last_name, c.type as client_type, c.company_name, c.company_ice 
        FROM sales s 
        LEFT JOIN clients c ON s.client_id = c.id 
        WHERE date(s.created_at) = ? 
        ORDER BY s.created_at DESC
      `).all(data);
    } else {
      return await db.prepare(`
        SELECT s.*, c.first_name, c.last_name, c.type as client_type, c.company_name, c.company_ice 
        FROM sales s 
        LEFT JOIN clients c ON s.client_id = c.id 
        WHERE date(s.created_at) BETWEEN ? AND ?
        ORDER BY s.created_at DESC
      `).all(data.start, data.end);
    }
  });

export const getSaleItemsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string }) => {
    return await db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(data);
  });

// ============================================
// BACKUP & ADMIN (protected + SQL injection fix)
// ============================================
export const downloadDatabaseAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { adminId: string } }) => {
    await checkAdmin(data.adminId);
    const dbPath = join(process.cwd(), "pos.db");
    const buffer = readFileSync(dbPath);
    return {
      content: buffer.toString("base64"),
      filename: `pos_backup_${new Date().toISOString().split("T")[0]}.db`
    };
  });

export const getTablesAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { adminId: string } }) => {
    await checkAdmin(data.adminId);
    const tables = await db.getTables();
    return tables.map(name => ({ name })); // Wrap in object to match previous return format
  });

export const getTableDataAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { tableName: string, adminId: string } }) => {
    await checkAdmin(data.adminId);
    // FIX: SQL injection protection - whitelist table names
    if (!ALLOWED_TABLES.includes(data.tableName)) {
      throw new Error(`Table "${data.tableName}" non autorisée`);
    }
    return await db.prepare(`SELECT * FROM ${data.tableName} LIMIT 100`).all();
  });

export const importFromSupabaseAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { products: any[], clients: any[] } }) => {
    const transaction = db.transaction(async () => {
      if (data.products.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO products (id, name, category, type, price, active, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const p of data.products) {
          await stmt.run(p.id, p.name, p.category, p.type, p.price, p.active ? 1 : 0, p.sort_order);
        }
      }
      if (data.clients.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO clients (id, first_name, last_name, phone, email, is_member, children_count, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of data.clients) {
          await stmt.run(c.id, c.first_name, c.last_name, c.phone, c.email, c.is_member ? 1 : 0, c.children_count, c.notes);
        }
      }
    });
    await transaction();
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
    
    const user = await db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
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
    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;
    if (existing) {
      throw new Error("Cet email est déjà utilisé");
    }
    
    // Hash the password before storing
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const id = crypto.randomUUID();
    const role = "cashier";
    await db.prepare(`
      INSERT INTO users (id, email, password, full_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, email, hashedPassword, fullName, role);
    return { id, email, fullName, role };
  });

// Server-side session validation
export const validateSessionAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string } }) => {
    const user = await db.prepare("SELECT id, email, full_name, role, avatar_url, created_at FROM users WHERE id = ?").get(data.userId) as any;
    if (!user) return null;
    return user;
  });

export const resetPasswordAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const { email, inviteCode, newPassword } = data;
    
    if (inviteCode !== "MUMS2026") {
      throw new Error("Code d'invitation invalide.");
    }
    
    const user = await db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;
    if (!user) {
      throw new Error("Aucun utilisateur trouvé avec cet email.");
    }
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, user.id);
    
    return { success: true };
  });

export const updateUserProfileAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const { userId, email, full_name, avatar_url } = data;
    await checkAuth(userId);
    
    if (email) {
      const existing = await db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, userId) as any;
      if (existing) {
        throw new Error("Cet email est déjà utilisé par un autre compte.");
      }
    }
    
    await db.prepare("UPDATE users SET email = ?, full_name = ?, avatar_url = ? WHERE id = ?")
      .run(email, full_name, avatar_url, userId);
    
    const updated = await db.prepare("SELECT id, email, full_name, role, avatar_url, created_at FROM users WHERE id = ?").get(userId) as any;
    return updated;
  });

export const uploadAvatarAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    // data is { userId, base64, filename }
    const { userId, base64, filename } = data;
    await checkAuth(userId);

    if (!base64) throw new Error("Données d'image manquantes");

    // Remove prefix like "data:image/png;base64,"
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    const extension = filename.split('.').pop() || 'png';
    const newFilename = `${userId}_${Date.now()}.${extension}`;
    const filePath = join(process.cwd(), "public", "uploads", "avatars", newFilename);
    
    writeFileSync(filePath, buffer);
    
    const publicUrl = `/uploads/avatars/${newFilename}`;
    await db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(publicUrl, userId);
    
    const updated = await db.prepare("SELECT id, email, full_name, role, avatar_url, created_at FROM users WHERE id = ?").get(userId) as any;
    return updated;
  });
