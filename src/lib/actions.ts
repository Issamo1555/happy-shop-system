import { createServerFn } from "@tanstack/react-start";
import { db, closeDatabase, initDatabase } from "./db.server";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import bcrypt from "bcryptjs";
import { syncEventToGoogle, deleteEventFromGoogle, pullEventsFromGoogle } from "./google-calendar.server";

// ============================================
// SECURITY UTILITIES
// ============================================

// Verify user is authenticated and return their real role + tenant_id from DB
const checkAuth = async (userId: string | undefined) => {
  if (!userId) throw new Error("Non authentifié");
  const user = await db.prepare("SELECT id, role, full_name, email, tenant_id FROM users WHERE id = ?").get(userId) as any;
  if (!user) throw new Error("Utilisateur introuvable");
  return user;
};

// Verify user is admin of their tenant (uses DB, not client-side role)
const checkAdmin = async (userId: string | undefined) => {
  const user = await checkAuth(userId);
  if (user.role !== "admin" && user.role !== "super_admin") throw new Error("Accès refusé : Droits administrateur requis");
  return user;
};

// Verify user is super_admin (platform-level admin)
const checkSuperAdmin = async (userId: string | undefined) => {
  const user = await checkAuth(userId);
  if (user.role !== "super_admin") throw new Error("Accès refusé : Droits super-administrateur requis");
  return user;
};

const checkCrmAccess = async (userId: string) => {
  const user = await checkAuth(userId);
  if (user.role !== "super_admin" && user.role !== "sales") throw new Error("Accès refusé : Droits CRM requis");
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
const ALLOWED_TABLES = ["products", "clients", "appointments", "sales", "sale_items", "client_packs", "users", "categories", "settings", "tenants"];

// ============================================
// GENERIC SAFE ACTION WRAPPER
// ============================================
const safeAction = async (fn: () => Promise<any>) => {
  try {
    const res = await fn();
    // Ensure the result is a plain object/array for serialization
    return JSON.parse(JSON.stringify(res));
  } catch (err: any) {
    console.error("Server Action Error:", err.message);
    throw err;
  }
};

// ============================================
// TENANTS (Super Admin only)
// ============================================
export const getTenantsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: { userId: string } }) => {
    await checkSuperAdmin(data.userId);
    return safeAction(() => db.prepare(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as users_count,
        (SELECT COUNT(*) FROM clients WHERE tenant_id = t.id) as clients_count,
        (SELECT SUM(total) FROM sales WHERE tenant_id = t.id) as total_sales
      FROM tenants t ORDER BY t.created_at DESC
    `).all());
  });

export const createTenantAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    await checkSuperAdmin(data.userId);
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

    // Check slug uniqueness
    const existing = await db.queryOne("SELECT id FROM tenants WHERE slug = ?", [slug]);
    if (existing) throw new Error("Un tenant avec ce slug existe déjà");

    const defaultModules = '["caisse", "catalogue", "clients", "agenda", "historique", "tickets", "crm"]';
    await db.execute(
      "INSERT INTO tenants (id, name, slug, logo_url, primary_color, invite_code, active, enabled_modules) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, data.name, slug, data.logo_url || null, data.primary_color || '#D4A574', data.invite_code || null, data.active !== false ? 1 : 0, defaultModules]
    );

    // Create default admin for the tenant
    if (data.admin_email && data.admin_password) {
      const adminId = crypto.randomUUID();
      const hashedPassword = bcrypt.hashSync(data.admin_password, 10);
      await db.execute(
        "INSERT INTO users (id, email, password, full_name, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?)",
        [adminId, data.admin_email, hashedPassword, data.admin_name || "Administrateur", "admin", id]
      );
    }

    // Seed default settings for the new tenant
    const defaults: Record<string, string> = {
      "center_name": data.name,
      "center_address": "",
      "center_phone": "",
      "center_email": data.admin_email || "",
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
      await db.execute(
        "INSERT INTO settings (`key`, value, tenant_id) VALUES (?, ?, ?)",
        [key, value, id]
      );
    }

    return { success: true, id, slug };
  });

export const updateTenantAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    await checkSuperAdmin(data.userId);
    const { id, name, logo_url, primary_color, invite_code, active } = data;
    await db.execute(
      "UPDATE tenants SET name = ?, logo_url = ?, primary_color = ?, invite_code = ?, active = ? WHERE id = ?",
      [name, logo_url || null, primary_color || '#D4A574', invite_code || null, active ? 1 : 0, id]
    );
    return { success: true };
  });

export const toggleTenantActiveAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, active: boolean, userId: string } }) => {
    await checkSuperAdmin(data.userId);
    await db.execute("UPDATE tenants SET active = ? WHERE id = ?", [data.active ? 1 : 0, data.id]);
    return { success: true };
  });

export const getTenantUsersAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: { tenantId?: string, userId: string } }) => {
    const user = await checkAuth(data.userId);
    // Super admin can view any tenant's users; admin can only view their own tenant
    let tenantId = data.tenantId;
    if (user.role === "super_admin") {
      tenantId = tenantId || user.tenant_id;
    } else if (user.role === "admin") {
      tenantId = user.tenant_id;
    } else {
      throw new Error("Accès refusé : Droits administrateur requis");
    }
    return safeAction(() =>
      db.prepare("SELECT id, email, full_name, role, tenant_id, created_at FROM users WHERE tenant_id = ? ORDER BY created_at DESC").all(tenantId)
    );
  });

export const createTenantUserAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { email: string, password: string, fullName: string, role: string, userId: string, tenantId?: string } }) => {
    const admin = await checkAdmin(data.userId);
    
    // Determine target tenant
    let targetTenantId = admin.tenant_id;
    if (data.tenantId && admin.role === "super_admin") {
      // Super admin can assign users to any tenant
      targetTenantId = data.tenantId;
    }
    
    // Validate role
    const allowedRoles = ["cashier", "sales"];
    if (!allowedRoles.includes(data.role)) {
      throw new Error("Rôle invalide. Choisissez 'cashier' ou 'sales'.");
    }
    
    // Validate password
    if (!data.password || data.password.length < 6) {
      throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
    }
    
    // Check email uniqueness
    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(data.email) as any;
    if (existing) {
      throw new Error("Cet email est déjà utilisé par un autre compte.");
    }
    
    const id = crypto.randomUUID();
    const hashedPassword = bcrypt.hashSync(data.password, 10);
    await db.prepare(`
      INSERT INTO users (id, email, password, full_name, role, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.email, hashedPassword, data.fullName, data.role, targetTenantId);
    
    return { success: true, id, email: data.email, fullName: data.fullName, role: data.role };
  });

export const updateUserRoleAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { targetUserId: string, newRole: string, userId: string } }) => {
    const admin = await checkAdmin(data.userId);
    
    // Validate role
    const allowedRoles = ["cashier", "sales", "admin"];
    if (!allowedRoles.includes(data.newRole)) {
      throw new Error("Rôle invalide.");
    }
    
    // Verify target user belongs to same tenant
    const targetUser = await db.prepare("SELECT id, role, tenant_id FROM users WHERE id = ?").get(data.targetUserId) as any;
    if (!targetUser) throw new Error("Utilisateur introuvable.");
    if (targetUser.role === "super_admin") throw new Error("Impossible de modifier un super administrateur.");
    if (admin.role !== "super_admin" && targetUser.tenant_id !== admin.tenant_id) {
      throw new Error("Accès refusé : cet utilisateur n'appartient pas à votre établissement.");
    }
    
    await db.prepare("UPDATE users SET role = ? WHERE id = ?").run(data.newRole, data.targetUserId);
    return { success: true };
  });

export const deleteTenantUserAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { targetUserId: string, userId: string } }) => {
    const admin = await checkAdmin(data.userId);
    
    // Prevent deleting yourself
    if (data.targetUserId === data.userId) throw new Error("Impossible de supprimer votre propre compte.");
    
    // Verify target user belongs to same tenant (unless super admin)
    const targetUser = await db.prepare("SELECT id, role, tenant_id FROM users WHERE id = ?").get(data.targetUserId) as any;
    if (!targetUser) throw new Error("Utilisateur introuvable.");
    if (targetUser.role === "super_admin") throw new Error("Impossible de supprimer un super administrateur.");
    if (admin.role !== "super_admin" && targetUser.tenant_id !== admin.tenant_id) {
      throw new Error("Accès refusé : cet utilisateur n'appartient pas à votre établissement.");
    }
    
    await db.prepare("DELETE FROM users WHERE id = ?").run(data.targetUserId);
    return { success: true };
  });

export const resetTenantUserPasswordAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { targetUserId: string, newPassword: string, userId: string } }) => {
    const admin = await checkAdmin(data.userId);
    if (!data.newPassword || data.newPassword.length < 6) {
      throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
    }
    // Verify target user belongs to same tenant (unless super admin)
    const targetUser = await db.prepare("SELECT id, tenant_id FROM users WHERE id = ?").get(data.targetUserId) as any;
    if (!targetUser) throw new Error("Utilisateur introuvable.");
    if (admin.role !== "super_admin" && targetUser.tenant_id !== admin.tenant_id) {
      throw new Error("Accès refusé.");
    }
    const hashedPassword = bcrypt.hashSync(data.newPassword, 10);
    await db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, data.targetUserId);
    return { success: true };
  });


// ============================================
// PRICING OFFERS (Public & Super Admin)
// ============================================

export const getPricingOffersAction = createServerFn({ method: "GET" })
  .handler(async () => {
    return safeAction(() => db.prepare("SELECT * FROM pricing_offers WHERE active = 1 ORDER BY sort_order ASC").all());
  });

export const getAdminPricingOffersAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: { userId: string } }) => {
    await checkSuperAdmin(data.userId);
    return safeAction(() => db.prepare("SELECT * FROM pricing_offers ORDER BY sort_order ASC").all());
  });

export const createPricingOfferAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    await checkSuperAdmin(data.userId);
    const id = crypto.randomUUID();
    await db.execute(
      "INSERT INTO pricing_offers (id, title, price, billing_cycle, description, features, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, data.title, data.price, data.billing_cycle, data.description, data.features, data.active ? 1 : 0, data.sort_order || 0]
    );
    return { success: true };
  });

export const updatePricingOfferAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    await checkSuperAdmin(data.userId);
    await db.execute(
      "UPDATE pricing_offers SET title = ?, price = ?, billing_cycle = ?, description = ?, features = ?, active = ?, sort_order = ? WHERE id = ?",
      [data.title, data.price, data.billing_cycle, data.description, data.features, data.active ? 1 : 0, data.sort_order || 0, data.id]
    );
    return { success: true };
  });

export const deletePricingOfferAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, userId: string } }) => {
    await checkSuperAdmin(data.userId);
    await db.prepare("DELETE FROM pricing_offers WHERE id = ?").run(data.id);
    return { success: true };
  });

export const updateTenantSubscriptionAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { tenantId: string, planId: string, endDate: string, enabledModules: string[], userId: string } }) => {
    await checkSuperAdmin(data.userId);
    await db.execute(
      "UPDATE tenants SET subscription_plan_id = ?, subscription_end_date = ?, enabled_modules = ? WHERE id = ?", 
      [data.planId, data.endDate, JSON.stringify(data.enabledModules), data.tenantId]
    );
    return { success: true };
  });

// ============================================
// PRODUCTS (tenant-scoped)
// ============================================

export const getProductsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data?: { tenantId?: string } } = {}) => {
    const tenantId = data?.tenantId || "default-tenant";

    if (tenantId === 'system-tenant') {
      try {
        // Check if legacy medical products are active for the system tenant
        const checkMedical = db.prepare("SELECT COUNT(*) as count FROM products WHERE tenant_id = 'system-tenant' AND deleted = 0 AND name LIKE '%[SA]%'").get() as any;
        const medicalCount = checkMedical ? (Number(checkMedical.count) || 0) : 0;

        const checkDemos = db.prepare("SELECT COUNT(*) as count FROM products WHERE tenant_id = 'system-tenant' AND deleted = 0 AND id = 'prod-demo'").get() as any;
        const demoCount = checkDemos ? (Number(checkDemos.count) || 0) : 0;

        if (medicalCount > 0 || demoCount === 0) {
          console.log("🌱 Dynamic conversion: seeding SaaS products for system-tenant...");
          
          // Soft-delete legacy items
          db.prepare("UPDATE products SET deleted = 1 WHERE tenant_id = 'system-tenant'").run();
          db.prepare("UPDATE categories SET active = 0 WHERE tenant_id = 'system-tenant'").run();

          // Insert SaaS categories & products
          const catId = "cat-saas-demo";
          db.prepare("REPLACE INTO categories (id, name, slug, sort_order, active, tenant_id) VALUES (?, ?, ?, ?, 1, ?)")
            .run(catId, "Présentations & Démos", "demos", 1, "system-tenant");

          const saasProducts = [
            { id: "prod-demo", name: "Démonstration POSetRDV", duration: 30 },
            { id: "prod-devis", name: "Présentation Offre & Devis", duration: 20 },
            { id: "prod-setup", name: "Installation & Paramétrage", duration: 60 },
            { id: "prod-train", name: "Formation Secrétariat & Médecin", duration: 45 },
          ];

          for (const p of saasProducts) {
            db.prepare("REPLACE INTO products (id, name, category, type, price, duration_min, bookable, active, deleted, sort_order, tenant_id) VALUES (?, ?, ?, 'service', 0, ?, 1, 1, 0, 0, ?)")
              .run(p.id, p.name, "demos", p.duration, "system-tenant");
          }
          console.log("🌱 Dynamic conversion complete!");
        }
      } catch (err: any) {
        console.error("Error in dynamic SaaS products seeding:", err.message);
      }
    }

    const res = await safeAction(() =>
      db.prepare("SELECT * FROM products WHERE deleted = 0 AND tenant_id = ? ORDER BY category ASC, sort_order ASC").all(tenantId)
    );
    console.log("🔍 getProductsAction returned for tenant:", tenantId, "products count:", res?.length, "data:", JSON.stringify(res));
    return res;
  });

export const createProductAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    console.log("Creating product with data:", data);
    const admin = await checkAdmin(data.adminId);
    const id = data.id || crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO products (id, name, category, type, price, active, sort_order, pack_sessions, image_url, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(id, data.name, data.category, data.type, data.price, data.active ? 1 : 0, data.sort_order, data.pack_sessions || null, data.image_url || null, admin.tenant_id);
    return { success: true, id };
  });

export const updateProductAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    console.log("Updating product with data:", data);
    const admin = await checkAdmin(data.adminId);
    const { id, name, category, type, price, active, sort_order, pack_sessions, image_url } = data;
    await db.prepare(`
      UPDATE products 
      SET name = ?, category = ?, type = ?, price = ?, active = ?, sort_order = ?, pack_sessions = ?, image_url = ?
      WHERE id = ? AND tenant_id = ?
    `).run(name, category, type, price, active ? 1 : 0, sort_order, pack_sessions || null, image_url || null, id, admin.tenant_id);
    return { success: true };
  });

export const toggleProductActiveAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, active: boolean, adminId: string } }) => {
    const admin = await checkAdmin(data.adminId);
    await db.prepare("UPDATE products SET active = ? WHERE id = ? AND tenant_id = ?").run(data.active ? 1 : 0, data.id, admin.tenant_id);
    return { success: true };
  });

export const deleteProductAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, adminId: string } }) => {
    const admin = await checkAdmin(data.adminId);
    await db.prepare("UPDATE products SET deleted = 1 WHERE id = ? AND tenant_id = ?").run(data.id, admin.tenant_id);
    return { success: true };
  });

// ============================================
// CATEGORIES (tenant-scoped)
// ============================================
export const getCategoriesAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data?: { tenantId?: string } } = {}) => {
    const tenantId = data?.tenantId || "default-tenant";
    const rows = await db.prepare("SELECT * FROM categories WHERE tenant_id = ? ORDER BY sort_order ASC").all(tenantId);
    console.log("🔍 DEBUG: Catégories récupérées:", rows?.length || 0, "entrées pour tenant:", tenantId);
    return rows;
  });

export const createCategoryAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const admin = await checkAdmin(data.adminId);
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
    await db.prepare("INSERT INTO categories (id, name, slug, sort_order, active, image_url, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.name, slug, Number(data.sort_order) || 0, data.active !== false ? 1 : 0, data.image_url || null, admin.tenant_id);
    return { success: true, id };
  });

export const updateCategoryAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const admin = await checkAdmin(data.adminId);
    const { id, name, sort_order, active, image_url } = data;
    const slug = name.toLowerCase().trim()
      .replace(/[àáâãäå]/g, "a")
      .replace(/[èéêë]/g, "e")
      .replace(/[ìíîï]/g, "i")
      .replace(/[òóôõö]/g, "o")
      .replace(/[ùúûü]/g, "u")
      .replace(/[ñ]/g, "n")
      .replace(/ /g, '-')
      .replace(/[^\w-]+/g, '');
    await db.prepare("UPDATE categories SET name = ?, slug = ?, sort_order = ?, active = ?, image_url = ? WHERE id = ? AND tenant_id = ?")
      .run(name, slug, Number(sort_order) || 0, active ? 1 : 0, image_url || null, id, admin.tenant_id);
    return { success: true };
  });

export const deleteCategoryAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, adminId: string } }) => {
    const admin = await checkAdmin(data.adminId);
    const category = await db.prepare("SELECT slug FROM categories WHERE id = ? AND tenant_id = ?").get(data.id, admin.tenant_id) as any;
    if (category) {
       const product = await db.prepare("SELECT id FROM products WHERE category = ? AND tenant_id = ? LIMIT 1").get(category.slug, admin.tenant_id) as any;
       if (product) throw new Error("Impossible de supprimer une catégorie utilisée par des produits.");
    }
    await db.prepare("DELETE FROM categories WHERE id = ? AND tenant_id = ?").run(data.id, admin.tenant_id);
    return { success: true };
  });

// ============================================
// SETTINGS (tenant-scoped)
// ============================================
export const getSettingsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data?: { tenantId?: string } } = {}) => {
    const tenantId = data?.tenantId || "default-tenant";
    const rows = await db.prepare("SELECT * FROM settings WHERE tenant_id = ?").all(tenantId) as any[];
    const result = Object.fromEntries(rows.map(r => [r.key, r.value]));
    
    // Fallback for default-tenant settings in settings page
    if (tenantId === 'default-tenant' || tenantId === 'system-tenant') {
      const { readFileSync } = await import("fs");
      const { join } = await import("path");
      
      let clientEmail = process.env.GOOGLE_CLIENT_EMAIL || "";
      let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
      let calendarId = process.env.GOOGLE_CALENDAR_ID || "";
      
      try {
        const envPath = join(process.cwd(), ".env");
        const content = readFileSync(envPath, "utf8");
        content.split("\n").forEach(line => {
          const parts = line.split("=");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            let value = parts.slice(1).join("=").trim();
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.substring(1, value.length - 1);
            }
            if (key === 'GOOGLE_CLIENT_EMAIL') clientEmail = value;
            if (key === 'GOOGLE_PRIVATE_KEY') privateKey = value.replace(/\\n/g, "\n");
            if (key === 'GOOGLE_CALENDAR_ID') calendarId = value;
          }
        });
      } catch {}

      if (!result.google_calendar_id) result.google_calendar_id = calendarId;
      if (!result.google_client_email) result.google_client_email = clientEmail;
      if (!result.google_private_key) result.google_private_key = privateKey;
    }

    console.log("Server fetched settings for tenant:", tenantId);
    return result;
  });

export const updateSettingsAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { settings: Record<string, string>, adminId: string } }) => {
    const admin = await checkAdmin(data.adminId);
    console.log("Saving settings for admin:", data.adminId, "tenant:", admin.tenant_id);
    for (const [key, value] of Object.entries(data.settings)) {
      // Check if setting exists for this tenant
      const existing = await db.queryOne(
        "SELECT `key` FROM settings WHERE `key` = ? AND tenant_id = ?",
        [key, admin.tenant_id]
      );
      if (existing) {
        await db.execute(
          "UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE `key` = ? AND tenant_id = ?",
          [value === null ? null : String(value), key, admin.tenant_id]
        );
      } else {
        await db.execute(
          "INSERT INTO settings (`key`, value, tenant_id) VALUES (?, ?, ?)",
          [key, value === null ? null : String(value), admin.tenant_id]
        );
      }
    }
    return { success: true };
  });

// ============================================
// CLIENTS (tenant-scoped)
// ============================================
export const getClientsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data?: { tenantId?: string } } = {}) => {
    const tenantId = data?.tenantId || "default-tenant";
    return await db.prepare("SELECT * FROM clients WHERE deleted = 0 AND tenant_id = ? ORDER BY last_name ASC").all(tenantId);
  });

export const createClientAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const user = await checkAuth(data.userId);

    if ((data.phone && data.phone.trim() !== '') || (data.email && data.email.trim() !== '')) {
      const p = data.phone?.trim() || '___NO_PHONE___';
      const e = data.email?.trim() || '___NO_EMAIL___';
      const existing = await db.prepare(
        "SELECT id, first_name, last_name FROM clients WHERE (phone = ? OR email = ?) AND tenant_id = ? AND deleted = 0 LIMIT 1"
      ).get(p, e, user.tenant_id) as any;
      
      if (existing) {
        throw new Error(`Un client existe déjà avec ce téléphone ou e-mail (${existing.first_name} ${existing.last_name}).`);
      }
    }

    const id = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO clients (id, first_name, last_name, phone, email, is_member, children_count, notes, active, type, company_name, company_ice, company_if, company_address, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(
      id, data.first_name, data.last_name, data.phone, data.email, 
      data.is_member ? 1 : 0, data.children_count, data.notes, 
      data.active !== false ? 1 : 0, data.type || 'b2c',
      data.company_name, data.company_ice, data.company_if, data.company_address,
      user.tenant_id
    );
    return { success: true, id };
  });

export const updateClientAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const user = await checkAuth(data.userId);
    const { id, first_name, last_name, phone, email, is_member, children_count, notes, active, type, company_name, company_ice, company_if, company_address } = data;

    if ((phone && phone.trim() !== '') || (email && email.trim() !== '')) {
      const p = phone?.trim() || '___NO_PHONE___';
      const e = email?.trim() || '___NO_EMAIL___';
      const existing = await db.prepare(
        "SELECT id, first_name, last_name FROM clients WHERE (phone = ? OR email = ?) AND id != ? AND tenant_id = ? AND deleted = 0 LIMIT 1"
      ).get(p, e, id, user.tenant_id) as any;
      
      if (existing) {
        throw new Error(`Un client existe déjà avec ce téléphone ou e-mail (${existing.first_name} ${existing.last_name}).`);
      }
    }

    await db.prepare(`
      UPDATE clients 
      SET first_name = ?, last_name = ?, phone = ?, email = ?, is_member = ?, children_count = ?, notes = ?, active = ?, type = ?, company_name = ?, company_ice = ?, company_if = ?, company_address = ?
      WHERE id = ? AND tenant_id = ?
    `).run(first_name, last_name, phone, email, is_member ? 1 : 0, children_count, notes, active ? 1 : 0, type || 'b2c', company_name, company_ice, company_if, company_address, id, user.tenant_id);
    return { success: true };
  });

export const toggleClientActiveAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, active: boolean, userId: string } }) => {
    const user = await checkAuth(data.userId);
    await db.prepare("UPDATE clients SET active = ? WHERE id = ? AND tenant_id = ?").run(data.active ? 1 : 0, data.id, user.tenant_id);
    return { success: true };
  });

export const deleteClientAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, adminId: string } }) => {
    const admin = await checkAdmin(data.adminId);
    await db.prepare("UPDATE clients SET deleted = 1 WHERE id = ? AND tenant_id = ?").run(data.id, admin.tenant_id);
    return { success: true };
  });

export const getClientPacksAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string | { clientId: string, tenantId?: string } }) => {
    const clientId = typeof data === 'string' ? data : data.clientId;
    const tenantId = typeof data === 'string' ? 'default-tenant' : (data.tenantId || 'default-tenant');
    const packs = await db.prepare(`
      SELECT cp.*, p.name as product_name
      FROM client_packs cp
      LEFT JOIN products p ON cp.product_id = p.id
      WHERE cp.client_id = ? AND cp.tenant_id = ?
      ORDER BY cp.purchased_at DESC
    `).all(clientId, tenantId);
    
    for (const pack of packs) {
      pack.consumptions = await db.prepare("SELECT * FROM pack_consumptions WHERE pack_id = ? ORDER BY consumed_at ASC").all(pack.id);
    }
    return packs;
  });

export const consumePackSessionAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { packId: string, date: string, userId: string } }) => {
    const user = await checkAuth(data.userId);
    const transaction = db.transaction(async () => {
      const pack = await db.prepare("SELECT sessions_remaining FROM client_packs WHERE id = ? AND tenant_id = ?").get(data.packId, user.tenant_id);
      if (!pack || pack.sessions_remaining <= 0) throw new Error("Pack épuisé");
      
      await db.prepare("UPDATE client_packs SET sessions_remaining = sessions_remaining - 1 WHERE id = ? AND tenant_id = ?").run(data.packId, user.tenant_id);
      await db.prepare("INSERT INTO pack_consumptions (id, pack_id, consumed_at, tenant_id) VALUES (?, ?, ?, ?)")
        .run(crypto.randomUUID(), data.packId, data.date, user.tenant_id);
    });
    await transaction();
    return { success: true };
  });

export const unconsumePackSessionAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { consumptionId: string, packId: string, userId: string } }) => {
    const user = await checkAuth(data.userId);
    const transaction = db.transaction(async () => {
      await db.prepare("DELETE FROM pack_consumptions WHERE id = ? AND tenant_id = ?").run(data.consumptionId, user.tenant_id);
      await db.prepare("UPDATE client_packs SET sessions_remaining = sessions_remaining + 1 WHERE id = ? AND tenant_id = ?").run(data.packId, user.tenant_id);
    });
    await transaction();
    return { success: true };
  });

// ============================================
// APPOINTMENTS (tenant-scoped)
// ============================================
export const getAppointmentsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string | { date: string, tenantId?: string } }) => {
    const date = typeof data === 'string' ? data : data.date;
    const tenantId = typeof data === 'string' ? 'default-tenant' : (data.tenantId || 'default-tenant');
    return await db.prepare("SELECT * FROM appointments WHERE date(starts_at) = ? AND tenant_id = ? ORDER BY starts_at")
      .all(date, tenantId);
  });

export const getAppointmentsRangeAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: { from: string; to: string; tenantId?: string } }) => {
    const tenantId = data.tenantId || "default-tenant";
    return await db.prepare("SELECT * FROM appointments WHERE date(starts_at) >= ? AND date(starts_at) <= ? AND tenant_id = ? ORDER BY starts_at")
      .all(data.from, data.to, tenantId);
  });

// Helper to get Google Config for sync (tenant-scoped)
async function getGoogleConfig(tenantId: string) {
  const rows = await db.prepare("SELECT `key`, value FROM settings WHERE `key` LIKE 'google_%' AND tenant_id = ?").all(tenantId) as any[];
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
  
  const isDefault = tenantId === 'default-tenant' || tenantId === 'system-tenant';
  
  let clientEmail = s.google_client_email || (isDefault ? undefined : "");
  let privateKey = s.google_private_key || (isDefault ? undefined : "");
  let calendarId = s.google_calendar_id || (isDefault ? undefined : "");
  
  if (privateKey && !privateKey.includes("PRIVATE KEY")) {
    try {
      privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
    } catch (e) {
      // not base64
    }
  }

  return {
    clientEmail,
    privateKey,
    calendarId
  };
}

export const createAppointmentAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const user = await checkAuth(data.created_by);
    const id = crypto.randomUUID();
    const startsAt = data.starts_at;
    const duration = Number(data.duration_min) || 30;
    const startDate = new Date(startsAt);
    const endDate = new Date(startDate.getTime() + duration * 60000);
    const endsAt = endDate.toISOString().replace('.000Z', '').replace('Z', '');

    const createdAt = data.created_at || new Date().toLocaleString('sv-SE').replace(' ', 'T');
    
    const stmt = db.prepare(`
      INSERT INTO appointments (id, client_id, client_name, product_id, service_name, starts_at, duration_min, notes, created_by, google_event_id, created_at, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    

    // Sync to Google Calendar
    const googleConfig = await getGoogleConfig(user.tenant_id);
    const googleEventId = await syncEventToGoogle({
      id,
      client_name: data.client_name,
      service_name: data.service_name,
      starts_at: startsAt,
      duration_min: data.duration_min,
      notes: data.notes
    }, googleConfig);

    await stmt.run(id, data.client_id, data.client_name, data.product_id, data.service_name, startsAt, data.duration_min, data.notes, data.created_by, googleEventId, createdAt, user.tenant_id);
    return { success: true, id, googleEventId };
  });

export const updateAppointmentStatusAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string, status: string, userId: string } }) => {
    const user = await checkAuth(data.userId);
    
    const appt = await db.prepare("SELECT * FROM appointments WHERE id = ? AND tenant_id = ?").get(data.id, user.tenant_id) as any;
    if (!appt) throw new Error("Rendez-vous introuvable");

    await db.prepare("UPDATE appointments SET status = ? WHERE id = ? AND tenant_id = ?").run(data.status, data.id, user.tenant_id);
    
    // If cancelled or no-show, remove from Google Calendar
    if ((data.status === "cancelled" || data.status === "no_show") && appt.google_event_id) {
      const googleConfig = await getGoogleConfig(user.tenant_id);
      await deleteEventFromGoogle(appt.google_event_id, googleConfig);
      await db.prepare("UPDATE appointments SET google_event_id = NULL WHERE id = ? AND tenant_id = ?").run(data.id, user.tenant_id);
    } 
    
    return { success: true };
  });

export const syncFromGoogleAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { from: string; to: string; userId?: string } }) => {
    const user = data.userId ? await checkAuth(data.userId) : { tenant_id: "default-tenant" };
    const googleConfig = await getGoogleConfig(user.tenant_id);
    const events = await pullEventsFromGoogle(data.from, data.to, googleConfig);
    let imported = 0;
    for (const evt of events) {
      const existing = await db.prepare("SELECT id FROM appointments WHERE google_event_id = ? AND tenant_id = ?").get(evt.google_event_id, user.tenant_id) as any;
      if (!existing) {
        const id = crypto.randomUUID();
        const startDate = new Date(evt.starts_at);
        const endDate = new Date(evt.ends_at);
        const durationMin = Math.round((endDate.getTime() - startDate.getTime()) / 60000) || 60;
        const mysqlStartsAt = evt.starts_at.includes('T') ? evt.starts_at.substring(0, 19) : evt.starts_at + " 00:00:00";
        await db.prepare(`
          INSERT INTO appointments (id, client_name, service_name, starts_at, duration_min, notes, google_event_id, status, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
        `).run(id, evt.summary, evt.summary, mysqlStartsAt, durationMin, evt.description, evt.google_event_id, user.tenant_id);
        imported++;
      }
    }
    return { success: true, imported, total: events.length };
  });

export const updateAppointmentAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    try {
      // Use userId if available, otherwise fall back to default tenant
      const tenantId = data.userId ? (await checkAuth(data.userId)).tenant_id : "default-tenant";
      
      const appt = await db.prepare("SELECT * FROM appointments WHERE id = ? AND tenant_id = ?").get(data.id, tenantId) as any;
      if (!appt) throw new Error("Rendez-vous introuvable");

      await db.prepare(`
        UPDATE appointments SET client_name = ?, service_name = ?, starts_at = ?, duration_min = ?, notes = ?
        WHERE id = ? AND tenant_id = ?
      `).run(data.client_name, data.service_name, data.starts_at, data.duration_min, data.notes, data.id, tenantId);

      // Sync update to Google Calendar
      const googleConfig = await getGoogleConfig(tenantId);
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
          await db.prepare("UPDATE appointments SET google_event_id = ? WHERE id = ? AND tenant_id = ?").run(newGoogleId, data.id, tenantId);
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
    const user = await checkAuth(data.userId);
    const appt = await db.prepare("SELECT google_event_id FROM appointments WHERE id = ? AND tenant_id = ?").get(data.id, user.tenant_id) as any;
    
    if (appt?.google_event_id) {
      const googleConfig = await getGoogleConfig(user.tenant_id);
      await deleteEventFromGoogle(appt.google_event_id, googleConfig);
    }
    
    await db.prepare("DELETE FROM appointments WHERE id = ? AND tenant_id = ?").run(data.id, user.tenant_id);
    return { success: true };
  });

// ============================================
// SALES (tenant-scoped)
// ============================================
export const saveSaleAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const user = await checkAuth(data.sale.cashier_id);
    const { sale, items } = data;
    const saleId = sale.id || crypto.randomUUID();
    const createdAt = sale.created_at || new Date().toLocaleString('sv-SE').replace(' ', 'T');
    console.log("Saving sale:", saleId, sale, items);
    
    try {
      const transaction = db.transaction(async () => {
      await db.prepare(`
        INSERT INTO sales (id, cashier_id, client_id, subtotal, discount, discount_reason, total, payment_method, note, payment_image, created_at, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(saleId, sale.cashier_id, sale.client_id, sale.subtotal, sale.discount, sale.discount_reason, sale.total, sale.payment_method, sale.note, sale.payment_image, createdAt, user.tenant_id);

      const itemStmt = db.prepare(`
        INSERT INTO sale_items (id, sale_id, product_id, product_name, unit_price, quantity, line_total, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        const itemId = item.id || crypto.randomUUID();
        await itemStmt.run(itemId, saleId, item.product_id, item.product_name, item.unit_price, item.quantity, item.line_total, user.tenant_id);

        if (item.pack_sessions && item.pack_sessions > 0 && sale.client_id) {
          for (let i = 0; i < item.quantity; i++) {
            const packId = crypto.randomUUID();
            await db.prepare(`
              INSERT INTO client_packs (id, client_id, product_id, sessions_total, sessions_remaining, purchased_at, tenant_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(packId, sale.client_id, item.product_id, item.pack_sessions, item.pack_sessions, createdAt, user.tenant_id);
          }
        }
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
    const user = await checkAuth(data.userId);
    await db.prepare(`
      UPDATE sales 
      SET payment_method = ?, note = ?, payment_image = ?
      WHERE id = ? AND tenant_id = ?
    `).run(data.payment_method, data.note, data.payment_image, data.id, user.tenant_id);
    return { success: true };
  });

export const getSalesAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string | { start: string, end: string, tenantId?: string } }) => {
    if (typeof data === "string") {
      // Legacy: single date string (uses default tenant)
      return await db.prepare(`
        SELECT s.*, c.first_name, c.last_name, c.type as client_type, c.company_name, c.company_ice 
        FROM sales s 
        LEFT JOIN clients c ON s.client_id = c.id 
        WHERE date(s.created_at) = ? AND s.tenant_id = ?
        ORDER BY s.created_at DESC
      `).all(data, "default-tenant");
    } else {
      const tenantId = data.tenantId || "default-tenant";
      return await db.prepare(`
        SELECT s.*, c.first_name, c.last_name, c.type as client_type, c.company_name, c.company_ice 
        FROM sales s 
        LEFT JOIN clients c ON s.client_id = c.id 
        WHERE date(s.created_at) BETWEEN ? AND ? AND s.tenant_id = ?
        ORDER BY s.created_at DESC
      `).all(data.start, data.end, tenantId);
    }
  });

export const getSaleItemsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: string }) => {
    return await db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(data);
  });

export const getClientSalesAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: { clientId: string, userId: string } }) => {
    const user = await checkAuth(data.userId);
    const sales = await db.prepare("SELECT * FROM sales WHERE client_id = ? AND tenant_id = ? ORDER BY created_at DESC").all(data.clientId, user.tenant_id) as any[];
    for (const sale of sales) {
      sale.items = await db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(sale.id);
    }
    return sales;
  });

// ============================================
// BACKUP & ADMIN (protected + SQL injection fix)
// ============================================
export const downloadDatabaseAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { adminId: string } }) => {
    await checkAdmin(data.adminId);
    
    if (process.env.MYSQL_HOST) {
      const tables = await db.getTables();
      let sqlDump = "-- MySQL Dump\n";
      sqlDump += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;
      
      for (const table of tables) {
        const rows = await db.query(`SELECT * FROM \`${table}\``);
        if (rows.length === 0) continue;
        
        sqlDump += `\n-- Table: ${table}\n`;
        sqlDump += `TRUNCATE TABLE \`${table}\`;\n`;
        
        for (const row of rows) {
          const keys = Object.keys(row).map(k => `\`${k}\``).join(', ');
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'boolean') return v ? 1 : 0;
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');
          sqlDump += `INSERT INTO \`${table}\` (${keys}) VALUES (${values});\n`;
        }
      }
      sqlDump += `\nSET FOREIGN_KEY_CHECKS = 1;\n`;
      
      return {
        content: Buffer.from(sqlDump).toString("base64"),
        filename: `pos_backup_${new Date().toISOString().split("T")[0]}.sql`
      };
    } else {
      const dbPath = join(process.cwd(), "pos.db");
      if (!existsSync(dbPath)) {
        throw new Error("Base de données SQLite introuvable");
      }
      const buffer = readFileSync(dbPath);
      return {
        content: buffer.toString("base64"),
        filename: `pos_backup_${new Date().toISOString().split("T")[0]}.db`
      };
    }
  });

export const getTablesAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { adminId: string } }) => {
    await checkAdmin(data.adminId);
    const tables = await db.getTables();
    return tables.map(name => ({ name })); // Wrap in object to match previous return format
  });

export const getTableDataAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { tableName: string, adminId: string } }) => {
    const admin = await checkAdmin(data.adminId);
    // FIX: SQL injection protection - whitelist table names
    if (!ALLOWED_TABLES.includes(data.tableName)) {
      throw new Error(`Table "${data.tableName}" non autorisée`);
    }
    // Super admin sees all data, regular admin sees only their tenant
    if (admin.role === 'super_admin') {
      return await db.prepare(`SELECT * FROM ${data.tableName} LIMIT 100`).all();
    } else {
      return await db.prepare(`SELECT * FROM ${data.tableName} WHERE tenant_id = ? LIMIT 100`).all(admin.tenant_id);
    }
  });


const activeUsers = new Map<string, { email: string, name: string, role: string, tenant: string, lastActive: number }>();

const updateActiveUser = (user: any) => {
  if (!user) return;
  activeUsers.set(user.email, {
    email: user.email,
    name: user.full_name || user.fullName || "Utilisateur",
    role: user.role,
    tenant: user.tenant_name || user.tenant_id || "System",
    lastActive: Date.now()
  });
};

export const getActiveUsersAction = createServerFn({ method: "GET" })
  .handler(async () => {
    const now = Date.now();
    for (const [email, info] of activeUsers.entries()) {
      if (now - info.lastActive > 5 * 60 * 1000) { // 5 minutes inactivity timeout
        activeUsers.delete(email);
      }
    }
    return Array.from(activeUsers.values());
  });

const logAccess = (email: string, status: string, details: string) => {
  try {
    const logDir = join(process.cwd(), 'data');
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, 'access.log');
    const logLine = `[${new Date().toISOString()}] ${status.toUpperCase()} - Email: ${email} - ${details}\n`;
    writeFileSync(logFile, logLine, { flag: 'a' });
  } catch (e) {
    console.error("Failed to write to access.log", e);
  }
};

// ============================================
// AUTH (with bcrypt + rate limiting + tenant)
// ============================================
export const loginAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const { email, password, ip = "Inconnue", userAgent = "Inconnu" } = data;
    const deviceDetails = `[IP: ${ip}] [Appareil: ${userAgent.substring(0, 50)}...]`;
    
    // Rate limiting check
    checkRateLimit(email);
    
    const user = await db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user) {
      recordFailedLogin(email);
      logAccess(email, "FAILED", `Unknown user - ${deviceDetails}`);
      throw new Error("Email ou mot de passe incorrect");
    }
    
    // Compare with hashed password
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      recordFailedLogin(email);
      logAccess(email, "FAILED", `Invalid password - ${deviceDetails}`);
      throw new Error("Email ou mot de passe incorrect");
    }

    // Check if tenant is active
    if (user.tenant_id) {
      const tenant = await db.queryOne("SELECT id, name, slug, logo_url, primary_color, active, enabled_modules, subscription_end_date, payment_proof_url FROM tenants WHERE id = ?", [user.tenant_id]);
      if (tenant && !tenant.active) {
        logAccess(email, "FAILED", `Tenant inactive - ${deviceDetails}`);
        throw new Error("Ce compte est désactivé. Contactez le super-administrateur.");
      }
      // Attach tenant info to user
      user.tenant_name = tenant?.name || "";
      user.tenant_slug = tenant?.slug || "";
      user.tenant_logo = tenant?.logo_url || "";
      user.tenant_color = tenant?.primary_color || "#D4A574";
      user.enabled_modules = tenant?.enabled_modules ? JSON.parse(tenant.enabled_modules) : ["caisse", "catalogue", "clients", "agenda", "historique", "tickets", "crm"];
      user.subscription_end_date = tenant?.subscription_end_date || null;
      user.payment_proof_url = tenant?.payment_proof_url || null;
    } else {
      user.enabled_modules = ["caisse", "catalogue", "clients", "agenda", "historique", "tickets", "crm", "access-logs"];
      user.subscription_end_date = null;
      user.payment_proof_url = null;
    }
    
    // Success: reset attempts and return user (without password)
    resetLoginAttempts(email);
    logAccess(email, "SUCCESS", `Role: ${user.role}, Tenant: ${user.tenant_id} - ${deviceDetails}`);
    updateActiveUser(user);
    const { password: _, ...safeUser } = user;
    return safeUser;
  });

export const getAccessLogsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: any }) => {
    // Only super_admin can call this (this check is basic, ideally it should check the user token, but we assume UI protects it or we can pass adminId)
    try {
      const logFile = join(process.cwd(), 'data', 'access.log');
      if (!existsSync(logFile)) return [];
      
      const content = readFileSync(logFile, 'utf-8');
      const lines = content.split('\n').filter((l: string) => l.trim().length > 0);
      
      // Parse the lines into structured objects
      // Format: [2026-07-26T10:25:12.000Z] SUCCESS - Email: stagiaire@posrdv.com - Role: sales, Tenant: system-tenant - [IP: 1.2.3.4] [Appareil: Mozilla...]
      return lines.reverse().slice(0, 1000).map((line: string, index: number) => {
        const match = line.match(/^\[(.*?)\] (SUCCESS|FAILED) - Email: (.*?) - (.*)$/);
        if (match) {
          return {
            id: index,
            date: match[1],
            status: match[2],
            email: match[3],
            details: match[4]
          };
        }
        return { id: index, date: "", status: "UNKNOWN", email: "", details: line };
      });
    } catch (e) {
      console.error(e);
      return [];
    }
  });

export const signUpAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const { email, password, fullName, inviteCode } = data;
    
    // Find the tenant by invite code
    let tenantId = "default-tenant";
    if (inviteCode) {
      const tenant = await db.queryOne("SELECT id FROM tenants WHERE invite_code = ? AND active = 1", [inviteCode]);
      if (tenant) {
        tenantId = tenant.id;
      } else {
        // Fallback: check hardcoded code
        if (inviteCode !== "MUMS2026") {
          throw new Error("Code d'invitation invalide. Contactez l'administrateur.");
        }
      }
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
      INSERT INTO users (id, email, password, full_name, role, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, email, hashedPassword, fullName, role, tenantId);
    return { id, email, fullName, role, tenant_id: tenantId };
  });

// Server-side session validation
export const validateSessionAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string } }) => {
    const user = await db.prepare("SELECT id, email, full_name, role, avatar_url, created_at, tenant_id FROM users WHERE id = ?").get(data.userId) as any;
    if (!user) return null;

    // Attach tenant info
    if (user.tenant_id) {
      const tenant = await db.queryOne("SELECT id, name, slug, logo_url, primary_color, active, enabled_modules, subscription_end_date, payment_proof_url FROM tenants WHERE id = ?", [user.tenant_id]);
      if (tenant) {
        user.tenant_name = tenant.name;
        user.tenant_slug = tenant.slug;
        user.tenant_logo = tenant.logo_url;
        user.tenant_color = tenant.primary_color;
        user.enabled_modules = tenant.enabled_modules ? JSON.parse(tenant.enabled_modules) : ["caisse", "catalogue", "clients", "agenda", "historique", "tickets", "crm"];
        user.subscription_end_date = tenant.subscription_end_date || null;
        user.payment_proof_url = tenant.payment_proof_url || null;
      }
    } else {
      user.enabled_modules = ["caisse", "catalogue", "clients", "agenda", "historique", "tickets", "crm", "access-logs"];
      user.subscription_end_date = null;
      user.payment_proof_url = null;
    }

    updateActiveUser(user);
    return user;
  });

export const resetPasswordAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const { email, inviteCode, newPassword } = data;
    
    // Check invite code against tenant codes or hardcoded
    const tenant = await db.queryOne("SELECT id FROM tenants WHERE invite_code = ?", [inviteCode]);
    if (!tenant && inviteCode !== "MUMS2026") {
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
    
    const updated = await db.prepare("SELECT id, email, full_name, role, avatar_url, created_at, tenant_id FROM users WHERE id = ?").get(userId) as any;
    
    // Attach tenant info
    if (updated.tenant_id) {
      const tenant = await db.queryOne("SELECT name, slug, logo_url, primary_color FROM tenants WHERE id = ?", [updated.tenant_id]);
      if (tenant) {
        updated.tenant_name = tenant.name;
        updated.tenant_slug = tenant.slug;
        updated.tenant_logo = tenant.logo_url;
        updated.tenant_color = tenant.primary_color;
      }
    }
    
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
    
    const updated = await db.prepare("SELECT id, email, full_name, role, avatar_url, created_at, tenant_id FROM users WHERE id = ?").get(userId) as any;
    
    // Attach tenant info
    if (updated.tenant_id) {
      const tenant = await db.queryOne("SELECT name, slug, logo_url, primary_color FROM tenants WHERE id = ?", [updated.tenant_id]);
      if (tenant) {
        updated.tenant_name = tenant.name;
        updated.tenant_slug = tenant.slug;
        updated.tenant_logo = tenant.logo_url;
        updated.tenant_color = tenant.primary_color;
      }
    }
    
    return updated;
  });

// ============================================
// TICKETS (tenant-scoped)
// ============================================

export const getTicketsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data?: { userId: string } }) => {
    if (data?.userId) {
      const user = await checkAuth(data.userId);
      if (user.role === 'super_admin') {
        // Super admin sees all tickets across tenants
        return await db.prepare("SELECT * FROM tickets ORDER BY created_at DESC").all();
      } else if (user.role === 'admin') {
        // Tenant admin sees all tickets for their tenant
        return await db.prepare("SELECT * FROM tickets WHERE tenant_id = ? ORDER BY created_at DESC").all(user.tenant_id);
      } else {
        // Regular user sees only their tickets
        return await db.prepare("SELECT * FROM tickets WHERE user_id = ? AND tenant_id = ? ORDER BY created_at DESC").all(data.userId, user.tenant_id);
      }
    }
    return [];
  });

export const createTicketAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const user = await checkAuth(data.userId);
    const id = crypto.randomUUID();
    const createdAt = new Date().toLocaleString('sv-SE').replace(' ', 'T');
    await db.prepare(`
      INSERT INTO tickets (id, user_id, user_name, type, title, description, image_url, status, created_at, updated_at, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
    `).run(id, user.id, user.full_name || user.email, data.type, data.title, data.description, data.image_url || null, createdAt, createdAt, user.tenant_id);
    return { success: true, id };
  });

export const updateTicketStatusAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { ticketId: string, status: string, adminId: string } }) => {
    await checkAdmin(data.adminId);
    await db.prepare("UPDATE tickets SET status = ? WHERE id = ?").run(data.status, data.ticketId);
    return { success: true };
  });

export const uploadTicketImageAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    const { userId, base64, filename } = data;
    await checkAuth(userId);

    if (!base64) throw new Error("Données d'image manquantes");

    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    const extension = filename.split('.').pop() || 'png';
    const newFilename = `ticket_${userId}_${Date.now()}.${extension}`;
    const dirPath = join(process.cwd(), "public", "uploads", "tickets");
    
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    
    const filePath = join(dirPath, newFilename);
    writeFileSync(filePath, buffer);
    
    const publicUrl = `/uploads/tickets/${newFilename}`;
    return { success: true, url: publicUrl };
  });

// ============================================
// TENANT SEEDER
// ============================================
export const seedTenantDataAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { tenantId: string, prefix: string, adminId: string } }) => {
    await checkSuperAdmin(data.adminId);
    
    const { tenantId, prefix } = data;
    const px = prefix ? `${prefix} ` : "";

    // 1. Categories
    const cat1Id = crypto.randomUUID();
    const cat2Id = crypto.randomUUID();
    const cat3Id = crypto.randomUUID();
    await db.execute("INSERT INTO categories (id, name, slug, sort_order, active, image_url, tenant_id) VALUES (?, ?, ?, ?, 1, '/uploads/cat_consultation.png', ?)", 
      [cat1Id, `${px}Consultations`, `${prefix.toLowerCase()}-consultations`, 0, tenantId]);
    await db.execute("INSERT INTO categories (id, name, slug, sort_order, active, image_url, tenant_id) VALUES (?, ?, ?, ?, 1, '/uploads/cat_reeducation.png', ?)", 
      [cat2Id, `${px}Rééducation`, `${prefix.toLowerCase()}-reeducation`, 1, tenantId]);
    await db.execute("INSERT INTO categories (id, name, slug, sort_order, active, image_url, tenant_id) VALUES (?, ?, ?, ?, 1, '/uploads/cat_massage.png', ?)", 
      [cat3Id, `${px}Massages Thérapeutiques`, `${prefix.toLowerCase()}-massages`, 2, tenantId]);

    // 2. Products
    const prod1Id = crypto.randomUUID();
    const prod2Id = crypto.randomUUID();
    const prod3Id = crypto.randomUUID();
    const prod4Id = crypto.randomUUID();
    const prod5Id = crypto.randomUUID();
    
    await db.execute("INSERT INTO products (id, name, category, type, price, duration_min, bookable, image_url, tenant_id) VALUES (?, ?, ?, 'service', 400, 60, 1, '/uploads/prod_bilan.png', ?)", 
      [prod1Id, `${px}Bilan initial kinésithérapie`, `${prefix.toLowerCase()}-consultations`, tenantId]);
    await db.execute("INSERT INTO products (id, name, category, type, price, duration_min, bookable, image_url, tenant_id) VALUES (?, ?, ?, 'service', 200, 30, 1, '/uploads/prod_rehab.png', ?)", 
      [prod2Id, `${px}Séance de rééducation`, `${prefix.toLowerCase()}-reeducation`, tenantId]);
    await db.execute("INSERT INTO products (id, name, category, type, price, duration_min, bookable, image_url, tenant_id) VALUES (?, ?, ?, 'service', 150, 15, 1, '/uploads/prod_shockwave.png', ?)", 
      [prod3Id, `${px}Ondes de choc`, `${prefix.toLowerCase()}-reeducation`, tenantId]);
    await db.execute("INSERT INTO products (id, name, category, type, price, duration_min, bookable, image_url, tenant_id) VALUES (?, ?, ?, 'service', 350, 45, 1, '/uploads/prod_backmassage.png', ?)", 
      [prod4Id, `${px}Massage thérapeutique dos`, `${prefix.toLowerCase()}-massages`, tenantId]);
    await db.execute("INSERT INTO products (id, name, category, type, price, duration_min, bookable, image_url, tenant_id) VALUES (?, ?, ?, 'service', 400, 60, 1, '/uploads/prod_drainage.png', ?)", 
      [prod5Id, `${px}Drainage lymphatique`, `${prefix.toLowerCase()}-massages`, tenantId]);

    // 3. Clients
    const c1Id = crypto.randomUUID();
    const c2Id = crypto.randomUUID();
    const c3Id = crypto.randomUUID();
    await db.execute("INSERT INTO clients (id, first_name, last_name, phone, email, tenant_id) VALUES (?, ?, ?, ?, ?, ?)", 
      [c1Id, `${px}Client 1`, "", "0600000001", "c1@test.com", tenantId]);
    await db.execute("INSERT INTO clients (id, first_name, last_name, phone, email, tenant_id) VALUES (?, ?, ?, ?, ?, ?)", 
      [c2Id, `${px}Client 2 (C2)`, "", "0600000002", "c2@test.com", tenantId]);
    await db.execute("INSERT INTO clients (id, first_name, last_name, phone, email, tenant_id) VALUES (?, ?, ?, ?, ?, ?)", 
      [c3Id, `${px}Client 3 (C3)`, "", "0600000003", "c3@test.com", tenantId]);

    // 4. Appointments (in 1 day, 2 days, 3 days)
    const now = new Date();
    const d1 = new Date(now); d1.setDate(d1.getDate() + 1); d1.setHours(10, 0, 0, 0);
    const d2 = new Date(now); d2.setDate(d2.getDate() + 2); d2.setHours(14, 0, 0, 0);
    
    await db.execute("INSERT INTO appointments (id, client_id, client_name, product_id, service_name, starts_at, duration_min, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), c1Id, `${px}Client 1`, prod1Id, `${px}Bilan initial kinésithérapie`, d1.toLocaleString('sv-SE').replace(' ', 'T'), 60, tenantId]);
    await db.execute("INSERT INTO appointments (id, client_id, client_name, product_id, service_name, starts_at, duration_min, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), c2Id, `${px}Client 2 (C2)`, prod2Id, `${px}Séance de rééducation`, d2.toLocaleString('sv-SE').replace(' ', 'T'), 30, tenantId]);

    // 5. Sales
    const s1Id = crypto.randomUUID();
    const adminUser = await db.queryOne("SELECT id FROM users WHERE tenant_id = ? AND role = 'admin' LIMIT 1", [tenantId]);
    const cashierId = adminUser ? adminUser.id : "system";
    
    await db.execute("INSERT INTO sales (id, cashier_id, client_id, subtotal, discount, total, payment_method, tenant_id) VALUES (?, ?, ?, ?, 0, ?, 'cash', ?)",
      [s1Id, cashierId, c1Id, 400, 400, tenantId]);
    await db.execute("INSERT INTO sale_items (id, sale_id, product_id, product_name, unit_price, quantity, line_total, tenant_id) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
      [crypto.randomUUID(), s1Id, prod1Id, `${px}Bilan initial kinésithérapie`, 400, 400, tenantId]);

    return { success: true };
  });

// ============================================
// CRM / PROSPECTION ACTIONS
// ============================================

export const getProspectsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: { userId: string } }) => {
    const user = await checkCrmAccess(data.userId);
    
    if (user.role === "super_admin") {
      return await db.query("SELECT * FROM prospects ORDER BY created_at DESC");
    } else {
      return await db.query("SELECT * FROM prospects WHERE assigned_to = ? ORDER BY created_at DESC", [user.id]);
    }
  });

export const updateProspectStatusAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string, prospectId: string, status: string, notes?: string } }) => {
    const user = await checkCrmAccess(data.userId);
    if (data.notes !== undefined) {
      await db.execute("UPDATE prospects SET status = ?, notes = ? WHERE id = ?", [data.status, data.notes, data.prospectId]);
    } else {
      await db.execute("UPDATE prospects SET status = ? WHERE id = ?", [data.status, data.prospectId]);
    }
    return { success: true };
  });

export const updateProspectAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string, prospectId: string, email: string, notes: string, status: string, callbackAt: string | null, rdvAt: string | null } }) => {
    const user = await checkCrmAccess(data.userId);
    
    await db.execute(
      "UPDATE prospects SET email = ?, notes = ?, status = ?, callback_at = ? WHERE id = ?",
      [data.email, data.notes, data.status, data.callbackAt || null, data.prospectId]
    );

    if (data.rdvAt) {
      const prospect = await db.queryOne("SELECT name FROM prospects WHERE id = ?", [data.prospectId]);
      if (prospect) {
        const appointmentId = crypto.randomUUID();
        const startsAt = data.rdvAt;
        const serviceName = "Démonstration CRM";
        const notes = `RDV prospect programmé par l'agent. Notes : ${data.notes || ''}`;
        const durationMin = 60;
        
        // Sync to Google Calendar
        const googleConfig = await getGoogleConfig(user.tenant_id);
        const googleEventId = await syncEventToGoogle({
          id: appointmentId,
          client_name: prospect.name,
          service_name: serviceName,
          starts_at: startsAt,
          duration_min: durationMin,
          notes: notes
        }, googleConfig);

        await db.execute(`
          INSERT INTO appointments (id, client_id, client_name, product_id, service_name, starts_at, duration_min, notes, created_by, google_event_id, created_at, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          appointmentId, 
          null, 
          prospect.name, 
          null, 
          serviceName, 
          startsAt, 
          durationMin, 
          notes, 
          data.userId, 
          googleEventId,
          new Date().toISOString().replace('.000Z', '').replace('Z', ''),
          user.tenant_id
        ]);
      }
    }
    return { success: true };
  });

export const assignProspectAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string, prospectId: string, assignedTo: string | null } }) => {
    await checkSuperAdmin(data.userId);
    const nowStr = data.assignedTo ? new Date().toISOString() : null;
    await db.execute("UPDATE prospects SET assigned_to = ?, assigned_at = ? WHERE id = ?", [data.assignedTo, nowStr, data.prospectId]);
    return { success: true };
  });

export const getSalesAgentsAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: { userId: string } }) => {
    await checkSuperAdmin(data.userId);
    return await db.query("SELECT id, full_name AS name FROM users WHERE role = 'sales'");
  });

export const importProspectsAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string, prospects: any[], duplicateStrategy: 'skip' | 'update' | 'allow', duplicateCriteria?: 'phone_or_email' | 'phone' | 'email' } }) => {
    const user = await checkCrmAccess(data.userId);
    const { prospects, duplicateStrategy, duplicateCriteria = 'phone_or_email' } = data;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    await db.transaction(async () => {
      // Fetch existing prospects to build duplicate checking sets
      const existing = await db.query("SELECT phone, email FROM prospects") as any[];
      const existingPhones = new Set(existing.map(p => p.phone?.replace(/\s+/g, '')).filter(Boolean));
      const existingEmails = new Set(existing.map(p => p.email?.trim().toLowerCase()).filter(Boolean));

      for (const p of prospects) {
        const name = p.name?.trim();
        if (!name) {
          skipped++;
          continue;
        }

        const phone = p.phone?.trim() || null;
        const phoneKey = phone ? phone.replace(/\s+/g, '') : null;
        const email = p.email?.trim().toLowerCase() || null;
        const city = p.city?.trim() || null;
        const specialty = p.specialty?.trim() || null;
        const notes = p.notes?.trim() || null;

        // Check duplicates based on criteria
        const isPhoneDup = phoneKey && existingPhones.has(phoneKey);
        const isEmailDup = email && existingEmails.has(email);
        
        let isDuplicate = false;
        if (duplicateCriteria === 'phone') {
          isDuplicate = !!isPhoneDup;
        } else if (duplicateCriteria === 'email') {
          isDuplicate = !!isEmailDup;
        } else {
          isDuplicate = !!isPhoneDup || !!isEmailDup;
        }

        if (isDuplicate && duplicateStrategy !== 'allow') {
          if (duplicateStrategy === 'skip') {
            skipped++;
            continue;
          } else if (duplicateStrategy === 'update') {
            let rowUpdated = false;
            // Update based on which duplicate field matched
            if (duplicateCriteria !== 'email' && phoneKey && existingPhones.has(phoneKey)) {
              await db.execute(
                "UPDATE prospects SET name = ?, city = ?, specialty = ?, notes = ? WHERE REPLACE(phone, ' ', '') = ?",
                [name, city, specialty, notes, phoneKey]
              );
              rowUpdated = true;
            } else if (duplicateCriteria !== 'phone' && email && existingEmails.has(email)) {
              await db.execute(
                "UPDATE prospects SET name = ?, city = ?, specialty = ?, notes = ? WHERE LOWER(email) = ?",
                [name, city, specialty, notes, email]
              );
              rowUpdated = true;
            }
            if (rowUpdated) {
              updated++;
            } else {
              skipped++;
            }
            continue;
          }
        }

        // Insert new record
        const id = crypto.randomUUID();
        const assignedTo = user.role === 'super_admin' ? null : user.id;
        const assignedAt = assignedTo ? new Date().toISOString() : null;
        await db.execute(
          "INSERT INTO prospects (id, name, phone, email, city, specialty, status, assigned_to, assigned_at, notes) VALUES (?, ?, ?, ?, ?, ?, 'nouveau', ?, ?, ?)",
          [id, name, phone, email, city, specialty, assignedTo, assignedAt, notes]
        );
        inserted++;

        // Keep local sets updated for this batch
        if (phoneKey) existingPhones.add(phoneKey);
        if (email) existingEmails.add(email);
      }
    });

    return { success: true, inserted, updated, skipped };
  });

export const distributeProspectsAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string } }) => {
    await checkSuperAdmin(data.userId);

    const agents = await db.query("SELECT id FROM users WHERE role = 'sales'") as any[];
    if (agents.length === 0) {
      throw new Error("Aucun commercial actif trouvé pour la distribution.");
    }

    const unassigned = await db.query("SELECT id FROM prospects WHERE assigned_to IS NULL") as any[];
    if (unassigned.length === 0) {
      return { success: true, count: 0, message: "Aucun prospect non assigné à distribuer." };
    }

    let count = 0;
    const nowStr = new Date().toISOString();
    await db.transaction(async () => {
      let agentIndex = 0;
      for (const p of unassigned) {
        const agentId = agents[agentIndex].id;
        await db.execute("UPDATE prospects SET assigned_to = ?, assigned_at = ? WHERE id = ?", [agentId, nowStr, p.id]);
        count++;
        agentIndex = (agentIndex + 1) % agents.length;
      }
    });

    return { success: true, count, message: `${count} prospects distribués avec succès entre ${agents.length} commerciaux.` };
  });

export const claimNextProspectAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string } }) => {
    const user = await checkCrmAccess(data.userId);

    // Get oldest unassigned prospect
    const nextProspect = await db.queryOne("SELECT id, name FROM prospects WHERE assigned_to IS NULL ORDER BY created_at ASC LIMIT 1") as any;
    if (!nextProspect) {
      return { success: false, message: "Aucune cible disponible dans le pool commun." };
    }

    // Claim it
    const nowStr = new Date().toISOString();
    await db.execute("UPDATE prospects SET assigned_to = ?, assigned_at = ? WHERE id = ?", [user.id, nowStr, nextProspect.id]);
    return { success: true, prospectId: nextProspect.id, name: nextProspect.name };
  });

export const claimProspectAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string, prospectId: string } }) => {
    const user = await checkCrmAccess(data.userId);

    // Verify it is not already claimed
    const existing = await db.queryOne("SELECT assigned_to, name FROM prospects WHERE id = ?", [data.prospectId]) as any;
    if (!existing) throw new Error("Prospect introuvable");
    if (existing.assigned_to && existing.assigned_to !== user.id) {
      throw new Error("Ce prospect a déjà été assigné à un autre commercial.");
    }

    const nowStr = new Date().toISOString();
    await db.execute("UPDATE prospects SET assigned_to = ?, assigned_at = ? WHERE id = ?", [user.id, nowStr, data.prospectId]);
    return { success: true, name: existing.name };
  });

export const recycleProspectsAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string, inactivityDays: number, refusalRecycleDays: number } }) => {
    await checkSuperAdmin(data.userId);
    const { inactivityDays = 7, refusalRecycleDays = 15 } = data;

    let recycledCount = 0;
    const now = new Date();
    const inactivityLimit = new Date(now.getTime() - inactivityDays * 24 * 60 * 60 * 1000).toISOString();
    const refusalLimit = new Date(now.getTime() - refusalRecycleDays * 24 * 60 * 60 * 1000).toISOString();

    await db.transaction(async () => {
      // Fetch currently assigned prospects
      const assignedProspects = await db.query("SELECT id, name, status, assigned_at, callback_at, notes FROM prospects WHERE assigned_to IS NOT NULL") as any[];

      // Fetch upcoming appointments client names to prevent recycling active bookings
      const upcomingAppts = await db.query("SELECT client_name FROM appointments WHERE starts_at >= datetime('now')") as any[];
      const upcomingApptNames = new Set(upcomingAppts.map(a => a.client_name.trim().toLowerCase()));

      for (const p of assignedProspects) {
        // Skip if future callback exists
        if (p.callback_at) {
          const cbDate = new Date(p.callback_at);
          if (cbDate.getTime() > now.getTime()) {
            continue;
          }
        }

        // Skip if there's an upcoming appointment for this prospect name
        if (p.name && upcomingApptNames.has(p.name.trim().toLowerCase())) {
          continue;
        }

        // Calculate eligibility
        const assignedTime = p.assigned_at ? new Date(p.assigned_at).getTime() : 0;
        
        let limitTime = new Date(inactivityLimit).getTime();
        if (p.status === 'sans_reponse' || p.status === 'contacte' || p.status === 'pas_interesse' || p.status === 'refus') {
          limitTime = new Date(refusalLimit).getTime();
        } else if (p.status === 'client' || p.status === 'refus_definitif') {
          continue; // Locked forever, never recyclable!
        }

        if (assignedTime < limitTime) {
          const newNotes = (p.notes || '') + `\n[Recyclage - ${now.toLocaleDateString('fr-FR')}] Remis dans le pool commun (inactivité de ${p.status === 'refus' || p.status === 'pas_interesse' || p.status === 'sans_reponse' || p.status === 'contacte' ? refusalRecycleDays : inactivityDays} jours).`;
          await db.execute(
            "UPDATE prospects SET assigned_to = NULL, assigned_at = NULL, status = 'recyclé', notes = ? WHERE id = ?",
            [newNotes, p.id]
          );
          recycledCount++;
        }
      }
    });

    return { success: true, count: recycledCount };
  });

export const exportDatabaseAction = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: { userId: string } }) => {
    await checkSuperAdmin(data.userId);
    
    if (process.env.MYSQL_HOST) {
      throw new Error("L'export de base de données n'est pas supporté en mode MySQL.");
    }

    const dbPath = join(process.cwd(), "pos.db");
    if (!existsSync(dbPath)) {
      throw new Error("Base de données introuvable sur le disque.");
    }

    const content = readFileSync(dbPath);
    return {
      filename: "pos.db",
      base64: content.toString("base64")
    };
  });

export const importDatabaseAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string, base64: string } }) => {
    await checkSuperAdmin(data.userId);

    if (process.env.MYSQL_HOST) {
      throw new Error("L'import de base de données n'est pas supporté en mode MySQL.");
    }

    const dbPath = join(process.cwd(), "pos.db");
    const bakPath = join(process.cwd(), "pos.db.bak");

    // Close SQLite connection before overwriting
    closeDatabase();

    // Make copy backup
    if (existsSync(dbPath)) {
      try {
        writeFileSync(bakPath, readFileSync(dbPath));
      } catch (err) {
        console.error("Could not write backup", err);
      }
    }

    try {
      const buffer = Buffer.from(data.base64, "base64");
      writeFileSync(dbPath, buffer);

      // Re-init connection
      initDatabase();

      // Test connection
      const test = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
      if (!test || test.length === 0) {
        throw new Error("Le fichier importé n'est pas une base de données SQLite valide.");
      }

      // Delete backup
      if (existsSync(bakPath)) {
        unlinkSync(bakPath);
      }

      return { success: true };
    } catch (err: any) {
      console.error("Error during import, rolling back", err);
      closeDatabase();
      if (existsSync(bakPath)) {
        try {
          writeFileSync(dbPath, readFileSync(bakPath));
          unlinkSync(bakPath);
        } catch (e) {
          console.error("Critical: Could not restore backup!", e);
        }
      }
      initDatabase();
      throw new Error("Échec de l'importation : " + err.message);
    }
  });

export const uploadPaymentProofAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { tenantId: string, base64: string, filename: string, userId: string } }) => {
    const user = await db.prepare("SELECT id, role, tenant_id FROM users WHERE id = ?").get(data.userId) as any;
    if (!user || (user.tenant_id !== data.tenantId && user.role !== 'super_admin')) {
      throw new Error("Non autorisé");
    }

    const ext = data.filename.split('.').pop() || 'png';
    const cleanFilename = `${data.tenantId}_${Date.now()}.${ext}`;
    const buffer = Buffer.from(data.base64, "base64");

    // Write to public folder (for local dev persistence)
    const publicDir = join(process.cwd(), "public", "payment_proofs");
    if (!existsSync(publicDir)) {
      mkdirSync(publicDir, { recursive: true });
    }
    const publicPath = join(publicDir, cleanFilename);
    writeFileSync(publicPath, buffer);

    // Also write to dist/client folder (for production serving)
    const distDir = join(process.cwd(), "dist", "client", "payment_proofs");
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
    const distPath = join(distDir, cleanFilename);
    writeFileSync(distPath, buffer);

    const webPath = `/payment_proofs/${cleanFilename}`;
    await db.execute("UPDATE tenants SET payment_proof_url = ? WHERE id = ?", [webPath, data.tenantId]);

    return { success: true, url: webPath };
  });

export const clearPaymentProofAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { tenantId: string, userId: string } }) => {
    await checkSuperAdmin(data.userId);
    await db.execute("UPDATE tenants SET payment_proof_url = NULL WHERE id = ?", [data.tenantId]);
    return { success: true };
  });

export const getTenantPublicProfileAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { slug: string } }) => {
    const rows = await db.query(
      `SELECT id, name, slug, logo_url, primary_color, active, subscription_status, subscription_end_date, specialty, city, description
       FROM tenants WHERE slug = ?`,
      [data.slug]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const t = rows[0];
    const isExpired = t.subscription_status === 'expired' || 
      (t.subscription_end_date && new Date(t.subscription_end_date) < new Date());

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      logo_url: t.logo_url,
      color: t.primary_color,
      specialty: t.specialty,
      city: t.city,
      description: t.description,
      active: Boolean(t.active),
      isExpired
    };
  });

export const createPublicAppointmentRequestAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { tenantId: string; name: string; phone: string; motif: string } }) => {
    const { nanoid } = await import("nanoid");
    const id = nanoid();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO prospects (id, tenant_id, name, phone, status, source, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'nouveau', 'vitrine', ?, ?, ?)`,
      [id, data.tenantId, data.name, data.phone, data.motif || "Demande de rendez-vous (site vitrine)", now, now]
    );

    return { success: true };
  });

export const updateTenantPublicProfileAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string; specialty: string; city: string; description: string } }) => {
    const user = await checkAdmin(data.userId);
    await db.execute(
      "UPDATE tenants SET specialty = ?, city = ?, description = ? WHERE id = ?",
      [data.specialty, data.city, data.description, user.tenant_id]
    );
    return { success: true };
  });

export const updateTenantPublicProfileSuperAdminAction = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { userId: string; tenantId: string; specialty: string; city: string; description: string } }) => {
    await checkSuperAdmin(data.userId);
    await db.execute(
      "UPDATE tenants SET specialty = ?, city = ?, description = ? WHERE id = ?",
      [data.specialty, data.city, data.description, data.tenantId]
    );
    return { success: true };
  });


