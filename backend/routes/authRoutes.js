const express = require("express");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const pool = require("../db");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

// POST: User Login
router.post("/login", async (req, res) => {
  console.log("Received Login Request:", req.body);

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const userQuery = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = userQuery.rows[0];
    const isMatch = password === user.password; // Temporary fix (replace with bcrypt in production)
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Fetch Role
    const roleQuery = await pool.query(
      "SELECT role_name FROM roles WHERE id = $1",
      [user.role_id]
    );
    if (roleQuery.rows.length === 0) {
      return res.status(404).json({ message: "Role not found" });
    }
    const role = roleQuery.rows[0].role_name;

    // Fetch Permissions
    const permissionsQuery = await pool.query(
      `SELECT m.module_name, rp.can_access, rp.can_read, rp.can_edit, rp.can_delete
       FROM role_permissions rp
       JOIN modules m ON rp.module_id = m.id
       WHERE rp.role_id = $1`,
      [user.role_id]
    );

    const permissions = permissionsQuery.rows.reduce((acc, row) => {
      acc[row.module_name] = {
        can_access: row.can_access,
        can_read: row.can_read,
        can_edit: row.can_edit,
        can_delete: row.can_delete,
      };
      return acc;
    }, {});

    // Generate JWT Token with role included
    const token = jwt.sign(
      { id: user.id, role: role },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );

    // Send token and user details in response
    res.json({
      success: true,
      token,
      user_id: user.id,
      role: role,
      name:user.name,
      permissions: permissions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// GET: Fetch User Permissions
router.get("/user-permissions/:email", authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;
    const userQuery = await pool.query(
      `SELECT r.role_name, rp.module_id, rp.can_access, rp.can_read, rp.can_edit 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       JOIN role_permissions rp ON r.id = rp.role_id 
       WHERE u.email = $1`,
      [email]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const permissions = userQuery.rows.reduce((acc, row) => {
      acc.read[row.module_id] = row.can_read;
      acc.edit[row.module_id] = row.can_edit;
      acc.access[row.module_id] = row.can_access;
      return acc;
    }, { read: {}, edit: {}, access: {} });

    res.json({ role: userQuery.rows[0].role_name, permissions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching permissions" });
  }
});

module.exports = router;