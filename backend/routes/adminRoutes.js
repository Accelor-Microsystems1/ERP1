const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken} = require("../middleware/authMiddleware");

router.get("/logs", authenticateToken,  async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM user_activity_logs ORDER BY timestamp DESC");
        console.log("qwerty :",result);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching logs:", error);
        res.status(500).json({ error: "Server error" });
    }
});


// // GET: Fetch all user logs records
// router.get("/admin/logs", async (req, res) => {
//     try {
//       const results = await getAllUserLogs();
//       res.json(results);
//     } catch (error) {
//       console.error("Error fetching non-COC data:", error);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   });
  

module.exports = router;
