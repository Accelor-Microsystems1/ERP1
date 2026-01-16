const db = require("../db");
const { DateTime } = require("luxon"); // Replace moment with Luxon

// Fetch pending issue requests (status: 'Inventory Approval Pending' or 'Receiving Pending')
const getPendingNonCOCIssueRequests = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;

    if (!["inventory_head", "inventory_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only inventory team and admin can view issue requests",
      });
    }
    // const currentDate = DateTime.now().toISODate(); // Use Luxon for current date
    const query = `
     SELECT nb.umi, nb.project_name, u.name AS user_name, nb.date, nb.status, nb.user_id,nb.priority, COALESCE(MAX(nb.mrf_no), 'No MRF') AS mrf_no
FROM noncoc_basket nb
JOIN users u ON nb.user_id = u.id
WHERE nb.status IN ('Inventory Approval Pending')
GROUP BY nb.umi, nb.project_name, u.name, nb.date, nb.status, nb.user_id, nb.note, nb.priority
ORDER BY nb.date DESC;
    `;

    const result = await db.query(query);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching pending issue requests:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// Fetch past non-COC issued requests
const getPastNonCOCIssuedRequests = async (req, res) => {
  try {
    // Defensive check for req.user
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    }

    const { role, id: user_id } = req.user;

    if (!["inventory_head", "inventory_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only inventory team can view past issued requests",
      });
    }

    const query = `
      WITH mrf_data AS (
        SELECT umi, MAX(mrf_no) AS mrf_no
        FROM noncoc_basket
        WHERE status IN ('Rejected', 'Issued', 'Receiving Pending')
        GROUP BY umi
      )
      SELECT DISTINCT ON (nb.umi) 
             nb.umi, 
             nb.project_name, 
             u.name AS user_name, 
             u.department AS user_department, 
             mif.issue_date, 
             nb.date, 
             nb.status, 
             mif.mi, 
             nb.priority, 
             COALESCE(md.mrf_no, 'No MRF') AS mrf_no,
             mif.remark AS mif_remark,
             mif.mrr_allocations
      FROM noncoc_basket nb
      JOIN users u ON nb.user_id = u.id
      JOIN material_issue_form mif ON nb.umi = mif.umi
      LEFT JOIN mrf_data md ON nb.umi = md.umi
      WHERE nb.status IN ('Rejected', 'Issued', 'Receiving Pending')
      ORDER BY nb.umi, nb.date DESC, nb.status = 'Receiving Pending';
    `;

    const result = await db.query(query);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching past issued requests:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

// Fetch details of a specific request based on UMI
const getNonCOCIssueRequestDetails = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;

    if (!["inventory_head", "inventory_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only inventory team can view request details",
      });
    }

    const { umi } = req.params;

    // Fetch request details
    const query = `
      SELECT nb.basket_id, nb.updated_requestedqty, nb.initial_requestedqty, nb.date, nb.status, nb.umi, nb.user_id, 
            u.name AS user_name, u.department AS user_department, r.role_name, nb.priority, nb.remark AS head_remark, nb.note as head_note, 
            mif.note AS mif_note, mif.remark AS mif_remark,
            nc.item_description, nc.mpn, nc.part_no, nc.make,nc.uom, nc.mrr_no AS nc_mrr_no, nc.on_hand_quantity, nc.location, nb.component_id
      FROM noncoc_basket nb
      JOIN users u ON nb.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN material_issue_form mif ON nb.umi = mif.umi AND nb.component_id = mif.component_id
      JOIN non_coc_components nc ON nb.component_id = nc.component_id
      WHERE nb.umi = $1 AND nb.status IN ('Inventory Approval Pending', 'Receiving Pending');
    `;
    const params = [umi];
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No request found for this UMI" });
    }

    // Fetch MRR numbers and material_in_quantity for each component
    const detailedItems = await Promise.all(result.rows.map(async (item) => {
      const department = item.role_name.split("_")[0];

      // Fetch MRR numbers from both sources using UNION
     const mrrQuery = `
  SELECT po.mrr_no, po.material_in_quantity, 'purchase_orders' AS source
  FROM purchase_orders po
  JOIN non_coc_components nc ON po.mpn = nc.mpn
  WHERE nc.component_id = $1 AND po.mrr_no IS NOT NULL AND po.material_in_quantity > 0
  UNION
  SELECT nc.mrr_no, NULL AS material_in_quantity, 'non_coc_components' AS source
  FROM non_coc_components nc
  WHERE nc.component_id = $1 AND nc.mrr_no IS NOT NULL AND nc.mrr_no != '';
`;
      const mrrResult = await db.query(mrrQuery, [item.component_id]);

      // Log the fetched MRR data for debugging
      console.log(`MRR data for component_id ${item.component_id}:`, mrrResult.rows);

      // Format MRR options, including source and material_in_quantity
      const mrrOptions = mrrResult.rows.map(row => ({
        mrr_no: row.mrr_no,
        material_in_quantity: row.material_in_quantity || 0,
        source: row.source,
      }));
      return {
        basket_id: item.basket_id,
        updated_requestedqty: item.updated_requestedqty,
        initial_requestedqty: item.initial_requestedqty,
        date: item.date,
        status: item.status,
        mif_note: item.mif_note,
        head_note: item.head_note,
        mif_remark: item.mif_remark,
        umi: item.umi,
        user_id: item.user_id,
        user_name: item.user_name,
        user_department: item.user_department,
        role_name: item.role_name,
        priority: item.priority,
        head_remark: item.head_remark || "N/A",
        item_description: item.item_description || "N/A",
        mpn: item.mpn || "N/A",
        part_no: item.part_no || "N/A",
        make: item.make || "N/A",
        uom: item.uom|| "N/A",
        on_hand_quantity: item.on_hand_quantity || 0,
        location: item.location || "N/A",
        component_id: item.component_id,
        department,
        mrr_options: mrrOptions, // Add MRR options for dropdown
      };
    }));

    console.log("Returning request details with MRR options:", detailedItems);
    return res.status(200).json(detailedItems);
  } catch (error) {
    console.error("Error fetching issue request details:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

// Submit non-COC material issue form
const submitNonCOCMaterialIssueForm = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    if (!["inventory_head", "inventory_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only inventory team can submit material issue forms",
      });
    }

    const { umi, items, issue_date, note } = req.body;

    console.log("Received submit payload:", { umi, items, issue_date, note }); // Debug log

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Valid items array is required" });
    }

    // Validate issue_date with Luxon
    const dt = DateTime.fromISO(issue_date, { zone: 'utc' });
    if (!dt.isValid) {
      return res.status(400).json({ error: `Invalid time value for issue_date: ${issue_date}, expected ISO format (e.g., 2025-04-16T12:00:00Z)` });
    }
    const currentTimestamp = dt.toISO(); // Use validated timestamp

    // Validate items and MRR allocations
    for (const item of items) {
      if (!item.component_id) {
        return res.status(400).json({ error: `Each item must have a valid component_id (received: ${item.component_id})` });
      }
      if (item.issued_quantity === undefined || item.issued_quantity === null || isNaN(item.issued_quantity) || !Number.isInteger(Number(item.issued_quantity))) {
        return res.status(400).json({ error: `Each item must have a valid issued_quantity (integer) (received: ${item.issued_quantity})` });
      }

      const basketQuery = `
        SELECT updated_requestedqty FROM noncoc_basket WHERE umi = $1 AND component_id = $2;
      `;
      const basketResult = await db.query(basketQuery, [umi, item.component_id]);
      if (basketResult.rows.length === 0) {
        return res.status(404).json({ error: `No basket item found for umi ${umi} and component_id ${item.component_id}` });
      }
      const requestedQty = basketResult.rows[0].updated_requestedqty || 0;
      const issuedQty = Number(item.issued_quantity);
      if (requestedQty < issuedQty) {
        return res.status(400).json({ error: `Issued quantity (${issuedQty}) cannot exceed requested quantity (${requestedQty}) for component_id ${item.component_id}` });
      }
      if (item.issued_quantity !== requestedQty && !item.remark) {
        return res.status(400).json({
          error: `Remark is required for component_id ${item.component_id} when issued quantity differs from requested quantity`,
        });
      }

      // Validate MRR allocations structure
      if (item.mrr_allocations && !Array.isArray(item.mrr_allocations)) {
        return res.status(400).json({ error: `mrr_allocations must be an array for component_id ${item.component_id}` });
      }
      if (item.mrr_allocations && item.mrr_allocations.length > 0) {
        const totalMrrQty = item.mrr_allocations.reduce((sum, mrr) => sum + Number(mrr.quantity), 0);
        if (totalMrrQty !== item.issued_quantity) {
          return res.status(400).json({
            error: `Total MRR quantities (${totalMrrQty}) must match issued quantity (${item.issued_quantity}) for component_id ${item.component_id}`,
          });
        }
        for (const mrr of item.mrr_allocations) {
          if (!mrr.mrr_no || typeof mrr.quantity !== 'number' || mrr.quantity <= 0 || !Number.isInteger(mrr.quantity)) {
            return res.status(400).json({
              error: `Invalid MRR allocation for component_id ${item.component_id}: mrr_no and quantity (positive integer) are required (received: ${JSON.stringify(mrr)})`,
            });
          }
        }
      }
    }

    let updatedNote = [];
    try {
      updatedNote = Array.isArray(note) ? note : JSON.parse(note);
    } catch (e) {
      console.warn("Invalid JSON format for note. Using empty array.");
      updatedNote = [];
    }

    // Verify UMI and status
    const checkQuery = `
      SELECT umi, status FROM noncoc_basket WHERE umi = $1 LIMIT 1;
    `;
    const checkResult = await db.query(checkQuery, [umi]);
    if (
      checkResult.rows.length === 0 ||
      checkResult.rows[0].status !== "Inventory Approval Pending"
    ) {
      return res
        .status(400)
        .json({ error: "Invalid UMI or request not ready for approval" });
    }

    // Check if UMI has already been issued
    const checkIssuedQuery = `
      SELECT EXISTS (
        SELECT 1 FROM material_issue_form WHERE umi = $1 AND mi IS NOT NULL
      ) AS is_issued;
    `;
    const issuedResult = await db.query(checkIssuedQuery, [umi]);
    if (issuedResult.rows[0].is_issued) {
      return res
        .status(400)
        .json({ error: "This UMI has already been issued" });
    }

    await db.query("BEGIN");

    // Generate and validate MI number
    const miResult = await db.query("SELECT nextval('mi_seq') AS mi;");
    if (!miResult.rows[0] || miResult.rows[0].mi === undefined || miResult.rows[0].mi === null) {
      throw new Error("Failed to generate valid MI sequence value");
    }
    const generatedMI = `MI${miResult.rows[0].mi}`;
    if (generatedMI.length > 15) {
      throw new Error(`Generated MI (${generatedMI}) exceeds character varying(15) limit`);
    }

    let lastBasketResult = null;
    for (const item of items) {
      const updateBasketQuery = `
        UPDATE noncoc_basket
        SET status = 'Receiving Pending'
        WHERE umi = $1 AND component_id = $2 AND status = 'Inventory Approval Pending'
        RETURNING umi, component_id, updated_requestedqty, user_id;
      `;
      const basketResult = await db.query(updateBasketQuery, [umi, item.component_id]);

      if (basketResult.rows.length === 0) {
        throw new Error(
          `No approved item found for UMI ${umi} and component_id ${item.component_id}`
        );
      }

      lastBasketResult = basketResult.rows[0];
      const issuedQuantity = Number(item.issued_quantity);

      const checkStockQuery = `
        SELECT on_hand_quantity FROM non_coc_components WHERE component_id = $1;
      `;
      const stockCheckResult = await db.query(checkStockQuery, [lastBasketResult.component_id]);
      if (
        stockCheckResult.rows.length === 0 ||
        stockCheckResult.rows[0].on_hand_quantity < issuedQuantity
      ) {
        throw new Error(
          `Insufficient stock for component_id ${lastBasketResult.component_id}`
        );
      }

      // Update stock in non_coc_components
      const updateComponentQuery = `
        UPDATE non_coc_components
        SET on_hand_quantity = on_hand_quantity - $1
        WHERE component_id = $2
        RETURNING on_hand_quantity;
      `;
      const componentResult = await db.query(updateComponentQuery, [
        issuedQuantity,
        lastBasketResult.component_id,
      ]);

      if (componentResult.rows.length === 0) {
        throw new Error(
          `Failed to update stock for component_id ${lastBasketResult.component_id}`
        );
      }

      // Serialize mrr_allocations into a string
      let mrrAllocationsString = null;
      if (item.mrr_allocations && item.mrr_allocations.length > 0) {
        mrrAllocationsString = item.mrr_allocations
          .map(mrr => `${mrr.mrr_no}:${mrr.quantity}`)
          .join(',');
      }

      // Insert into material_issue_form with mrr_allocations
      const insertMifQuery = `
        INSERT INTO material_issue_form (mi, umi, issued_quantity, issue_date, component_id, note, remark, mrr_allocations)
        VALUES ($1::varchar, $2::varchar, $3::integer, $4::timestamptz, $5::bigint, $6::jsonb, $7::text, $8::text)
        RETURNING mif_id;
      `;
      console.log("Executing insertMifQuery with params:", [
        generatedMI,
        umi,
        issuedQuantity,
        currentTimestamp,
        lastBasketResult.component_id,
        note,
        item.remark,
        mrrAllocationsString
      ]);
      const mifResult = await db.query(insertMifQuery, [
        generatedMI,
        umi,
        issuedQuantity,
        currentTimestamp,
        lastBasketResult.component_id,
        JSON.stringify(updatedNote),
        item.remark,
        mrrAllocationsString
      ]);

      const generatedMifId = mifResult.rows[0].mif_id;

      const stockCardQuery = `
        INSERT INTO noncoc_stockcard (
          mif_id, umi, requested_quantity, component_id, transaction_type, transaction_date, balance, user_id
        )
        VALUES ($1::integer, $2::varchar, $3::integer, $4::bigint, $5::text, $6::timestamptz, $7::integer, $8::integer)
        RETURNING *;
      `;
      await db.query(stockCardQuery, [
        generatedMifId,
        lastBasketResult.umi,
        issuedQuantity,
        lastBasketResult.component_id,
        "Receiving Pending",
        currentTimestamp,
        componentResult.rows[0].on_hand_quantity,
        lastBasketResult.user_id,
      ]);
    }

    if (!lastBasketResult) {
      throw new Error("No items processed for notification");
    }

    const initiatorId = lastBasketResult.user_id;
    const userQuery = `SELECT email, department FROM users WHERE id = $1;`;
    const userResult = await db.query(userQuery, [initiatorId]);
    if (userResult.rows.length === 0) {
      throw new Error(`User with ID ${initiatorId} not found`);
    }
    const initiatorEmail = userResult.rows[0].email;
    const initiatorDepartment = userResult.rows[0].department;

    const expectedDepartment = 'quality';
    if (initiatorDepartment !== expectedDepartment) {
      console.warn(`Initiator department (${initiatorDepartment}) does not match expected department (${expectedDepartment})`);
    }

    const targetUserId = initiatorId;
    const message = `Inventory has approved, Receiving pending for UMI ${umi}`;
    const io = req.app.get('io');

    console.log(`Creating MIF notification for user_id: ${targetUserId}, UMI: ${umi}, message: ${message}`);
    const notifResult = await db.query(
      `INSERT INTO notifications (user_id, umi, mrf_no, type, message, status, is_read, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL)
       RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
      [targetUserId, umi, null, 'mif', message, 'Receiving Pending', false]
    );
    const notification = notifResult.rows[0];
    console.log(`Notification created for user_id: ${targetUserId}:`, notification);

    if (io) {
      const userSocketMap = req.app.get('userSocketMap');
      const socketId = userSocketMap.get(targetUserId.toString());
      if (socketId) {
        io.to(socketId).emit('notification', notification);
        console.log(`Socket.IO notification emitted to user_id: ${targetUserId}, socket_id: ${socketId} for UMI ${umi}`);
      } else {
        console.warn(`No socket found for user_id: ${targetUserId}`);
      }
    } else {
      console.error('Socket.IO instance is not available; notification not emitted');
    }

    console.log(
      `Confirmation message sent to ${initiatorEmail}: Please confirm receipt for UMI ${umi} (MI: ${generatedMI}).`
    );

    await db.query("COMMIT");
    return res.status(200).json({
      message: "Material issue form approved successfully, awaiting confirmation",
      mi: generatedMI,
      initiatorEmail,
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error approving material issue form:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// // Helper function to get available component_ids for debugging
// async function getAvailableComponentIds(umi) {
//   const result = await db.query(
//     `SELECT component_id FROM noncoc_basket WHERE umi = $1`,
//     [umi]
//   );
//   return result.rows.map(row => row.component_id).join(", ");
// }

const confirmReceipt = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const { umi } = req.params;
    const io = req.app.get('io'); // Socket.IO instance

    // Check if the UMI exists and get its status and initiator
    const checkQuery = `
      SELECT user_id, status FROM noncoc_basket WHERE umi = $1 LIMIT 1;
    `;
    const checkResult = await db.query(checkQuery, [umi]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "No request found for this UMI" });
    }
    const { user_id: initiatorId, status } = checkResult.rows[0];

    // Authorization check: Only the initiator or admin can confirm receipt when status is 'Receiving Pending'
    if (status !== "Receiving Pending" || (user_id !== initiatorId && role !== "admin")) {
      return res.status(403).json({ error: "Unauthorized or invalid status for confirmation" });
    }

    await db.query("BEGIN");

    // Update the status to 'Issued'
    const updateQuery = `
      UPDATE noncoc_basket 
      SET status = 'Issued', updated_at = NOW()
      WHERE umi = $1 AND status = 'Receiving Pending'
      RETURNING umi, status;
    `;
    const updateResult = await db.query(updateQuery, [umi]);
    if (updateResult.rows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ error: "Failed to update status, UMI not found or status invalid" });
    }

    // Notification Logic: Notify inventory_head (user_id = 1)
    const inventoryHeadId = 1; // Fixed user_id for inventory_head
    const message = `Receiving completed for UMI ${umi}`;

    // Insert notification into the database (adjusted for current schema)
    const notifQuery = `
      INSERT INTO notifications (umi, mrf_no, message, is_read, created_at, updated_at, mif_id, urf_id)
      VALUES ($1, $2, $3, $4, NOW(), NULL, NULL, NULL)
      RETURNING id, umi, mrf_no, message, is_read, created_at;
    `;
    try {
      const notifResult = await db.query(notifQuery, [
        umi,
        null, // mrf_no is null since this is UMI-related
        message,
        false
      ]);
      const notification = notifResult.rows[0];
      console.log(`Notification created for inventory_head (intended user_id: ${inventoryHeadId}):`, notification);
    } catch (notifError) {
      console.error("Error inserting notification:", notifError.stack);
      await db.query("ROLLBACK");
      return res.status(500).json({ error: "Failed to insert notification", details: notifError.message });
    }

    // Emit Socket.IO notification if io is available
    if (io) {
      const userSocketMap = req.app.get('userSocketMap');
      const socketId = userSocketMap.get(inventoryHeadId.toString());
      if (socketId) {
        io.to(socketId).emit('notification', { message }); // Simplified for now
        console.log(`Socket.IO notification emitted to user_id: ${inventoryHeadId}, socket_id: ${socketId} for UMI ${umi}`);
      } else {
        console.warn(`No socket found for user_id: ${inventoryHeadId}`);
      }
    } else {
      console.error('Socket.IO instance is not available; notification not emitted');
    }

    await db.query("COMMIT");
    return res.status(200).json({ message: "Receipt confirmed, status updated to Issued" });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error confirming receipt:", error.stack);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

const getPastIssuedRequestDetails = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;

    if (!["inventory_head", "inventory_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only inventory team can view request details",
      });
    }

    const { umi } = req.params;

    const query = `
      SELECT DISTINCT ON (mif.umi, mif.component_id)
        mif.mi, 
        mif.umi, 
        mif.component_id,
        mif.issued_quantity, 
        mif.issue_date, 
        mif.note AS mif_note, 
        mif.remark AS mif_remark,
        mif.mrr_allocations,
        nb.note AS head_note, 
        nb.remark AS head_remark, 
        nb.initial_requestedqty,
        nb.updated_requestedqty, 
        nb.priority, 
        u.name AS user_name, 
        u.department AS user_department, 
        r.role_name,
        nc.item_description, 
        nc.mpn, 
        nc.part_no, 
        nc.mrr_no AS nc_mrr_no, 
        nc.make, 
        nc.uom,
        nc.on_hand_quantity, 
        nc.location
      FROM material_issue_form mif
      JOIN noncoc_basket nb ON mif.umi = nb.umi AND mif.component_id = nb.component_id
      JOIN users u ON nb.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      JOIN non_coc_components nc ON nb.component_id = nc.component_id
      WHERE mif.umi = $1 
        AND nb.status IN ('Rejected', 'Issued', 'Receiving Pending')
      ORDER BY mif.umi, mif.component_id, mif.issue_date DESC;
    `;
    const params = [umi];

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No issued request found for this UMI" });
    }

    const detailedItems = await Promise.all(result.rows.map(async (item) => {
      const department = item.role_name.split("_")[0];

      // Handle mrr_allocations safely
      let mrrAllocations = [];
      if (item.mrr_allocations && typeof item.mrr_allocations === 'string' && item.mrr_allocations.trim() !== '') {
        try {
          const allocations = item.mrr_allocations.split(',').map(alloc => {
            const [mrr_no, quantity] = alloc.split(':');
            return { mrr_no, quantity: Number(quantity) || 0 };
          });
          mrrAllocations = allocations.filter(alloc => alloc.mrr_no && alloc.quantity > 0);
        } catch (error) {
          console.error(`Error parsing mrr_allocations for UMI ${item.umi}, component_id ${item.component_id}:`, error);
          mrrAllocations = []; // Default to empty array on parsing error
        }
      }

      // Fetch MRR numbers from both sources using UNION
      const mrrQuery = `
        SELECT mrr_no, material_in_quantity, 'purchase_orders' AS source
        FROM purchase_orders
        WHERE mpn = $1 AND mrr_no IS NOT NULL AND material_in_quantity > 0
        UNION
        SELECT mrr_no, NULL AS material_in_quantity, 'non_coc_components' AS source
        FROM non_coc_components
        WHERE mpn = $1 AND mrr_no IS NOT NULL AND mrr_no != '';
      `;
      const mrrResult = await db.query(mrrQuery, [item.mpn]);

      // Format MRR options
      const mrrOptions = mrrResult.rows.map(row => ({
        mrr_no: row.mrr_no,
        material_in_quantity: row.material_in_quantity || 0,
        source: row.source,
      }));

      return {
        mi: item.mi,
        umi: item.umi,
        component_id: item.component_id,
        issued_quantity: item.issued_quantity,
        issue_date: item.issue_date,
        mif_note: item.mif_note,
        mif_remark: item.mif_remark || "N/A",
        head_remark: item.head_remark || "N/A",
        head_note: item.head_note,
        updated_requestedqty: item.updated_requestedqty,
        initial_requestedqty: item.initial_requestedqty,
        priority: item.priority,
        user_name: item.user_name,
        role_name: item.role_name,
        item_description: item.item_description || "N/A",
        mpn: item.mpn || "N/A",
        part_no: item.part_no || "N/A",
        make: item.make || "N/A",
        uom: item.uom || "N/A",
        on_hand_quantity: item.on_hand_quantity || 0,
        location: item.location || "N/A",
        user_department: item.user_department || "N/A",
        department,
        mrr_options: mrrOptions,
        mrr_allocations: mrrAllocations, // Always include mrr_allocations (empty array if none)
      };
    }));

    return res.status(200).json(detailedItems);
  } catch (error) {
    console.error("Error fetching past issued request details:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

// Reject non-COC material issue form
const rejectNonCOCMaterialIssueForm = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isHead = role.endsWith("_head");
    const isAdmin = role === "admin";
    const isCeo = role === "ceo";

    if (!isHead && !isAdmin && !isCeo) {
      return res.status(403).json({
        error: "Unauthorized: Only heads, admin, or CEO can reject MIF requests",
      });
    }

    const { umi } = req.params;
    const { note, reason } = req.body;

    if (!note || (Array.isArray(note) && note.length === 0)) {
      return res.status(400).json({ error: "Rejection note is required." });
    }

    // Check the status of the request
    const statusQuery = `
      SELECT status, user_id
      FROM noncoc_basket
      WHERE umi = $1
      LIMIT 1;
    `;
    const statusResult = await db.query(statusQuery, [umi]);
    console.log(`Status check for UMI ${umi}:`, statusResult.rows); // Debug log
    if (statusResult.rows.length === 0) {
      return res.status(404).json({ error: `No request found for UMI ${umi}` });
    }
    if (statusResult.rows[0].status !== "Inventory Approval Pending") {
      return res.status(400).json({ error: "Request is not ready for rejection" });
    }
    const initiatorId = statusResult.rows[0].user_id;

    // Get user name and initiator details
    const userQuery = `
      SELECT name, email, department 
      FROM users 
      WHERE id = $1;
    `;
    const userResult = await db.query(userQuery, [user_id]);
    console.log(`User check for ID ${user_id}:`, userResult.rows); // Debug log
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: `User with ID ${user_id} not found` });
    }
    const userName = userResult.rows[0].name;

    // Fetch initiator's department for verification
    const initiatorQuery = `
      SELECT email, department 
      FROM users 
      WHERE id = $1;
    `;
    const initiatorResult = await db.query(initiatorQuery, [initiatorId]);
    if (initiatorResult.rows.length === 0) {
      return res.status(404).json({ error: `Initiator with ID ${initiatorId} not found` });
    }
    const initiatorEmail = initiatorResult.rows[0].email;
    const initiatorDepartment = initiatorResult.rows[0].department;

    // Verify the initiator's department (for future-proofing)
    const expectedDepartment = 'quality'; // Since initiator is quality_employee
    if (initiatorDepartment !== expectedDepartment) {
      console.warn(`Initiator department (${initiatorDepartment}) does not match expected department (${expectedDepartment})`);
      // For now, we proceed since there's only one user; in the future, this could be an error
    }

    // Fetch existing note and items from noncoc_basket
    const itemsQuery = `
      SELECT nb.component_id, nb.updated_requestedqty, nb.initial_requestedqty, nb.note, nc.on_hand_quantity
      FROM noncoc_basket nb
      JOIN non_coc_components nc ON nb.component_id = nc.component_id
      WHERE nb.umi = $1 AND nb.status = 'Inventory Approval Pending';
    `;
    const itemsResult = await db.query(itemsQuery, [umi]);
    console.log(`Items for UMI ${umi}:`, itemsResult.rows); // Debug log
    if (itemsResult.rows.length === 0) {
      return res.status(404).json({ error: `No items found for UMI ${umi}` });
    }

    const items = itemsResult.rows.map((item) => ({
      component_id: item.component_id,
      issued_quantity: 0, // Since it's rejected, issued quantity is 0
      updated_requestedqty: item.updated_requestedqty,
      initial_requestedqty: item.initial_requestedqty,
      on_hand_quantity: item.on_hand_quantity,
      remark: reason, // Use the reason if provided, otherwise a default remark
    }));

    // Prepare notes
    const currentNotes = itemsResult.rows[0].note || [];
    let updatedNotes = Array.isArray(currentNotes) ? [...currentNotes] : [];

    if (Array.isArray(note)) {
      updatedNotes = [...updatedNotes, ...note];
    } else if (note && note.content && note.content.trim()) {
      updatedNotes.push({
        timestamp: new Date().toISOString(),
        user_name: userName,
        content: note.content.trim(),
      });
    }

    if (updatedNotes.length === currentNotes.length && reason && reason.trim()) {
      updatedNotes.push({
        timestamp: new Date().toISOString(),
        user_name: userName,
        content: reason.trim(),
      });
    }

    await db.query("BEGIN");

    // Generate and validate MI number
    const miResult = await db.query("SELECT nextval('mi_seq') AS mi;");
    if (!miResult.rows[0] || miResult.rows[0].mi === undefined || miResult.rows[0].mi === null) {
      throw new Error("Failed to generate valid MI sequence value");
    }
    const generatedMI = `MI${miResult.rows[0].mi}`;
    if (generatedMI.length > 15) {
      throw new Error(`Generated MI (${generatedMI}) exceeds character varying(15) limit`);
    }

    // Insert into material_issue_form
    const currentTimestamp = DateTime.now().toISO();
    for (const item of items) {
      const insertMifQuery = `
        INSERT INTO material_issue_form (mi, umi, issued_quantity, issue_date, component_id, note, remark)
        VALUES ($1::varchar, $2::varchar, $3::integer, $4::timestamptz, $5::bigint, $6::jsonb, $7::text)
        RETURNING mif_id;
      `;
      const mifResult = await db.query(insertMifQuery, [
        generatedMI,
        umi,
        item.issued_quantity,
        currentTimestamp,
        item.component_id,
        JSON.stringify(updatedNotes),
        item.remark,
      ]);
    }

    // Update noncoc_basket to set status to Rejected
    const updateBasketQuery = `
      UPDATE noncoc_basket
      SET status = 'Rejected'
      WHERE umi = $1
      RETURNING umi, status;
    `;
    const updateResult = await db.query(updateBasketQuery, [
      umi
    ]);

    if (updateResult.rows.length === 0) {
      throw new Error(`Failed to update noncoc_basket for UMI ${umi}`);
    }

    // Notification Logic
    const targetUserId = initiatorId; // Currently 4 (quality_employee)
    const message = `Request has been rejected by the inventory for UMI ${umi}`;
    const io = req.app.get('io'); // Socket.IO instance

    // Insert notification into the database
    console.log(`Creating MIF rejection notification for user_id: ${targetUserId}, UMI: ${umi}, message: ${message}`);
    console.log('Notification parameters:', {
      user_id: typeof targetUserId,
      umi: typeof umi,
      mrf_no: null,
      type: 'mif',
      message: typeof message,
      status: 'Rejected',
      is_read: typeof false,
    });

    const notifResult = await db.query(
      `INSERT INTO notifications (user_id, umi, mrf_no, type, message, status, is_read, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL)
       RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
      [targetUserId, umi, null, 'mif', message, 'Rejected', false]
    );
    const notification = notifResult.rows[0];
    console.log(`Notification created for user_id: ${targetUserId}:`, notification);

    // Emit Socket.IO notification if io is available
    if (io) {
      const userSocketMap = req.app.get('userSocketMap');
      const socketId = userSocketMap.get(targetUserId.toString());
      if (socketId) {
        io.to(socketId).emit('notification', notification);
        console.log(`Socket.IO notification emitted to user_id: ${targetUserId}, socket_id: ${socketId} for UMI ${umi}`);
      } else {
        console.warn(`No socket found for user_id: ${targetUserId}`);
      }
    } else {
      console.error('Socket.IO instance is not available; notification not emitted');
    }

    await db.query("COMMIT");
    return res.status(200).json({
      message: "MIF request rejected successfully",
      mi: generatedMI,
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error rejecting MIF request:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

const getAllPurchaseOrderComponents = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;

    if (!["inventory_head", "inventory_employee", "admin", "purchase_head"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only inventory team, purchase head, or admin can view purchase order components",
      });
    }

    // Fetch records with DISTINCT to avoid duplicates, prioritize backorder_items entries
    const query = `
      SELECT DISTINCT ON (COALESCE(po.po_number, bi.po_number), COALESCE(po.mpn, bi.mpn))
        po.mrf_no,
        po.mrr_no,
        TO_CHAR(po.expected_delivery_date, 'YYYY-MM-DD') AS expected_delivery_date, -- Format date as YYYY-MM-DD
        COALESCE(po.mpn, bi.mpn) AS mpn,
        po.item_description,
        po.make,
        po.part_no,
        COALESCE(po.po_number, bi.po_number) AS po_number,
        CASE 
          WHEN bi.status IS NOT NULL AND ri.status IS NOT NULL THEN bi.status || ', ' || ri.status
          WHEN bi.status IS NOT NULL THEN bi.status
          WHEN ri.status IS NOT NULL THEN ri.status
          ELSE po.status
        END AS status,
        po.updated_requested_quantity,
        po.uom,
        po.vendor_name,
        TO_CHAR(po.created_at, 'YYYY-MM-DD') AS created_at,
        bi.backorder_sequence,
        bi.reordered_quantity AS backorder_pending_quantity,
        ri.return_sequence,
        ri.reordered_quantity AS return_reordered_quantity,
        nc.component_id,
        nc.location
      FROM backorder_items bi
      RIGHT JOIN purchase_orders po
        ON po.po_number = bi.po_number 
        AND po.mpn = bi.mpn
        AND bi.status = 'Backorder generated and material delivery pending'
      LEFT JOIN return_items ri
        ON COALESCE(po.po_number, bi.po_number) = ri.po_number
        AND COALESCE(po.mpn, bi.mpn) = ri.mpn
        AND ri.status = 'Return generated and material delivery pending'
      LEFT JOIN non_coc_components nc
        ON COALESCE(po.mpn, bi.mpn) = nc.mpn
      WHERE bi.status = 'Backorder generated and material delivery pending'
         OR po.status IN (
           'Material Delivery Pending',
           'Warehouse In, Backordered',
           'Warehouse In, Backordered Returned',
           'Material Delivered & Quality Check Pending',
           'Returned'
         )
      ORDER BY COALESCE(po.po_number, bi.po_number), COALESCE(po.mpn, bi.mpn), po.expected_delivery_date DESC NULLS LAST;
    `;

    const result = await db.query(query);

    const processedRows = result.rows.map((row, index) => {
      return {
        s_no: index + 1,
        mrf_no: row.mrf_no || "N/A",
        mrr_no: row.mrr_no || "N/A",
        expected_delivery_date: row.expected_delivery_date || "N/A",
        mpn: row.mpn || "N/A",
        item_description: row.item_description || "N/A",
        make: row.make || "-",
        part_no: row.part_no || "-",
        po_number: row.po_number || "N/A",
        status: row.status || "Material Delivery Pending",
        updated_requested_quantity: row.updated_requested_quantity || 0,
        uom: row.uom || "N/A",
        vendor_name: row.vendor_name || "N/A",
        created_at: row.created_at || "N/A",
        backorder_sequence: row.backorder_sequence || "N/A",
        backorder_pending_quantity: row.backorder_pending_quantity || 0,
        return_sequence: row.return_sequence || "N/A",
        return_reordered_quantity: row.return_reordered_quantity || 0,
        component_id: row.component_id || null,
        location: row.location || "N/A",
      };
    });

    const columnsToShow = {
      mrf_no: processedRows.some(row => row.mrf_no !== "N/A"),
      mrr_no: processedRows.some(row => row.mrr_no !== "N/A"),
      expected_delivery_date: processedRows.some(row => row.expected_delivery_date !== "N/A"),
      mpn: processedRows.some(row => row.mpn !== "N/A"),
      item_description: processedRows.some(row => row.item_description !== "N/A"),
      make: processedRows.some(row => row.make !== "-"),
      part_no: processedRows.some(row => row.part_no !== "-"),
      po_number: processedRows.some(row => row.po_number !== "N/A"),
      status: processedRows.some(row => row.status !== "Material Delivery Pending"),
      updated_requested_quantity: processedRows.some(row => row.updated_requested_quantity !== 0),
      uom: processedRows.some(row => row.uom !== "N/A"),
      vendor_name: processedRows.some(row => row.vendor_name !== "N/A"),
      created_at: processedRows.some(row => row.created_at !== "N/A"),
      backorder_sequence: processedRows.some(row => row.backorder_sequence !== "N/A"),
      backorder_pending_quantity: processedRows.some(row => row.backorder_pending_quantity !== 0),
      return_sequence: processedRows.some(row => row.return_sequence !== "N/A"),
      return_reordered_quantity: processedRows.some(row => row.return_reordered_quantity !== 0),
      component_id: processedRows.some(row => row.component_id !== null),
      location: processedRows.some(row => row.location !== "N/A"),
    };

    return res.status(200).json({ data: processedRows, columnsToShow });
  } catch (error) {
    console.error("Error fetching purchase order components:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

const updatePoStatus = async (req, res) => {
  const { po_number, mpn, status } = req.body;
  const { role, id: user_id } = req.user; // Use req.user from authenticateToken middleware

   if (!["inventory_head", "inventory_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only inventory team, or admin can view purchase order components",
      });
    }

  if (!po_number || !mpn || !status) {
    return res.status(400).json({ error: 'Missing required fields: po_number, mpn, or status' });
  }

  if (status !== 'Material Delivered & Quality Check Pending') {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  // // Check user role (already available from req.user)
  // if (!['inventory_head', 'inventory_employee', 'admin', 'purchase_head'].includes(role)) {
  //   return res.status(403).json({ error: 'Unauthorized: Only inventory team, purchase head, or admin can update status' });
  // }

  try {
    // Update the status in the purchase_orders table
    const updateQuery = `
      UPDATE purchase_orders 
      SET status = $1 
      WHERE po_number = $2 AND mpn = $3
      RETURNING *;
    `;
    const updateResult = await db.query(updateQuery, [status, po_number, mpn]); // Use db instead of pool

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Send notifications to quality team (IDs 4 and 3)
    const notificationQuery = `
      INSERT INTO notifications (user_id, umi, mrf_no, message, type, is_read, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)
      RETURNING id, user_id, umi, mrf_no, message, type, is_read, created_at;
    `;
    const message = `Purchase Order ${po_number} (MPN: ${mpn}) material is delivered, kindly complete the QC.`;
    await db.query(notificationQuery, [4, null, null, message, "Pending for Quality Check",false]); // Notify quality_employee
    await db.query(notificationQuery, [3, null, null, message, "Pending for Quality Check", false]); // Notify quality_head

    // Emit Socket.IO notifications if available
    const io = req.app.get('io');
    const userSocketMap = req.app.get('userSocketMap');
    if (io) {
      const qualityEmployeeSocketId = userSocketMap.get("4");
      const qualityHeadSocketId = userSocketMap.get("3");
      const notification = { user_id: 4, message, is_read: false, created_at: new Date().toISOString() };
      if (qualityEmployeeSocketId) {
        io.to(qualityEmployeeSocketId).emit('notification', notification);
      }
      if (qualityHeadSocketId) {
        io.to(qualityHeadSocketId).emit('notification', { ...notification, user_id: 3 });
      }
    }

    return res.status(200).json({ message: 'Status updated successfully' });
  } catch (err) {
    console.error("Error updating PO status:", err);
    return res.status(500).json({ error: 'Failed to update status', details: err.message });
  }
};

const updateBoStatus = async (req, res) => {
  const { po_number, mpn, status, backorder_sequence } = req.body;
  const { role, id: user_id } = req.user;

  // Validate user role
  if (!['inventory_head', 'inventory_employee', 'admin'].includes(role)) {
    return res.status(403).json({
      error: 'Unauthorized: Only inventory team or admin can update backorder status',
    });
  }

  // Validate inputs
  if (!po_number || !mpn || !status || !backorder_sequence) {
    return res.status(400).json({
      error: 'Missing required fields: po_number, mpn, status, and backorder_sequence are required',
    });
  }

  // Validate status
  if (status !== 'Material Delivered & Quality Check Pending') {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    // Start transaction
    await db.query('BEGIN');

    // Check if the backorder item exists
    const fetchQuery = `
      SELECT backorder_sequence, po_number, mpn, status AS old_status
      FROM backorder_items
      WHERE backorder_sequence = $1 AND po_number = $2 AND mpn = $3;
    `;
    const fetchResult = await db.query(fetchQuery, [backorder_sequence, po_number, mpn]);
    if (fetchResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        error: `Backorder item not found for backorder_sequence: ${backorder_sequence}, po_number: ${po_number}, and mpn: ${mpn}`,
      });
    }

    const { old_status } = fetchResult.rows[0];

    // Update the backorder item status
    const updateQuery = `
      UPDATE backorder_items
      SET status = $1
      WHERE backorder_sequence = $2
      RETURNING backorder_sequence, po_number, mpn, status;
    `;
    const updateResult = await db.query(updateQuery, [status, backorder_sequence]);
    if (updateResult.rows.length === 0) {
      await db.query('ROLLBACK');
      throw new Error('Failed to update backorder item status');
    }

    const updatedBackorderItem = updateResult.rows[0];

    // Send notifications to quality team (user_id: 3 and 4) if status changed
    if (old_status !== status) {
      const message = `Backorder item for PO ${po_number} (MPN: ${mpn}) material is delivered, kindly complete the QC.`;
      const notificationQuery = `
        INSERT INTO notifications (user_id, umi, mrf_no, message, type, is_read, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)
        RETURNING id, user_id, umi, mrf_no, message, type, is_read, created_at;
      `;
      const notificationValues = [
        null, // umi
        null, // mrf_no
        message,
        'Pending for Quality Check',
        false, // is_read
      ];

      // Notify quality_head (user_id: 3)
      const qualityHeadNotif = await db.query(notificationQuery, [3, ...notificationValues]);
      const qualityHeadNotification = qualityHeadNotif.rows[0];

      // Notify quality_employee (user_id: 4)
      const qualityEmployeeNotif = await db.query(notificationQuery, [4, ...notificationValues]);
      const qualityEmployeeNotification = qualityEmployeeNotif.rows[0];

      // Emit Socket.IO notifications
      const io = req.app.get('io');
      const userSocketMap = req.app.get('userSocketMap');
      if (io && userSocketMap) {
        const qualityHeadSocketId = userSocketMap.get('3');
        const qualityEmployeeSocketId = userSocketMap.get('4');

        if (qualityHeadSocketId) {
          io.to(qualityHeadSocketId).emit('notification', {
            ...qualityHeadNotification,
            created_at: new Date().toISOString(),
          });
          console.log(`Socket.IO notification emitted to quality_head (user_id: 3), socket_id: ${qualityHeadSocketId}`);
        } else {
          console.warn('No socket found for quality_head (user_id: 3)');
        }

        if (qualityEmployeeSocketId) {
          io.to(qualityEmployeeSocketId).emit('notification', {
            ...qualityEmployeeNotification,
            created_at: new Date().toISOString(),
          });
          console.log(`Socket.IO notification emitted to quality_employee (user_id: 4), socket_id: ${qualityEmployeeSocketId}`);
        } else {
          console.warn('No socket found for quality_employee (user_id: 4)');
        }
      }
    }

    // Commit transaction
    await db.query('COMMIT');

    // Return success response
    return res.status(200).json({
      message: `Backorder item status for PO ${po_number} updated successfully`,
      data: updatedBackorderItem,
    });
  } catch (error) {
    // Rollback transaction on error
    await db.query('ROLLBACK');
    console.error('Error updating backorder item status:', error);
    return res.status(500).json({
      error: 'Failed to update backorder item status',
      details: error.message,
    });
  }
};

const handleBackorderOfBackorder = async (req, res) => {
  const { po_number, mpn, received_quantity, reordered_quantity, backorder_sequence } = req.body;
  const { role, id: user_id } = req.user;

  // Validate user role
  if (!['inventory_head', 'inventory_employee', 'admin'].includes(role)) {
    return res.status(403).json({
      error: 'Unauthorized: Only inventory team or admin can handle backorder of backorder',
    });
  }

  // Validate inputs
  if (!po_number || !mpn || !backorder_sequence || received_quantity === undefined || reordered_quantity === undefined) {
    return res.status(400).json({
      error: 'Missing required fields: po_number, mpn, backorder_sequence, received_quantity, and reordered_quantity are required',
    });
  }

  if (!Number.isInteger(received_quantity) || !Number.isInteger(reordered_quantity) || received_quantity < 0 || reordered_quantity < 0) {
    return res.status(400).json({
      error: 'Received_quantity and reordered_quantity must be non-negative integers',
    });
  }

  try {
    await db.query('BEGIN');

    // Fetch the existing backorder item
    const fetchQuery = `
      SELECT backorder_sequence, po_number, mpn, reordered_quantity AS existing_reordered_quantity, status
      FROM backorder_items
      WHERE po_number = $1 AND mpn = $2 AND backorder_sequence = $3;
    `;
    const fetchResult = await db.query(fetchQuery, [po_number, mpn, backorder_sequence]);
    if (fetchResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        error: `Backorder item not found for po_number: ${po_number}, mpn: ${mpn}, backorder_sequence: ${backorder_sequence}`,
      });
    }

    const { existing_reordered_quantity, status: old_status } = fetchResult.rows[0];

    // Validate quantities
    if (received_quantity + reordered_quantity !== existing_reordered_quantity) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        error: `Sum of received_quantity (${received_quantity}) and reordered_quantity (${reordered_quantity}) must equal the existing reordered_quantity (${existing_reordered_quantity})`,
      });
    }

    // Update the existing backorder item
    let newStatus = 'Backorder Completed';
    if (reordered_quantity > 0) {
      newStatus = 'Nested Backorder Generated & Material Delivery Pending';
    }

    const updateQuery = `
      UPDATE backorder_items
      SET status = $1,
          received_quantity = COALESCE(received_quantity, 0) + $2,
          reordered_quantity = $3
      WHERE backorder_sequence = $4
      RETURNING backorder_sequence, po_number, mpn, status, received_quantity, reordered_quantity;
    `;
    const updateResult = await db.query(updateQuery, [newStatus, received_quantity, reordered_quantity, backorder_sequence]);
    if (updateResult.rows.length === 0) {
      await db.query('ROLLBACK');
      throw new Error('Failed to update backorder item');
    }

    const updatedBackorderItem = updateResult.rows[0];

    let newBackorderSequence = null;
    if (reordered_quantity > 0) {
      // Generate a new backorder sequence for the nested backorder
      const sequenceResult = await db.query("SELECT nextval('backorder_seq') AS seq;");
      if (!sequenceResult.rows[0] || sequenceResult.rows[0].seq === undefined) {
        await db.query('ROLLBACK');
        throw new Error('Failed to generate backorder sequence');
      }
      newBackorderSequence = `BO-${sequenceResult.rows[0].seq}`;

      // Insert a new backorder item for the remaining quantity, linking it to the parent backorder
      const insertQuery = `
        INSERT INTO backorder_items (backorder_sequence, po_number, mpn, reordered_quantity, status, reference_backorder_sequence)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING backorder_sequence, po_number, mpn, reordered_quantity, status, reference_backorder_sequence;
      `;
      const insertResult = await db.query(insertQuery, [
        newBackorderSequence,
        po_number,
        mpn,
        reordered_quantity,
        'Nested Backorder & Material Delivery Pending',
        backorder_sequence, // Reference the parent backorder
      ]);
      if (insertResult.rows.length === 0) {
        await db.query('ROLLBACK');
        throw new Error('Failed to create nested backorder');
      }
    }

    // Send notifications to quality team (user_id: 3 and 4) if status changed
    if (old_status !== newStatus) {
      const message = `Backorder item for PO ${po_number} (MPN: ${mpn}) updated: ${newStatus}${newBackorderSequence ? `, new nested backorder ${newBackorderSequence} created` : ''}.`;
      const notificationQuery = `
        INSERT INTO notifications (user_id, umi, mrf_no, message, type, is_read, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)
        RETURNING id, user_id, umi, mrf_no, message, type, is_read, created_at;
      `;
      const notificationValues = [
        null, // umi
        null, // mrf_no
        message,
        newStatus === 'Backorder Completed' ? 'Backorder Completed' : 'Pending for Quality Check',
        false, // is_read
      ];

      // Notify quality_head (user_id: 3)
      const qualityHeadNotif = await db.query(notificationQuery, [3, ...notificationValues]);
      const qualityHeadNotification = qualityHeadNotif.rows[0];

      // Notify quality_employee (user_id: 4)
      const qualityEmployeeNotif = await db.query(notificationQuery, [4, ...notificationValues]);
      const qualityEmployeeNotification = qualityEmployeeNotif.rows[0];

      // Emit Socket.IO notifications
      const io = req.app.get('io');
      const userSocketMap = req.app.get('userSocketMap');
      if (io && userSocketMap) {
        const qualityHeadSocketId = userSocketMap.get('3');
        const qualityEmployeeSocketId = userSocketMap.get('4');

        if (qualityHeadSocketId) {
          io.to(qualityHeadSocketId).emit('notification', {
            ...qualityHeadNotification,
            created_at: new Date().toISOString(),
          });
          console.log(`Socket.IO notification emitted to quality_head (user_id: 3), socket_id: ${qualityHeadSocketId}`);
        } else {
          console.warn('No socket found for quality_head (user_id: 3)');
        }

        if (qualityEmployeeSocketId) {
          io.to(qualityEmployeeSocketId).emit('notification', {
            ...qualityEmployeeNotification,
            created_at: new Date().toISOString(),
          });
          console.log(`Socket.IO notification emitted to quality_employee (user_id: 4), socket_id: ${qualityEmployeeSocketId}`);
        } else {
          console.warn('No socket found for quality_employee (user_id: 4)');
        }
      }
    }

    await db.query('COMMIT');
    return res.status(200).json({
      message: `Backorder item for PO ${po_number} updated successfully`,
      data: updatedBackorderItem,
      newBackorderSequence,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error handling backorder of backorder:', error);
    return res.status(500).json({
      error: 'Failed to handle backorder of backorder',
      details: error.message,
    });
  }
};

const cancelRequest = async (req, res) => {
  const { umi } = req.params;
  const { reason, status } = req.body;
  const userId = req.user?.id; // Extracted from JWT by authentication middleware

  // Input validation
  if (!umi || typeof umi !== 'string' || umi.trim() === '') {
    return res.status(400).json({ error: 'Invalid or missing UMI' });
  }
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return res.status(400).json({ error: 'Reason is required and must be a non-empty string' });
  }
  if (status !== 'Request Cancelled') {
    return res.status(400).json({ error: 'Invalid status: Status must be "Request Cancelled"' });
  }
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: User ID not found in token' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Debug: Log query parameters
    console.log('Checking request with params:', { umi, userId });

    // Check if the UMI exists in noncoc_basket
    const existsQuery = `SELECT status FROM noncoc_basket WHERE umi = $1`;
    const existsResult = await client.query(existsQuery, [umi]);
    console.log('UMexists query result:', existsResult.rows);

    if (existsResult.rows.length === 0) {
      throw new Error(`Request with UMI ${umi} does not exist in noncoc_basket`);
    }

    // Verify the request's status
    if (existsResult.rows[0].status !== 'Head Approval Pending') {
      throw new Error(`Request ${umi} is not in "Head Approval Pending" status; current status: ${existsResult.rows[0].status}`);
    }

    // // Check if the user is authorized (matches user_id in material_issue_form)
    // const authQuery = `
    //   SELECT mif.user_id
    //   FROM material_issue_form mif
    //   WHERE mif.umi = $1
    // `;
    // const authResult = await client.query(authQuery, [umi]);
    // console.log('Authorization query result:', authResult.rows);

    // if (authResult.rows.length === 0) {
    //   throw new Error(`No material_issue_form record found for UMI ${umi}`);
    // }
    // if (authResult.rows[0].user_id != userId) { // Use != to handle type coercion
    //   throw new Error(`User ${userId} is not authorized to cancel request ${umi}; request belongs to user ${authResult.rows[0].user_id}`);
    // }

    // Update noncoc_basket with new status and reason
    const updateQuery = `
      UPDATE noncoc_basket
      SET status = $1, remark = $2, updated_at = CURRENT_TIMESTAMP
      WHERE umi = $3
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [status, reason, umi]);
    console.log('Update query result:', updateResult.rows);

    if (updateResult.rows.length === 0) {
      throw new Error(`Failed to update request ${umi} status`);
    }

    // Insert notification for inventory_head (user_id = 1)
    const notificationQuery = `
      INSERT INTO notifications (user_id, type, message, status, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    const notificationMessage = `Request ${umi} has been cancelled by user ${userId} with reason: ${reason}`;
    const notificationResult = await client.query(notificationQuery, [
      1, // Inventory head user ID
      'Request Cancelled',
      notificationMessage,
      'unread',
    ]);
    console.log('Notification created:', notificationResult.rows[0]);

    // Emit Socket.IO notification
    const io = req.app.get('socketio');
    if (io) {
      io.to(`user_${1}`).emit('notification', {
        id: notificationResult.rows[0].id,
        message: notificationMessage,
        type: 'Request Cancelled',
        created_at: new Date().toISOString(),
      });
      console.log('Socket.IO notification emitted for user_1');
    } else {
      console.warn('Socket.IO instance not found');
    }

    await client.query('COMMIT');
    return res.status(200).json({
      message: 'Request cancelled successfully',
      data: updateResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling request:', {
      message: error.message,
      stack: error.stack,
      umi,
      userId,
    });
    const statusCode = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 : 500;
    return res.status(statusCode).json({ error: error.message });
  } finally {
    client.release();
  }
};




module.exports = {
  getPendingNonCOCIssueRequests,
  getPastNonCOCIssuedRequests,
  getNonCOCIssueRequestDetails,
  submitNonCOCMaterialIssueForm,
  getPastIssuedRequestDetails,
  confirmReceipt,
  rejectNonCOCMaterialIssueForm,
  getAllPurchaseOrderComponents,
  updatePoStatus,
  updateBoStatus,
  handleBackorderOfBackorder,
  cancelRequest,
};