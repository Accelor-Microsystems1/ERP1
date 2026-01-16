require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");
const path = require("path");
const multer = require('multer');

//const fileUpload = require('express-fileupload');
// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// Routes import
const adminRoutes = require("./routes/adminRoutes");
const noncocRoutes = require("./routes/noncocRoutes");
const authRoutes = require("./routes/authRoutes");
const protectedRoutes = require("./routes/protectedRoutes");
const noncocuRoutes = require("./routes/noncocuRoutes");
const ncRequestsRoutes = require("./routes/ncRequestsRoutes");
const approvalsRoutes = require("./routes/approvalsRoutes");
const noncocUMIFRoutes = require("./routes/noncocUMIFRoutes");
const mrfroutes = require("./routes/mrfRoutes");
const locationsRoutes = require("./routes/locationsRoutes");
const notificationsRoutes = require("./routes/notificationsRoutes");
const returnRoutes = require("./routes/returnRoutes");
const vendorsRoutes = require("./routes/vendorsRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const qualityCheckpointsRoutes = require('./routes/qualitycheckpointsRoutes');
const qualityInspectionRoutes = require("./routes/qualityInspectionRoutes");
const documentRoutes = require('./routes/documentRoutes');
const usersRoutes = require("./routes/usersRoutes");
const { authenticateToken } = require("./middleware/authMiddleware");
const directPoRoutes = require('./routes/directPoRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://erp1-1-ih0r.onrender.com/",
    methods: ["GET", "POST", "PATCH", "PUT"],
    credentials: true,
  },
});

// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(__dirname, "Uploads")));

// Log incoming requests for debugging
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "https://erp1-1-ih0r.onrender.com/",
    credentials: true,
  })
);

// Map to store user_id to socket_id
const userSocketMap = new Map();

// Make io and userSocketMap accessible in routes
app.set("io", io);
app.set("userSocketMap", userSocketMap);

// Socket.IO connection
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("register", (userId) => {
    userSocketMap.set(userId, socket.id);
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

// Helper function to determine the role based on status
const getRoleForStatus = (status) => {
  switch (status) {
    case "Head Approval Pending":
      return "department_head";
    case "Inventory Approval Pending":
      return "inventory";
    case "Purchase Approval Pending":
      return "purchase";
    case "CEO Approval Pending":
      return "ceo";
    case "Request Accepted":
      return null;
    default:
      return null;
  }
};

// Helper function to send notifications
const sendNotification = async (userId, message, type, umi, mrf_no, status) => {
  const notification = {
    id: Date.now(),
    user_id: userId,
    umi,
    mrf_no,
    type,
    message,
    status,
    created_at: new Date().toISOString(),
    is_read: false,
  };

  const headSocketId = userSocketMap.get(userId.toString());
  if (headSocketId) {
    io.to(headSocketId).emit("notification", notification);
  }

  await pool.query(
    `INSERT INTO notifications (user_id, umi, mrf_no, type, message, status, is_read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [userId, umi, mrf_no, type, message, status, false]
  );
};

// Root route
app.get("/", (_, res) => {
  res.send("🚀 ERP Backend is running...");
});

// Multer error handling middleware
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("Multer error:", err);
    return res.status(400).json({
      error: "Multer error",
      details: err.message,
      field: err.field,
      code: err.code,
    });
  }
  next(err);
};


// Routes
app.use("/api/noncoc", noncocRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/non_coc_components", noncocuRoutes);
app.use("/api/nc-requests", ncRequestsRoutes);
app.use("/api/approvals", approvalsRoutes);
app.use("/api/locations", locationsRoutes);
app.use("/api/noncoc_umif", noncocUMIFRoutes);
app.use("/api/mrf-approvals", mrfroutes);
app.use("/api/returns", returnRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/vendors", vendorsRoutes);
app.use('/api/direct-po-components', directPoRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use('/api/quality-checkpoints', qualityCheckpointsRoutes);
app.use("/api/quality-inspection", qualityInspectionRoutes);
// Mount the document routes at /api/documents
app.use('/api/documents', documentRoutes);
app.use("/api/users", usersRoutes);
//app.use(fileUpload());

// Apply Multer middleware with upload.any() for the mrr-upload-documents route
//app.use("/api/quality-inspection", upload.any(), qualityInspectionRoutes);


// Add Multer error handler after route-specific middleware
app.use(multerErrorHandler);

// Notify department head on order submission (MIF/MRF)
app.post(
  "/api/noncoc_umif/submit-order",
  authenticateToken,
  async (req, res) => {
    const { items, project_name } = req.body;
    const userId = req.user.id;

    try {
      await pool.query("BEGIN");

      const userResult = await pool.query(
        `SELECT user_name, department FROM users WHERE id = $1`,
        [userId]
      );
      const userName = userResult.rows[0]?.user_name || "Unknown User";
      const department = userResult.rows[0]?.department;

      const mifInsertQuery = `
      INSERT INTO material_issue_form (user_id, project_name, status, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING umi;
    `;
      const mifResult = await pool.query(mifInsertQuery, [
        userId,
        project_name || null,
        "Head Approval Pending",
      ]);
      const umi = mifResult.rows[0].umi;

      for (const item of items) {
        await pool.query(
          `UPDATE noncoc_basket 
         SET umi = $1, updated_requestedqty = $2, mrf_no = $3, status = $4
         WHERE basket_id = $5`,
          [
            umi,
            item.requested_quantity,
            item.mrf_no || null,
            "Head Approval Pending",
            item.basket_id,
          ]
        );
      }

      let mrfNo = null;
      if (items.some((item) => item.mrf_no)) {
        const mrfInsertQuery = `
        INSERT INTO material_request_form (umi, user_id, project_name, status, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING mrf_no;
      `;
        const mrfResult = await pool.query(mrfInsertQuery, [
          umi,
          userId,
          project_name || null,
          "Head Approval Pending",
        ]);
        mrfNo = mrfResult.rows[0].mrf_no;

        for (const item of items.filter((item) => item.mrf_no)) {
          await pool.query(
            `UPDATE material_request_form_items 
           SET mrf_no = $1 
           WHERE component_id = $2 AND umi = $3`,
            [mrfNo, item.component_id, umi]
          );
        }
      }

      await pool.query("COMMIT");

      const headResult = await pool.query(
        `SELECT id FROM users WHERE role = $1`,
        [`${department}_head`]
      );
      const headId = headResult.rows[0]?.id;

      if (headId) {
        const type = mrfNo ? "mrf" : "mif";
        await sendNotification(
          headId,
          `New ${mrfNo ? "MRF" : "MIF"} request submitted by ${userName}: UMI ${umi}${
            mrfNo ? `, MRF ${mrfNo}` : ""
          }`,
          type,
          umi,
          mrfNo,
          "Head Approval Pending"
        );
      }

      res.json({ message: "Order submitted successfully", umi, mrf_no: mrfNo });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("Order submission error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Notify department head on return request submission
app.post(
  "/api/returns/submit-return",
  authenticateToken,
  async (req, res) => {
    const { items, project_name } = req.body;
    const userId = req.user.id;

    try {
      await pool.query("BEGIN");

      const userResult = await pool.query(
        `SELECT user_name, department FROM users WHERE id = $1`,
        [userId]
      );
      const userName = userResult.rows[0]?.user_name || "Unknown User";
      const department = userResult.rows[0]?.department;

      const returnInsertQuery = `
      INSERT INTO return_requests (user_id, project_name, status, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING umi;
    `;
      const returnResult = await pool.query(returnInsertQuery, [
        userId,
        project_name || null,
        "Head Approval Pending",
      ]);
      const umi = returnResult.rows[0].umi;

      for (const item of items) {
        await pool.query(
          `INSERT INTO return_request_items (umi, component_id, quantity, reason)
         VALUES ($1, $2, $3, $4)`,
          [umi, item.component_id, item.quantity, item.reason || null]
        );
      }

      await pool.query("COMMIT");

      const headResult = await pool.query(
        `SELECT id FROM users WHERE role = $1`,
        [`${department}_head`]
      );
      const headId = headResult.rows[0]?.id;

      if (headId) {
        await sendNotification(
          headId,
          `New return request submitted by ${userName}: UMI ${umi}`,
          "return",
          umi,
          null,
          "Head Approval Pending"
        );
      }

      res.json({ message: "Return request submitted successfully", umi });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("Return submission error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Fetch approval requests for department head
app.get(
  "/api/approvals/approval-requests",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT nb.*, u.user_name, mrf.mrf_no 
       FROM noncoc_basket nb 
       JOIN users u ON nb.user_id = u.id 
       LEFT JOIN material_request_form mrf ON nb.umi = mrf.umi 
       WHERE nb.status = $1`,
        ["Head Approval Pending"]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching approval requests:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Approve MIF/MRF request (Head)
app.put(
  "/api/approvals/approve-request/:umi",
  authenticateToken,
  async (req, res) => {
    const { umi } = req.params;
    const { updatedItems, note, priority } = req.body;

    try {
      await pool.query("BEGIN");

      // Fetch the request details
      const requestResult = await pool.query(
        `SELECT nb.*, mrf.mrf_no 
       FROM noncoc_basket nb 
       LEFT JOIN material_request_form mrf ON nb.umi = mrf.umi 
       WHERE nb.umi = $1 AND nb.status = $2`,
        [umi, "Head Approval Pending"]
      );

      if (requestResult.rowCount === 0) {
        throw new Error("Request not found or not pending head approval");
      }

      const request = requestResult.rows[0];
      const userId = request.user_id;
      const mrfNo = request.mrf_no;

      // Update items in noncoc_basket
      for (const item of updatedItems) {
        await pool.query(
          `UPDATE noncoc_basket 
         SET updated_requestedqty = $1, note = $2, priority = $3
         WHERE umi = $4 AND component_id = $5`,
          [item.updated_requestedqty, note, priority, umi, item.component_id]
        );
      }

      // Determine next status and notify the appropriate team
      let nextStatus, nextRole, notificationType;
      if (mrfNo) {
        // MRF request: Next step is Purchase approval
        nextStatus = "Purchase Approval Pending";
        nextRole = "purchase";
        notificationType = "mrf";
      } else {
        // MIF request: Next step is Inventory approval
        nextStatus = "Inventory Approval Pending";
        nextRole = "inventory";
        notificationType = "mif";
      }

      // Update status in noncoc_basket
      await pool.query(
        `UPDATE noncoc_basket 
       SET status = $1 
       WHERE umi = $2`,
        [nextStatus, umi]
      );

      // Update status in material_issue_form (for MIF) or material_request_form (for MRF)
      if (mrfNo) {
        await pool.query(
          `UPDATE material_request_form 
         SET status = $1 
         WHERE umi = $2`,
          [nextStatus, umi]
        );
      } else {
        await pool.query(
          `UPDATE material_issue_form 
         SET status = $1 
         WHERE umi = $2`,
          [nextStatus, umi]
        );
      }

      // Fetch the next approver
      const nextApproverResult = await pool.query(
        `SELECT id, user_name FROM users WHERE role = $1`,
        [nextRole]
      );
      const nextApproverId = nextApproverResult.rows[0]?.id;
      const nextApproverName =
        nextApproverResult.rows[0]?.user_name || "Unknown Approver";

      if (nextApproverId) {
        await sendNotification(
          nextApproverId,
          `New ${mrfNo ? "MRF" : "MIF"} request UMI ${umi}${
            mrfNo ? `, MRF ${mrfNo}` : ""
          } pending your approval`,
          notificationType,
          umi,
          mrfNo,
          nextStatus
        );
      }

      await pool.query("COMMIT");
      res.json({ message: "Request approved successfully", umi, mrf_no: mrfNo });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("Approve request error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Fetch approval requests for Inventory
app.get(
  "/api/approvals/inventory-approval-requests",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT nb.*, u.user_name 
       FROM noncoc_basket nb 
       JOIN users u ON nb.user_id = u.id 
       WHERE nb.status = $1`,
        ["Inventory Approval Pending"]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching inventory approval requests:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Approve MIF request (Inventory)
app.put(
  "/api/approvals/inventory-approve-request/:umi",
  authenticateToken,
  async (req, res) => {
    const { umi } = req.params;
    const { note } = req.body;

    try {
      await pool.query("BEGIN");

      const requestResult = await pool.query(
        `SELECT nb.*, u.user_name 
       FROM noncoc_basket nb 
       JOIN users u ON nb.user_id = u.id 
       WHERE nb.umi = $1 AND nb.status = $2`,
        [umi, "Inventory Approval Pending"]
      );

      if (requestResult.rowCount === 0) {
        throw new Error("Request not found or not pending inventory approval");
      }

      const request = requestResult.rows[0];
      const originalUserId = request.user_id;
      const userName = request.user_name;

      // Update status to Request Accepted
      await pool.query(
        `UPDATE noncoc_basket 
       SET status = $1, note = $2 
       WHERE umi = $3`,
        ["Request Accepted", note, umi]
      );

      await pool.query(
        `UPDATE material_issue_form 
       SET status = $1 
       WHERE umi = $2`,
        ["Request Accepted", umi]
      );

      // Notify the original user
      await sendNotification(
        originalUserId,
        `Your MIF request UMI ${umi} has been approved`,
        "mif",
        umi,
        null,
        "Request Accepted"
      );

      await pool.query("COMMIT");
      res.json({ message: "MIF request approved successfully", umi });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("Inventory approve request error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Fetch approval requests for Purchase
app.get(
  "/api/mrf-approvals/purchase-approval-requests",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT mrf.*, u.user_name 
       FROM material_request_form mrf 
       JOIN users u ON mrf.user_id = u.id 
       WHERE mrf.status = $1`,
        ["Purchase Approval Pending"]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching purchase approval requests:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Approve MRF request (Purchase)
app.put(
  "/api/mrf-approvals/purchase-approve-request/:mrf_no",
  authenticateToken,
  async (req, res) => {
    const { mrf_no } = req.params;
    const { note } = req.body;

    try {
      await pool.query("BEGIN");

      const requestResult = await pool.query(
        `SELECT mrf.*, u.user_name 
       FROM material_request_form mrf 
       JOIN users u ON mrf.user_id = u.id 
       WHERE mrf.mrf_no = $1 AND mrf.status = $2`,
        [mrf_no, "Purchase Approval Pending"]
      );

      if (requestResult.rowCount === 0) {
        throw new Error(
          "MRF request not found or not pending purchase approval"
        );
      }

      const request = requestResult.rows[0];
      const umi = request.umi;

      // Update status to CEO Approval Pending
      await pool.query(
        `UPDATE material_request_form 
       SET status = $1 
       WHERE mrf_no = $2`,
        ["CEO Approval Pending", mrf_no]
      );

      await pool.query(
        `UPDATE noncoc_basket 
       SET status = $1, note = $2 
       WHERE umi = $3`,
        ["CEO Approval Pending", note, umi]
      );

      // Fetch the CEO
      const ceoResult = await pool.query(
        `SELECT id FROM users WHERE role = $1`,
        ["ceo"]
      );
      const ceoId = ceoResult.rows[0]?.id;

      if (ceoId) {
        await sendNotification(
          ceoId,
          `New MRF request MRF ${mrf_no} pending your approval`,
          "mrf",
          umi,
          mrf_no,
          "CEO Approval Pending"
        );
      }

      await pool.query("COMMIT");
      res.json({ message: "MRF request approved by Purchase", mrf_no });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("Purchase approve request error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Fetch approval requests for CEO
app.get(
  "/api/mrf-approvals/ceo-approval-requests",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT mrf.*, u.user_name 
       FROM material_request_form mrf 
       JOIN users u ON mrf.user_id = u.id 
       WHERE mrf.status = $1`,
        ["CEO Approval Pending"]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching CEO approval requests:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// New endpoint: Fetch all direct PO requests with specified statuses
app.get(
  '/api/mrf-approvals/direct-po-history',
  authenticateToken,
  async (req, res) => {
    try {
      console.log('Received request for /api/mrf-approvals/direct-po-history');
      console.log('User from token:', req.user);

      const testConnection = await pool.query('SELECT NOW() as current_time');
      console.log('Database connection test successful:', testConnection.rows[0]);

      console.log('Executing query to fetch direct PO requests history...');
      const result = await pool.query(
        `
        SELECT 
          dpr.direct_sequence,
          dpr.project_name,
          dpr.created_at,
          dpr.vendor,
          dpr.note,
          dpr.total_po_cost,
          dpr.mrf_no,
          dpr.mpn,
          dpr.item_description,
          dpr.make,
          dpr.part_no,
          dpr.requested_quantity,
          dpr.uom,
          dpr.rate_per_unit,
          dpr.amount_inr,
          dpr.gst_type,
          dpr.gst_amount,
          dpr.submitted_at,
          dpr.status
        FROM direct_po_requests dpr
        WHERE dpr.status IN ('CEO Approval Pending', 'CEO Approval Done', 'Hold', 'PO Raised', 'Rejected')
        ORDER BY dpr.direct_sequence, dpr.created_at DESC;
        `
      );

      console.log('Query executed successfully, row count:', result.rowCount);
      if (result.rowCount === 0) {
        console.log('No direct PO requests found.');
        return res.status(200).json([]);
      }

      console.log('Sample row from query result:', result.rows[0]);

      // Return flat list of all rows instead of grouping
      const response = result.rows.map(row => ({
        direct_sequence: row.direct_sequence || 'N/A',
        project_name: row.project_name || 'N/A',
        mrf_no: row.mrf_no || 'N/A',
        status: row.status || 'N/A',
        created_at: row.created_at ? row.created_at.toISOString() : 'N/A',
        vendor: row.vendor || 'Unknown Vendor',
        note: row.note || '',
        total_po_cost: parseFloat(row.total_po_cost || 0),
        user_name: row.user_name || 'Unknown User',
        mpn: row.mpn || 'N/A',
        item_description: row.item_description || 'N/A',
        make: row.make || 'N/A',
        part_no: row.part_no || 'N/A',
        requested_quantity: parseInt(row.requested_quantity || 0),
        uom: row.uom || 'N/A',
        rate_per_unit: parseFloat(row.rate_per_unit || 0),
        amount_inr: parseFloat(row.amount_inr || 0),
        gst_type: row.gst_type || 'N/A',
        gst_amount: parseFloat(row.gst_amount || 0),
        submitted_at: row.submitted_at ? row.submitted_at.toISOString() : 'N/A',
      }));

      console.log(`Fetched ${response.length} direct PO requests for history`);
      res.json(response);
    } catch (err) {
      console.error('Error fetching direct PO requests history:', {
        message: err.message,
        stack: err.stack,
      });
      res.status(500).json({ error: 'Failed to fetch direct PO requests history: ' + err.message });
    }
  }
);

// Approve MRF request (CEO)
app.put(
  "/api/mrf-approvals/ceo-approve-request/:mrf_no",
  authenticateToken,
  async (req, res) => {
    const { mrf_no } = req.params;
    const { note } = req.body;

    try {
      await pool.query("BEGIN");

      const requestResult = await pool.query(
        `SELECT mrf.*, u.user_name 
       FROM material_request_form mrf 
       JOIN users u ON mrf.user_id = u.id 
       WHERE mrf.mrf_no = $1 AND mrf.status = $2`,
        [mrf_no, "CEO Approval Pending"]
      );

      if (requestResult.rowCount === 0) {
        throw new Error("MRF request not found or not pending CEO approval");
      }

      const request = requestResult.rows[0];
      const originalUserId = request.user_id;
      const umi = request.umi;

      // Update status to Request Accepted
      await pool.query(
        `UPDATE material_request_form 
       SET status = $1 
       WHERE mrf_no = $2`,
        ["Request Accepted", mrf_no]
      );

      await pool.query(
        `UPDATE noncoc_basket 
       SET status = $1, note = $2 
       WHERE umi = $3`,
        ["Request Accepted", note, umi]
      );

      // Notify the original user
      await sendNotification(
        originalUserId,
        `Your MRF request MRF ${mrf_no} has been approved`,
        "mrf",
        umi,
        mrf_no,
        "Request Accepted"
      );

      await pool.query("COMMIT");
      res.json({ message: "MRF request approved by CEO", mrf_no });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("CEO approve request error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Fetch pending notifications (updated to filter by both status and user_id)
app.get(
  "/api/notifications/pending",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Determine the status to fetch based on the user's role
      let targetStatus;
      switch (userRole) {
        case "inventory":
          targetStatus = "Inventory Approval Pending";
          break;
        case "purchase":
          targetStatus = "Purchase Approval Pending";
          break;
        case "ceo":
          targetStatus = "CEO Approval Pending";
          break;
        default:
          if (userRole.endsWith("_head")) {
            targetStatus = "Head Approval Pending";
          } else {
            targetStatus = "Request Accepted";
          }
      }

      // Fetch notifications based on both status and user_id
      const query = `
      SELECT n.id, n.user_id, n.umi, n.mrf_no, n.type, n.message, n.status, n.is_read, n.created_at, n.updated_at,
             nb.status AS basket_status, nb.note AS note_head, COALESCE(mif.note, 'N/A') AS note_inventory,
             u.user_name AS intended_user
      FROM notifications n 
      JOIN noncoc_basket nb ON n.umi = nb.umi 
      LEFT JOIN material_issue_form mif ON mif.umi = nb.umi AND mif.component_id = nb.component_id 
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.status = $1 
      AND n.user_id = $2
      AND nb.status != 'Issued';
    `;
      const queryParams = [targetStatus, userId];

      const result = await pool.query(query, queryParams);
      res.json(result.rows);
    } catch (err) {
      console.error("Notification fetch error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  "/api/nc-requests/confirm-receipt/:umi",
  authenticateToken,
  async (req, res) => {
    const { umi } = req.params;
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid or missing items array" });
    }
    try {
      await pool.query("BEGIN");
      const updateQuery = `
      UPDATE noncoc_basket 
      SET status = $1, received_quantity = COALESCE($2, received_quantity)
      WHERE umi = $3 AND component_id = $4
      RETURNING *;
    `;
      for (const item of items) {
        if (!item.component_id || item.received_quantity == null) {
          throw new Error("Missing component_id or received_quantity in item");
        }
        const validationQuery = `
        SELECT COALESCE(updated_requestedqty, initial_requestedqty) AS max_qty
        FROM noncoc_basket
        WHERE umi = $1 AND component_id = $2;
      `;
        const validationResult = await pool.query(validationQuery, [
          umi,
          item.component_id,
        ]);
        const maxQty = validationResult.rows[0]?.max_qty || 0;
        if (parseInt(item.received_quantity) > maxQty) {
          throw new Error(
            `Received quantity (${item.received_quantity}) exceeds max allowed (${maxQty}) for component_id ${item.component_id}`
          );
        }
        const result = await pool.query(updateQuery, [
          "Issued",
          item.received_quantity,
          umi,
          item.component_id,
        ]);
        if (result.rowCount === 0) {
          throw new Error(
            `No record updated for umi ${umi} and component_id ${item.component_id}`
          );
        }
      }
      await pool.query("COMMIT");
      res.json({ message: "Receipt confirmed", umi });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("Confirm receipt error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

app.get('/api/nc-requests/purchase-order-components', authenticateToken, async (req, res) => {
  try {
    // Log the user role for debugging
    console.log(`User role: ${req.user.role}`);

    // Debug: Check raw created_at values in the purchase_orders table
    const debugCreatedAt = await pool.query(`
      SELECT po_number, created_at AS raw_created_at, TO_CHAR(created_at, 'YYYY-MM-DD') AS formatted_created_at
      FROM purchase_orders
      WHERE TRIM(LOWER(status)) = 'material delivery pending'
      LIMIT 5;
    `);
    console.log("Debug: Raw and formatted created_at values from purchase_orders:", debugCreatedAt.rows);

    // Check for distinct statuses in purchase_orders to debug
    const statusCheck = await pool.query(`
      SELECT DISTINCT status
      FROM purchase_orders
      WHERE TRIM(LOWER(status)) = 'material delivery pending';
    `);
    console.log("Raw statuses in purchase_orders:", statusCheck.rows);

    // Fetch components with formatted created_at
    const result = await pool.query(`
      SELECT 
        po.po_number,
        po.mrf_no,
        po.vendor_name,
        TO_CHAR(po.created_at, 'YYYY-MM-DD') AS created_at, -- Ensure date is formatted as YYYY-MM-DD
        po.mpn,
        po.item_description,
        po.part_no,
        po.make,
        po.uom,
        po.updated_requested_quantity,
        TO_CHAR(po.expected_delivery_date, 'YYYY-MM-DD') AS expected_delivery_date, -- Add this
        po.status,
        ncc.component_id,
        ncc.location
      FROM purchase_orders po
      LEFT JOIN non_coc_components ncc 
        ON po.component_id = ncc.component_id
      WHERE TRIM(LOWER(po.status)) = 'material delivery pending'
      ORDER BY po.created_at DESC;
    `);

    const components = result.rows || [];
    console.log(`Fetched ${components.length} purchase order components from DB:`);
    console.log("First 5 components (or all if less than 5):", components.slice(0, 5));

    // Check if any components have invalid created_at
    components.forEach((comp, index) => {
      if (!comp.created_at || comp.created_at === 'N/A') {
        console.warn(`Component ${index} has invalid created_at:`, comp);
      }
    });

    res.json({ data: components }); // Wrap in a data object for consistency
  } catch (err) {
    console.error("Error fetching purchase order components:", err);
    res.status(500).json({ error: 'Failed to fetch purchase order components: ' + err.message });
  }
});


app.get('/api/purchase-orders', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        po.po_id, 
        po.expected_delivery_date,
        po.mrf_no, 
        po.po_number, 
        po.mpn, 
        po.mrr_no,
        po.uom, 
        po.mpn_received, 
        po.make_received,
        po.date_code, 
        po.lot_code, 
        po.received_quantity, 
        po.passed_quantity, 
        po.coc_received, 
        po.note,
        po.failed_quantity,
        po.material_in_quantity, 
        po.item_description,  
        po.part_no, 
        po.make, 
        ncc.on_hand_quantity, 
        ncc.location,            
        po.updated_requested_quantity, 
        po.status, 
        po.vendor_name,
        po.component_id,
       DATE(po.created_at) AS created_at,

        -- Nested backorder array with additional fields
        COALESCE(bo.backorder_sequences, '[]') AS backorder_sequences,

        -- Nested return array
        COALESCE(ri.return_sequences, '[]') AS return_sequences

      FROM purchase_orders po

      JOIN non_coc_components ncc 
        ON po.component_id = ncc.component_id


      -- Subquery for backorder sequences with additional fields
      LEFT JOIN (
        SELECT 
          bi.po_number, 
          bi.mpn,
          json_agg(json_build_object(
            'backorder_sequence', bi.backorder_sequence,
            'reordered_quantity', bi.reordered_quantity,
            'received_quantity', bi.received_quantity,
            'material_in_quantity', bi.material_in_quantity,
            'status', bi.status,
             'created_at', DATE(bi.created_at) -- Ensure created_at is fetched as a date
          )) AS backorder_sequences
        FROM backorder_items bi
        WHERE bi.status NOT IN ('Backorder generated and material delivery pending')
        GROUP BY bi.po_number, bi.mpn
      ) bo
        ON po.po_number = bo.po_number AND po.mpn = bo.mpn

      -- Subquery for return sequences
      LEFT JOIN (
        SELECT 
          ri.po_number, 
          ri.mpn,
          json_agg(json_build_object(
            'return_sequence', ri.return_sequence,
            'reordered_quantity', ri.reordered_quantity
          )) AS return_sequences
        FROM return_items ri
        GROUP BY ri.po_number, ri.mpn
      ) ri
        ON po.po_number = ri.po_number AND po.mpn = ri.mpn

      WHERE 
    po.status NOT IN ('Material Delivery Pending', 'PO Raised')
    OR po.status ILIKE 'Warehouse In%'
    OR po.status ILIKE '%backordered%'
ORDER BY 
    po.po_number, 
    po.mpn;

    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching purchase orders:", err);
    res.status(500).json({ error: 'Failed to fetch purchase orders: ' + err.message });
  }
});

app.put('/api/purchase-orders/:po_id/material-in', authenticateToken, async (req, res) => {
  const { po_id } = req.params;
  const { material_in_quantity, mrf_no } = req.body;

  if (material_in_quantity == null) {
    return res.status(400).json({ error: 'Material in quantity is required' });
  }

  try {
    await pool.query('BEGIN');

    // Get user_id from the token
    const user_id = req.user.id;
    if (!user_id) {
      await pool.query('ROLLBACK');
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    // Get component_id and validate PO
    const poResult = await pool.query(`
      SELECT component_id FROM purchase_orders WHERE po_id = $1
    `, [po_id]);

    if (poResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const { component_id } = poResult.rows[0];

    // Update material_in_quantity in purchase_orders
    await pool.query(`
      UPDATE purchase_orders
      SET material_in_quantity = $1
      WHERE po_id = $2
    `, [material_in_quantity, po_id]);

    // Update on_hand_quantity in non_coc_components
    await pool.query(`
      UPDATE non_coc_components
      SET on_hand_quantity = on_hand_quantity + $1
      WHERE component_id = $2
    `, [material_in_quantity, component_id]);

    // Insert into stockcard
    await pool.query(`
      INSERT INTO noncoc_stockcard (
        component_id, transaction_type, transaction_date, mrf_no,
        balance, requested_quantity, user_id
      ) VALUES (
        $1, 'Received Material', CURRENT_TIMESTAMP, $2,
        (SELECT on_hand_quantity FROM non_coc_components WHERE component_id = $1),
        $3, $4
      )
    `, [component_id, mrf_no || null, material_in_quantity, user_id]);

    await pool.query('COMMIT');
    res.json({ success: true });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error updating material in:', err);
    res.status(500).json({ error: 'Failed to update material in' });
  }
});

app.post("/api/backorder", authenticateToken, async (req, res) => {
  const { components } = req.body;
  const userId = req.user.id;

  // Validate input
  if (!components || !Array.isArray(components) || components.length === 0) {
    return res.status(400).json({ error: "Invalid or missing components array" });
  }

  try {
    await pool.query("BEGIN");

    // Generate a single backorder sequence
    const seqResult = await pool.query("SELECT nextval('backorder_sequence_seq') AS seq");
    const newSequence = seqResult.rows[0].seq;
    const sequence = `BO-${newSequence}`;
    const backorderSequenceList = [];

    for (const component of components) {
      const {
        po_number,
        mpn,
        ordered_quantity,
        received_quantity,
        failed_quantity,
        item_description,
        isSelected,
      } = component;

      // Skip if component is not selected
      if (!isSelected) {
        continue;
      }

      // Calculate reordered quantity
      const receivedQty = parseInt(received_quantity) || 0;
      const orderedQty = parseInt(ordered_quantity) || 0;
      const failedQty = parseInt(failed_quantity) || 0;
      const reorderedQty = Math.max(0, orderedQty - receivedQty);

      // Skip if no quantity to backorder
      if (reorderedQty <= 0 && failedQty <= 0) {
        continue;
      }

      // Validate purchase order
      const poResult = await pool.query(
        `SELECT po_id, failed_quantity FROM purchase_orders WHERE po_number = $1 AND mpn = $2`,
        [po_number, mpn]
      );
      if (poResult.rows.length === 0) {
        throw new Error(`Purchase order not found for PO ${po_number} and MPN ${mpn}`);
      }

      // Determine status
      let status;
      if (failedQty > 0) {
        status = `Warehouse In, Backordered (${reorderedQty}) Returned (${failedQty})`;
      } else {
        status = `Warehouse In, Backordered (${reorderedQty})`;
      }

      // Insert into backorder_items
      await pool.query(
        `INSERT INTO backorder_items (
          user_id, po_number, mpn, item_description, backorder_sequence, reordered_quantity
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, po_number, mpn, item_description || '', sequence, reorderedQty]
      );

      // Update purchase_orders status
      await pool.query(
        `UPDATE purchase_orders SET status = $1 WHERE po_number = $2 AND mpn = $3`,
        [status, po_number, mpn]
      );

      backorderSequenceList.push({
        po_number,
        mpn,
        backorder_sequence: sequence,
        reordered_quantity: reorderedQty,
      });
    }

    // Check if any components were processed
    if (backorderSequenceList.length === 0) {
      throw new Error("No valid components to backorder");
    }

    await pool.query("COMMIT");

    // Notify inventory head
    const headResult = await pool.query(`SELECT id FROM users WHERE role = 'purchase_head'`);
    const headId = headResult.rows[0]?.id;
    if (headId) {
      const poNumbers = [...new Set(backorderSequenceList.map(item => item.po_number))];
      const poNumbersStr = poNumbers.join(", ");
      const message = `New backorder ${sequence} created against PO Number ${poNumbersStr}, kindly add the expected_delivery_date.`;

      await sendNotification(
        headId,
        message,
        'backorder',
        null,
        null,
        'Backordered'
      );
    }

    res.json({
      message: "Backorder submitted successfully",
      backorder_sequence: sequence,
      items: backorderSequenceList,
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Backorder submission error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/return", authenticateToken, async (req, res) => {
  const { components } = req.body;
  const userId = req.user.id;

  if (!components || !Array.isArray(components) || components.length === 0) {
    return res.status(400).json({ error: "Invalid or missing components array" });
  }

  try {
    await pool.query("BEGIN");

    // Generate single return sequence like RO-10001
    const seqResult = await pool.query("SELECT nextval('return_sequence_generator') AS seq");
    const newSequence = seqResult.rows[0].seq;
    const returnSequence = `RO-${newSequence}`;
    const returnSequenceList = [];

    // // Fetch user details
    // const userResult = await pool.query(
    //   `SELECT user_name, department FROM users WHERE id = $1`,
    //   [userId]
    // );
    // const userName = userResult.rows[0]?.user_name || "Unknown User";
    // const department = userResult.rows[0]?.department;

    for (const component of components) {
      const { po_number, mpn, failed_quantity, item_description } = component;
      const reorderedQty = parseInt(failed_quantity) || 0;

      if (reorderedQty <= 0) {
        continue;
      }

      // Validate purchase order exists
      const poResult = await pool.query(
        `SELECT po_id FROM purchase_orders WHERE po_number = $1 AND mpn = $2`,
        [po_number, mpn]
      );
      if (poResult.rows.length === 0) {
        throw new Error(`Purchase order not found for PO ${po_number} and MPN ${mpn}`);
      }

      // Insert into return_items table
      await pool.query(
        `INSERT INTO return_items (
          user_id, po_number, mpn, item_description, failed_quantity, reordered_quantity, return_sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          po_number,
          mpn,
          item_description || '',
          reorderedQty,
          reorderedQty,
          returnSequence,
        ]
      );

      returnSequenceList.push({
        po_number,
        mpn,
        return_sequence: returnSequence,
        failed_quantity: reorderedQty,
      });

      // Optionally update PO status if needed
      await pool.query(
        `UPDATE purchase_orders SET status = $1 WHERE po_number = $2 AND mpn = $3`,
        ['Returned', po_number, mpn]
      );
    }

    if (returnSequenceList.length === 0) {
      throw new Error("No valid components to return");
    }

    // // Notify head of department
    // const headResult = await pool.query(
    //   `SELECT id FROM users WHERE role = $1`,
    //   [`${department}_head`]
    // );
    // const headId = headResult.rows[0]?.id;

    // if (headId) {
    //   await sendNotification(
    //     headId,
    //     `Return request raised by ${userName}: ${returnSequence}`,
    //     "return",
    //     returnSequence,
    //     null,
    //     "Head Approval Pending"
    //   );
    // }

    await pool.query("COMMIT");

    res.json({
      message: "Return submitted successfully",
      returnSequence: returnSequenceList
    });

  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Return submission error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/quality-inspection/components", authenticateToken, async (req, res) => {
  try {
    // Query to fetch required fields from purchase_orders and backorder_items
    const query = `
      SELECT 
        po.po_number,
        po.mpn,
        po.vendor_name,
        po.mrf_no,
        po.item_description,
        po.part_no,
        po.uom,
        po.make,
        bi.reordered_quantity,
        bi.status,
        bi.passed_quantity,
        bi.date_code,
        bi.lot_code,
        bi.mrr_no,
        bi.material_in_quantity,
        bi.coc_received,
        bi.received_quantity,
        bi.failed_quantity,
        bi.expected_delivery_date AS receipt_date,
        
        ncc.location
      FROM purchase_orders po
      INNER JOIN backorder_items bi ON po.po_number = bi.po_number
      LEFT JOIN non_coc_components ncc ON po.component_id = ncc.component_id
      WHERE bi.status IN ('QC Cleared', 'QC Rejected')
      ORDER BY bi.expected_delivery_date DESC
    `;

    const result = await pool.query(query);
    
    // Check if any results were found
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No quality inspection components found" });
    }

    // Return the fetched components
    res.status(200).json(result.rows);
  } catch (err) {
    // Log error with context for debugging
    console.error("Error fetching quality inspection components:", {
      error: err.message,
      stack: err.stack,
    });
    
    // Return a generic error message to the client
    res.status(500).json({ error: "Internal server error while fetching components" });
  }
});

app.put('/api/backorder-items/:mpn/material-in', authenticateToken, async (req, res) => {
  const { mpn } = req.params;
  const { material_in_quantity, mrf_no } = req.body;

  if (material_in_quantity == null) {
    return res.status(400).json({ error: 'Material in quantity is required' });
  }

  try {
    await pool.query('BEGIN');

    // Get user ID from token
    const user_id = req.user.id;
    if (!user_id) {
      await pool.query('ROLLBACK');
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    // ✅ Fetch component_id from non_coc_components using mpn
    const compResult = await pool.query(`
      SELECT component_id FROM non_coc_components WHERE mpn = $1
    `, [mpn]);

    if (compResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Component not found in non_coc_components' });
    }

    const component_id = compResult.rows[0].component_id;

    // ✅ Update material_in_quantity in backorder_items
    await pool.query(`
      UPDATE backorder_items
      SET material_in_quantity = $1
      WHERE mpn = $2
    `, [material_in_quantity, mpn]);

    // ✅ Update on_hand_quantity in non_coc_components
    await pool.query(`
      UPDATE non_coc_components
      SET on_hand_quantity = on_hand_quantity + $1
      WHERE component_id = $2
    `, [material_in_quantity, component_id]);

    // ✅ Insert into noncoc_stockcard
    await pool.query(`
      INSERT INTO noncoc_stockcard (
        component_id, transaction_type, transaction_date, mrf_no,
        balance, requested_quantity, user_id
      ) VALUES (
        $1, 'Received Material', CURRENT_TIMESTAMP, $2,
        (SELECT on_hand_quantity FROM non_coc_components WHERE component_id = $3),
        $4, $5
      )
    `, [component_id, mrf_no || null, component_id, material_in_quantity, user_id]);

    await pool.query('COMMIT');
    res.json({ success: true });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error updating backorder material in:', err);
    res.status(500).json({ error: 'Failed to update backorder material in' });
  }
});

app.get(
  "/api/mrf-approvals/ceo-approved-for-po",
  authenticateToken,
  async (req, res) => {
    try {
      console.log("Received request for /api/mrf-approvals/ceo-approved-for-po");
      console.log("User from token:", req.user);

      const testConnection = await pool.query("SELECT NOW() as current_time");
      console.log("Database connection test successful:", testConnection.rows[0]);

      console.log("Executing query to fetch CEO approved direct PO requests...");
      const result = await pool.query(
        `
        SELECT 
          dpr.direct_sequence,
          dpr.project_name,
          dpr.status,
          dpr.created_at,
          dpr.vendor,
          dpr.note,
          dpr.total_po_cost,
          dpr.mrf_no,
          dpr.mpn,
          dpr.item_description,
          dpr.make,
          dpr.part_no,
          dpr.requested_quantity,
          dpr.uom,
          dpr.rate_per_unit,
          dpr.amount_inr,
          dpr.gst_type,
          dpr.gst_amount,
          dpr.submitted_at
        FROM direct_po_requests dpr
        WHERE dpr.status = $1
        ORDER BY dpr.direct_sequence, dpr.created_at DESC;
        `,
        ["CEO Approval Done"]
      );

      console.log("Query executed successfully, row count:", result.rowCount);
      if (result.rowCount === 0) {
        console.log("No CEO approved direct PO requests found.");
        return res.status(200).json([]);
      }

      console.log("Sample row from query result:", result.rows[0]);

      const groupedData = result.rows.reduce((acc, row) => {
        const sequence = row.direct_sequence || "N/A";

        if (!acc[sequence]) {
          acc[sequence] = {
            direct_sequence: sequence,
            project_name: row.project_name || "N/A",
            mrf_no: row.mrf_no || "N/A",
            status: row.status || "CEO Approval Done",
            created_at: row.created_at ? row.created_at.toISOString() : "N/A",
            vendor: row.vendor || "Unknown Vendor",
            note: row.note || "",
            total_po_cost: parseFloat(row.total_po_cost || 0),
            user_name: row.user_name || "Unknown User",
            components: [],
          };
        }

        let parsedNote = row.note || "";
        try {
          if (row.note) {
            const parsed = JSON.parse(row.note);
            if (Array.isArray(parsed) && parsed.length > 0) {
              parsedNote = parsed[0].content || row.note || "";
            }
          }
        } catch (e) {
          console.error(`Error parsing note for row with direct_sequence ${sequence}:`, {
            note: row.note,
            error: e.message,
          });
          parsedNote = row.note || "";
        }

        acc[sequence].components.push({
          id: row.id || null,
          mpn: row.mpn || "N/A",
          item_description: row.item_description || "N/A",
          make: row.make || "N/A",
          part_no: row.part_no || "N/A",
          requested_quantity: parseInt(row.requested_quantity || 0),
          uom: row.uom || "N/A",
          vendor: row.vendor || "Unknown Vendor",
          rate_per_unit: parseFloat(row.rate_per_unit || 0),
          amount_inr: parseFloat(row.amount_inr || 0),
          gst_type: row.gst_type || "N/A",
          gst_amount: parseFloat(row.gst_amount || 0),
          total_po_cost: parseFloat(row.total_po_cost) || 0,
          note: parsedNote,
          submitted_at: row.submitted_at ? row.submitted_at.toISOString() : "N/A",
        });

        return acc;
      }, {});

      const response = Object.values(groupedData);
      console.log(`Fetched ${response.length} CEO approved direct PO requests for PO`);
      res.json(response);
    } catch (err) {
      console.error("Error fetching CEO approved direct PO requests for PO:", {
        message: err.message,
        stack: err.stack,
      });
      res.status(500).json({ error: "Failed to fetch CEO approved direct PO requests: " + err.message });
    }
  }
);

// GET endpoint to fetch inventory items
app.get('/api/inventory/items', authenticateToken, async (req, res) => {
  try {
    console.log('Received request for /api/inventory-items');
    console.log('User from token:', req.user);

    // Test database connection
    const testConnection = await pool.query('SELECT NOW() as current_time');
    console.log('Database connection test successful:', testConnection.rows[0]);

    // Construct query parameters
    const { item_name, category, date_from, date_to, status } = req.query;
    let query = `
      SELECT 
        i.id as item_id,
        i.item_name as category,
        i.category,
        i.quantity,
        i.unit_price,
        i.last_updated_at,
        i.status
      FROM inventory_items i
      WHERE 1=1
    `;
    const queryParams = [];

    // Dynamically add filters
    if (item_name) {
      query += ` AND i.item_name LIKE $${queryParams.length + 1}`;
      queryParams.append('%${item_name}%');
    }
    if (category) {
      query += ` AND i.category = $${queryParams.length + 1}`;
      queryParams.append(category);
    }
    if (date_from) {
      query += ` AND i.last_updated_at >= $${queryParams.length + 1}`;
      queryParams.append(date_from);
    }
    if (date_to) {
      query += ` AND i.last_updated_at <= $${queryParams.length + 1}`;
      queryParams.append(date_to);
    }
    if (status) {
      query += ` AND i.status = $${queryParams.length + 1}`;
      queryParams.append(status);
    }

    query += ` ORDER BY i.item_id, i.last_updated_at DESC;`;

    console.log('Executing query to fetch inventory items...');
    const result = await pool.query(query, queryParams);

    console.log('Query executed successfully, row count:', result.rowCount, result.rows);
    if (result.rowCount === 0) {
      console.log('No inventory items found.');
      return res.status(200).json([]);
    }

    // Group data by item_id
    const groupedData = result.rows.reduce((acc, row) => {
      const itemId = row.item_id || 'N/A';

      if (!acc[itemId]) {
        acc[itemId] = {
          item_id: itemId,
          item_name: row.item_name || 'N/A',
          category: row.category || 'N/A',
          quantity: parseInt(row.quantity || 0),
          unit_price: parseFloat(row.unit_price || 0),
          last_updated: row.last_updated_at ? row.last_updated_at.toISOString() : 'N/A',
          status: row.status || 'N/A',
          details: [],
        };
      }

      acc[itemId].details.push({
        item_id: row.item_id,
        quantity: parseInt(row.quantity || 0),
        unit_price: parseFloat(row.unit_price || 0),
        last_updated: row.last_updated_at ? row.last_updated_at.toISOString() : 'N/A',
        status: row.status || 'N/A',
      });

      return acc;
    }, {});

    const response = Object.values(groupedData);
    console.log(`Fetched ${response.length} rows of inventory items`);
    res.status(200).json(response);
  } catch (err) {
    console.error('Error fetching inventory items:', {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: 'Failed to fetch inventory items: ' + err.message });
  }
});

app.get('/mrf-approvals/previous-vendors', authenticateToken, async (req, res) => {
  const { componentId } = req.query;
  const { limit = 5, offset = 0 } = req.query;

  if (!componentId) {
    return res.status(400).json({ error: 'componentId is required' });
  }

  const queryParams = [];
  let query = `
    SELECT DISTINCT vendor_name
    FROM purchase_orders
    WHERE component_id = $1
    ORDER BY created_at DESC
  `;
  queryParams.push(componentId);

  if (limit || offset) {
    query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(parseInt(limit), parseInt(offset));
  }

  try {
    const result = await pool.query(query, queryParams);
    res.json({
      data: result.rows.map(row => row.vendor_name),
      total: result.rowCount,
      limit,
      offset,
    });
  } catch (err) {
    console.error("Error fetching previous vendors:", err);
    res.status(500).json({ error: err.message });
  }
});
// Catch-all for 404 errors
app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

// addiing code for backend health 
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});


// Error-handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));