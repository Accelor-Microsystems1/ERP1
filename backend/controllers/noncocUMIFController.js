const db = require("../db");
const { DateTime } = require("luxon");

const dateFormatRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const getDepartmentFromRole = (role) => {
  const match = role.match(/^(\w+)_(head|employee)$/);
  return match ? match[1] : null;
};

const getBasketItemsForUMIF = async (req, res) => {
  try {
    const user_id = req.user.id;
    const query = `
      SELECT 
        nb.basket_id,
        nb.component_id, 
        c.item_description, 
        c.mpn, 
        c.part_no,
        c.make,
        c.uom,
        c.on_hand_quantity, 
        nb.initial_requestedqty, 
        nb.updated_requestedqty,
        nb.umi,
        nb.mrf_no,
        TO_CHAR(nb.date, 'YYYY-MM-DD HH24:MI:SS') as date
      FROM public.noncoc_basket nb
      JOIN public.non_coc_components c ON nb.component_id = c.component_id
      WHERE nb.user_id = $1
      AND (nb.umi IS NULL OR nb.umi = '')
    `;
    const result = await db.query(query, [user_id]);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching basket items:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

const getProjects = async (req, res) => {
  try {
    const query = `
      SELECT project_name
      FROM projects
      ORDER BY project_name ASC;
    `;
    const result = await db.query(query);
    return res.status(200).json(result.rows.map(row => row.project_name));
  } catch (error) {
    console.error("Error fetching projects:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};
const updateBasketQuantities = async (req, res) => {
  try {
    const { basket_id, requested_quantity } = req.body;
    const user_id = req.user.id;

    if (
      !basket_id ||
      !Number.isInteger(requested_quantity) ||
      requested_quantity < 0
    ) {
      return res.status(400).json({ 
        error: "Basket ID and a non-negative integer requested quantity are required",
      });
    }

    const query = `
      UPDATE public.noncoc_basket
      SET initial_requestedqty = $1, updated_requestedqty = $1
      WHERE basket_id = $2 AND user_id = $3 AND (umi IS NULL OR umi = '')
      RETURNING *;
    `;
    const values = [requested_quantity, basket_id, user_id];
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Basket item not found or already submitted" });
    }

    return res
      .status(200)
      .json({ message: "Quantities updated", data: result.rows[0] });
  } catch (error) {
    console.error(
      "Error updating basket quantities:",
      error.message,
      error.stack
    );
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

const submitMaterialIssueForm = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const { items } = req.body;
    const io = req.app.get('socketio');
    const isHead = role.endsWith("_head");

    console.log("Received submitMaterialIssueForm request with items:", items);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Valid items array is required" });
    }

    for (const item of items) {
      console.log(`Processing item ${item.basket_id}: project_name=${item.project_name}`); // Debug log
      if (
        !item.basket_id ||
        !Number.isInteger(item.requested_quantity) ||
        item.requested_quantity < 0 ||
        (item.project_name && typeof item.project_name !== "string")
      ) {
        return res.status(400).json({
          error: `Invalid item data: ${JSON.stringify(item)}`,
        });
      }

      const basketDetailsQuery = `
        SELECT nb.component_id, ncc.on_hand_quantity
        FROM public.noncoc_basket nb
        JOIN public.non_coc_components ncc ON nb.component_id = ncc.component_id
        WHERE nb.basket_id = $1;
      `;
      const basketDetails = await db.query(basketDetailsQuery, [item.basket_id]);
      if (basketDetails.rows.length === 0) {
        return res.status(400).json({ error: `Basket item ${item.basket_id} not found` });
      }
      const { on_hand_quantity, component_id } = basketDetails.rows[0];

      const requiresMRF = item.requested_quantity > on_hand_quantity;
      console.log(`Item ${item.basket_id}: requiresMRF=${requiresMRF}, requested_quantity=${item.requested_quantity}, on_hand_quantity=${on_hand_quantity}`);

      if (item.mrf_no) {
        const mrfCheckQuery = `
          SELECT 1 
          FROM material_request_form 
          WHERE mrf_no = $1::character varying 
            AND component_id = $2;
        `;
        const mrfCheckResult = await db.query(mrfCheckQuery, [item.mrf_no, component_id]);
        console.log(`MRF Check for basket_id ${item.basket_id}, mrf_no ${item.mrf_no}, component_id ${component_id}:`, mrfCheckResult.rows);
        if (mrfCheckResult.rows.length === 0) {
          return res.status(400).json({
            error: `Invalid mrf_no: ${item.mrf_no} for basket_id ${item.basket_id} (component_id ${component_id}). MRF number and component_id combination does not exist in material_request_form`,
          });
        }
      }
    }

    const umiResult = await db.query("SELECT nextval('umi_sequence') AS umi;");
    if (!umiResult.rows[0]?.umi) {
      throw new Error("Failed to generate UMI");
    }
    const umi = `UMI${umiResult.rows[0].umi}`;

    await db.query("BEGIN");

    const failedItems = [];
    for (const item of items) {
      const adjustedDate = item.date || DateTime.now().setZone("Asia/Kolkata").toFormat("yyyy-MM-dd HH:mm:ss");
      const projectNameToUse = item.project_name || "";

      const basketCheckQuery = `
        SELECT nb.umi, nb.mrf_no, nb.component_id, ncc.on_hand_quantity
        FROM public.noncoc_basket nb
        JOIN public.non_coc_components ncc ON nb.component_id = ncc.component_id
        WHERE nb.basket_id = $1 AND nb.user_id = $2 AND (nb.umi IS NULL OR nb.umi = '')
        FOR UPDATE;
      `;
      const checkResult = await db.query(basketCheckQuery, [item.basket_id, user_id]);
      if (checkResult.rows.length === 0) {
        failedItems.push({
          basket_id: item.basket_id,
          error: "Basket item not found or already submitted",
        });
        continue;
      }
      const { component_id, on_hand_quantity } = checkResult.rows[0];

      const mrfNoToUse = item.mrf_no || null;
      console.log(`Updating item ${item.basket_id}: mrfNoToUse=${mrfNoToUse}, umi=${umi}, project_name=${projectNameToUse}`);

      const requestStatus = isHead ? 'Inventory Approval Pending' : 'Head Approval Pending';
      const updateQuery = `
        UPDATE public.noncoc_basket 
        SET initial_requestedqty = $1, 
            updated_requestedqty = $1, 
            umi = $2, 
            date = TO_TIMESTAMP($3, 'YYYY-MM-DD HH24:MI:SS'), 
            status = $4, 
            project_name = $5,
            mrf_no = $6
        WHERE basket_id = $7 AND user_id = $8 AND (umi IS NULL OR umi = '')
        RETURNING *;
      `;
      const result = await db.query(updateQuery, [
        item.requested_quantity,
        umi,
        adjustedDate,
        requestStatus,
        projectNameToUse,
        mrfNoToUse,
        item.basket_id,
        user_id,
      ]);

      if (result.rows.length === 0) {
        failedItems.push({
          basket_id: item.basket_id,
          error: "Failed to update (concurrent modification or invalid state)",
        });
      } else {
        console.log(`Updated basket_id: ${item.basket_id} with UMI: ${umi}, MRF_NO: ${mrfNoToUse || "null"}, Component_ID: ${component_id}, Project_Name: ${projectNameToUse}`);
      }
    }

    if (failedItems.length > 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({ error: "Some items failed to submit", details: failedItems });
    }

    await db.query("COMMIT");

    if (!isHead) {
      const department = getDepartmentFromRole(role);
      if (department) {
        const headResult = await db.query(
          `SELECT id FROM users WHERE role = $1`,
          [`${department}_head`]
        );
        const headId = headResult.rows[0]?.id;

        if (headId) {
          try {
            const message = `New MIF request: ${umi}`;
            console.log(`Creating MIF notification for headId ${headId}, UMI ${umi}, message: ${message}`);
            const notifResult = await db.query(
              `INSERT INTO notifications (user_id, umi, type, message, is_read, created_at, updated_at)
               VALUES ($1, $2, $3, $4, FALSE, NOW(), NULL)
               RETURNING id, user_id, umi, type, message, is_read, created_at`,
              [headId, umi, 'mif', message]
            );
            const notification = notifResult.rows[0];
            console.log(`Notification created for headId ${headId}:`, notification);

            io.to(headId.toString()).emit('notification', notification);
            console.log(`Socket.IO notification emitted to headId ${headId} for UMI ${umi}`);
          } catch (notifError) {
            console.error(`Failed to create/send MIF notification for UMI ${umi}:`, {
              message: notifError.message,
              stack: notifError.stack
            });
          }
        } else {
          console.warn(`No head found for department ${department}`);
        }
      } else {
        console.warn(`Could not determine department from role ${role}`);
      }
    }

    return res.status(201).json({ message: "Material Issue Form submitted", umi });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error submitting material issue form:", {
      message: error.message,
      stack: error.stack,
      details: error.details,
      raw: error,
    });
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

const submitMaterialRequestForm = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const { items, basket_ids } = req.body;
    const io = req.app.get('socketio');
    const isHead = role.endsWith("_head");

    if (
      !items ||
      !Array.isArray(items) ||
      items.length === 0 ||
      !basket_ids ||
      !Array.isArray(basket_ids)
    ) {
      return res
        .status(400)
        .json({ error: "Valid items and basket_ids array is required" });
    }

    if (basket_ids.length !== items.length) {
      return res
        .status(400)
        .json({ error: "Number of basket_ids must match number of items" });
    }

    for (const item of items) {
      if (
        !item.component_id ||
        !Number.isInteger(item.requested_quantity) ||
        item.requested_quantity <= 0 ||
        !item.date ||
        !dateFormatRegex.test(item.date) ||
        (item.user_id && item.user_id !== user_id) ||
        (item.status && typeof item.status !== "string") ||
        (item.project_name && typeof item.project_name !== "string")
      ) {
        return res.status(400).json({
          error: "Each item must have a valid component_id, positive requested_quantity (integer), date in 'YYYY-MM-DD HH24:MI:SS' format, valid user_id/status/project_name if provided",
        });
      }
      if (item.vendorDetails) {
        const { vendorName, approxPrice, expected_deliverydate, certificate_desired } = item.vendorDetails;
        if (vendorName && typeof vendorName !== "string") {
          return res.status(400).json({
            error: `Invalid vendorName for component_id ${item.component_id}: must be a string`,
          });
        }
        const parsedApproxPrice = parseFloat(approxPrice);
        if (approxPrice && (isNaN(parsedApproxPrice) || parsedApproxPrice < 0)) {
          return res.status(400).json({
            error: `Invalid approxPrice for component_id ${item.component_id}: must be a non-negative number`,
          });
        }
        if (expected_deliverydate) {
          const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2}|Z)$/;
          if (!isoRegex.test(expected_deliverydate)) {
            return res.status(400).json({
              error: `Invalid expected_deliverydate for component_id ${item.component_id}: must be in ISO format (e.g., 2025-05-30T23:59:59.000+05:30)`,
            });
          }
         
          const parsedDate = DateTime.fromISO(expected_deliverydate);
          if (!parsedDate.isValid) {
            return res.status(400).json({
              error: `Invalid expected_deliverydate for component_id ${item.component_id}: ${parsedDate.invalidReason}`,
            });
          }
        }

        if (certificate_desired && typeof certificate_desired !== "boolean") {
          return res.status(400).json({
            error: `Invalid certification for component_id ${item.component_id}: must be a boolean`,
          });
    }

    // if (vendor_link && typeof vendor_link !== "string") {
    //   return res.status(400).json({
    //     error: `Invalid vendor_link for component_id ${item.component_id}: must be a valid URL`,
    //   });
    // }
    }
    }

    const mrfNoResult = await db.query(
      "SELECT nextval('mrf_sequence') AS mrf_no;"
    );
    if (!mrfNoResult.rows[0]?.mrf_no) {
      throw new Error("Failed to generate MRF number");
    }
    const mrfNo = `MRF${mrfNoResult.rows[0].mrf_no}`;

    const userQuery = `
    SELECT name
    FROM users
    WHERE id = $1;
  `;
  const userResult = await db.query(userQuery, [user_id]);
  if (userResult.rows.length === 0) {
    throw new Error(`User with id ${user_id} not found`);
  }
  const username = userResult.rows[0].name;
  const submissionTime = DateTime.now().setZone("Asia/Kolkata").toFormat("yyyy-MM-DD HH:mm:ss");
  const mrfTimelineEntry = [{
    username,
    action : "Submitted",
    timestamp: submissionTime,
  }];

    await db.query("BEGIN");

    const processedItems = new Set();
    for (const item of items) {
      const uniqueKey = `${item.component_id}-${user_id}-${item.date}`;
      if (processedItems.has(uniqueKey)) {
        console.warn(`Duplicate submission detected for ${uniqueKey}`);
        continue;
      }
      processedItems.add(uniqueKey);

      const checkQuery = `
        SELECT COUNT(*) 
        FROM material_request_form 
        WHERE component_id = $1 AND user_id = $2 
        AND date = TO_TIMESTAMP($3, 'YYYY-MM-DD HH24:MI:SS');
      `;
      const checkResult = await db.query(checkQuery, [
        item.component_id,
        user_id,
        item.date,
      ]);
      if (checkResult.rows[0].count > 0) {
        console.warn(
          `Duplicate submission detected for component_id ${item.component_id} and user_id ${user_id}`
        );
        continue;
      }
      const vendorDetails = item.vendorDetails || {};
      let expectedDeliveryTimestamp = null;
if (vendorDetails.expected_deliverydate) {
  const parsedDate = DateTime.fromISO(vendorDetails.expected_deliverydate);
  expectedDeliveryTimestamp = parsedDate.toFormat("yyyy-MM-dd HH:mm:ss");
}
      const mrfQuery = `
        INSERT INTO material_request_form (
          user_id, component_id, initial_requested_quantity, date, status, mrf_no, priority,  project_name,
          approx_price,
          certificate_desired,
          vendor,
          expected_deliverydate,
          vendor_link, 
          mrf_timeline
        )
        VALUES ($1, $2, $3, TO_TIMESTAMP($4, 'YYYY-MM-DD HH24:MI:SS'), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
        RETURNING mrf_id, mrf_no;
      `;
      const mrfResult = await db.query(mrfQuery, [
        user_id,
        item.component_id,
        item.requested_quantity,
        item.date,
        isHead ? 'Inventory Approval Pending' : 'Head Approval Pending',
        mrfNo,
        false,
        item.project_name || "", 
        vendorDetails.approxPrice ? parseFloat(vendorDetails.approxPrice) : null,
        vendorDetails.certificate_desired || false,
        vendorDetails.vendorName || null,
        expectedDeliveryTimestamp ? expectedDeliveryTimestamp : null,
        vendorDetails.vendor_link || null,
        JSON.stringify(mrfTimelineEntry),
      ]);

      if (mrfResult.rows.length === 0) {
        throw new Error(
          `Failed to insert MRF item for component ${item.component_id}`
        );
      }
    }

    const failedBasketUpdates = [];
    for (const basket_id of basket_ids) {
      const updateBasketQuery = `
        UPDATE public.noncoc_basket
        SET mrf_no = $1
        WHERE basket_id = $2 AND user_id = $3 AND (umi IS NULL OR umi = '')
        RETURNING *;
      `;
      const updateResult = await db.query(updateBasketQuery, [
        mrfNo,
        basket_id,
        user_id,
      ]);
      if (updateResult.rows.length === 0) {
        failedBasketUpdates.push({
          basket_id,
          error: "Basket item not found or already submitted",
        });
      }
    }
    if (failedBasketUpdates.length > 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({
        error: "Failed to update some basket items with MRF number",
        details: failedBasketUpdates,
      });
    }

    await db.query("COMMIT");

    if (!isHead) {
      const department = getDepartmentFromRole(role);
      if (department) {
        const headResult = await db.query(
          `SELECT id FROM users WHERE role = $1`,
          [`${department}_head`]
        );
        const headId = headResult.rows[0]?.id;

        if (headId) {
          try {
            const message = `New MRF request: ${mrfNo}`;
            console.log(`Creating MRF notification for headId ${headId}, MRF ${mrfNo}, message: ${message}`);
            const notifResult = await db.query(
              `INSERT INTO notifications (user_id, mrf_no, type, message, is_read, created_at, updated_at)
               VALUES ($1, $2, $3, $4, FALSE, NOW(), NULL)
               RETURNING id, user_id, mrf_no, type, message, is_read, created_at`,
              [headId, mrfNo, 'mrf', message]
            );
            const notification = notifResult.rows[0];
            console.log(`Notification created for headId ${headId}:`, notification);

            io.to(headId.toString()).emit('notification', notification);
            console.log(`Socket.IO notification emitted to headId ${headId} for MRF ${mrfNo}`);
          } catch (notifError) {
            console.error(`Failed to create/send MRF notification for MRF ${mrfNo}:`, {
              message: notifError.message,
              stack: notifError.stack
            });
          }
        } else {
          console.warn(`No head found for department ${department}`);
        }
      } else {
        console.warn(`Could not determine department from role ${role}`);
      }
    }

    return res
      .status(201)
      .json({ message: "Material Request Form submitted", mrf_no: mrfNo });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error(
      "Error submitting material request form:",
      error.message,
      error.stack
    );
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

const deleteBasketItem = async (req, res) => {
  try {
    const { basketId } = req.params;
    const user_id = req.user.id;

    const query = `DELETE FROM public.noncoc_basket WHERE basket_id = $1 AND user_id = $2 RETURNING *;`;
    const result = await db.query(query, [basketId, user_id]);

    if (result.rows.length === 0) {
      console.error(
        `Failed to delete basket item with basket_id: ${basketId} for user_id: ${user_id}`
      );
      return res.status(404).json({ error: "Basket item not found" });
    }

    return res.status(200).json({ message: "Basket item deleted" });
  } catch (error) {
    console.error("Error deleting basket item:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

const deleteMRFItem = async (req, res) => {
  try {
    const { mrfId } = req.params;

    if (!mrfId) {
      return res
        .status(400)
        .json({ error: "mrfId is required for post submission deletion" });
    }

    const query = `
      DELETE FROM material_request_form
      WHERE mrf_id = $1 AND status = 'Head Approval Pending'
      RETURNING *;
    `;
    const values = [mrfId];
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      console.error(`Failed to delete MRF item with mrfId: ${mrfId}`);
      return res
        .status(404)
        .json({ error: "MRF item not found or not in pending status" });
    }

    return res.status(200).json({ message: "MRF item deleted" });
  } catch (error) {
    console.error("Error deleting MRF item:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};
const submitDirectPurchaseRequest = async (req, res) => {
  try {
    const { id: user_id } = req.user;
    const { items } = req.body;
    const io = req.app.get('socketio');

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Valid items array is required' });
    }

    for (const item of items) {
      if (
        !item.mpn || typeof item.mpn !== 'string' || item.mpn.trim() === '' ||
        !Number.isInteger(item.requested_quantity) || item.requested_quantity <= 0 ||
        !item.project_name || typeof item.project_name !== 'string' || item.project_name.trim() === '' ||
        (item.note && typeof item.note !== 'string') ||
        !item.vendor || typeof item.vendor !== 'string' || item.vendor.trim() === '' ||
        !item.uom || typeof item.uom !== 'string' || item.uom.trim() === '' ||
        !item.gst_type || typeof item.gst_type !== 'string' || !['18% GST', '18% IGST'].includes(item.gst_type) ||
        isNaN(parseFloat(item.rate_per_unit)) || item.rate_per_unit < 0 ||
        isNaN(parseFloat(item.amount_inr)) || item.amount_inr < 0 ||
        isNaN(parseFloat(item.gst_amount)) || item.gst_amount < 0 ||
        isNaN(parseFloat(item.total_po_cost)) || item.total_po_cost <= 0 ||
        !item.submitted_at || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(item.submitted_at) ||
        (item.item_description && typeof item.item_description !== 'string') ||
        (item.make && typeof item.make !== 'string')
      ) {
        return res.status(400).json({
          error: `Invalid item data: ${JSON.stringify(item)}`,
        });
      }

      const componentCheck = await db.query(
        `SELECT component_id FROM public.non_coc_components WHERE mpn = $1`,
        [item.mpn.trim()]
      );
      if (componentCheck.rows.length === 0) {
        return res.status(400).json({
          error: `Invalid MPN: ${item.mpn}`,
        });
      }
    }

    const totalPoCostSet = new Set(items.map(item => parseFloat(item.total_po_cost)));
    if (totalPoCostSet.size !== 1) {
      return res.status(400).json({ error: 'Inconsistent total_po_cost values across items' });
    }

    await db.query('BEGIN');

    const sequenceResult = await db.query("SELECT nextval('direct_po_sequence') AS seq");
    if (!sequenceResult.rows[0]?.seq) {
      throw new Error("Failed to generate direct_sequence");
    }
    const directSequence = `PO-${sequenceResult.rows[0].seq}`;

    const mrfSequenceResult = await db.query("SELECT nextval('mrf_sequence') AS seq");
    if (!mrfSequenceResult.rows[0]?.seq) {
      throw new Error("Failed to generate mrf_sequence");
    }
    const mrfNo = `MRF-${mrfSequenceResult.rows[0].seq}`;

    const processedItems = new Set();
    const insertedIds = [];

    for (const item of items) {
      const uniqueKey = `${item.mpn}-${user_id}-${item.submitted_at}`;
      if (processedItems.has(uniqueKey)) {
        console.warn(`Duplicate submission detected for ${uniqueKey}`);
        continue;
      }
      processedItems.add(uniqueKey);

      const componentCheck = await db.query(
        `SELECT component_id FROM public.non_coc_components WHERE mpn = $1`,
        [item.mpn.trim()]
      );
      const component_id = componentCheck.rows[0].component_id;

      const insertPoQuery = `
        INSERT INTO public.direct_po_requests (
          mpn, requested_quantity, project_name, note, vendor, uom, gst_type,
          rate_per_unit, amount_inr, gst_amount, status, total_po_cost,
          submitted_at, direct_sequence, mrf_no, item_description, make
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          TO_TIMESTAMP($13, 'YYYY-MM-DD HH24:MI:SS'), $14, $15, $16, $17
        )
        RETURNING id;
      `;
      const poInsertResult = await db.query(insertPoQuery, [
        item.mpn.trim(),
        item.requested_quantity,
        item.project_name.trim(),
        item.note || '',
        item.vendor.trim(),
        item.uom.trim(),
        item.gst_type,
        item.rate_per_unit,
        item.amount_inr,
        item.gst_amount,
        'CEO Approval Pending',
        item.total_po_cost,
        item.submitted_at,
        directSequence,
        mrfNo,
        item.item_description ? item.item_description.trim() : 'N/A',
        item.make ? item.make.trim() : 'N/A',
      ]);

      if (poInsertResult.rows.length === 0) {
        throw new Error(`Failed to insert Direct PO Request for MPN ${item.mpn}`);
      }

      const insertMrfQuery = `
        INSERT INTO public.material_request_form (
          mrf_no, component_id, updated_requested_quantity, project_name, created_at
        )
        VALUES ($1, $2, $3, $4, TO_TIMESTAMP($5, 'YYYY-MM-DD HH24:MI:SS'))
        RETURNING mrf_id;
      `;
      const mrfInsertResult = await db.query(insertMrfQuery, [
        mrfNo,
        component_id,
        item.updated_requested_quantity,
        item.project_name.trim(),
        item.created_at,
      ]);

      if (mrfInsertResult.rows.length === 0) {
        throw new Error(`Failed to insert Material Request Form for MPN ${item.mpn}`);
      }

      console.log(`Inserted Direct PO Request for MPN ${item.mpn}:`, poInsertResult.rows[0]);
      insertedIds.push(poInsertResult.rows[0].id);
    }

    if (insertedIds.length === 0) {
      throw new Error('No items were inserted into direct_po_requests');
    }

    const ceoUserId = 7;
    const message = `A direct purchase request has been initiated with sequence ${directSequence}, kindly review for approval.`;
    try {
      const notifResult = await db.query(
        `INSERT INTO notifications (user_id, type, message, is_read, created_at, updated_at)
         VALUES ($1, $2, $3, FALSE, NOW(), NULL)
         RETURNING id, user_id, type, message, is_read, created_at`,
        [ceoUserId, 'direct purchase request', message]
      );
      const notification = notifResult.rows[0];
      if (io) {
        io.to(ceoUserId.toString()).emit('notification', notification);
      }
    } catch (notifError) {
      console.error(`Failed to create/send notification for sequence ${directSequence}:`, notifError);
    }

    await db.query('COMMIT');

    const response = {
      message: 'Direct Purchase Request submitted',
      direct_sequence: directSequence,
      mrf_no: mrfNo,
      ids: insertedIds,
    };
    return res.status(201).json(response);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error submitting direct purchase request:', {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

module.exports = {
  getBasketItemsForUMIF,
   getProjects,
  submitMaterialIssueForm,
  submitMaterialRequestForm,
  deleteBasketItem,
  updateBasketQuantities,
  deleteMRFItem,
  submitDirectPurchaseRequest,
};