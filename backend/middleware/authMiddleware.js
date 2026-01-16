const jwt = require("jsonwebtoken");
require("dotenv").config();

const authenticateToken = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Access Denied. No token provided." });
    }

    // Verify JWT Token using promise-based version
    const user = await jwt.verify(token, process.env.JWT_SECRET);

    // Attach user details to request (role is now in the token)
    req.user = {
      id: user.id,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Authentication Error:", error.message);
    if (error.name === "JsonWebTokenError") {
      return res.status(403).json({ message: "Invalid or expired token." });
    }
    return res.status(500).json({ message: "Internal Server Error." });
  }
};

// Middleware to check user role
const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access Denied. Insufficient permissions." });
    }
    next();
  };
};

// Middleware to check permissions dynamically
const authorizeRoleDynamic = (moduleName, action) => async (req, res, next) => {
  try {
    const { role } = req.user;

    // Get role_id from roles table
    const roleQuery = `
      SELECT id
      FROM roles
      WHERE role_name = $1;
    `;
    const roleResult = await pool.query(roleQuery, [role]);
    if (roleResult.rows.length === 0) {
      return res.status(403).json({ message: "Role not found." });
    }
    const role_id = roleResult.rows[0].id;

    // Query the database to check permission
    const query = `
      SELECT can_access, can_read, can_edit, can_delete
      FROM role_permissions
      JOIN modules ON role_permissions.module_id = modules.id
      WHERE role_permissions.role_id = $1 AND modules.module_name = $2;
    `;
    const { rows } = await pool.query(query, [role_id, moduleName]);

    if (!rows.length) {
      return res.status(403).json({ message: "Access denied." });
    }

    const permissions = rows[0];
    if (!permissions[action]) {
      return res.status(403).json({ message: `You do not have permission to ${action} this module.` });
    }

    next();
  } catch (error) {
    console.error("Authorization Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { authenticateToken, authorizeRole, authorizeRoleDynamic };