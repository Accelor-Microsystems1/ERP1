const pool = require("../db"); // PostgreSQL connection
//const db = require('../db');

const logActivity = async (user_id, module_name, action, query ) => {
    try {
        await pool.query(
            `INSERT INTO user_activity_logs (user_id, module_name, action, query)
             VALUES ($1, $2, $3, $4)`,
            [user_id, module_name, action, query]
        );
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};

module.exports = logActivity;
