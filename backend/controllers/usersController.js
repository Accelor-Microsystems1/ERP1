const db = require("../db");

const createUser = async (req, res) => {
  const { name, email, password, department, designation, role, role_id } = req.body;
  const signature = req.file ? req.file.buffer : null;
  try {
    const query = `
      INSERT INTO users (name, email, password, department, designation, role, role_id, signature, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const values = [name, email, password, department, designation, role, role_id || null, signature];
    
    const result = await db.query(query, values);
    const user = result.rows[0];
    user.signature = user.signature ? `data:image/png;base64,${user.signature.toString('base64')}` : null;
    res.status(201).json(user);
  } catch (error) {
    res.status(422).json({ message: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const { role_id } = req.query;

    let query = `
      SELECT 
        u.id, u.name, u.email, u.department, u.designation, u.role, u.role_id, 
        u.signature, u.created_at, u.updated_at, r.role_name,
        m.module_name, 
        rp.can_access, rp.can_read, rp.can_edit, rp.can_delete
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN modules m ON rp.module_id = m.id
    `;
    const queryParams = [];

    if (role_id) {
      query += ` WHERE u.role_id = $1`;
      queryParams.push(parseInt(role_id));
    }

    query += ` ORDER BY u.created_at DESC, m.module_name NULLS LAST`;

    const result = await db.query(query, queryParams);

    const usersMap = {};

    result.rows.forEach(row => {
      const userId = row.id;

      if (!usersMap[userId]) {
        usersMap[userId] = {
          id: row.id,
          name: row.name,
          email: row.email,
          department: row.department,
          designation: row.designation,
          role: row.role,
          role_id: row.role_id,
          role_name: row.role_name,
          // START CHANGE: Convert binary signature to base64
          signature: row.signature ? `data:image/png;base64,${Buffer.from(row.signature).toString('base64')}` : null,
          // END CHANGE
          created_at: row.created_at,
          updated_at: row.updated_at,
          permissions: {},
        };
      }

      if (row.module_name) {
        usersMap[userId].permissions[row.module_name] = {
          can_access: row.can_access || false,
          can_read: row.can_read || false,
          can_edit: row.can_edit || false,
          can_delete: row.can_delete || false,
        };
      }
    });

    const users = Object.values(usersMap);

    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: "Error fetching users: " + error.message });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, department, designation, role, role_id } = req.body;
  // Parse permissions JSON string
  let permissions = null;
  try {
    if (req.body.permissions) {
      permissions = JSON.parse(req.body.permissions);
    }
  } catch (error) {
    await db.query('ROLLBACK');
    return res.status(400).json({ message: 'Invalid permissions format' });
  }
  const signature = req.file ? req.file.buffer : null;

  try {
    await db.query('BEGIN');

    const userQuery = `
      UPDATE users 
      SET name = $1, email = $2, department = $3, designation = $4, role = $5, role_id = $6, signature = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING id, name, email, department, designation, role, role_id, signature, created_at, updated_at;
    `;
    const userValues = [
      name,
      email,
      department,
      designation || null,
      role,
      role_id || null,
      signature,
      id,
    ];
    const userResult = await db.query(userQuery, userValues);
    if (userResult.rowCount === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ message: "User not found" });
    }

    if (permissions && role_id) {
      // Validate permissions object
      if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
        await db.query('ROLLBACK');
        return res.status(400).json({ message: 'Permissions must be an object' });
      }

      const moduleNames = Object.keys(permissions);
      if (moduleNames.length === 0) {
        await db.query('COMMIT');
        const user = userResult.rows[0];
        user.signature = user.signature ? `data:image/png;base64,${Buffer.from(user.signature).toString('base64')}` : null;
        return res.status(200).json(user);
      }

      // Validate module names
      for (const moduleName of moduleNames) {
        if (!moduleName || typeof moduleName !== 'string' || moduleName.match(/^\d+$/)) {
          await db.query('ROLLBACK');
          return res.status(400).json({ message: `Invalid module name: ${moduleName}` });
        }
      }

      const moduleQuery = `
        SELECT id, module_name FROM modules WHERE module_name = ANY($1)
      `;
      const moduleResult = await db.query(moduleQuery, [moduleNames]);
      const moduleMap = moduleResult.rows.reduce((acc, { id, module_name }) => {
        acc[module_name] = id;
        return acc;
      }, {});

      for (const [moduleName, perms] of Object.entries(permissions)) {
        const moduleId = moduleMap[moduleName];
        if (!moduleId) {
          await db.query('ROLLBACK');
          return res.status(400).json({ message: `Module ${moduleName} not found` });
        }

        const permQuery = `
          INSERT INTO role_permissions (role_id, module_id, can_access, can_read, can_edit, can_delete)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (role_id, module_id)
          DO UPDATE SET
            can_access = EXCLUDED.can_access,
            can_read = EXCLUDED.can_read,
            can_edit = EXCLUDED.can_edit,
            can_delete = EXCLUDED.can_delete
          RETURNING *;
        `;
        const permValues = [
          role_id,
          moduleId,
          perms.can_access || false,
          perms.can_read || false,
          perms.can_edit || false,
          perms.can_delete || false,
        ];
        await db.query(permQuery, permValues);
      }
    }

    await db.query('COMMIT');

    const user = userResult.rows[0];
    user.signature = user.signature ? `data:image/png;base64,${Buffer.from(user.signature).toString('base64')}` : null;
    res.status(200).json(user);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error updating user:', error);
    res.status(422).json({ message: error.message || 'Failed to update user' });
  }
};

module.exports = { createUser, getUsers, updateUser };