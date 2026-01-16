const db = require("../db");

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

const updateLocation = async (component_id, location) => {
  try {
    const query = `
      UPDATE non_coc_components
      SET location = $1
      WHERE component_id = $2
      RETURNING *;
    `;
    const values = [location, component_id];
    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      throw new Error("Component not found");
    }
    return result.rows[0];
  } catch (error) {
    throw new Error(`Error updating location: ${error.message}`);
  }
};

module.exports = { getAllNonCOC, insertNonCOC, searchNonCOC, updateLocation };