import mysql from 'mysql2/promise';

async function checkMySQL() {
  try {
    const connection = await mysql.createConnection({
      host: "127.0.0.1",
      port: 3306,
      user: "root",
      password: "",
      database: "mums_home_pos",
    });
    console.log("Connected to MySQL successfully");
    
    const [rows] = await connection.execute("SELECT * FROM users WHERE email = ?", ['issamo1555@gmail.com']);
    if (rows.length > 0) {
      console.log("User found in MySQL:");
      console.log(JSON.stringify(rows[0], null, 2));
    } else {
      console.log("User not found in MySQL.");
      const [allUsers] = await connection.execute("SELECT email FROM users");
      console.log("All users in MySQL:");
      console.log(JSON.stringify(allUsers, null, 2));
    }
    await connection.end();
  } catch (err) {
    console.error("Failed to connect to MySQL:", err.message);
  }
}

checkMySQL();
