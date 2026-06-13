import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import fs from "fs";

const envStr = fs.readFileSync(".env", "utf8");
envStr.split("\n").forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  }
});

async function reset() {
  try {
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "mums_home_pos",
      socketPath: process.env.MYSQL_SOCKET
    });

    const hash = bcrypt.hashSync("admin123", 10);
    const [result] = await pool.execute("UPDATE users SET password = ? WHERE email = ?", [hash, "admin@mums.home"]);
    console.log("Password reset successfully", result);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
reset();
