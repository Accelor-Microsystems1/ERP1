const db = require("../db");

const getRoles = async (req, res) => {
  try {
    // Fetch all roles
    const rolesQuery = 'SELECT * FROM roles;';
    const rolesResult = await db.query(rolesQuery);
    const roles = rolesResult.rows;

    // Fetch all modules
    const modulesQuery = 'SELECT * FROM modules;';
    const modulesResult = await db.query(modulesQuery);
    const modules = modulesResult.rows;

    // Fetch role permissions
    const permissionsQuery = 'SELECT * FROM role_permissions;';
    const permissionsResult = await db.query(permissionsQuery);
    const permissions = permissionsResult.rows;

    // Combine roles with their permissions
    const rolesData = roles.map(role => {
      const rolePermissions = permissions.reduce((acc, perm) => {
        if (perm.role_id === role.id) {
          acc[perm.module_id] = {
            can_access: perm.can_access,
            can_read: perm.can_read,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete,
          };
        }
        return acc;
      }, {});
      
      return {
        ...role,
        permissions: rolePermissions,
        modules,
      };
    });

    res.status(200).json(rolesData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createRole = async (req, res) => {
  const { name } = req.body;

  try {
    const query = `
      INSERT INTO roles (name, created_at)
      VALUES ($1, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const values = [name];

    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(422).json({ message: error.message });
  }
};

const updatePermissions = async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;

  try {
    // Start a transaction
    await db.query('BEGIN');

    // Update permissions for each module
    for (const [moduleId, perms] of Object.entries(permissions)) {
      const query = `
        INSERT INTO role_permissions (role_id, module_id, can_access, can_read, can_edit, can_delete)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (role_id, module_id)
        DO UPDATE SET
          can_access = EXCLUDED.can_access,
          can_read = EXCLUDED.can_read,
          can_edit = EXCLUDED.can_edit,
          can_delete = EXCLUDED.can_delete;
      `;
      const values = [
        id,
        moduleId,
        perms.can_access || false,
        perms.can_read || false,
        perms.can_edit || false,
        perms.can_delete || false,
      ];
      await db.query(query, values);
    }

    await db.query('COMMIT');
    res.status(200).json({ message: 'Permissions updated successfully' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(422).json({ message: error.message });
  }
};

module.exports = { getRoles, createRole, updatePermissions };