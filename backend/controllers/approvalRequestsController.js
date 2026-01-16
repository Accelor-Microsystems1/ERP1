// Handles fetching approval requests sent to *_head/admin, approving requests, and viewing past approved requests.
const db = require("../db");

// Helper function to get the department from a role
const getDepartmentFromRole = (role) => {
  const match = role.match(/^(\w+)_(head|employee)$/);
  return match ? match[1] : null;
};

// Fetch approval requests sent to the logged-in head/admin
const getApprovalRequests = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;

    if (!role || !user_id) {
      return res.status(400).json({ error: "User role or ID not found in request." });
    } 

    const isAdmin = role === "admin";
    const isHead = role.endsWith("_head");
    const department = getDepartmentFromRole(role);

    if (isHead && !department) {
      return res.status(400).json({ error: "Invalid role format: Department could not be determined." });
    }

    let query;
    let params = [];

    if (isAdmin) {
      query = `
       SELECT nb.umi, nb.project_name, u.name AS user_name, nb.date, nb.status, nb.user_id, nb.note, nb.priority, 
               COALESCE(MAX(nb.mrf_no), 'No MRF') AS mrf_no
        FROM noncoc_basket nb
        JOIN users u ON nb.user_id = u.id
        WHERE nb.status = 'Head Approval Pending'
        GROUP BY nb.umi, nb.project_name, u.name, nb.date, nb.status, nb.user_id, nb.note, nb.priority
        HAVING MAX(nb.mrf_no) IS NOT NULL OR COUNT(*) = COUNT(CASE WHEN nb.mrf_no IS NULL THEN 1 END);
        `;
      params = [];
    } else if (isHead && department) {
      query = `
       SELECT nb.umi, nb.project_name, u.name AS user_name, nb.date, nb.status, nb.user_id, nb.note, nb.priority, 
               COALESCE(MAX(nb.mrf_no), 'No MRF') AS mrf_no
        FROM noncoc_basket nb
        JOIN users u ON nb.user_id = u.id
        JOIN roles r ON u.role_id = r.id
        WHERE nb.status = 'Head Approval Pending'
        AND r.role_name = $1
        GROUP BY nb.umi, nb.project_name, u.name, nb.date, nb.status, nb.user_id, nb.note, nb.priority
        HAVING MAX(nb.mrf_no) IS NOT NULL OR COUNT(*) = COUNT(CASE WHEN nb.mrf_no IS NULL THEN 1 END);
        `;
      params = [`${department}_employee`];
    } else {
      return res.status(403).json({ error: "Unauthorized: Only heads or admin can view approval requests" });
    }

    const result = await db.query(query, params);
    console.log("Approval Requests Query Result:", result.rows); // Debug log
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching approval requests:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

// Fetch past approved requests
const getPastApprovedRequests = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isAdmin = role === "admin";
    const isHead = role.endsWith("_head");
    const department = getDepartmentFromRole(role);

    if (!isHead && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized: Only heads or admin can view past approved requests" });
    }

    const currentDate = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    let query = `
      SELECT nb.umi, nb.project_name, u.name AS user_name, nb.date, nb.status, nb.note, nb.priority, 
             COALESCE(MAX(nb.mrf_no), 'No MRF') AS mrf_no
      FROM noncoc_basket nb
      JOIN users u ON nb.user_id = u.id
    `;
    let params = [currentDate];

    if (isHead && department) {
      query += `
        JOIN roles r ON u.role_id = r.id
        WHERE DATE_TRUNC('day', nb.date) <= $1 AND nb.status IN ('Inventory Approval Pending', 'Issued', 'Rejected')
        AND r.role_name = $2
      `;
      params.push(`${department}_employee`);
    } else if (isAdmin) {
      query += ` WHERE DATE_TRUNC('day', nb.date) <= $1 AND nb.status IN ('Inventory Approval Pending', 'Issued',  'Rejected' )`;
    }

    query += `
      GROUP BY nb.umi, nb.project_name, u.name, nb.status, nb.date, nb.note, nb.priority
      HAVING MAX(nb.mrf_no) IS NOT NULL OR COUNT(*) = COUNT(CASE WHEN nb.mrf_no IS NULL THEN 1 END)
      ORDER BY nb.date DESC;
    `;

    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      console.warn("No past approved requests found.");
    }
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching past approved requests:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

// Fetch details of a specific request based on UMI for approval
const getRequestDetails = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isHead = role.endsWith("_head");
    const isAdmin = role === "admin";
    const department = getDepartmentFromRole(role);

    if (isHead && !department) {
      return res.status(400).json({ error: "Invalid role format: Department cannot be determined." });
    }

    const { umi } = req.params;

    let query;
    let params = [];

    if (isAdmin) {
      query = `
        SELECT nb.basket_id, nb.component_id, u.department as user_department, nb.initial_requestedqty, nb.date AS created_at, nb.status, nb.umi, nb.updated_requestedqty, nb.note, nb.priority, nb.remark, nb.mrf_no
        FROM noncoc_basket nb
        JOIN users u ON nb.user_id = u.id
        WHERE nb.umi = $1 AND (nb.status = 'Head Approval Pending' OR nb.status = 'Inventory Approval Pending' OR nb.status = 'Issued' OR  nb.status = 'Rejected');
      `;
      params = [umi];
    } else if (isHead && department) {
      query = `
        SELECT nb.basket_id, nb.component_id, u.department as user_department, nb.initial_requestedqty, nb.date AS created_at, nb.status, nb.umi, nb.updated_requestedqty, nb.note, nb.priority, nb.remark, nb.mrf_no
        FROM noncoc_basket nb
        JOIN users u ON nb.user_id = u.id
        JOIN roles r ON u.role_id = r.id
        WHERE nb.umi = $1 AND (nb.status = 'Head Approval Pending' OR nb.status = 'Inventory Approval Pending' OR nb.status = 'Issued' OR  nb.status = 'Rejected')
        AND r.role_name = $2;
      `;
      params = [umi, `${department}_employee`];
    } else {
      return res.status(403).json({ error: "Unauthorized: Only heads or admin can view request details" });
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No request found for this UMI" });
    }

    const detailedItems = await Promise.all(
      result.rows.map(async (item) => {
        const componentQuery = `
          SELECT item_description, mpn, on_hand_quantity, part_no, make,uom
          FROM non_coc_components
          WHERE component_id = $1;
        `;
        const componentResult = await db.query(componentQuery, [item.component_id]);
        const component = componentResult.rows[0] || {};
        return {
          ...item,
          item_description: component.item_description || "N/A",
          mpn: component.mpn || "N/A",
          on_hand_quantity: component.on_hand_quantity || 0,
          part_no: component.part_no || "N/A",
          make: component.make || "N/A",
          uom: component.uom || "N/A",
        };
      })
    );

    return res.status(200).json(detailedItems);
  } catch (error) {
    console.error("Error fetching request details:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

// // Approve a request
// const approveRequest = async (req, res) => {
//   try {
//     const { role, id: user_id } = req.user;
//     const isHead = role.endsWith("_head");
//     const isAdmin = role === "admin";
//     const department = getDepartmentFromRole(role);

//     if (!isHead && !isAdmin) {
//       return res.status(403).json({ error: "Unauthorized: Only heads or admin can approve requests" });
//     }

//     const { umi } = req.params;
//     const { updatedItems, note, priority } = req.body;
//     const io = req.app.get('io'); // Corrected key from 'socketio' to 'io'

//     if (!updatedItems || !Array.isArray(updatedItems)) {
//       return res.status(400).json({ error: "Invalid request: updatedItems must be an array" });
//     }

//     if (!Array.isArray(note)) {
//       return res.status(400).json({ error: "Invalid request: note must be an array" });
//     }

//     // Validate umi is a string
//     if (typeof umi !== 'string') {
//       return res.status(400).json({ error: "Invalid request: umi must be a string" });
//     }

//     await db.query("BEGIN"); // Fixed: Replaced Gobernador with db

//     for (const item of updatedItems) {
//       const fetchNoteQuery = `
//         SELECT note
//         FROM noncoc_basket
//         WHERE basket_id = $1 AND umi = $2;
//       `;
//       const fetchNoteResult = await db.query(fetchNoteQuery, [item.basket_id, umi]);
//       let existingNotes = [];
//       if (fetchNoteResult.rows.length > 0 && fetchNoteResult.rows[0].note) {
//         existingNotes = fetchNoteResult.rows[0].note;
//       }

//       const updatedNotes = [...existingNotes, ...note];

//       let updateQuery = `
//         UPDATE noncoc_basket
//         SET updated_requestedqty = $1, status = 'Inventory Approval Pending', note = $2, priority = $3, remark = $4
//         WHERE basket_id = $5 AND umi = $6
//         AND status = 'Head Approval Pending'
//         RETURNING umi, component_id, updated_requestedqty, note, priority, remark, mrf_no;
//       `;
//       let params = [
//         item.updated_requestedqty,
//         JSON.stringify(updatedNotes),
//         priority !== undefined ? priority : false,
//         item.remark || null,
//         item.basket_id,
//         umi,
//       ];

//       if (isHead && department) {
//         updateQuery = `
//           UPDATE noncoc_basket nb
//           SET updated_requestedqty = $1, status = 'Inventory Approval Pending', note = $2, priority = $3, remark = $4
//           FROM users u
//           JOIN roles r ON u.role_id = r.id
//           WHERE nb.basket_id = $5 AND nb.umi = $6
//           AND nb.status = 'Head Approval Pending'
//           AND r.role_name = $7
//           RETURNING nb.umi, nb.component_id, nb.updated_requestedqty, nb.note, nb.priority, nb.remark, nb.mrf_no;
//         `;
//         params = [
//           item.updated_requestedqty,
//           JSON.stringify(updatedNotes),
//           priority !== undefined ? priority : false,
//           item.remark || null,
//           item.basket_id,
//           umi,
//           `${department}_employee`,
//         ];
//       }

//       const updateResult = await db.query(updateQuery, params);
//       if (updateResult.rows.length === 0) {
//         throw new Error(`No item found with basket_id ${item.basket_id} for UMI ${umi}`);
//       }
//       console.log("Update Result for basket_id", item.basket_id, ":", updateResult.rows[0]);

//       // Update linked MRF status if mrf_no exists
//       const mrfNo = updateResult.rows[0].mrf_no;
//       if (mrfNo) {
//         const mrfUpdateQuery = `
//           UPDATE material_request_form
//           SET status = 'Inventory Approval Pending'
//           WHERE mrf_no = $1 AND status != 'Issued';
//         `;
//         await db.query(mrfUpdateQuery, [mrfNo]);
//       }
//     }

//     // Send notification to inventory_head (user_id = 1)
//     const inventoryHeadId = 1; // Fixed user_id for inventory_head
//     const message = `MIF request approved by Head: UMI ${umi}`;

//     // Insert notification into database
//     console.log(`Creating MIF approval notification for inventory_head (user_id: ${inventoryHeadId}), UMI ${umi}, message: ${message}`);
//     console.log('Notification parameters:', {
//       inventoryHeadId: typeof inventoryHeadId,
//       umi: typeof umi,
//       mrf_no: null,
//       type: 'mif',
//       message: typeof message,
//       is_read: typeof false,
//     });

//     const notifResult = await db.query(
//       `INSERT INTO notifications (user_id, umi, mrf_no, type, message, is_read, created_at, updated_at)
//        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)
//        RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
//       [inventoryHeadId, umi, null, 'mif', message, false]
//     );
//     const notification = notifResult.rows[0];
//     console.log(`Notification created for inventory_head (user_id: ${inventoryHeadId}):`, notification);

//     // Emit Socket.IO notification if io is available
//     if (io) {
//       const userSocketMap = req.app.get('userSocketMap');
//       const socketId = userSocketMap.get(inventoryHeadId.toString());
//       if (socketId) {
//         io.to(socketId).emit('notification', notification);
//         console.log(`Socket.IO notification emitted to inventory_head (user_id: ${inventoryHeadId}, socket_id: ${socketId}) for UMI ${umi}`);
//       } else {
//         console.warn(`No socket found for inventory_head (user_id: ${inventoryHeadId})`);
//       }
//     } else {
//       console.error('Socket.IO instance is not available; notification not emitted');
//     }

//     await db.query("COMMIT");
//     return res.status(200).json({ message: "Request approved successfully" });
//   } catch (error) {
//     await db.query("ROLLBACK");
//     console.error("Error approving request:", error);
//     return res.status(500).json({ error: "Server error", details: error.message });
//   }
// };

// Approve a request (Notification Integrated)
const approveRequest = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isHead = role.endsWith("_head");
    const isAdmin = role === "admin";
    const department = getDepartmentFromRole(role);

    if (!isHead && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized: Only heads or admin can approve requests" });
    }

    const { umi } = req.params;
    const { updatedItems, note, priority } = req.body;
    const io = req.app.get('io');

    if (!updatedItems || !Array.isArray(updatedItems)) {
      return res.status(400).json({ error: "Invalid request: updatedItems must be an array" });
    }

    if (!Array.isArray(note)) {
      return res.status(400).json({ error: "Invalid request: note must be an array" });
    }

    if (typeof umi !== 'string') {
      return res.status(400).json({ error: "Invalid request: umi must be a string" });
    }

    await db.query("BEGIN");

    for (const item of updatedItems) {
      const fetchNoteQuery = `
        SELECT note
        FROM noncoc_basket
        WHERE basket_id = $1 AND umi = $2;
      `;
      const fetchNoteResult = await db.query(fetchNoteQuery, [item.basket_id, umi]);

      let existingNotes = [];
      if (fetchNoteResult.rows.length > 0 && fetchNoteResult.rows[0].note) {
        existingNotes = fetchNoteResult.rows[0].note;
      }

      const updatedNotes = [...existingNotes, ...note];

      let updateQuery = `
        UPDATE noncoc_basket
        SET updated_requestedqty = $1, status = 'Inventory Approval Pending', note = $2, priority = $3, remark = $4
        WHERE basket_id = $5 AND umi = $6
        AND status = 'Head Approval Pending'
        RETURNING umi, component_id, updated_requestedqty, note, priority, remark, mrf_no;
      `;
      let params = [
        item.updated_requestedqty,
        JSON.stringify(updatedNotes),
        priority !== undefined ? priority : false,
        item.remark || null,
        item.basket_id,
        umi,
      ];

      if (isHead && department) {
        updateQuery = `
          UPDATE noncoc_basket nb
          SET updated_requestedqty = $1, status = 'Inventory Approval Pending', note = $2, priority = $3, remark = $4
          FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE nb.basket_id = $5 AND nb.umi = $6
          AND nb.status = 'Head Approval Pending'
          AND r.role_name = $7
          RETURNING nb.umi, nb.component_id, nb.updated_requestedqty, nb.note, nb.priority, nb.remark, nb.mrf_no;
        `;
        params = [
          item.updated_requestedqty,
          JSON.stringify(updatedNotes),
          priority !== undefined ? priority : false,
          item.remark || null,
          item.basket_id,
          umi,
          `${department}_employee`,
        ];
      }

      const updateResult = await db.query(updateQuery, params);

      if (updateResult.rows.length === 0) {
        throw new Error(`No item found with basket_id ${item.basket_id} for UMI ${umi}`);
      }

      console.log("Update Result for basket_id", item.basket_id, ":", updateResult.rows[0]);

      const mrfNo = updateResult.rows[0].mrf_no;

      // if (mrfNo) {
      //   const mrfUpdateQuery = `
      //     UPDATE material_request_form
      //     SET status = 'Inventory Approval Pending'
      //     WHERE mrf_no = $1 AND status != 'Issued';
      //   `;
      //   await db.query(mrfUpdateQuery, [mrfNo]);
      // }
    }

    // Send notification to inventory_head (user_id = 1)
    const inventoryHeadId = 1;
    const message = `MIF request approved by Head: UMI ${umi}`;

    console.log(`Creating MIF approval notification for inventory_head (user_id: ${inventoryHeadId}), UMI ${umi}, message: ${message}`);

    const notifResult = await db.query(
      `INSERT INTO notifications (user_id, umi, mrf_no, type, message, is_read, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)
       RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
      [inventoryHeadId, umi, null, 'mif', message, false]
    );

    const notification = notifResult.rows[0];
    console.log(`Notification created for inventory_head (user_id: ${inventoryHeadId}):`, notification);

    // Emit Socket.IO notification if io is available
    if (io) {
      const userSocketMap = req.app.get('userSocketMap');
      const socketId = userSocketMap.get(inventoryHeadId.toString());

      if (socketId) {
        io.to(socketId).emit('notification', notification);
        console.log(`Socket.IO notification emitted to inventory_head (user_id: ${inventoryHeadId}, socket_id: ${socketId}) for UMI ${umi}`);
      } else {
        console.warn(`No socket found for inventory_head (user_id: ${inventoryHeadId})`);
      }
    } else {
      console.error('Socket.IO instance is not available; notification not emitted');
    }

    await db.query("COMMIT");
    return res.status(200).json({ message: "Request approved successfully" });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error approving request:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isHead = role.endsWith("_head");
    const isAdmin = role === "admin";
    const department = getDepartmentFromRole(role);

    if (!isHead && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized: Only heads or admin can reject requests" });
    }

    const { umi } = req.params;
    const { note } = req.body;
    const io = req.app.get('io'); // Corrected key from 'socketio' to 'io'

    if (!note || !Array.isArray(note)) {
      return res.status(400).json({ error: "Invalid request: note must be an array" });
    }

    await db.query("BEGIN");

    // Fetch the existing note (jsonb) for the items to merge with new notes
    const fetchNoteQuery = `
      SELECT note
      FROM noncoc_basket
      WHERE umi = $1 AND status = 'Head Approval Pending';
    `;
    const fetchNoteResult = await db.query(fetchNoteQuery, [umi]);
    if (fetchNoteResult.rows.length === 0) {
      throw new Error(`No items found for UMI ${umi} with status 'Head Approval Pending'`);
    }

    let existingNotes = [];
    if (fetchNoteResult.rows[0].note) {
      existingNotes = fetchNoteResult.rows[0].note; // jsonb is automatically parsed as an array
    }

    // Merge existing notes with new notes from the request
    const updatedNotes = [...existingNotes, ...note];

    // Update the status to "Rejected" and add the note
    let updateQuery = `
      UPDATE noncoc_basket
      SET status = 'Rejected', note = $1
      WHERE umi = $2 AND status = 'Head Approval Pending'
      RETURNING umi, note;
    `;
    let params = [
      JSON.stringify(updatedNotes), // Serialize the merged notes array to JSON for jsonb storage
      umi,
    ];

    if (isHead && department) {
      updateQuery = `
        UPDATE noncoc_basket nb
        SET status = 'Rejected', note = $1
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE nb.umi = $2 AND nb.status = 'Head Approval Pending'
        AND r.role_name = $3
        RETURNING nb.umi, nb.note;
      `;
      params = [
        JSON.stringify(updatedNotes),
        umi,
        `${department}_employee`,
      ];
    }

    const updateResult = await db.query(updateQuery, params);
    if (updateResult.rows.length === 0) {
      throw new Error(`No items updated for UMI ${umi}. Possibly already processed or unauthorized.`);
    }

    // Send notification to the user (user_id = 4)
const userId = 4; // Fixed user_id for the employee
const message = `MIF request rejected by Head: UMI ${umi}`;

// Insert notification into database
console.log(`Creating MIF rejection notification for user (user_id: ${userId}), UMI ${umi}, message: ${message}`);
const notifResult = await db.query(
  `INSERT INTO notifications (user_id, umi, mrf_no, type, message, is_read, created_at, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)
   RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
  [userId, umi, null, 'mif', message, false]
);
const notification = notifResult.rows[0];
console.log(`Notification created for user (user_id: ${userId}):`, notification);

// Emit Socket.IO notification if io is available
if (io) {
  const userSocketMap = req.app.get('userSocketMap');
  const socketId = userSocketMap.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit('notification', notification);
    console.log(`Socket.IO notification emitted to user (user_id: ${userId}, socket_id: ${socketId}) for UMI ${umi}`);
  } else {
    console.warn(`No socket found for user (user_id: ${userId})`);
  }
} else {
  console.error('Socket.IO instance is not available; notification not emitted');
}

    await db.query("COMMIT");
    return res.status(200).json({ message: "Request rejected successfully" });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error rejecting request:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};




module.exports = {
  getApprovalRequests,
  getPastApprovedRequests,
  getRequestDetails,
  approveRequest,
  rejectRequest,
};


















