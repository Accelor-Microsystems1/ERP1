const { Pool } = require("pg");
require("dotenv").config();

// Create PostgreSQL connection pool using DATABASE_URL
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

db.on("connect", () => {
  console.log("✅ PostgreSQL Database Connected Successfully");
});

db.on("error", (err) => {
  console.error("❌ PostgreSQL Connection Error:", err);
  process.exit(-1);
});

// Test the connection on startup
db.query("SELECT 1")
  .then(() => console.log("✅ Initial Database Connection Test Passed"))
  .catch((err) => {
    console.error("❌ Initial Database Connection Test Failed:", err);
    process.exit(-1);
  });

module.exports = db;