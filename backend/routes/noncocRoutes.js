const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const db = require("../db");

// Controller logic directly in noncocRoutes.js for now (or move to a proper noncocController.js)
const getAllNonCOC = async () => {
  try {
    const query = `
      SELECT * FROM non_coc_components
    `;
    const result = await db.query(query);
    return result.rows;
  } catch (error) {
    throw new Error(`Error fetching non-COC data: ${error.message}`);
  }
};

const insertNonCOC = async (data) => {
  try {
    const results = [];
    for (const item of data) {
      const query = `
        INSERT INTO non_coc_components (item_description, mpn, on_hand_quantity, location, receive_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const values = [
        item.item_description,
        item.mpn,
        item.on_hand_quantity || 0,
        item.location || 'WH-STOCK',
        item.receive_date || new Date().toISOString(),
      ];
      const result = await db.query(query, values);
      results.push(result.rows[0]);
    }
    return results;
  } catch (error) {
    throw new Error(`Error inserting non-COC data: ${error.message}`);
  }
};

const searchNonCOC = async (query) => {
  try {
    const searchQuery = `
      SELECT * FROM non_coc_components
      WHERE item_description ILIKE $1 OR mpn ILIKE $1 OR CAST(component_id AS TEXT) ILIKE $1;
    `;
    const result = await db.query(searchQuery, [`%${query}%`]);
    return result.rows;
  } catch (error) {
    throw new Error(`Error searching non-COC data: ${error.message}`);
  }
};

// API to Import Data from Excel
router.post("/import", async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: "Invalid or empty data." });
    }

    for (const item of data) {
      if (!item.item_description || !item.mpn) {
        return res.status(400).json({ message: "Missing required fields (item_description, mpn)." });
      }
    }

    const results = await insertNonCOC(data);
    res.status(200).json({ message: "Data imported successfully", data: results });
  } catch (error) {
    console.error("Error inserting non-COC data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API to Fetch All Non-COC Records
router.get("/", async (req, res) => {
  try {
    const results = await getAllNonCOC();
    console.log("Sending data to frontend:", results);
    res.json(results);
  } catch (error) {
    console.error("Error in GET /noncoc:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API to Search Non-COC Records
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }
    const results = await searchNonCOC(query);
    res.json(results);
  } catch (error) {
    console.error("Error searching non-COC data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Location suggestions endpoint
router.get("/locations/suggestions", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Query is required" });
    }

    const queryText = `
      SELECT name, type, path
      FROM locations
      WHERE path ILIKE $1
      LIMIT 5;
    `;
    const result = await db.query(queryText, [`%${query}%`]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching location suggestions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;