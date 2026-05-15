
import mysql from 'mysql2/promise';

async function test() {
  console.log("🚀 Test de connexion via SOCKET...");
  try {
    const connection = await mysql.createConnection({
      socketPath: '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock',
      user: 'root',
      password: '',
      database: 'mums_home_pos',
    });
    console.log("✅ Connexion réussie via Socket !");
    const [prods] = await connection.execute("SELECT count(*) as count FROM products WHERE deleted = 0");
    console.log("📦 Produits trouvés :", prods[0].count);
    await connection.end();
  } catch (err) {
    console.error("❌ ÉCHEC Socket :", err.message);
  }
}
test();
