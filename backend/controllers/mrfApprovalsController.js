const { DateTime } = require("luxon");
const db = require("../db");

// Helper function to get the department from a role
const getDepartmentFromRole = (role) => {
  const match = role.match(/^(\w+)_(head|employee)$/);
  return match ? match[1] : null;
};

// Normalize user_name field in JSON objects
const normalizeUserName = (obj) => {
  if (!obj) return obj;
  return {
    ...obj,
    user_name: obj.user_name || obj.userName || obj.username || "Unknown",
    userName: undefined, // Clean up alternative field names
    username: undefined,
  };
};

// Fetch the next PO number
const getNextPoNumber = async (req, res) => {
  try {
    const { role } = req.user;
    const isPurchaseHead = role === "purchase_head";

    if (!isPurchaseHead) {
      return res
        .status(403)
        .json({
          error:
            "Unauthorized: Only Purchase Head can fetch the next PO number",
        });
    }

    // Start a transaction
    await db.query("BEGIN");

    // Fetch the last PO number from the sequence table
    const query = `
      SELECT last_po_number
      FROM po_number_sequence
      WHERE id = 1
      FOR UPDATE; -- Lock the row to prevent concurrent updates
    `;
    const result = await db.query(query);

    if (!result || result.rows.length === 0) {
      await db.query("ROLLBACK");
      console.error("No PO number sequence found in the database.");
      return res
        .status(500)
        .json({
          error: "Failed to fetch next PO number: No sequence data found",
        });
    }

    let lastPoNumber = result.rows[0].last_po_number;
    console.log(`Fetched last PO number: ${lastPoNumber}`);

    // Extract the numeric part and increment it
    const numericPart = parseInt(lastPoNumber.replace("PO", ""), 10);
    if (isNaN(numericPart)) {
      await db.query("ROLLBACK");
      console.error("Invalid PO number format:", lastPoNumber);
      return res
        .status(500)
        .json({
          error: "Failed to fetch next PO number: Invalid PO number format",
        });
    }

    const nextNumericPart = numericPart + 1;
    const nextPoNumber = `PO${nextNumericPart}`;
    console.log(`Generated next PO number: ${nextPoNumber}`);

    // Update the sequence table with the new PO number
    const updateQuery = `
      UPDATE po_number_sequence
      SET last_po_number = $1
      WHERE id = 1;
    `;
    await db.query(updateQuery, [nextPoNumber]);

    // Commit the transaction
    await db.query("COMMIT");

    return res.status(200).json({ poNumber: nextPoNumber });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error fetching next PO number:", error.stack);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// Fetch MRF approval requests
const getMrfApprovalRequests = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;

    if (!role || !user_id) {
      console.error("Missing role or user_id in req.user");
      return res
        .status(400)
        .json({ error: "User role or ID not found in request." });
    }

    console.log("Fetching MRF approval requests for user:", { role, user_id });

    const isAdmin = role === "admin";
    const isHead = role.endsWith("_head");
    const isCeo = role === "ceo";
    const department = getDepartmentFromRole(role);

    if (isHead && !department) {
      return res
        .status(400)
        .json({
          error: "Invalid role format: Department could not be determined.",
        });
    }

    if (!isHead && !isAdmin && !isCeo) {
      return res
        .status(403)
        .json({
          error:
            "Unauthorized: Only heads, admin, or CEO can view MRF approval requests",
        });
    }

    let query;
    let params = [];

    if (isAdmin) {
      query = `
        SELECT DISTINCT mrf.mrf_id, mrf.mrf_no, u.name, mrf.component_id, mrf.project_name, mrf.initial_requested_quantity, mrf.date, mrf.status, mrf.updated_requested_quantity, mrf.note, mrf.priority, mrf.updated_at, u.name AS user_name
        FROM material_request_form mrf
        JOIN users u ON mrf.user_id = u.id
        WHERE LOWER(mrf.status) IN (LOWER('Head Approval Pending'), LOWER('Inventory Approval Pending'), LOWER('Purchase Approval Pending'), LOWER('CEO Approval Pending'))
      `;
      params = [];
    } else if (isCeo) {
      query = `
        SELECT DISTINCT mrf.mrf_id, mrf.mrf_no,  u.name, mrf.component_id, mrf.project_name, mrf.initial_requested_quantity, mrf.date, mrf.status, mrf.updated_requested_quantity, mrf.note, mrf.priority, mrf.updated_at, u.name AS user_name
        FROM material_request_form mrf
        JOIN users u ON mrf.user_id = u.id
        WHERE LOWER(mrf.status) = LOWER('CEO Approval Pending')
      `;
      params = [];
    } else if (isHead) {
      if (role === "inventory_head") {
        query = `
          SELECT DISTINCT mrf.mrf_id, mrf.mrf_no,  u.name, mrf.component_id, mrf.project_name, mrf.initial_requested_quantity, mrf.date, mrf.status, mrf.updated_requested_quantity, mrf.note, mrf.priority, mrf.updated_at, u.name AS user_name
          FROM material_request_form mrf
          JOIN users u ON mrf.user_id = u.id
          WHERE LOWER(mrf.status) = LOWER('Inventory Approval Pending')
        `;
        params = [];
      } else if (role === "purchase_head") {
        query = `
          SELECT DISTINCT mrf.mrf_id, mrf.mrf_no,  u.name, mrf.component_id, mrf.project_name, mrf.initial_requested_quantity, mrf.date, mrf.status, mrf.updated_requested_quantity, mrf.note, mrf.priority, mrf.updated_at, u.name AS user_name
          FROM material_request_form mrf
          JOIN users u ON mrf.user_id = u.id
          WHERE LOWER(mrf.status) = LOWER('Purchase Approval Pending')
        `;
        params = [];
      } else {
        query = `
          SELECT DISTINCT mrf.mrf_id, mrf.mrf_no, u.name, mrf.component_id, mrf.project_name, mrf.initial_requested_quantity, mrf.date, mrf.status, mrf.updated_requested_quantity, mrf.note, mrf.priority, mrf.updated_at, u.name AS user_name
          FROM material_request_form mrf
          JOIN users u ON mrf.user_id = u.id
          JOIN roles r ON u.role_id = r.id
          WHERE LOWER(mrf.status) = LOWER('Head Approval Pending')
          AND r.role_name = $1
        `;
        params = [`${department}_employee`];
      }
    }

    console.log("Executing MRF approval query:", query, params);
    const result = await db.query(query, params);
    console.log("MRF approval query result:", result.rows);
    if (result.rows.length === 0) {
      console.warn(
        "No MRF approval requests found for the given status and role."
      );
    }
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching MRF approval requests:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// Fetch details of a specific MRF request for approval
const getMrfRequestDetails = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isHead = role.endsWith("_head");
    const isAdmin = role === "admin";
    const isCeo = role === "ceo";
    const department = getDepartmentFromRole(role);

    if (isHead && !department) {
      return res
        .status(400)
        .json({
          error: "Invalid role format: Department cannot be determined.",
        });
    }

    const { mrf_no } = req.params;
    const isPastApproved = req.query.past === "true";

    if (!isHead && !isAdmin && !isCeo) {
      return res
        .status(403)
        .json({
          error:
            "Unauthorized: Only heads, admin, or CEO can view MRF request details",
        });
    }

    let query;
    let params = [mrf_no];
    if (isAdmin) {
      query = `
        SELECT mrf.mrf_id, mrf.component_id, mrf.initial_requested_quantity, mrf.date AS created_at, mrf.status, mrf.mrf_no, 
               mrf.updated_requested_quantity, mrf.remark,mrf.mrf_timeline,
               mrf.note, mrf.priority, mrf.project_name, u.department AS user_department, u.name, mrf.quantity_change_history,  mrf.vendor,
      mrf.approx_price,
      mrf.expected_deliverydate,
      mrf.certificate_desired,
      mrf.vendor_link
        FROM material_request_form mrf
        JOIN users u ON mrf.user_id = u.id
        WHERE mrf.mrf_no = $1 AND mrf.status IN ('Head Approval Pending', 'Inventory Approval Pending', 'Purchase Approval Pending', 'CEO Approval Pending', 'CEO Approval Done' , 'Rejected');
      `;
    } else if (isCeo) {
      query = `
        SELECT mrf.mrf_id, mrf.component_id, mrf.initial_requested_quantity, mrf.date AS created_at, mrf.status, mrf.mrf_no, 
               mrf.updated_requested_quantity,  mrf.remark, mrf.mrf_timeline,
               mrf.note, mrf.priority, mrf.project_name, u.department AS user_department, u.name, mrf.quantity_change_history,
       mrf.vendor,
      mrf.approx_price,
      mrf.expected_deliverydate,
      mrf.certificate_desired,
      mrf.vendor_link
        FROM material_request_form mrf
        JOIN users u ON mrf.user_id = u.id
        WHERE mrf.mrf_no = $1 AND mrf.status IN ('CEO Approval Pending', 'CEO Approval Done', 'Rejected','PO Raised','Material Delivery Pending');
      `;
      params = [mrf_no];
    } else if (isHead) {
      if (role === "inventory_head") {
        query = `
          SELECT mrf.mrf_id, mrf.component_id, mrf.initial_requested_quantity, mrf.date AS created_at, mrf.status, mrf.mrf_no, 
                 mrf.updated_requested_quantity, mrf.remark, mrf.mrf_timeline,
                 mrf.note, mrf.priority, mrf.project_name, u.department AS user_department, u.name, mrf.quantity_change_history,
                  mrf.vendor,
      mrf.approx_price,
      mrf.expected_deliverydate,
      mrf.certificate_desired,
      mrf.vendor_link
          FROM material_request_form mrf
          JOIN users u ON mrf.user_id = u.id
          WHERE mrf.mrf_no = $1 AND mrf.status IN ('Inventory Approval Pending', 'Purchase Approval Pending', 'CEO Approval Pending', 'CEO Approval Done', 'Rejected', 'PO Raised','Material Delivery Pending');
        `;
        params = [mrf_no];
      } else if (role === "purchase_head") {
        query = `
          SELECT mrf.mrf_id, mrf.component_id, mrf.initial_requested_quantity, mrf.date AS created_at, mrf.status, mrf.mrf_no, 
                 mrf.updated_requested_quantity, mrf.remark, mrf.mrf_timeline,
                 mrf.note, mrf.priority, mrf.project_name, u.department AS user_department, u.name, mrf.quantity_change_history,
                  mrf.vendor,
      mrf.approx_price,
      mrf.expected_deliverydate,
      mrf.certificate_desired,
      mrf.vendor_link
          FROM material_request_form mrf
          JOIN users u ON mrf.user_id = u.id
          WHERE mrf.mrf_no = $1 AND mrf.status IN ('Purchase Approval Pending', 'CEO Approval Pending', 'CEO Approval Done', 'Rejected','PO Raised', 'Material Delivery Pending','Rejected by Purchase');
        `;
        params = [mrf_no];
      } else {
        if (isPastApproved) {
          query = `
            SELECT mrf.mrf_id, mrf.component_id, mrf.initial_requested_quantity, mrf.date AS created_at, mrf.status, mrf.mrf_no, 
                   mrf.updated_requested_quantity, mrf.remark, mrf.mrf_timeline, 
                   mrf.note, mrf.priority, mrf.project_name, u.department AS user_department, u.name, mrf.quantity_change_history,
                    mrf.vendor,
      mrf.approx_price,
      mrf.expected_deliverydate,
      mrf.certificate_desired,
      mrf.vendor_link
            FROM material_request_form mrf
            JOIN users u ON mrf.user_id = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE mrf.mrf_no = $1 AND mrf.status IN ('Head Approval Pending','Inventory Approval Pending', 'Purchase Approval Pending', 'CEO Approval Pending', 'CEO Approval Done', ' Accepted', 'Rejected', 'PO Raised', 'Material Delivery Pending', 'Rejected by Head','Rejected by Purchase')
            AND EXISTS (
              SELECT 1 FROM roles r2 JOIN users u2 ON r2.id = u2.role_id
              WHERE u2.id = mrf.user_id AND r2.role_name = $2
            );
          `;
          params = [mrf_no, `${department}_employee`];
        } else {
          query = `
            SELECT mrf.mrf_id, mrf.component_id, mrf.initial_requested_quantity, mrf.date AS created_at, mrf.status, mrf.mrf_no, 
                   mrf.updated_requested_quantity,  mrf.remark, mrf.mrf_timeline,
                   mrf.note, mrf.priority, mrf.project_name, u.department AS user_department, u.name, mrf.quantity_change_history,
                    mrf.vendor,
      mrf.approx_price,
      mrf.expected_deliverydate,
      mrf.certificate_desired,
      mrf.vendor_link
            FROM material_request_form mrf
            JOIN users u ON mrf.user_id = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE mrf.mrf_no = $1 
            AND (
              (mrf.status = 'Head Approval Pending' AND r.role_name = $2)
              OR EXISTS (
                SELECT 1 
                FROM noncoc_basket nb
                JOIN users u2 ON nb.user_id = u2.id
                JOIN roles r2 ON u2.role_id = r2.id
                WHERE nb.mrf_no = mrf.mrf_no 
                AND r2.role_name = $2
                AND nb.status IN ('Head Approval Pending', 'Inventory Approval Pending', 'Issued')
              )
            );
          `;
          params = [mrf_no, `${department}_employee`];
        }
      }
    }

    console.log("Executing query for details:", query, params);
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: `No request found for this MRF No: ${mrf_no}` });
    }

    const detailedItems = await Promise.all(
      result.rows.map(async (item) => {
        const componentQuery = `
          SELECT item_description, mpn, on_hand_quantity, part_no, make,uom
          FROM non_coc_components
          WHERE component_id = $1;
        `;
        const componentResult = await db.query(componentQuery, [
          item.component_id,
        ]);
        const component = componentResult.rows[0] || {};

        // Normalize quantity_change_history
        const quantityChangeHistory = Array.isArray(
          item.quantity_change_history
        )
          ? item.quantity_change_history.map(normalizeUserName)
          : [];

        // Normalize note
        let normalizedNote;
        if (typeof item.note === "string" && item.note) {
          normalizedNote = [
            {
              timestamp: new Date().toISOString(),
              user_name: "Unknown",
              role: "Unknown",
              content: item.note,
            },
          ];
        } else {
          normalizedNote = Array.isArray(item.note)
            ? item.note.map(normalizeUserName)
            : [];
        }

        return {
          ...item,
          item_description: component.item_description || "N/A",
          mpn: component.mpn || "N/A",
          on_hand_quantity: component.on_hand_quantity || 0,
          part_no: component.part_no || "N/A",
          make: component.make || "N/A",
          uom: component.uom || "N/A",
          quantity_change_history: quantityChangeHistory,
          note: normalizedNote,
          vendor: item.vendor || "",
          approx_price: item.approx_price || "",
          expected_deliverydate: item.expected_deliverydate || "",
          certificate_desired: item.certificate_desired || false,
          vendor_link: item.vendor_link || "",
        };
      })
    );

    return res.status(200).json(detailedItems);
  } catch (error) {
    console.error("Error fetching MRF request details:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// Fetch past MRF approved requests
const getPastMrfApprovedRequests = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isAdmin = role === "admin";
    const isCeo = role === "ceo";
    const isHead = role.endsWith("_head");
    const department = getDepartmentFromRole(role);

    if (!isHead && !isAdmin && !isCeo) {
      return res
        .status(403)
        .json({
          error:
            "Unauthorized: Only heads, CEO, or admin can view past approved requests",
        });
    }

    const currentDate = new Date().toISOString().slice(0, 10);
    let query = `
      SELECT mrf.mrf_no, mrf.project_name, u.name, mrf.date, mrf.status, mrf.note, mrf.priority
      FROM material_request_form mrf
      JOIN users u ON mrf.user_id = u.id
    `;
    let params = [currentDate];

    if (isCeo) {
      query += `
        WHERE DATE_TRUNC('day', mrf.date) <= $1 AND mrf.status IN ('CEO Approval Done', 'Rejected', 'PO Raised')
      `;
    } else if (isHead && department) {
      let pastApprovedStatuses;
      if (department === "inventory") {
        pastApprovedStatuses = [
          "Purchase Approval Pending",
          "CEO Approval Pending",
          "CEO Approval Done",
          "Rejected",
          "PO Raised",
          "Material Delivery Pending",
          "Rejected by Purchase"
        ];
      } else if (department === "purchase") {
        pastApprovedStatuses = [
          "CEO Approval Pending",
          "CEO Approval Done",
          "Rejected",
          "PO Raised",
          "Material Delivery Pending",
          "Rejected by Purchase"
        ];
      } else {
        pastApprovedStatuses = [
          "Inventory Approval Pending",
          "Purchase Approval Pending",
          "CEO Approval Pending",
          "CEO Approval Done",
          "Rejected",
          "PO Raised",
          "Material Delivery Pending",
          "Rejected by Head",
          "Rejected by Purchase"
        ];
      }

      query += `
        JOIN roles r ON u.role_id = r.id
        WHERE DATE_TRUNC('day', mrf.date) <= $1 AND mrf.status = ANY($2)
      `;
      params.push(pastApprovedStatuses);
    } else if (isAdmin) {
      query += `
        WHERE DATE_TRUNC('day', mrf.date) <= $1 AND mrf.status IN ('CEO Approval Done')
      `;
    }

    query += `
      ORDER BY mrf.date DESC;
    `;

    const result = await db.query(query, params);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching past approved MRF requests:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

const approveMrfRequest = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isHead = role.endsWith("_head");
    const isAdmin = role === "admin";
    const isCeo = role === "ceo";

    if (!isHead && !isAdmin && !isCeo) {
      return res.status(403).json({
        error: "Unauthorized: Only heads, admin, or CEO can approve MRF requests",
      });
    }

    const { mrf_no } = req.params;
    const { updatedItems, note, priority, prioritySetBy, currentUserNotes = {} } = req.body;

    if (!updatedItems || !Array.isArray(updatedItems) || updatedItems.length === 0) {
      return res.status(400).json({
        error: "Invalid request: updatedItems must be a non-empty array",
      });
    }

    // Validate each item in updatedItems
    const invalidItem = updatedItems.find(
      item => !item.mrf_id || !item.component_id || item.updated_requested_quantity === undefined || item.updated_requested_quantity < 0
    );
    if (invalidItem) {
      return res.status(400).json({ error: "Invalid item in updatedItems: missing mrf_id, component_id, or invalid quantity" });
    }

    // Fetch user_name
    const userQuery = `SELECT name FROM users WHERE id = $1;`;
    const userResult = await db.query(userQuery, [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: `User with ID ${user_id} not found` });
    }
    const userName = userResult.rows[0].name;

    // Define rejectionStatus based on user_id
    let rejectionStatus;
    switch (user_id) {
      case "3":
        rejectionStatus = "Rejected by Head";
        break;
      case "1":
        rejectionStatus = "Rejected by Inventory";
        break;
      case "6":
        rejectionStatus = "Rejected by Purchase";
        break;
      case "7":
        rejectionStatus = "Rejected by CEO";
        break;
      default:
        rejectionStatus = `Rejected by ${userName}`;
    }

    // Fetch all components for the MRF
    const allComponentsQuery = `
      SELECT component_id, status, initial_requested_quantity, updated_requested_quantity, quantity_change_history, remark, note
      FROM material_request_form
      WHERE mrf_no = $1;
    `;
    const allComponentsResult = await db.query(allComponentsQuery, [mrf_no]);
    if (allComponentsResult.rows.length === 0) {
      return res.status(404).json({ error: `No components found for MRF No ${mrf_no}` });
    }

    await db.query("BEGIN");

    let approvableItems = 0;
    let rejectableItems = 0;
    const updatedComponentIds = updatedItems.map(item => item.component_id);
    const updatedComponents = [];

    // Process approved items with component-specific notes
    for (const item of updatedItems) {
      const validateQuery = `
        SELECT status, initial_requested_quantity, updated_requested_quantity, quantity_change_history, remark, vendor, vendor_link, approx_price, expected_deliverydate, certificate_desired
        FROM material_request_form
        WHERE mrf_no = $1 AND component_id = $2;
      `;
      const validateResult = await db.query(validateQuery, [mrf_no, item.component_id]);
      if (validateResult.rows.length === 0) {
        throw new Error(`No item found with component_id ${item.component_id} for MRF No ${mrf_no}`);
      }

      const currentItem = validateResult.rows[0];
      const currentStatus = currentItem.status;
      let nextStatus = null;

      // Determine next status
      switch (currentStatus) {
        case "Head Approval Pending":
          nextStatus = "Inventory Approval Pending";
          break;
        case "Inventory Approval Pending":
          nextStatus = "Purchase Approval Pending";
          break;
        case "Purchase Approval Pending":
          nextStatus = "CEO Approval Pending";
          break;
        case "CEO Approval Pending":
          nextStatus = "CEO Approval Done";
          break;
        default:
          if (currentStatus.startsWith("Rejected by")) {
            console.warn(`Skipping component ${item.component_id} with rejected status: ${currentStatus}`);
            continue;
          }
          throw new Error(`Invalid status ${currentStatus} for component ${item.component_id}`);
      }

      const oldQuantity = currentItem.updated_requested_quantity !== null
        ? currentItem.updated_requested_quantity
        : currentItem.initial_requested_quantity;
      const newQuantity = item.updated_requested_quantity;

      let quantityChangeHistory = currentItem.quantity_change_history || [];
      let currentRemark = currentItem.remark || "";

      if (oldQuantity !== newQuantity) {
        quantityChangeHistory.push({
          timestamp: new Date().toISOString(),
          user_name: userName,
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          remark: item.remark || "Quantity updated during approval",
        });
        currentRemark = item.remark || currentRemark;
      }

      // Use component-specific notes from updatedItems
      const componentNotes = item.notes || [];
      const updatedNote = Array.isArray(currentItem.note) ? [...currentItem.note, ...componentNotes.filter(n => n.content?.trim())] : componentNotes;

      // Update approved component
      const updateQuery = `
        UPDATE material_request_form
        SET
          status = $1,
          updated_requested_quantity = $2,
          quantity_change_history = $3,
          remark = $4,
          note = $5,
          vendor = $6,
          vendor_link = $7,
          approx_price = $8,
          expected_deliverydate = $9,
          certificate_desired = $10,
          amount = $11,
          rate_per_unit = $12,
          updated_at = NOW()
        WHERE mrf_no = $13 AND component_id = $14
        RETURNING *;
      `;
      const updateValues = [
        nextStatus,
        newQuantity,
        JSON.stringify(quantityChangeHistory),
        currentRemark,
        JSON.stringify(updatedNote),
        item.vendor || null,
        item.vendor_link || null,
        item.approx_price || null,
        item.expected_deliverydate || null,
        item.certificate_desired || false,
        item.amount || 0,
        item.rate_per_unit || 0,
        mrf_no,
        item.component_id,
      ];
      const updateResult = await db.query(updateQuery, updateValues);
      updatedComponents.push(updateResult.rows[0]);
      approvableItems++;
    }

    // Reject non-selected components with their own notes
    const nonSelectedComponents = allComponentsResult.rows.filter(
      component => !updatedComponentIds.includes(component.component_id) && !component.status.startsWith("Rejected by")
    );
    for (const component of nonSelectedComponents) {
      const rejectQuery = `
        UPDATE material_request_form
        SET
          status = $1,
          remark = $2,
          note = $3,
          updated_at = NOW()
        WHERE mrf_no = $4 AND component_id = $5
        RETURNING *;
      `;
      const currentNotesQuery = `
        SELECT note FROM material_request_form WHERE mrf_no = $1 AND component_id = $2;
      `;
      const currentNotesResult = await db.query(currentNotesQuery, [mrf_no, component.component_id]);
      const existingNotes = currentNotesResult.rows[0]?.note || [];
      const componentNotes = currentUserNotes[component.component_id]?.filter(note => note.content?.trim()) || [];
      const updatedNote = Array.isArray(existingNotes) ? [...existingNotes, ...componentNotes] : componentNotes;

      const rejectValues = [
        rejectionStatus,
        component.remark || `Rejected by ${userName} during approval`,
        JSON.stringify(updatedNote),
        mrf_no,
        component.component_id,
      ];
      const rejectResult = await db.query(rejectQuery, rejectValues);
      updatedComponents.push(rejectResult.rows[0]);
      rejectableItems++;
    }

    // Update MRF priority if provided
    if (priority && prioritySetBy) {
      await db.query(
        `UPDATE material_request_form SET priority = $1, priority_set_by = $2 WHERE mrf_no = $3`,
        [priority, prioritySetBy, mrf_no]
      );
    }

    await db.query("COMMIT");

    // Send notifications (simplified)
    const io = req.app.get("io");
    if (approvableItems > 0) {
      const notificationMessage = `${approvableItems} component(s) approved for MRF ${mrf_no} by ${userName}`;
      io.emit("mrfApprovalUpdate", { mrf_no, message: notificationMessage });
    }
    if (rejectableItems > 0) {
      const notificationMessage = `${rejectableItems} component(s) rejected for MRF ${mrf_no} by ${userName}`;
      io.emit("mrfApprovalUpdate", { mrf_no, message: notificationMessage });
    }

    return res.status(200).json({
      message: `${approvableItems} component(s) approved, ${rejectableItems} component(s) rejected`,
      updatedComponents,
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error approving MRF request:", error);
    return res.status(500).json({ error: error.message || "Failed to approve MRF request" });
  }
};


const rejectMrfRequest = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isHead = role.endsWith("_head");
    const isAdmin = role === "admin";
    const isCeo = role === "ceo";
    const department = getDepartmentFromRole(role);

    if (!isHead && !isAdmin && !isCeo) {
      return res
        .status(403)
        .json({
          error: "Unauthorized: Only heads, admin, or CEO can reject MRF requests",
        });
    }

    const { mrf_no } = req.params;
    const { note, reason, updatedItems } = req.body;
    const io = req.app.get("io"); // Socket.IO instance

    // Validate updatedItems
    if (!updatedItems || !Array.isArray(updatedItems) || updatedItems.length === 0) {
      return res
        .status(400)
        .json({
          error: "Invalid request: updatedItems must be a non-empty array",
        });
    }

    const invalidItem = updatedItems.find(
      (item) => !item.mrf_id || !item.component_id
    );
    if (invalidItem) {
      return res.status(400).json({ error: "Invalid item in updatedItems" });
    }

    // Fetch the user_name based on user_id
    const userQuery = `
      SELECT name FROM users WHERE id = $1;
    `;
    const userResult = await db.query(userQuery, [user_id]);
    if (userResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: `User with ID ${user_id} not found` });
    }
    const userName = userResult.rows[0].name;

    // Fetch all components for the MRF
    const allComponentsQuery = `
      SELECT component_id, status, initial_requested_quantity, updated_requested_quantity, quantity_change_history, remark, note
      FROM material_request_form
      WHERE mrf_no = $1;
    `;
    const allComponentsResult = await db.query(allComponentsQuery, [mrf_no]);
    if (allComponentsResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: `No components found for MRF No ${mrf_no}` });
    }

    await db.query("BEGIN");

    // Fetch the MRF details, including the original requester's user_id
    const mrfQuery = `
      SELECT note, user_id AS requester_id, status
      FROM material_request_form
      WHERE mrf_no = $1 LIMIT 1;
    `;
    const mrfResult = await db.query(mrfQuery, [mrf_no]);
    if (mrfResult.rows.length === 0) {
      await db.query("ROLLBACK");
      return res
        .status(404)
        .json({ error: `No item found with mrf_no ${mrf_no}` });
    }

    const mrf = mrfResult.rows[0];
    const requesterId = mrf.requester_id;
    const currentNotes = mrf.note || [];

    // Determine  status based on user_id
    let Status;
    switch (user_id) {
      case 3:
        Status = "Rejected by Head";
        break;
      case 1:
        Status = "Rejected by Inventory";
        break;
      case 6:
        Status = "Rejected by Purchase";
        break;
      case 7:
        Status = "Rejected by CEO";
        break;
      default:
        Status = "Rejected";
    }

    // Determine approval status based on current status
    const getNextApprovalStatus = (currentStatus) => {
      if (currentStatus === "Head Approval Pending") return "Inventory Approval Pending";
      if (currentStatus === "Inventory Approval Pending") return "Purchase Approval Pending";
      if (currentStatus === "Purchase Approval Pending") return "CEO Approval Pending";
      if (currentStatus === "CEO Approval Pending") return "CEO Approval Done";
      return null;
    };

    let rejectableItems = 0;
    let approvableItems = 0;
    const updatedComponentIds = updatedItems.map(item => item.component_id);

    // Handle notes for rejection
    let updatedNotes = Array.isArray(currentNotes) ? [...currentNotes] : [];
    if (reason && reason.trim()) {
      updatedNotes.push({
        timestamp: new Date().toISOString(),
        user_name: userName,
        content: reason.trim(),
      });
    } else if (note && note.content && note.content.trim()) {
      updatedNotes.push({
        timestamp: new Date().toISOString(),
        user_name: userName,
        content: note.content.trim(),
      });
    } else if (Array.isArray(note) && note.length > 0) {
      note.forEach((n) => {
        if (n.content && n.content.trim()) {
          updatedNotes.push({
            timestamp: new Date().toISOString(),
            user_name: userName,
            content: n.content.trim(),
          });
        }
      });
    } else {
      updatedNotes.push({
        timestamp: new Date().toISOString(),
        user_name: userName,
        content: "No reason provided for rejection",
      });
    }

    // Update selected components (reject them)
    for (const item of updatedItems) {
      const validateQuery = `
        SELECT note, remark, status
        FROM material_request_form
        WHERE mrf_no = $1 AND component_id = $2;
      `;
      const validateResult = await db.query(validateQuery, [mrf_no, item.component_id]);
      if (validateResult.rows.length === 0) {
        await db.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: `No item found with component_id ${item.component_id} for MRF No ${mrf_no}` });
      }

      const currentItem = validateResult.rows[0];
      const currentStatus = currentItem.status;
      if (currentStatus && currentStatus.startsWith("Rejected by")) {
        console.warn(`Skipping component ${item.component_id} with rejected status: ${currentStatus}`);
        continue;
      }

      let currentRemark = currentItem.remark || "";
      if (item.remark && item.remark.trim()) {
        currentRemark = currentRemark
          ? `${currentRemark} \n ${userName}: ${item.remark}`
          : `${userName}: ${item.remark}`;
      }

      const updateQuery = `
        UPDATE material_request_form
        SET status = $1, note = $2, remark = $3, updated_at = NOW()
        WHERE mrf_no = $4 AND component_id = $5
        RETURNING mrf_no, component_id, status, note, remark;
      `;
      const updateResult = await db.query(updateQuery, [
        Status,
        JSON.stringify(updatedNotes),
        currentRemark,
        mrf_no,
        item.component_id,
      ]);

      if (updateResult.rows.length === 0) {
        await db.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: `No item found with component_id ${item.component_id} for MRF No ${mrf_no}` });
      }
      rejectableItems++;
    }

    // Update non-selected components (approve them)
    const nonSelectedComponents = allComponentsResult.rows.filter(
      item => !updatedComponentIds.includes(item.component_id) && !item.status.startsWith("Rejected by")
    );

    for (const item of nonSelectedComponents) {
      const nextStatus = getNextApprovalStatus(item.status);
      if (!nextStatus) {
        console.warn(`Skipping component ${item.component_id} with invalid status: ${item.status}`);
        continue;
      }

      let itemNotes = item.note || [];
      itemNotes = Array.isArray(itemNotes) ? [...itemNotes] : [];
      itemNotes.push({
        timestamp: new Date().toISOString(),
        user_name: userName,
        content: "Automatically approved as it was not selected for rejection",
      });

      let updateQuery = `
        UPDATE material_request_form
        SET status = $1, note = $2, updated_at = NOW()
        WHERE mrf_no = $3 AND component_id = $4
        RETURNING mrf_no, component_id, status, note;
      `;
      let params = [
        nextStatus,
        JSON.stringify(itemNotes),
        mrf_no,
        item.component_id,
      ];

      if (
        isHead &&
        department &&
        item.status === "Head Approval Pending" &&
        role !== "purchase_head" &&
        role !== "inventory_head" &&
        role !== "ceo"
      ) {
        updateQuery = `
          UPDATE material_request_form mrf
          SET status = $1, note = $2, updated_at = NOW()
          FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE mrf.mrf_no = $3 AND mrf.component_id = $4
          AND r.role_name = $5
          RETURNING mrf.mrf_no, mrf.component_id, mrf.status, mrf.note;
        `;
        params = [
          nextStatus,
          JSON.stringify(itemNotes),
          mrf_no,
          item.component_id,
          `${department}_employee`,
        ];
      }

      console.log("Executing update query for approval:", updateQuery, "with params:", params);
      const updateResult = await db.query(updateQuery, params);
      if (updateResult.rows.length === 0) {
        throw new Error(`No item found with component_id ${item.component_id} for MRF No ${mrf_no} after validation`);
      }
      console.log("Approval Update Result:", updateResult.rows[0]);
      approvableItems++;
    }

    if (rejectableItems === 0 && approvableItems === 0) {
      await db.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "No components with a valid pending status were found to process" });
    }

    // Notification Logic
    let targetUserId = null;
    let message = "";
    const updatedStatuses = await Promise.all(nonSelectedComponents.map(async (item) => {
      const currentItemResult = await db.query(
        `SELECT status FROM material_request_form WHERE mrf_no = $1 AND component_id = $2`,
        [mrf_no, item.component_id]
      );
      return currentItemResult.rows[0]?.status;
    }));
    const validStatuses = updatedStatuses.filter(status => status);
    const finalNextStatus = validStatuses.length > 0 ? validStatuses[validStatuses.length - 1] : null;

    if (finalNextStatus) {
      if (finalNextStatus === "Inventory Approval Pending") {
        targetUserId = 1; // inventory_head
        message = `New MRF request MRF ${mrf_no} pending your approval`;
      } else if (finalNextStatus === "Purchase Approval Pending") {
        targetUserId = 6; // purchase_head
        message = `New MRF request MRF ${mrf_no} pending your approval`;
      } else if (finalNextStatus === "CEO Approval Pending") {
        targetUserId = 7; // ceo
        message = `New MRF request MRF ${mrf_no} pending your approval`;
      } else if (finalNextStatus === "CEO Approval Done") {
        targetUserId = requesterId;
        message = `Your MRF request MRF ${mrf_no} has been approved`;
      }
    }

    // Notify original requester for rejected components
    if (rejectableItems > 0) {
      const rejectMessage = `Your MRF request MRF ${mrf_no} has components rejected (${Status})`;
      const notifResult = await db.query(
        `INSERT INTO notifications (user_id, umi, mrf_no, type, message, status, is_read, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL)
         RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
        [requesterId, null, mrf_no, "mrf", rejectMessage, Status, false]
      );
      const rejectNotification = notifResult.rows[0];
      console.log(`Rejection notification created for user_id: ${requesterId}:`, rejectNotification);

      if (io) {
        const userSocketMap = req.app.get("userSocketMap");
        const socketId = userSocketMap.get(requesterId.toString());
        if (socketId) {
          io.to(socketId).emit("notification", rejectNotification);
          console.log(`Socket.IO rejection notification emitted to user_id: ${requesterId}, socket_id: ${socketId} for MRF ${mrf_no}`);
        } else {
          console.warn(`No socket found for user_id: ${requesterId}`);
        }
      }
    }

    if (targetUserId && finalNextStatus) {
      const notifResult = await db.query(
        `INSERT INTO notifications (user_id, umi, mrf_no, type, message, status, is_read, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL)
         RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
        [targetUserId, null, mrf_no, "mrf", message, finalNextStatus, false]
      );
      const notification = notifResult.rows[0];
      console.log(`Approval notification created for user_id: ${targetUserId}:`, notification);

      if (io) {
        const userSocketMap = req.app.get("userSocketMap");
        const socketId = userSocketMap.get(targetUserId.toString());
        if (socketId) {
          io.to(socketId).emit("notification", notification);
          console.log(`Socket.IO approval notification emitted to user_id: ${targetUserId}, socket_id: ${socketId} for MRF ${mrf_no}`);
        } else {
          console.warn(`No socket found for user_id: ${targetUserId}`);
        }
      }
    }

    await db.query("COMMIT");
    return res
      .status(200)
      .json({
        message: `MRF request components processed successfully: ${rejectableItems} rejected, ${approvableItems} approved`,
      });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error processing MRF request:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// New controller to search MRF components for Purchase/CEO approval
const searchMrfComponents = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isPurchaseHead = role === "purchase_head";
    const isCeo = role === "ceo";

    if (!isPurchaseHead && !isCeo) {
      return res
        .status(403)
        .json({
          error:
            "Unauthorized: Only Purchase Head or CEO can search MRF components",
        });
    }

    const { part_no, mpn, created_at } = req.query;
    let query = `
      SELECT 
        mrf.mrf_no,
        mrf.project_name,
        mrf.status,
        mrf.initial_requested_quantity,
        mrf.updated_requested_quantity,
        mrf.note,
        mrf.remark,
        mrf.vendor,
        mrf.date AS created_at,
        ncc.item_description,
        ncc.mpn,
        ncc.make,
        ncc.part_no,
        ncc.on_hand_quantity,
        u.name
      FROM material_request_form mrf
      JOIN non_coc_components ncc ON mrf.component_id = ncc.component_id
      JOIN users u ON mrf.user_id = u.id
      WHERE 1=1
    `;
    let params = [];
    let paramIndex = 1;

    // Role-based status filter
    if (isPurchaseHead) {
      query += ` AND mrf.status = 'Purchase Approval Pending'`;
    } else if (isCeo) {
      query += ` AND mrf.status = 'CEO Approval Pending'`;
    }

    // Search filters
    if (part_no) {
      query += ` AND LOWER(ncc.part_no) LIKE LOWER($${paramIndex})`;
      params.push(`%${part_no}%`);
      paramIndex++;
    }
    if (mpn) {
      query += ` AND LOWER(ncc.mpn) LIKE LOWER($${paramIndex})`;
      params.push(`%${mpn}%`);
      paramIndex++;
    }
    if (created_at) {
      query += ` AND DATE_TRUNC('day', mrf.date) = $${paramIndex}`;
      params.push(created_at);
      paramIndex++;
    }

    query += ` ORDER BY mrf.date DESC`;

    console.log("Executing MRF component search query:", query, params);
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      console.warn("No MRF components found for the given filters.");
      return res.status(200).json([]);
    }

    // Normalize note field
    const normalizedRows = result.rows.map((row) => {
      let normalizedNote = [];
      if (typeof row.note === "string" && row.note) {
        normalizedNote = [
          {
            timestamp: new Date().toISOString(),
            user_name: "Unknown",
            role: "Unknown",
            content: row.note,
          },
        ];
      } else if (Array.isArray(row.note)) {
        normalizedNote = row.note.map(normalizeUserName);
      }
      return {
        ...row,
        note: normalizedNote,
      };
    });

    return res.status(200).json(normalizedRows);
  } catch (error) {
    console.error("Error searching MRF components:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// Add to mrfApprovalsController.js
const confirmReceipt = async (req, res) => {
  try {
    const { mrf_no } = req.params;
    const { id: user_id } = req.user;
    const io = req.app.get("io");

    // Validate user
    const userQuery = `
      SELECT name FROM users WHERE id = $1;
    `;
    const userResult = await db.query(userQuery, [user_id]);
    if (userResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: `User with ID ${user_id} not found` });
    }
    const userName = userResult.rows[0].name;

    await db.query("BEGIN");

    // Check if the MRF exists and get the requester's user_id
    const mrfQuery = `
      SELECT user_id AS requester_id, status
      FROM material_request_form
      WHERE mrf_no = $1;
    `;
    const mrfResult = await db.query(mrfQuery, [mrf_no]);
    if (mrfResult.rows.length === 0) {
      await db.query("ROLLBACK");
      return res
        .status(404)
        .json({ error: `No request found for MRF No ${mrf_no}` });
    }
    const requesterId = mrfResult.rows[0].requester_id;
    const currentStatus = mrfResult.rows[0].status;

    // Optional: Add a status check to ensure the MRF is in the correct state
    if (
      currentStatus !== "CEO Approval Pending" &&
      currentStatus !== "CEO Approval Done"
    ) {
      await db.query("ROLLBACK");
      return res
        .status(400)
        .json({
          error: `Cannot confirm receipt for MRF No ${mrf_no} with status ${currentStatus}`,
        });
    }

    // Update the MRF status to 'Request Accepted'
    const updateQuery = `
      UPDATE material_request_form
      SET status = $1, updated_at = NOW()
      WHERE mrf_no = $2
      RETURNING mrf_no, status;
    `;
    const updateResult = await db.query(updateQuery, [
      "CEO Approval Done",
      mrf_no,
    ]);
    if (updateResult.rows.length === 0) {
      await db.query("ROLLBACK");
      return res
        .status(404)
        .json({ error: `Failed to update MRF No ${mrf_no}` });
    }

    // Create a notification for the requester
    const message = `Receipt confirmed for your MRF request MRF ${mrf_no}`;
    const notifResult = await db.query(
      `INSERT INTO notifications (user_id, umi, mrf_no, type, message, status, is_read, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL)
       RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
      [requesterId, null, mrf_no, "mrf", message, "CEO Approval Done", false]
    );

    const notification = notifResult.rows[0];
    console.log(
      `Notification created for user_id: ${requesterId}:`,
      notification
    );

    // Emit the notification via Socket.IO
    if (io) {
      const userSocketMap = req.app.get("userSocketMap");
      const socketId = userSocketMap.get(requesterId.toString());
      if (socketId) {
        io.to(socketId).emit("notification", notification);
        console.log(
          `Socket.IO notification emitted to user_id: ${requesterId}, socket_id: ${socketId} for MRF ${mrf_no}`
        );
      } else {
        console.warn(`No socket found for user_id: ${requesterId}`);
      }
    }

    await db.query("COMMIT");
    return res
      .status(200)
      .json({
        message: `Receipt confirmed for MRF ${mrf_no}`,
        status: "CEO Approval Done",
      });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error confirming MRF receipt:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

const searchMrfComponentsForPurchaseHead = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isPurchaseHead = role === "purchase_head";

    if (!isPurchaseHead) {
      return res
        .status(403)
        .json({
          error: "Unauthorized: Only Purchase Head can search MRF components",
        });
    }

    const { part_no, mpn, created_at } = req.query;
    let query = `
      SELECT 
        mrf.mrf_no,
        mrf.project_name,
        mrf.status,
        mrf.vendor,
        mrf.initial_requested_quantity,
        mrf.updated_requested_quantity,
        mrf.date AS created_at,
        ncc.item_description,
        ncc.mpn,
        ncc.make,
        ncc.part_no,
        ncc.uom,
        ncc.on_hand_quantity,
        u.name
      FROM material_request_form mrf
      JOIN non_coc_components ncc ON mrf.component_id = ncc.component_id
      JOIN users u ON mrf.user_id = u.id
      WHERE mrf.status = 'CEO Approval Done'
    `;
    let params = [];
    let paramIndex = 1;

    // Search filters
    if (part_no) {
      query += ` AND LOWER(ncc.part_no) LIKE LOWER($${paramIndex})`;
      params.push(`%${part_no}%`);
      paramIndex++;
    }
    if (mpn) {
      query += ` AND LOWER(ncc.mpn) LIKE LOWER($${paramIndex})`;
      params.push(`%${mpn}%`);
      paramIndex++;
    }
    if (created_at) {
      query += ` AND DATE_TRUNC('day', mrf.date) = $${paramIndex}`;
      params.push(created_at);
      paramIndex++;
    }

    query += ` ORDER BY mrf.date DESC`;

    console.log(
      "Executing MRF component search query for Purchase Head:",
      query,
      params
    );
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      console.warn("No MRF components found for the given filters.");
      return res.status(200).json([]);
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error searching MRF components for Purchase Head:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

const searchMrfComponentsForPORaised = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const isPurchaseHead = role === "purchase_head";

    if (!isPurchaseHead) {
      return res
        .status(403)
        .json({
          error: "Unauthorized: Only Purchase Head can search MRF components",
        });
    }

    const { part_no, mpn, created_at } = req.query;
    let query = `
      SELECT 
        mrf.mrf_no,
        mrf.project_name,
        mrf.status,
        mrf.initial_requested_quantity,
        mrf.updated_requested_quantity,
        mrf.date AS created_at,
        ncc.item_description,
        ncc.mpn,
        ncc.make,
        ncc.part_no,
        ncc.uom,
        ncc.on_hand_quantity,
        u.name,
        po.po_number,
        po.vendor_name,
        po.quotation_no
      FROM material_request_form mrf
      JOIN non_coc_components ncc ON mrf.component_id = ncc.component_id
      JOIN users u ON mrf.user_id = u.id
      LEFT JOIN purchase_orders po ON mrf.mrf_no = po.mrf_no
      WHERE mrf.status = 'PO Raised'
    `;
    let params = [];
    let paramIndex = 1;

    // Search filters
    if (part_no) {
      query += ` AND LOWER(ncc.part_no) LIKE LOWER($${paramIndex})`;
      params.push(`%${part_no}%`);
      paramIndex++;
    }
    if (mpn) {
      query += ` AND LOWER(ncc.mpn) LIKE LOWER($${paramIndex})`;
      params.push(`%${mpn}%`);
      paramIndex++;
    }
    if (created_at) {
      query += ` AND DATE_TRUNC('day', mrf.date) = $${paramIndex}`;
      params.push(created_at);
      paramIndex++;
    }

    query += ` ORDER BY mrf.date DESC`;

    console.log(
      "Executing MRF component search query for PO Raised:",
      query,
      params
    );
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      console.warn("No MRF components found for the given filters.");
      return res.status(200).json([]);
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error searching MRF components for PO Raised:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// Fetch rejected MRF requests
const getRejectedMrfRequests = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    console.log("getRejectedMrfRequests - User role:", role, "User ID:", user_id);

    const isAdmin = role === "admin";
    const isCeo = role === "ceo";
    const isPurchaseHead = role === "purchase_head";
    const isHead = role.endsWith("_head");
    const department = getDepartmentFromRole(role);
    console.log("getRejectedMrfRequests - isHead:", isHead, "isPurchaseHead:", isPurchaseHead, "Department:", department);

    if (!isHead && !isAdmin && !isCeo) {
      return res
        .status(403)
        .json({
          error: "Unauthorized: Only heads, CEO, or admin can view rejected requests",
        });
    }

    const { date } = req.query;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    let query = `
      SELECT DISTINCT mrf.mrf_no, mrf.project_name, u.name, mrf.date, mrf.status, mrf.note, mrf.priority
      FROM material_request_form mrf
      JOIN users u ON mrf.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      WHERE mrf.status = 'Rejected'
    `;
    let params = [];

    if (date) {
      params.push(date);
      query += ` AND DATE_TRUNC('day', mrf.date) = $${params.length}`;
    }

    // Admins, CEOs, and purchase_head can see all rejected requests; other heads see only their department's requests
    if (isHead && department && !isAdmin && !isCeo && !isPurchaseHead) {
      params.push(department);
      query += `
        AND r.role_name LIKE $${params.length} || '%'
      `;
    }

    query += ` ORDER BY mrf.date DESC;`;

    console.log("Executing rejected MRF query:", query, params);
    const result = await db.query(query, params);
    console.log("Rejected MRF query result:", result.rows);

    if (result.rows.length === 0) {
      console.warn("No rejected MRF requests found.");
      return res.status(200).json([]);
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching rejected MRF requests:", {
      message: error.message,
      stack: error.stack,
      query: error.query || "N/A",
      params: error.params || "N/A",
    });
    return res
      .status(500)
      .json({ error: "Failed to fetch rejected MRF requests", details: error.message });
  }
};

module.exports = {
  getMrfApprovalRequests,
  getPastMrfApprovedRequests,
  getMrfRequestDetails,
  approveMrfRequest,
  rejectMrfRequest,
  searchMrfComponents,
  confirmReceipt,
  searchMrfComponentsForPurchaseHead,
  searchMrfComponentsForPORaised,
  getNextPoNumber,
    getRejectedMrfRequests,
};
