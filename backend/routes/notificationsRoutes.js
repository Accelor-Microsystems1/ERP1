const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const { getPendingNotifications, markNotificationAsRead } = require("../controllers/notificationsController");

router.get("/pending", authenticateToken, getPendingNotifications);
router.put("/:id/read", authenticateToken, markNotificationAsRead);

module.exports = router;