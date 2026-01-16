const pool = require("../db");

const getPendingNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`getPendingNotifications: Processing for req.user.id=${userId}`);

    // Query to fetch pending notifications
    const result = await pool.query(
      'SELECT id, type, message, created_at, is_read ' +
      'FROM notifications ' +
      'WHERE user_id = $1 AND is_read = false ' +
      'ORDER BY created_at DESC',
      [userId]
    );

    console.log(`getPendingNotifications: Fetched notifications for userId=${userId}:`, result.rows);

    // Map the rows to the format expected by the frontend
    const notifications = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      message: row.message, // Treat message as a plain string, no JSON parsing
      createdAt: row.created_at,
      isRead: row.is_read
    }));

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Notification fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Mark a notification as read
const markNotificationAsRead = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Notification not found or unauthorized" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Notification update error:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getPendingNotifications, markNotificationAsRead };