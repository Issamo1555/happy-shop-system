
import mysql from 'mysql2/promise';

async function test() {
  console.log("🚀 Test du POOL (Moteur de l'App)...");
  try {
    const pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'mums_home_pos',
      socketPath: '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock',
    });
    
    const [rows] = await pool.execute("SELECT count(*) as count FROM products WHERE deleted = 0");
    console.log("✅ POOL OK ! Produits trouvés :", rows[0].count);
    await pool.end();
  } catch (err) {
    console.error("❌ ÉCHEC DU POOL :", err.message);
  }
}
test();
