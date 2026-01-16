const db = require('../db');  // Adjust path as per your setup

// Fetch user by email
const findUserByEmail = async (email) => {
    const result = await db.query(`   
        SELECT id, name, email, password, role_id FROM users WHERE email = $1
    `, [email]);

    return result.rows[0];
};

// Fetch user permissions based on role_id
const getUserPermissions = async (roleId) => {
    const result = await db.query(`
        SELECT m.module_name, rp.can_access, rp.can_read, rp.can_edit, rp.can_delete
        FROM role_permissions rp
        JOIN modules m ON rp.module_id = m.id
        WHERE rp.role_id = $1
    `, [roleId]);

    let permissions = {};
    result.rows.forEach(row => {
        permissions[row.module_name] = {
            can_access: row.can_access,
            can_read: row.can_read,
            can_edit: row.can_edit,
            can_delete: row.can_delete
        };
    });

    return permissions;
};

module.exports = { findUserByEmail, getUserPermissions };
