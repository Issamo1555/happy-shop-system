import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

try {
  const db = new Database("pos.db");
  const hash = bcrypt.hashSync("admin123", 10);
  const info = db.prepare("UPDATE users SET password = ? WHERE email = ?").run(hash, "admin@mums.home");
  console.log("Password reset successfully in pos.db", info);
} catch (err) {
  console.error(err);
  process.exit(1);
}
