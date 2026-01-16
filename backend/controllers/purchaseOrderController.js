const db = require('../db');
const moment = require('moment');

// Function to generate PO number in the format ACC/ADMIN/PO/0001
async function generatePONumber() {
  const { rows } = await db.query(
    `SELECT po_number
     FROM purchase_orders
     WHERE po_number LIKE 'ACC/ADMIN/PO/%'
     ORDER BY CAST(SUBSTRING(po_number FROM 'ACC/ADMIN/PO/(\\d+)') AS INTEGER) DESC
     LIMIT 1`
  );

  let sequence = 1;
  if (rows.length > 0) {
    const lastPoNumber = rows[0].po_number;
    const lastSequence = parseInt(lastPoNumber.split('/').pop());
    sequence = lastSequence + 1;
  }

  const formattedSequence = String(sequence).padStart(4, '0');
  return `ACC/ADMIN/PO/${formattedSequence}`;
}

const raisePurchaseOrder = async (req, res) => {
  const { items, vendor, quotation_no, totalpo_cost, expected_delivery_date, payment_term_id, other_term_condition_id} = req.body;
  const userId = req.user.id; // From authenticateToken middleware

  try {
    await db.query('BEGIN');

    const results = [];
    const notifications = [];

    // Validate all items first to ensure we don't partially process the batch
    for (const item of items) {
      const { mrf_no, updated_requested_quantity, uom, ratePerUnit, amount, taxAmount, mpn, item_description, make, part_no, totalpo_cost } = item;

      // Validate required fields
      if (!mrf_no || !updated_requested_quantity || !uom || !vendor.name || !mpn || typeof totalpo_cost === 'undefined') {
        throw new Error('Missing required fields: mrf_no, updated_requested_quantity, uom, vendor.name, mpn, and totalpo_cost are required');
      }

      // Validate numeric fields
      if (isNaN(ratePerUnit) || ratePerUnit < 0) {
        throw new Error(`Invalid ratePerUnit for mpn ${mpn}`);
      }
      if (isNaN(amount) || amount < 0) {
        throw new Error(`Invalid amount for mpn ${mpn}`);
      }
      if (isNaN(taxAmount) || taxAmount < 0) {
        throw new Error(`Invalid taxAmount for mpn ${mpn}`);
      }
      if (isNaN(totalpo_cost) || totalpo_cost <= 0 || totalpo_cost !== (amount + taxAmount)) {
        throw new Error(`Invalid total_po_cost for mpn ${mpn}. Expected ${amount + taxAmount}, got ${totalpo_cost}`);
      }

      // Validate expected delivery date
      if (!expected_delivery_date) {
        throw new Error('Expected delivery date is required');
      }
      const deliveryDate = moment(expected_delivery_date, 'YYYY-MM-DD', true);
      if (!deliveryDate.isValid()) {
        throw new Error('Invalid expected delivery date format. Use YYYY-MM-DD');
      }
      if (deliveryDate.isBefore(moment().startOf('day'))) {
        throw new Error('Expected delivery date cannot be in the past');
      }

      if (isNaN(totalpo_cost) || totalpo_cost <= 0) {
        throw new Error('Invalid total PO cost');
      }

      // Lookup component_id using mrf_no and mpn
      const mrfQuery = `
        SELECT mrf.component_id, mrf.status, mrf.user_id AS requester_id
        FROM material_request_form mrf
        JOIN non_coc_components ncc ON mrf.component_id = ncc.component_id
        WHERE mrf.mrf_no = $1 AND ncc.mpn = $2;
      `;
      const mrfResult = await db.query(mrfQuery, [mrf_no, mpn]);
      if (mrfResult.rows.length === 0) {
        throw new Error(`No MRF found for MRF No ${mrf_no} and mpn ${mpn}`);
      }

      const { status } = mrfResult.rows[0];
      if (status !== 'CEO Approval Done' && status !== 'Material Delivery Pending') {
        throw new Error(`Cannot raise PO for MRF No ${mrf_no} with status ${status}`);
      }
    }

    // ============================================
    // LOOKUP/CREATE PAYMENT TERM ID
    // ============================================
    let finalPaymentTermId = null;
    if (payment_term_id) {
      // Check if it's already a number (ID)
      if (typeof payment_term_id === 'number' || !isNaN(parseInt(payment_term_id))) {
        finalPaymentTermId = parseInt(payment_term_id);
      } else {
        // It's a string (description), so look it up or create it
        const paymentLookup = await db.query(
          'SELECT id FROM payment_terms WHERE description = $1 LIMIT 1',
          [payment_term_id]
        );
        
        if (paymentLookup.rows.length > 0) {
          finalPaymentTermId = paymentLookup.rows[0].id;
        } else {
          // Create new payment term
          const newPaymentTerm = await db.query(
            'INSERT INTO payment_terms (description, created_at) VALUES ($1, NOW()) RETURNING id',
            [payment_term_id]
          );
          finalPaymentTermId = newPaymentTerm.rows[0].id;
        }
      }
    }

    // ============================================
    // LOOKUP/CREATE OTHER TERM CONDITION ID
    // ============================================
    let finalOtherTermId = null;
    if (other_term_condition_id) {
      // Check if it's already a number (ID)
      if (typeof other_term_condition_id === 'number' || !isNaN(parseInt(other_term_condition_id))) {
        finalOtherTermId = parseInt(other_term_condition_id);
      } else {
        // It's a string (description), so look it up or create it
        const otherTermLookup = await db.query(
          'SELECT id FROM other_terms_conditions WHERE description = $1 LIMIT 1',
          [other_term_condition_id]
        );
        
        if (otherTermLookup.rows.length > 0) {
          finalOtherTermId = otherTermLookup.rows[0].id;
        } else {
          // Create new other term
          const newOtherTerm = await db.query(
            'INSERT INTO other_terms_conditions (description, created_at) VALUES ($1, NOW()) RETURNING id',
            [other_term_condition_id]
          );
          finalOtherTermId = newOtherTerm.rows[0].id;
        }
      }
    }

    // Generate a single po_number for this entire request
    const sharedPoNumber = await generatePONumber(); // e.g., ACC/ADMIN/PO/0001

    // Insert all items with the same po_number
    for (const item of items) {
      const { mrf_no, updated_requested_quantity, uom, ratePerUnit, amount, taxAmount, mpn, item_description, make, part_no } = item;

      // Lookup component_id for the current item
      const mrfQuery = `
        SELECT mrf.component_id, mrf.status, mrf.user_id AS requester_id
        FROM material_request_form mrf
        JOIN non_coc_components ncc ON mrf.component_id = ncc.component_id
        WHERE mrf.mrf_no = $1 AND ncc.mpn = $2;
      `;
      const mrfResult = await db.query(mrfQuery, [mrf_no, mpn]);
      const { component_id, requester_id, status } = mrfResult.rows[0];

      // Check if this MRF and component already have a Material Delivery Pending
      if (status === 'Material Delivery Pending') {
        const existingPoQuery = `
          SELECT po_number
          FROM purchase_orders
          WHERE mrf_no = $1 AND component_id = $2
          LIMIT 1;
        `;
        const existingPoResult = await db.query(existingPoQuery, [mrf_no, component_id]);
        if (existingPoResult.rows.length > 0) {
          const existingPoNumber = existingPoResult.rows[0].po_number;
          results.push({ mrf_no, component_id, po_number: existingPoNumber, status: 'Material Delivery Pending' });
          continue; // Skip to the next item
        }
      }

      // Insert into purchase_orders with the shared po_number
      const poInsertQuery = `
        INSERT INTO purchase_orders (
          po_number, mrf_no, component_id, updated_requested_quantity, uom, 
          vendor_name, rate_per_unit, amount, gst_amount, mpn,
          item_description,
          make, part_no, quotation_no, status, totalpo_cost, 
          expected_delivery_date,
          payment_term_id, other_term_condition_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING po_id, po_number, status, created_at, mrf_no, component_id
      `;
      
      const poInsertValues = [
        sharedPoNumber,
        mrf_no,
        component_id,
        updated_requested_quantity,
        uom,
        vendor.name,
        ratePerUnit,
        amount,
        taxAmount,
        mpn || null,
        item_description || null,
        make || null,
        part_no || null,
        quotation_no || null,
        'Material Delivery Pending',
        totalpo_cost,
        expected_delivery_date,
        finalPaymentTermId,      // ✅ Now passing ID instead of text
        finalOtherTermId,        // ✅ Now passing ID instead of text
      ];

      const poResult = await db.query(poInsertQuery, poInsertValues);
      const po = poResult.rows[0];
      results.push(po);

      // Update material_request_form status to 'Material Delivery Pending'
      const updateMrfQuery = `
        UPDATE material_request_form
        SET status = $1, updated_at = NOW()
        WHERE mrf_no = $2 AND component_id = $3 AND status = $4
        RETURNING mrf_no, component_id, status;
      `;
      const updateMrfResult = await db.query(updateMrfQuery, ['Material Delivery Pending', mrf_no, component_id, 'CEO Approval Done']);
      if (updateMrfResult.rows.length === 0) {
        // If no rows were updated, it might already be 'Material Delivery Pending', which we've handled above
        continue;
      }

      // Prepare notification for the current item's requester
      const message = `Purchase Order ${sharedPoNumber} raised for your MRF ${mrf_no} (mpn: ${mpn})`;
      notifications.push({
        user_id: requester_id,
        mrf_no,
        message,
        status: 'Material Delivery Pending',
      });
    }

    // Notify purchase team (single notification for the entire PO)
    const purchaseTeamResult = await db.query(
      `SELECT id FROM users WHERE role = $1`,
      ['purchase']
    );
    const purchaseTeamIds = purchaseTeamResult.rows.map(row => row.id);

    const io = req.app.get('io');
    const userSocketMap = req.app.get('userSocketMap');

    const purchaseMessage = `New purchase order ${sharedPoNumber} raised for MRFs: ${results.map(r => r.mrf_no).join(', ')}`;
    for (const purchaseId of purchaseTeamIds) {
      const notifResult = await db.query(
        `INSERT INTO notifications (user_id, umi, mrf_no, type, message, status, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
        [purchaseId, null, results[0].mrf_no, 'purchase_order', purchaseMessage, results[0].status, false]
      );
      const notification = notifResult.rows[0];

      const socketId = userSocketMap.get(purchaseId.toString());
      if (socketId) {
        io.to(socketId).emit('notification', notification);
        console.log(`Socket.IO notification emitted to user_id: ${purchaseId}, socket_id: ${socketId} for PO ${sharedPoNumber}`);
      } else {
        console.warn(`No socket found for user_id: ${purchaseId}`);
      }
    }

    // Notify original requesters
    for (const notif of notifications) {
      const notifResult = await db.query(
        `INSERT INTO notifications (user_id, umi, mrf_no, type, message, status, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
        [notif.user_id, null, notif.mrf_no, 'mrf', notif.message, notif.status, false]
      );
      const notification = notifResult.rows[0];

      const socketId = userSocketMap.get(notif.user_id.toString());
      if (socketId) {
        io.to(socketId).emit('notification', notification);
        console.log(`Socket.IO notification emitted to user_id: ${notif.user_id}, socket_id: ${socketId} for MRF ${notif.mrf_no}`);
      } else {
        console.warn(`No socket found for user_id: ${notif.user_id}`);
      }
    }

    await db.query('COMMIT');
    res.status(201).json({
      message: `Purchase order ${sharedPoNumber} raised successfully`,
      data: results,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error raising purchase order:', error);
    res.status(400).json({ error: error.message || 'Failed to raise purchase order' });
  }
};

// Start: Add endpoints for payment terms
const getPaymentTerms = async (req, res) => {
  try {
    const result = await db.query('SELECT id, description FROM payment_terms ORDER BY description');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching payment terms:', error);
    res.status(500).json({ error: 'Failed to fetch payment terms' });
  }
};

const createPaymentTerm = async (req, res) => {
  const {  description } = req.body;
  if (! description) {
    return res.status(400).json({ error: 'Term name is required' });
  }
  try {
    const result = await db.query(
      'INSERT INTO payment_terms ( description) VALUES ($1) RETURNING id, description',
      [ description || null]
    );
    res.status(201).json({
      message: `Payment term ${ description} created successfully`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating payment term:', error);
    res.status(500).json({ error: 'Failed to create payment term' });
  }
};
// End: Add endpoints for payment terms

// Start: Add endpoints for other terms & conditions
const getOtherTermsConditions = async (req, res) => {
  try {
    const result = await db.query('SELECT id, description FROM other_terms_conditions ORDER BY description');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching other terms & conditions:', error);
    res.status(500).json({ error: 'Failed to fetch other terms & conditions' });
  }
};

const createOtherTermCondition = async (req, res) => {
  const { description } = req.body;
  if (! description) {
    return res.status(400).json({ error: 'Condition description is required' });
  }
  try {
    const result = await db.query(
      'INSERT INTO other_terms_conditions ( description) VALUES ($1) RETURNING id,  description',
      [ description|| null]
    );
    res.status(201).json({
      message: `Other term/condition ${ description} created successfully`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating other term/condition:', error);
    res.status(500).json({ error: 'Failed to create other term/condition' });
  }
};
// End:

const getPoNumberForMrfs = async (req, res) => {
  const { mrfNos } = req.body;

  if (!Array.isArray(mrfNos) || mrfNos.length === 0) {
    return res.status(400).json({ error: 'mrfNos must be a non-empty array' });
  }

  try {
    const query = `
      SELECT DISTINCT po_number
      FROM purchase_orders
      WHERE mrf_no = ANY($1)
      LIMIT 1;
    `;
    const result = await db.query(query, [mrfNos]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No purchase order found for the given MRFs' });
    }

    const poNumber = result.rows[0].po_number;
    res.status(200).json({ po_number: poNumber });
  } catch (error) {
    console.error('Error fetching PO number for MRFs:', error);
    res.status(500).json({ error: 'Failed to fetch PO number' });
  }
};

// Updated endpoint to update purchase order
const updatePurchaseOrder = async (req, res) => {
  const { po_number, component_id, expected_delivery_date, updated_requested_quantity } = req.body;

  if (!po_number || !component_id || !expected_delivery_date || !updated_requested_quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const deliveryDate = moment(expected_delivery_date, 'YYYY-MM-DD', true);
  if (!deliveryDate.isValid()) {
    return res.status(400).json({ error: 'Invalid expected delivery date format. Use YYYY-MM-DD' });
  }
  if (deliveryDate.isBefore(moment().startOf('day'))) {
    return res.status(400).json({ error: 'Expected delivery date cannot be in the past' });
  }

  if (isNaN(updated_requested_quantity) || updated_requested_quantity <= 0) {
    return res.status(400).json({ error: 'Invalid ordered quantity' });
  }

  try {
    await db.query('BEGIN');

    // Fetch the current purchase order to get rate_per_unit, vendor_name, and old values for comparison
    const fetchQuery = `
      SELECT rate_per_unit, amount, gst_amount, mrf_no, vendor_name, expected_delivery_date AS old_delivery_date, updated_requested_quantity AS old_quantity
      FROM purchase_orders
      WHERE po_number = $1 AND component_id = $2;
    `;
    const fetchResult = await db.query(fetchQuery, [po_number, component_id]);
    if (fetchResult.rows.length === 0) {
      throw new Error('Purchase order not found');
    }

    const { rate_per_unit, mrf_no, vendor_name, old_delivery_date, old_quantity } = fetchResult.rows[0];
    const newAmount = rate_per_unit * updated_requested_quantity;
    const GST_RATE = 0.18; // Assuming 18% GST rate
    const newGstAmount = newAmount * GST_RATE;

    const updateQuery = `
      UPDATE purchase_orders
      SET expected_delivery_date = $1, 
          updated_requested_quantity = $2, 
          amount = $3, 
          gst_amount = $4, 
          updated_at = NOW()
      WHERE po_number = $5 AND component_id = $6
      RETURNING po_number, component_id, expected_delivery_date, updated_requested_quantity, amount, gst_amount;
    `;
    const updateValues = [expected_delivery_date, updated_requested_quantity, newAmount, newGstAmount, po_number, component_id];
    const updateResult = await db.query(updateQuery, updateValues);

    if (updateResult.rows.length === 0) {
      throw new Error('Purchase order not found or update failed');
    }

    const updatedPO = updateResult.rows[0];

    // Determine what was updated
    const updates = [];
    if (old_delivery_date !== expected_delivery_date) {
      updates.push(`Expected Delivery Date updated to ${expected_delivery_date}`);
    }
    if (parseInt(old_quantity) !== parseInt(updated_requested_quantity)) {
      updates.push(`Updated Requested Quantity changed to ${updated_requested_quantity}`);
    }
    const updatesStr = updates.length > 0 ? updates.join(' and ') : 'No changes detected';

    // Notify admin (user_id: 2)
    const adminId = 2;
    const io = req.app.get('io');
    const userSocketMap = req.app.get('userSocketMap');

    const adminMessage = `Purchase Order ${po_number} against vendor ${vendor_name} was unlocked and updated: ${updatesStr} for component ${component_id} at ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
    const notifResult = await db.query(
      `INSERT INTO notifications (user_id, umi, mrf_no, type, message, status, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
      [adminId, null, mrf_no, 'purchase_order', adminMessage, 'PO Updated', false]
    );
    const notification = notifResult.rows[0];

    const socketId = userSocketMap.get(adminId.toString());
    if (socketId) {
      io.to(socketId).emit('notification', notification);
      console.log(`Socket.IO notification emitted to admin_id: ${adminId}, socket_id: ${socketId} for PO ${po_number}`);
    } else {
      console.warn(`No socket found for admin_id: ${adminId}`);
    }

    await db.query('COMMIT');
    res.status(200).json({
      message: `Purchase order ${po_number} updated successfully`,
      data: updatedPO,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error updating purchase order:', error);
    res.status(400).json({ error: error.message || 'Failed to update purchase order' });
  }
};

const getAllPurchaseOrders = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized: No user found' });
    }

    const query = `
      SELECT 
        po.po_id,
        po.po_number,
        po.mrf_no,
        po.component_id,
        po.updated_requested_quantity,
        po.uom,
        po.vendor_name,
        po.rate_per_unit,
        po.amount,
        po.gst_amount,
        po.mpn,
        po.item_description,
        po.make,
        po.part_no,
        po.quotation_no,
        po.status AS po_status,
        po.created_at AS po_created_at,
        po.totalpo_cost,
        po.expected_delivery_date,
        COALESCE(mrf.project_name, dpr.project_name) AS project_name,
        mrf.initial_requested_quantity,
        ncc.on_hand_quantity,
        po.direct_sequence
      FROM purchase_orders po
      LEFT JOIN material_request_form mrf 
        ON po.mrf_no = mrf.mrf_no AND po.component_id = mrf.component_id
      LEFT JOIN direct_po_requests dpr 
        ON po.mrf_no = dpr.mrf_no AND po.component_id = dpr.component_id
      LEFT JOIN non_coc_components ncc 
        ON po.component_id = ncc.component_id
      WHERE po.status NOT IN ('Backordered', 'Returned', 'Backordered and Returned')
      ORDER BY po.created_at DESC;
    `;

    const result = await db.query(query);

    if (result.rows.length === 0) {
      return res.status(200).json({
        message: 'No purchase orders found',
        data: []
      });
    }

    const purchaseOrders = result.rows.map(row => ({
      po_id: row.po_id,
      po_number: row.po_number,
      mrf_no: row.mrf_no,
      component_id: row.component_id,
      updated_requested_quantity: row.updated_requested_quantity,
      uom: row.uom,
      vendor_name: row.vendor_name,
      rate_per_unit: row.rate_per_unit,
      amount: row.amount,
      gst_amount: row.gst_amount,
      mpn: row.mpn,
      item_description: row.item_description,
      make: row.make,
      part_no: row.part_no,
      quotation_no: row.quotation_no,
      po_status: row.po_status,
      po_created_at: row.po_created_at,
      totalpo_cost: row.totalpo_cost,
      expected_delivery_date: row.expected_delivery_date,
      project_name: row.project_name || '-',
      initial_requested_quantity: row.initial_requested_quantity,
      on_hand_quantity: row.on_hand_quantity || 0,
      requested_by: row.requested_by || '-',
      direct_sequence: row.direct_sequence || '-',
    }));

    res.status(200).json({
      message: 'Purchase orders fetched successfully',
      data: purchaseOrders
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({
      error: 'Failed to fetch purchase orders: ' + (error.message || 'Internal server error')
    });
  }
};

const getBackorderedReturnedPOs = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized: No user found' });
    }

    const query = `
      SELECT 
        po.po_id,
        po.po_number,
        po.mrf_no,
        po.component_id,
        po.updated_requested_quantity,
        po.uom,
        po.vendor_name,
        po.rate_per_unit,
        po.amount,
        po.gst_amount,
        po.mpn,
        po.item_description,
        po.make,
        po.received_quantity,
        po.part_no,
        po.quotation_no,
        po.status AS po_status,
        po.created_at AS po_created_at,
        po.totalpo_cost,
        po.expected_delivery_date,
        mrf.project_name,
        mrf.initial_requested_quantity,
        ncc.on_hand_quantity,
        bi.backorder_sequence,
        bi.reordered_quantity AS pending_quantity,
        ri.return_sequence,
        ri.reordered_quantity AS return_reordered_quantity
      FROM purchase_orders po
      LEFT JOIN material_request_form mrf 
        ON po.mrf_no = mrf.mrf_no AND po.component_id = mrf.component_id
      LEFT JOIN non_coc_components ncc 
        ON po.component_id = ncc.component_id
      LEFT JOIN backorder_items bi
        ON po.po_number = bi.po_number AND po.mpn = bi.mpn
      LEFT JOIN return_items ri
        ON po.po_number = ri.po_number AND po.mpn = ri.mpn
      WHERE po.status = 'Returned'
         OR po.status LIKE 'Warehouse In, Backordered (%)'
         OR po.status LIKE 'Warehouse In, Backordered (%) Returned (%)'
      ORDER BY po.created_at DESC;
    `;

    const result = await db.query(query);

    if (result.rows.length === 0) {
      return res.status(200).json({
        message: 'No backordered or returned purchase orders found',
        data: []
      });
    }

    const purchaseOrders = result.rows.map(row => {
      // Debug: Log if backorder_sequence is missing for backordered statuses
      if ((row.po_status.includes('Backordered') && !row.backorder_sequence)) {
        console.warn(`Missing backorder_sequence for PO ${row.po_number}, MPN ${row.mpn} with status ${row.po_status}`);
      }
      return {
        po_id: row.po_id,
        po_number: row.po_number,
        mrf_no: row.mrf_no,
        component_id: row.component_id,
        updated_requested_quantity: row.updated_requested_quantity,
        uom: row.uom,
        vendor_name: row.vendor_name,
        rate_per_unit: row.rate_per_unit,
        amount: row.amount,
        gst_amount: row.gst_amount,
        mpn: row.mpn,
        item_description: row.item_description,
        make: row.make,
        part_no: row.part_no,
        quotation_no: row.quotation_no,
        po_status: row.po_status,
        po_created_at: row.po_created_at,
        totalpo_cost: row.totalpo_cost,
        expected_delivery_date: row.expected_delivery_date,
        project_name: row.project_name,
        initial_requested_quantity: row.initial_requested_quantity,
        on_hand_quantity: row.on_hand_quantity || 0,
        received_quantity: row.received_quantity || 0,
        backorder_sequence: row.backorder_sequence || null,
        pending_quantity: row.pending_quantity || 0,
        return_sequence: row.return_sequence || null,
        return_reordered_quantity: row.return_reordered_quantity || 0,
      };
    });

    res.status(200).json({
      message: 'Backordered and returned purchase orders fetched successfully',
      data: purchaseOrders
    });
  } catch (error) {
    console.error('Error fetching backordered/returned purchase orders:', error);
    res.status(500).json({
      error: 'Failed to fetch backordered/returned purchase orders: ' + (error.message || 'Internal server error')
    });
  }
};
const raiseDirectPurchaseOrder = async (req, res) => {
  const { items, vendor, quotation_no, totalpo_cost, expected_delivery_date, paymentTerms, otherTerms, direct_sequence, mrf_no } = req.body;
  const userId = req.user.id;

  try {
    await db.query('BEGIN');

    const results = [];
    const notifications = [];

    // Validate input data
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and must not be empty');
    }
    if (!vendor || !vendor.name || typeof vendor.name !== 'string' || vendor.name.trim() === '') {
      throw new Error('Vendor name is required and must be a non-empty string');
    }
    if (isNaN(totalpo_cost) || totalpo_cost <= 0) {
      throw new Error('Total PO cost must be a positive number');
    }
    if (!expected_delivery_date) {
      throw new Error('Expected delivery date is required');
    }
    const deliveryDate = moment(expected_delivery_date, 'YYYY-MM-DD', true);
    if (!deliveryDate.isValid()) {
      throw new Error('Invalid expected delivery date format. Use YYYY-MM-DD');
    }
    if (deliveryDate.isBefore(moment().startOf('day'))) {
      throw new Error('Expected delivery date cannot be in the past');
    }
    if (!paymentTerms || typeof paymentTerms !== 'string' || paymentTerms.trim() === '') {
      throw new Error('Payment terms must be a non-empty string');
    }
    if (!otherTerms || typeof otherTerms !== 'string' || otherTerms.trim() === '') {
      throw new Error('Other terms and conditions must be a non-empty string');
    }
    if (!direct_sequence || typeof direct_sequence !== 'string' || direct_sequence.trim() === '') {
      throw new Error('Direct sequence is required and must be a non-empty string');
    }

    // Validate items and fetch component_id
    for (const item of items) {
      const { updated_requested_quantity, uom, ratePerUnit, amount, gstAmount, mpn, item_description, make, part_no } = item;

      if (!updated_requested_quantity || isNaN(updated_requested_quantity) || updated_requested_quantity <= 0) {
        throw new Error(`Invalid updated_requested_quantity for MPN ${mpn || 'unknown'}: must be a positive integer`);
      }
      if (!uom || typeof uom !== 'string' || uom.trim() === '') {
        throw new Error(`Invalid uom for MPN ${mpn || 'unknown'}: must be a non-empty string`);
      }
      if (isNaN(ratePerUnit) || ratePerUnit < 0) {
        throw new Error(`Invalid ratePerUnit for MPN ${mpn || 'unknown'}: must be a non-negative number`);
      }
      if (isNaN(amount) || amount < 0) {
        throw new Error(`Invalid amount for MPN ${mpn || 'unknown'}: must be a non-negative number`);
      }
      if (isNaN(gstAmount) || gstAmount < 0) {
        throw new Error(`Invalid gstAmount for MPN ${mpn || 'unknown'}: must be a non-negative number`);
      }
      if (!mpn || typeof mpn !== 'string' || mpn.trim() === '') {
        throw new Error(`MPN for item is required and must be a non-empty string`);
      }

      // Fetch component_id from non_coc_components
      const componentCheck = await db.query(
        `SELECT component_id FROM public.non_coc_components WHERE mpn = $1`,
        [mpn.trim()]
      );
      if (componentCheck.rows.length === 0) {
        throw new Error(`Invalid MPN: ${mpn}`);
      }
    }

    // Handle Payment Terms
    let paymentTermId;
    const paymentTermsQuery = `
      SELECT id
      FROM payment_terms
      WHERE description = $1
      LIMIT 1;
    `;
    const paymentTermsResult = await db.query(paymentTermsQuery, [paymentTerms]);
    if (paymentTermsResult.rows.length > 0) {
      paymentTermId = paymentTermsResult.rows[0].id;
    } else {
      const insertPaymentTermsQuery = `
        INSERT INTO payment_terms (description, created_at)
        VALUES ($1, NOW())
        RETURNING id;
      `;
      const insertPaymentTermsResult = await db.query(insertPaymentTermsQuery, [paymentTerms]);
      paymentTermId = insertPaymentTermsResult.rows[0].id;
    }

    // Handle Other Terms and Conditions
    let otherTermsId;
    const otherTermsQuery = `
      SELECT id
      FROM other_terms_conditions
      WHERE description = $1
      LIMIT 1;
    `;
    const otherTermsResult = await db.query(otherTermsQuery, [otherTerms]);
    if (otherTermsResult.rows.length > 0) {
      otherTermsId = otherTermsResult.rows[0].id;
    } else {
      const insertOtherTermsQuery = `
        INSERT INTO other_terms_conditions (description, created_at)
        VALUES ($1, NOW())
        RETURNING id;
      `;
      const insertOtherTermsResult = await db.query(insertOtherTermsQuery, [otherTerms]);
      otherTermsId = insertOtherTermsResult.rows[0].id;
    }

    // Generate a single PO number
    const sharedPoNumber = await generatePONumber();

    // Insert a purchase order for each item
    for (const item of items) {
      const { updated_requested_quantity, uom, ratePerUnit, amount, gstAmount, mpn, item_description, make, part_no } = item;

      // Fetch component_id for this item
      const componentCheck = await db.query(
        `SELECT component_id FROM public.non_coc_components WHERE mpn = $1`,
        [mpn.trim()]
      );
      const component_id = componentCheck.rows[0].component_id;

      const poInsertQuery = `
        INSERT INTO purchase_orders (
          po_number, mrf_no, component_id, updated_requested_quantity, uom, vendor_name,
          rate_per_unit, amount, gst_amount, mpn, item_description,
          make, part_no, quotation_no, status, totalpo_cost, expected_delivery_date,
          payment_term_id, other_term_condition_id, direct_sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING po_id, po_number, status, created_at
      `;
      const poInsertValues = [
        sharedPoNumber,
        mrf_no,
        component_id,
        updated_requested_quantity,
        uom,
        vendor.name,
        ratePerUnit,
        amount,
        gstAmount,
        mpn || null,
        item_description || null,
        make || null,
        part_no || null,
        quotation_no || null,
        'Material Delivery Pending',
        totalpo_cost,
        expected_delivery_date,
        paymentTermId,
        otherTermsId,
        direct_sequence,
      ];

      const poResult = await db.query(poInsertQuery, poInsertValues);
      const po = poResult.rows[0];
      results.push(po);
    }

    // Update direct_po_requests status
    const updateDirectPoQuery = `
      UPDATE direct_po_requests
      SET status = $1, updated_at = NOW()
      WHERE direct_sequence = $2
      RETURNING direct_sequence, status;
    `;
    const updateDirectPoResult = await db.query(updateDirectPoQuery, ['PO Raised', direct_sequence]);
    if (updateDirectPoResult.rows.length === 0) {
      throw new Error(`Direct PO request with sequence ${direct_sequence} not found`);
    }

    // Notify purchase team
    const purchaseTeamResult = await db.query(
      `SELECT id FROM users WHERE role = $1`,
      ['purchase']
    );
    const purchaseTeamIds = purchaseTeamResult.rows.map(row => row.id);

    const io = req.app.get('io');
    const userSocketMap = req.app.get('userSocketMap');

    const purchaseMessage = `New purchase order ${sharedPoNumber} raised for Direct PO Sequence: ${direct_sequence}`;
    for (const purchaseId of purchaseTeamIds) {
      const notifResult = await db.query(
        `INSERT INTO notifications (user_id, umi, mrf_no, type, message, status, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
        [purchaseId, null, null, 'purchase_order', purchaseMessage, 'Material Delivery Pending', false]
      );
      const notification = notifResult.rows[0];

      const socketId = userSocketMap.get(purchaseId.toString());
      if (socketId) {
        io.to(socketId).emit('notification', notification);
        console.log(`Socket.IO notification emitted to user_id: ${purchaseId}, socket_id: ${socketId} for PO ${sharedPoNumber}`);
      } else {
        console.warn(`No socket found for user_id: ${purchaseId}`);
      }
    }

    await db.query('COMMIT');
    res.status(201).json({
      message: `Purchase order ${sharedPoNumber} raised successfully for Direct PO Sequence ${direct_sequence}`,
      data: {
        po_number: sharedPoNumber,
        purchase_orders: results,
      },
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error raising direct purchase order:', error);
    res.status(400).json({ error: error.message || 'Failed to raise direct purchase order' });
  }
};



const updateBackorderItem = async (req, res) => {
  const { po_number, component_id, expected_delivery_date } = req.body;

  // Validate inputs
  if (!po_number || !component_id || !expected_delivery_date) {
    return res.status(400).json({ error: 'Missing required fields: po_number, component_id, and expected_delivery_date are required' });
  }

  const deliveryDate = moment(expected_delivery_date, 'YYYY-MM-DD', true);
  if (!deliveryDate.isValid()) {
    return res.status(400).json({ error: 'Invalid expected delivery date format. Use YYYY-MM-DD' });
  }
  if (deliveryDate.isBefore(moment().startOf('day'))) {
    return res.status(400).json({ error: 'Expected delivery date cannot be in the past' });
  }

  try {
    await db.query('BEGIN');

    // Check if the backorder item exists
    const fetchQuery = `
      SELECT backorder_sequence, po_number, expected_delivery_date AS old_delivery_date
      FROM backorder_items
      WHERE po_number = $1 ;
    `;
    const fetchResult = await db.query(fetchQuery, [po_number]);
    if (fetchResult.rows.length === 0) {
      throw new Error(`Backorder item not found for po_number: ${po_number}`);
    }

    const { backorder_sequence, old_delivery_date } = fetchResult.rows[0];

    // Update the backorder item
    const updateQuery = `
      UPDATE backorder_items
      SET expected_delivery_date = $1
      WHERE backorder_sequence = $2
      RETURNING backorder_sequence, po_number,expected_delivery_date;
    `;
    const updateResult = await db.query(updateQuery, [expected_delivery_date, backorder_sequence]);
    if (updateResult.rows.length === 0) {
      throw new Error('Failed to update backorder item');
    }

    const updatedBackorderItem = updateResult.rows[0];

    // Notify admin (user_id: 2) if the delivery date changed
    if (old_delivery_date !== expected_delivery_date) {
      const adminId = 2;
      const io = req.app.get('io');
      const userSocketMap = req.app.get('userSocketMap');

      const adminMessage = `Backorder item for PO ${po_number} updated: Expected Delivery Date changed to ${expected_delivery_date} at ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
      const notifResult = await db.query(
        `INSERT INTO notifications (user_id, umi, mrf_no, type, message, status, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id, user_id, umi, mrf_no, type, message, status, is_read, created_at`,
        [adminId, null, null, 'backorder_update', adminMessage, 'Backorder Updated', false]
      );
      const notification = notifResult.rows[0];

      const socketId = userSocketMap.get(adminId.toString());
      if (socketId) {
        io.to(socketId).emit('notification', notification);
        console.log(`Socket.IO notification emitted to admin_id: ${adminId}, socket_id: ${socketId} for backorder PO ${po_number}`);
      } else {
        console.warn(`No socket found for admin_id: ${adminId}`);
      }
    }

    await db.query('COMMIT');
    res.status(200).json({
      message: `Backorder item for PO ${po_number} updated successfully`,
      data: updatedBackorderItem,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error updating backorder item:', error);
    res.status(400).json({ error: error.message || 'Failed to update backorder item' });
  }
};



module.exports = { raisePurchaseOrder, getPoNumberForMrfs, getAllPurchaseOrders, getPaymentTerms,
  createPaymentTerm,
  getOtherTermsConditions,
  createOtherTermCondition, updatePurchaseOrder, getBackorderedReturnedPOs, raiseDirectPurchaseOrder, updateBackorderItem };



