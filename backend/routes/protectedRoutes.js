const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

router.get("/inventory", authenticateToken, authorizeRole(["inventory_personnel", "admin"]), (req, res) => {
    res.json({ message: "Inventory module accessed successfully!" });
});

router.post("/inventory", authenticateToken, authorizeRole(["admin"]), (req, res) => {
    res.json({ message: "Inventory module edited successfully!" });
});

router.get("/quality", authenticateToken, authorizeRole(["quality_personnel", "admin"]), (req, res) => {
    res.json({ message: "Quality module accessed successfully!" });
})

router.post("/quality", authenticateToken, authorizeRole (["admin"]), (req, res) => {
    res.json({ message: "Quality module edited successfully!" });
});

// Admin route (has access to everything)
// router.get("/admin", authenticateToken, authorizeRole("admin", "can_read"), (req, res) => {
//     res.json({ message: "Admin module accessed successfully!" });
// });

module.exports = router;
