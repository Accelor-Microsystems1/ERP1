const pool = require("../db");

const submitReturnForm = async (req, res) => {
  try {
    const { items } = req.body;
    const user_id = req.user.id;

    console.log("Received items:", items);

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Items are required and must be an array" });
    }

    await pool.query("BEGIN");

    // Fetch the next sequence value for urf_id
    const sequenceResult = await pool.query("SELECT nextval('urf_id_seq') AS seq");
    const sequenceNumber = sequenceResult.rows[0].seq;
    const urfNo = `URF${sequenceNumber}`; // Format as URF10001, URF10002, etc.

    const insertQuery = `
      INSERT INTO material_return_form (urf_id, umi, component_id, return_quantity, remark, status, user_id, return_date)
      VALUES ($1, $2, $3::bigint, $4, $5, $6, $7, NOW())
      RETURNING *;
    `;
    for (const item of items) {
      if (!item.return_quantity || !item.remark || !item.status) {
        throw new Error("Missing required fields in item: " + JSON.stringify(item));
      }
      console.log("Component ID received:", item.component_id, "Type:", typeof item.component_id);
      const result = await pool.query(insertQuery, [
        urfNo,
        item.umi,
        item.component_id,
        item.return_quantity,
        item.remark,
        item.status,
        user_id
      ]);
      console.log("Inserted row:", result.rows[0]);
      
      // Update noncoc_basket with status only (remove return_quantity since it doesn't exist)
      await pool.query(
        `UPDATE noncoc_basket 
         SET status = $1
         WHERE umi = $2 AND component_id = $3`,
        [item.status, item.umi, item.component_id]
      );
    }
    
    // Fetch department head for notification
    const userResult = await pool.query(
      `SELECT department FROM users WHERE id = $1`,
      [user_id]
    );
    const department = userResult.rows[0]?.department;

    const headResult = await pool.query(
      `SELECT id FROM users WHERE role = $1`,
      [`${department}_head`]
    );
    const headId = headResult.rows[0]?.id;

    if (headId) {
      const io = req.app.get("io");
      const userSocketMap = req.app.get("userSocketMap");
      const headSocketId = userSocketMap.get(headId.toString());
      if (headSocketId) {
        io.to(headSocketId).emit("notification", {
          id: Date.now(),
          message: `New return request submitted: ${urfNo}`,
          urf_id: urfNo,
          created_at: new Date().toISOString(),
          is_read: false
        });
      }

      // Store notification in database
      await pool.query(
        `INSERT INTO notifications (user_id, urf_id, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [headId, urfNo, `New return request submitted:  ${urfNo}`, false]
      );
    }

    await pool.query("COMMIT");
    res.status(200).json({ message: "Return form submitted", urfNo, status: "Return Initiated" });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error in submitReturnForm:", error.message);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};
const getReturnRequests = async (req, res) => {
  try {
    const userRole = req.user.role;
    console.log("User role in getReturnRequests:", userRole); // Debug log
    let query;
    let queryParams = [];

    // Define the base query with the corrected column name and alias return_date as created_at
    query = `
      SELECT mrf.*, 
             to_char(mrf.return_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at, 
             u.name, 
             nc.part_no, 
             nc.make, 
             nc.item_description, 
             nc.mpn
      FROM material_return_form mrf
      JOIN users u ON mrf.user_id = u.id
      JOIN non_coc_components nc ON mrf.component_id = nc.component_id
      WHERE mrf.status = $1
    `;

    // Set the status based on the user role
    if (userRole.includes("head") && !userRole.includes("inventory_head")) {
      queryParams = ["Return Initiated"];
    } else if (userRole.includes("inventory") || userRole.includes("inventory_head")) {
      queryParams = ["Return Request Approved by Head"];
    } else {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const result = await pool.query(query, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching return requests:", error.message);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

const getPastReturnRequests = async (req, res) => {
  try {
    const userRole = req.user.role;
    console.log("User role in getPastReturnRequests:", userRole); // Debug log
    let query;
    let queryParams = [];

    // Define the base query with the corrected column name and alias return_date as created_at
    query = `
      SELECT mrf.*, 
             to_char(mrf.return_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at, 
             u.name, 
             nc.part_no, 
             nc.make, 
             nc.item_description, 
             nc.mpn
      FROM material_return_form mrf
      JOIN users u ON mrf.user_id = u.id
      JOIN non_coc_components nc ON mrf.component_id = nc.component_id
      WHERE mrf.status = ANY($1)
    `;

    // Set the statuses based on the user role
    if (userRole.includes("head") && !userRole.includes("inventory_head")) {
      queryParams = [["Return Request Approved by Head", "Return Request Rejected by Head"]];
    } else if (userRole.includes("inventory_head")) {
      queryParams = [["Material Returned Successfully", "Return Request Rejected by Inventory Head"]];
    } else {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const result = await pool.query(query, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching past return requests:", error.message);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

const approveReturnRequest = async (req, res) => {
  try {
    const { urf_id } = req.params;
    const { note } = req.body;
    const userRole = req.user.role;

    await pool.query("BEGIN");

    // Determine the next status based on the user's role
    let nextStatus;
    if (userRole.includes("head") && !userRole.includes("inventory_head")) {
      nextStatus = "Return Request Approved by Head";
    } else if (userRole.includes("inventory_head")) {
      nextStatus = "Material Returned Successfully";
    } else {
      throw new Error("Unauthorized role for approving return request");
    }

    // Update return form status
    const updateQuery = `
      UPDATE material_return_form 
      SET 
        status = $1, 
        remark = COALESCE(remark, '') || $2 
      WHERE urf_id = $3
      RETURNING *;
    `;
    const updateResult = await pool.query(updateQuery, [nextStatus, note ? `\n${note}` : "", urf_id]);

    if (updateResult.rowCount === 0) {
      throw new Error(`No return request found for URF ${urf_id}`);
    }

    // Update noncoc_basket status
    const items = await pool.query(
      `SELECT umi, component_id, return_quantity FROM material_return_form WHERE urf_id = $1`,
      [urf_id]
    );
    for (const item of items.rows) {
      // Update noncoc_basket status
      await pool.query(
        `UPDATE noncoc_basket 
         SET status = $1
         WHERE umi = $2 AND component_id = $3`,
        [nextStatus, item.umi, item.component_id]
      );

      // If inventory_head approves, update on_hand_quantity in non_coc_components
      if (userRole.includes("inventory_head")) {
        const updateComponentQuery = `
          UPDATE non_coc_components 
          SET on_hand_quantity = on_hand_quantity + $1
          WHERE component_id = $2
          RETURNING on_hand_quantity;
        `;
        const componentUpdateResult = await pool.query(updateComponentQuery, [
          item.return_quantity,
          item.component_id
        ]);
        if (componentUpdateResult.rowCount === 0) {
          throw new Error(`Component ${item.component_id} not found in non_coc_components`);
        }
        console.log(`Updated on_hand_quantity for component ${item.component_id}: ${componentUpdateResult.rows[0].on_hand_quantity}`);
      }
    }

    // Notify the appropriate user
    const returnForm = updateResult.rows[0];
    let notifyUserId;
    if (userRole.includes("inventory_head")) {
      // Notify the original user who submitted the return request
      notifyUserId = returnForm.user_id;
    } else {
      // Notify inventory user (for head approval)
      const inventoryResult = await pool.query(
        `SELECT id FROM users WHERE role = $1`,
        ["inventory"]
      );
      notifyUserId = inventoryResult.rows[0]?.id;
    }

    if (notifyUserId) {
      await pool.query(
        `INSERT INTO notifications (user_id, urf_id, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [notifyUserId, urf_id, `Return request ${urf_id} updated to ${nextStatus}`, false]
      );
    }

    await pool.query("COMMIT");
    res.status(200).json({ message: `Return request ${urf_id} approved`, status: nextStatus });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error approving return request:", error.message);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

const rejectReturnRequest = async (req, res) => {
  try {
    const { urf_id } = req.params;
    const { note } = req.body;
    const userRole = req.user.role;

    let rejectStatus;
    if (userRole.includes("head") && !userRole.includes("inventory_head")) {
      rejectStatus = "Return Request Rejected by Head";
    } else if (userRole.includes("inventory_head")) {
      rejectStatus = "Return Request Rejected by Inventory Head";
    } else {
      throw new Error("Unauthorized role for rejecting return request");
    }

    await pool.query("BEGIN");

    const updateQuery = `
      UPDATE material_return_form 
      SET status = $1, remark = COALESCE(remark, '') || $2
      WHERE urf_id = $3
      RETURNING *;
    `;
    const updateResult = await pool.query(updateQuery, [rejectStatus, note ? `\n${note}` : "", urf_id]);

    if (updateResult.rowCount === 0) {
      throw new Error(`No return request found for URF ${urf_id}`);
    }

    // Update noncoc_basket status
    const items = await pool.query(
      `SELECT umi, component_id FROM material_return_form WHERE urf_id = $1`,
      [urf_id]
    );
    for (const item of items.rows) {
      await pool.query(
        `UPDATE noncoc_basket 
         SET status = $1
         WHERE umi = $2 AND component_id = $3`,
        [rejectStatus, item.umi, item.component_id]
      );
    }

    // Notify original user
    const returnForm = updateResult.rows[0];
    await pool.query(
      `INSERT INTO notifications (user_id, urf_id, message, is_read, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [returnForm.user_id, urf_id, `Return request ${urf_id} rejected: ${rejectStatus}`, false]
    );

    await pool.query("COMMIT");
    res.status(200).json({ message: `Return request ${urf_id} rejected`, status: rejectStatus });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error rejecting return request:", error.message);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

const getUserReturnRequests = async (req, res) => {
  try {
    const user_id = req.user.id;
    console.log("Fetching return requests for user:", user_id);

    const query = `
      SELECT mrf.*, 
             to_char(mrf.return_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at, 
             u.name, 
             nc.part_no, 
             nc.make, 
             nc.item_description, 
             nc.mpn
      FROM material_return_form mrf
      JOIN users u ON mrf.user_id = u.id
      JOIN non_coc_components nc ON mrf.component_id = nc.component_id
      WHERE mrf.user_id = $1
      ORDER BY mrf.return_date DESC;
    `;

    const result = await pool.query(query, [user_id]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching user return requests:", error.message);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};


module.exports = { submitReturnForm, getReturnRequests, getPastReturnRequests, approveReturnRequest, rejectReturnRequest, getUserReturnRequests };