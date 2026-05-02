import { createServerFn } from "@tanstack/react-start";
import { db } from "./db.server";
import { readFileSync } from "fs";
import { join } from "path";
import { supabase } from "@/integrations/supabase/client";

// SECURITY UTILITY
const checkAdmin = (userId: string | undefined) => {
  if (!userId) throw new Error("Non authentifié");
  const user = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as any;
  if (!user || user.role !== "admin") throw new Error("Accès refusé : Droits administrateur requis");
};

// PRODUCTS
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
    // Soft Delete instead of hard delete
    db.prepare("UPDATE products SET deleted = 1 WHERE id = ?").run(data.id);
    return { success: true };
  });

// CLIENTS
export const getClientsAction = createServerFn({ method: "GET" })
  .handler(async () => {
    return db.prepare("SELECT * FROM clients WHERE deleted = 0 ORDER BY last_name ASC").all();
  });

export const createClientAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
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
    // Soft Delete for clients too
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
  .handler(async ({ data }: { data: string }) => {
    db.prepare("UPDATE client_packs SET sessions_remaining = sessions_remaining - 1 WHERE id = ? AND sessions_remaining > 0")
      .run(data);
    return { success: true };
  });

// APPOINTMENTS
export const getAppointmentsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string }) => {
    return db.prepare("SELECT * FROM appointments WHERE date(starts_at) = ? ORDER BY starts_at")
      .all(data);
  });

export const createAppointmentAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const id = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO appointments (id, client_id, client_name, product_id, service_name, starts_at, duration_min, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.client_id, data.client_name, data.product_id, data.service_name, data.starts_at, data.duration_min, data.notes, data.created_by);
    return { success: true, id };
  });

export const updateAppointmentStatusAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, status: string } }) => {
    db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(data.status, data.id);
    return { success: true };
  });

// SALES
export const saveSaleAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
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

// BACKUP & ADMIN
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

// AUTH
export const loginAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const { email, password } = data;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password);
    if (!user) {
      throw new Error("Email ou mot de passe incorrect");
    }
    return user;
  });

export const signUpAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const { email, password, fullName } = data;
    const id = crypto.randomUUID();
    const role = "cashier";
    db.prepare(`
      INSERT INTO users (id, email, password, full_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, email, password, fullName, role);
    return { id, email, fullName, role };
  });
