const db = require('../db');

// Fetch all direct PO components grouped by direct_sequence
const fetchDirectPoComponents = async (req, res) => {
  try {
    const query = `
      SELECT 
        direct_sequence,
        project_name,
        vendor,
        TO_CHAR(submitted_at, 'YYYY-MM-DD') as created_at,
        note,
        total_po_cost,
        mpn,
        uom,
        item_description,
        make,
        part_no,
        mrf_no,
        requested_quantity,
        gst_type,
        rate_per_unit,
        amount_inr,
        gst_amount
      FROM direct_po_requests
      WHERE status = 'CEO Approval Pending'
      ORDER BY direct_sequence, submitted_at DESC
    `;
    const { rows } = await db.query(query);
    // Group by direct_sequence, ensuring duplicates are preserved with unique keys
    let sequenceCounter = {};
    const groupedData = rows.reduce((acc, row) => {
      const sequence = row.direct_sequence;
      // Increment counter for this sequence to create unique keys
      sequenceCounter[sequence] = (sequenceCounter[sequence] || 0) + 1;
      const uniqueKey = `${sequence}-${sequenceCounter[sequence]}`;
      
      if (!acc[uniqueKey]) {
        acc[uniqueKey] = {
          direct_sequence: sequence,
          project_name: row.project_name,
          mrf_no: row.mrf_no,
          vendor: row.vendor,
          created_at: row.created_at,
          note: [],
          total_po_cost: parseFloat(row.total_po_cost || 0),
          components: [],
        };
      }
      let parsedNotes = [];
      try {
        parsedNotes = row.note ? JSON.parse(row.note) : [];
        if (!Array.isArray(parsedNotes)) {
          parsedNotes = [{
            timestamp: new Date().toISOString(),
            user_name: 'Unknown',
            role: 'Unknown',
            content: row.note || ''
          }];
        }
      } catch (e) {
        parsedNotes = [{
          timestamp: new Date().toISOString(),
          user_name: 'Unknown',
          role: 'Unknown',
          content: row.note || ''
        }];
      }
      acc[uniqueKey].note = parsedNotes;
      acc[uniqueKey].components.push({
        mpn: row.mpn || 'N/A',
        make: row.make || 'N/A',
        item_description: row.item_description || 'N/A',
        part_no: row.part_no || 'N/A',
        uom: row.uom || 'N/A',
        requested_quantity: row.requested_quantity || 0,
        gst_type: row.gst_type || 'N/A',
        rate_per_unit: row.rate_per_unit || 0,
        amount_inr: row.amount_inr || 0,
        gst_amount: row.gst_amount || 0,
      });
      return acc;
    }, {});
    const response = Object.values(groupedData);
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching direct PO components:', error);
    res.status(500).json({ message: 'Failed to fetch direct PO components', error: error.message });
  }
};
const approveDirectPoRequest = async (req, res) => {
  const { direct_sequence } = req.params;
  const { note, mpn } = req.body;
  const io = req.app.get('socketio'); // Get Socket.IO instance from app

  try {
    // Check if the request exists
    const queryCheck = `
      SELECT note, project_name
      FROM direct_po_requests
      WHERE direct_sequence = $1 AND ($2::text IS NULL OR mpn = $2)
      LIMIT 1
    `;
    const { rows } = await db.query(queryCheck, [direct_sequence, mpn]);
    if (rows.length === 0) {
      return res.status(404).json({
        message: `No request found for direct_sequence ${direct_sequence}${mpn ? ` and MPN ${mpn}` : ''}`,
      });
    }

    const requesterId = rows[0].user_id;
    const projectName = rows[0].project_name || 'N/A';
    let existingNotes = [];
    try {
      existingNotes = rows[0].note ? JSON.parse(rows[0].note) : [];
      if (!Array.isArray(existingNotes)) {
        existingNotes = [
          {
            timestamp: new Date().toISOString(),
            user_name: 'Unknown',
            role: 'Unknown',
            content: rows[0].note || '',
          },
        ];
      }
    } catch (e) {
      existingNotes = [];
    }
    const updatedNotes = [...existingNotes, ...(Array.isArray(note) ? note : [])];

    // Update the request status
    let queryUpdate;
    let params;
    if (mpn) {
      queryUpdate = `
        UPDATE direct_po_requests
        SET status = 'CEO Approval Done', note = $1, updated_at = CURRENT_TIMESTAMP
        WHERE direct_sequence = $2 AND mpn = $3
        RETURNING direct_sequence
      `;
      params = [JSON.stringify(updatedNotes), direct_sequence, mpn];
    } else {
      queryUpdate = `
        UPDATE direct_po_requests
        SET status = 'CEO Approval Done', note = $1, updated_at = CURRENT_TIMESTAMP
        WHERE direct_sequence = $2
        RETURNING direct_sequence
      `;
      params = [JSON.stringify(updatedNotes), direct_sequence];
    }
    await db.query(queryUpdate, params);

    // Handle remaining components if approving a single MPN
    if (mpn) {
      const remainingQuery = `
        SELECT COUNT(*) as remaining
        FROM direct_po_requests
        WHERE direct_sequence = $1 AND status = 'CEO Approval Pending'
      `;
      const { rows: remainingRows } = await db.query(remainingQuery, [direct_sequence]);
      const remainingCount = parseInt(remainingRows[0].remaining, 10);

      if (remainingCount === 0) {
        await db.query(
          `UPDATE direct_po_requests
           SET status = 'CEO Approval Done'
           WHERE direct_sequence = $1 AND status = 'Hold'`,
          [direct_sequence]
        );
      }
    }

    // Define sendNotification function (inline for now)
    const sendNotification = async (userId, message, type) => {
      try {
        console.log(`Creating notification for userId ${userId}, sequence ${direct_sequence}`);
        const notifResult = await db.query(
          `INSERT INTO notifications (user_id, type, message, is_read, created_at, updated_at)
           VALUES ($1, $2, $3, FALSE, NOW(), NULL)
           RETURNING id, user_id, type, message, is_read, created_at`,
          [userId, type, message]
        );
        const notification = notifResult.rows[0];
        console.log(`Notification created for userId ${userId}:`, notification);

        if (io) {
          io.to(userId.toString()).emit('notification', notification);
          console.log(`Socket.IO notification emitted to userId ${userId} for sequence ${direct_sequence}`);
        } else {
          console.warn(`Socket.IO instance not initialized. Skipping notification for sequence ${direct_sequence}`);
        }
      } catch (notifError) {
        console.error(`Failed to create/send notification for sequence ${direct_sequence}:`, {
          message: notifError.message,
          stack: notifError.stack,
        });
      }
    };

    // Send notification to Purchase Head (user ID 6)
    await sendNotification(
      6, // Purchase Head user ID
      `Your direct PO request for project ${projectName}} has been approved by the CEO, kindly review the approved request.`,
      'direct_po'
    );

    res.status(200).json({ message: 'Request approved successfully' });
  } catch (error) {
    console.error('Error approving direct PO request:', error);
    res.status(500).json({ message: 'Failed to approve request', error: error.message });
  }
};

const rejectDirectPoRequest = async (req, res) => {
  const { direct_sequence } = req.params;
  const { note, reason, mpn } = req.body;
  const io = req.app.get('socketio'); // Get Socket.IO instance from app

  try {
    const queryCheck = `SELECT note, project_name FROM direct_po_requests WHERE direct_sequence = $1 AND ($2::text IS NULL OR mpn = $2) LIMIT 1`;
    const { rows } = await db.query(queryCheck, [direct_sequence, mpn]);
    if (rows.length === 0) {
      return res.status(404).json({ message: `No request found for direct_sequence ${direct_sequence}${mpn ? ` and MPN ${mpn}` : ''}` });
    }
    const requesterId = rows[0].user_id;
    const projectName = rows[0].project_name || 'N/A';
    if (!note || !Array.isArray(note) || note.length === 0) {
      return res.status(400).json({ message: 'A note is required to reject the request' });
    }
    let existingNotes = [];
    try {
      existingNotes = rows[0].note ? JSON.parse(rows[0].note) : [];
      if (!Array.isArray(existingNotes)) {
        existingNotes = [{
          timestamp: new Date().toISOString(),
          user_name: 'Unknown',
          role: 'Unknown',
          content: rows[0].note || ''
        }];
      }
    } catch (e) {
      existingNotes = [];
    }
    const updatedNotes = [...existingNotes, ...note];
    let queryUpdate;
    let params;
    if (mpn) {
      queryUpdate = `
        UPDATE direct_po_requests
        SET status = 'Rejected', note = $1, updated_at = CURRENT_TIMESTAMP
        WHERE direct_sequence = $2 AND mpn = $3
        RETURNING direct_sequence
      `;
      params = [JSON.stringify(updatedNotes), direct_sequence, mpn];
    } else {
      queryUpdate = `
        UPDATE direct_po_requests
        SET status = 'Rejected', note = $1, updated_at = CURRENT_TIMESTAMP
        WHERE direct_sequence = $2
        RETURNING direct_sequence
      `;
      params = [JSON.stringify(updatedNotes), direct_sequence];
    }
    await db.query(queryUpdate, params);
    if (mpn) {
      const remainingQuery = `
        SELECT COUNT(*) as remaining
        FROM direct_po_requests
        WHERE direct_sequence = $1 AND status = 'CEO Approval Pending'
      `;
      const { rows: remainingRows } = await db.query(remainingQuery, [direct_sequence]);
      const remainingCount = parseInt(remainingRows[0].remaining, 10);
      if (remainingCount === 0) {
        await db.query(
          `UPDATE direct_po_requests
           SET status = 'Rejected'
           WHERE direct_sequence = $1 AND status = 'Hold'`,
          [direct_sequence]
        );
      }
    }
   // Define sendNotification function (inline for now)
    const sendNotification = async (userId, message, type) => {
      try {
        console.log(`Creating notification for userId ${userId}, sequence ${direct_sequence}`);
        const notifResult = await db.query(
          `INSERT INTO notifications (user_id, type, message, is_read, created_at, updated_at)
           VALUES ($1, $2, $3, FALSE, NOW(), NULL)
           RETURNING id, user_id, type, message, is_read, created_at`,
          [userId, type, message]
        );
        const notification = notifResult.rows[0];
        console.log(`Notification created for userId ${userId}:`, notification);

        if (io) {
          io.to(userId.toString()).emit('notification', notification);
          console.log(`Socket.IO notification emitted to userId ${userId} for sequence ${direct_sequence}`);
        } else {
          console.warn(`Socket.IO instance not initialized. Skipping notification for sequence ${direct_sequence}`);
        }
      } catch (notifError) {
        console.error(`Failed to create/send notification for sequence ${direct_sequence}:`, {
          message: notifError.message,
          stack: notifError.stack,
        });
      }
    };

    // Send notification to Purchase Head (user ID 6)
    await sendNotification(
      6, // Purchase Head user ID
      `Your direct PO request for project ${projectName}} has been approved by the CEO, kindly review the approved request.`,
      'direct_po'
    );

    res.status(200).json({ message: 'Request approved successfully' });
  } catch (error) {
    console.error('Error approving direct PO request:', error);
    res.status(500).json({ message: 'Failed to approve request', error: error.message });
  }
};


const markDirectPoRequestAsHold = async (req, res) => {
  const { direct_sequence } = req.params;
  const { mpns } = req.body; // Expect an array of MPNs to mark as Hold
  try {
    if (!mpns || !Array.isArray(mpns) || mpns.length === 0) {
      return res.status(400).json({ message: 'An array of MPNs is required to mark as Hold' });
    }

    const queryCheck = `SELECT 1 FROM direct_po_requests WHERE direct_sequence = $1 AND mpn = ANY($2::text[])`;
    const { rows } = await db.query(queryCheck, [direct_sequence, mpns]);
    if (rows.length !== mpns.length) {
      return res.status(404).json({ message: `Some MPNs not found for direct_sequence ${direct_sequence}` });
    }

    const queryUpdate = `
      UPDATE direct_po_requests
      SET status = 'Hold', updated_at = CURRENT_TIMESTAMP
      WHERE direct_sequence = $1 AND mpn = ANY($2::text[])
      RETURNING direct_sequence, mpn
    `;
    const result = await db.query(queryUpdate, [direct_sequence, mpns]);
    res.status(200).json({ message: 'Components marked as Hold successfully', updated: result.rows });
  } catch (error) {
    console.error('Error marking direct PO request as Hold:', error);
    res.status(500).json({ message: 'Failed to mark as Hold', error: error.message });
  }
};

const fetchPastDirectPoApprovals = async (req, res) => {
  try {
    const query = `
      SELECT 
        direct_sequence,
        project_name,
        vendor,
        TO_CHAR(submitted_at, 'YYYY-MM-DD') as created_at,
        note,
        total_po_cost,
        mpn,
        uom,
        mrf_no,
        item_description,
        make,
        part_no,
        requested_quantity,
        gst_type,
        rate_per_unit,
        amount_inr,
        gst_amount,
        status
      FROM direct_po_requests
      WHERE status IN ('CEO Approval Done', 'PO Raised', 'Rejected','Hold')
      ORDER BY direct_sequence, submitted_at DESC
    `;
    const { rows } = await db.query(query);
    // Group by direct_sequence, ensuring duplicates are preserved with unique keys
    let sequenceCounter = {};
    const groupedData = rows.reduce((acc, row) => {
      const sequence = row.direct_sequence;
      // Increment counter for this sequence to create unique keys
      sequenceCounter[sequence] = (sequenceCounter[sequence] || 0) + 1;
      const uniqueKey = `${sequence}-${sequenceCounter[sequence]}`;
      
      if (!acc[uniqueKey]) {
        acc[uniqueKey] = {
          direct_sequence: sequence,
          project_name: row.project_name,
          mrf_no: row.mrf_no,
          vendor: row.vendor,
          created_at: row.created_at,
          note: [],
          total_po_cost: parseFloat(row.total_po_cost || 0),
          components: [],
        };
      }
      let parsedNotes = [];
      try {
        parsedNotes = row.note ? JSON.parse(row.note) : [];
        if (!Array.isArray(parsedNotes)) {
          parsedNotes = [{
            timestamp: new Date().toISOString(),
            user_name: 'Unknown',
            role: 'Unknown',
            content: row.note || ''
          }];
        }
      } catch (e) {
        parsedNotes = [{
          timestamp: new Date().toISOString(),
          user_name: 'Unknown',
          role: 'Unknown',
          content: row.note || ''
        }];
      }
      acc[uniqueKey].note = parsedNotes;
      acc[uniqueKey].components.push({
        mpn: row.mpn || 'N/A',
        make: row.make || 'N/A',
        item_description: row.item_description || 'N/A',
        part_no: row.part_no || 'N/A',
        uom: row.uom || 'N/A',
        requested_quantity: row.requested_quantity || 0,
        gst_type: row.gst_type || 'N/A',
        rate_per_unit: row.rate_per_unit || 0,
        amount_inr: row.amount_inr || 0,
        gst_amount: row.gst_amount || 0,
        status: row.status || 'N/A',
      });
      return acc;
    }, {});
    const response = Object.values(groupedData);
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching past direct PO approvals:', error);
    res.status(500).json({ message: 'Failed to fetch past direct PO approvals', error: error.message });
  }
};

// In ../controllers/purchaseOrderController.js
const fetchPreviousPurchases = async (req, res) => {
  const { component_id, date_from, date_to, po_number, status } = req.query; // Support query params
  try {
    let query = `
      SELECT 
        po.po_number, 
        po.vendor_name, 
        poi.rate_per_unit, 
        TO_CHAR(po.created_at, 'YYYY-MM-DD') as created_at,
        poi.updated_requested_quantity,
        (poi.rate_per_unit * poi.updated_requested_quantity) as amount
      FROM purchase_orders po
      LEFT JOIN purchase_orders poi ON po.po_id = poi.po_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (component_id) {
      query += ` AND poi.component_id = $${paramIndex}`;
      params.push(component_id);
      paramIndex++;
    }
    if (date_from) {
      query += ` AND po.created_at >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      query += ` AND po.created_at <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }
    if (po_number) {
      query += ` AND po.po_number = $${paramIndex}`;
      params.push(po_number);
      paramIndex++;
    }
    if (status) {
      query += ` AND po.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY po.created_at DESC`;

    console.log('Executing query:', query, 'with params:', params); // Debug log
    const { rows } = await db.query(query, params);
    console.log('Raw data from database:', rows); // Debug log

    res.status(200).json({ data: rows });
  } catch (error) {
    console.error('Error fetching previous purchases:', error);
    res.status(500).json({ message: 'Failed to fetch previous purchases', error: error.message });
  }
};

module.exports = {
  fetchDirectPoComponents,
  approveDirectPoRequest,
  rejectDirectPoRequest,
  markDirectPoRequestAsHold,
  fetchPastDirectPoApprovals,
  fetchPreviousPurchases,
};