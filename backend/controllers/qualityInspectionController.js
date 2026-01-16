const db = require('../db');

// Generate a new MRR number using the sequence
const generateMrrNo = async () => {
  try {
    const result = await db.query('SELECT nextval(\'mrr_no_seq\') AS mrr_seq');
    const mrrSeq = result.rows[0].mrr_seq;
    return `MRR${mrrSeq}`;
  } catch (error) {
    console.error('Error generating MRR number:', error);
    throw new Error('Failed to generate MRR number');
  }
};



// Fetch all components for quality inspection
const getQualityInspectionComponents = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;

    if (!["quality_head", "quality_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only quality team or admin can view quality inspection components",
      });
    }

    const query = `
      SELECT 
        po.mrf_no,
        po.expected_delivery_date,
        po.mpn,
        po.item_description,
        po.make,
        po.part_no,
        po.po_number,
        po.status,
        po.updated_requested_quantity,
        po.uom,
        po.vendor_name,
        po.mpn_received,
        po.make_received,
        po.date_code,
        po.lot_code,
        po.received_quantity,
        po.passed_quantity,
        po.failed_quantity,
        po.coc_received,
        po.note
      FROM purchase_orders po
      LEFT JOIN mrr_documents mrr ON po.po_number = mrr.po_number
      WHERE po.status IN ('Material Delivered & Quality Check Pending', 'QC Cleared')
        AND mrr.mrr_no IS NULL
      ORDER BY po.created_at ASC
    `;

    const result = await db.query(query);
    
    const processedRows = result.rows.map((row, index) => {
      let formattedDeliveryDate = row.expected_delivery_date;
      if (formattedDeliveryDate && typeof formattedDeliveryDate === 'string') {
        formattedDeliveryDate = formattedDeliveryDate.replace(/\//g, '-');
      }

      return {
        s_no: index + 1,
        mrf_no: row.mrf_no || "N/A",
        expected_delivery_date: formattedDeliveryDate || "N/A",
        mpn: row.mpn || "N/A",
        item_description: row.item_description || "N/A",
        make: row.make || "-",
        part_no: row.part_no || "-",
        po_number: row.po_number || "N/A",
        status: row.status || "Material Delivered & Quality Check Pending",
        updated_requested_quantity: row.updated_requested_quantity || 0,
        uom: row.uom || "N/A",
        vendor_name: row.vendor_name || "N/A",
        received_mpn: row.mpn_received || "",
        received_make: row.make_received || "",
        date_code: row.date_code || "",
        lot_code: row.lot_code || "",
        received_quantity: row.received_quantity || "",
      passed_quantity: row.passed_quantity || "",
        failed_quantity: row.failed_quantity || "0",
        coc_received: row.coc_received || false,
        note: row.note || "",
      };
    });

    const columnsToShow = {
      mrf_no: processedRows.some(row => row.mrf_no !== "N/A"),
      expected_delivery_date: processedRows.some(row => row.expected_delivery_date !== "N/A"),
      mpn: processedRows.some(row => row.mpn !== "N/A"),
      item_description: processedRows.some(row => row.item_description !== "N/A"),
      make: processedRows.some(row => row.make !== "-"),
      part_no: processedRows.some(row => row.part_no !== "-"),
      po_number: processedRows.some(row => row.po_number !== "N/A"),
      status: processedRows.some(row => row.status !== "Material Delivered & Quality Check Pending"),
      updated_requested_quantity: processedRows.some(row => row.updated_requested_quantity !== 0),
      uom: processedRows.some(row => row.uom !== "N/A"),
      vendor_name: processedRows.some(row => row.vendor_name !== "N/A"),
      received_mpn: processedRows.some(row => row.received_mpn !== ""),
      received_make: processedRows.some(row => row.received_make !== ""),
      date_code: processedRows.some(row => row.date_code !== ""),
      lot_code: processedRows.some(row => row.lot_code !== ""),
      received_quantity: processedRows.some(row => row.received_quantity !== ""),
      passed_quantity: processedRows.some(row => row.passed_quantity !== ""),
      failed_quantity: processedRows.some(row => row.failed_quantity !== "0"),
      coc_received: processedRows.some(row => row.coc_received !== false),
      note: processedRows.some(row => row.note !== ""),
    };

    return res.status(200).json({ data: processedRows, columnsToShow });
  } catch (error) {
    console.error("Error fetching quality inspection components:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

const getBackorderQualityInspectionComponents = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;

    if (!["quality_head", "quality_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only quality team or admin can view backorder quality inspection components",
      });
    }

    // Fetch backorder items with additional fields from purchase_orders
    const query = `
      SELECT DISTINCT ON (bi.po_number, bi.mpn)
        po.mrf_no AS po_mrf_no,
        bi.expected_delivery_date,
        bi.mpn,
        bi.item_description,
        po.make,
        po.part_no,
        bi.po_number,
        bi.status,
        bi.reordered_quantity AS updated_requested_quantity,
        po.uom,
        po.vendor_name,
        bi.mpn_received,
        bi.make_received,
        bi.date_code,
        bi.lot_code,
        bi.received_quantity,
        bi.passed_quantity,
        bi.failed_quantity,
        bi.coc_received,
        bi.note,
        bi.backorder_sequence
      FROM backorder_items bi
      LEFT JOIN purchase_orders po
        ON bi.po_number = po.po_number AND bi.mpn = po.mpn
     LEFT JOIN mrr_documents mrr ON bi.po_number = mrr.po_number
      WHERE bi.status IN ('Material Delivered & Quality Check Pending', 'QC Cleared')
        AND mrr.mrr_no IS NULL
      `;
      // ORDER BY bi.created_at ASC;

    const result = await db.query(query);

    const processedRows = result.rows.map((row, index) => {
      let formattedDeliveryDate = row.expected_delivery_date;
      if (formattedDeliveryDate && typeof formattedDeliveryDate === 'string') {
        formattedDeliveryDate = formattedDeliveryDate.replace(/\//g, '-');
      }

      return {
        s_no: index + 1,
        mrf_no: row.po_mrf_no || row.bi_mrf_no || "N/A", // Prioritize purchase_orders mrf_no, fall back to backorder_items mrf_no
        expected_delivery_date: formattedDeliveryDate || "N/A",
        mpn: row.mpn || "N/A",
        item_description: row.item_description || "N/A",
        make: row.make || "-",
        part_no: row.part_no || "-",
        po_number: row.po_number || "N/A",
        status: row.status || "Material Delivered & Quality Check Pending",
        updated_requested_quantity: row.updated_requested_quantity || 0, // This is reordered_quantity aliased
        uom: row.uom || "N/A",
        vendor_name: row.vendor_name || "N/A",
        received_mpn: row.mpn_received || "",
        received_make: row.make_received || "",
        date_code: row.date_code || "",
        lot_code: row.lot_code || "",
        received_quantity: row.received_quantity || "",
        passed_quantity: row.passed_quantity || "",
        failed_quantity: row.failed_quantity || "0",
        coc_received: row.coc_received || false,
        note: row.note || "",
        backorder_sequence: row.backorder_sequence,
        source: "backorder", // Add a source field to distinguish backorder items
      };
    });

    return res.status(200).json({ data: processedRows });
  } catch (error) {
    console.error("Error fetching backorder quality inspection components:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// Fetch QC done components
const getQCdoneComponents = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;

    if (!["quality_head", "quality_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only quality team or admin can view quality inspection components",
      });
    }

    const query = `
      SELECT 
        po.mrf_no,
        po.expected_delivery_date,
        po.mpn,
        po.item_description,
        po.make,
        po.part_no,
        po.po_number,
        po.status,
        po.updated_requested_quantity,
        po.uom,
        po.vendor_name,
        po.mpn_received AS received_mpn,
        po.make_received AS received_make,
        po.date_code,
        po.lot_code,
        po.received_quantity,
        po.passed_quantity,
        po.failed_quantity,
        po.coc_received,
        po.note,
        mrr.mrr_no,
        NULL AS backorder_sequence,
        'purchase_order' AS source
      FROM purchase_orders po
      INNER JOIN mrr_documents mrr ON po.po_number = mrr.po_number AND mrr.backorder_sequence IS NULL
      WHERE po.status = 'QC Cleared' AND mrr.mrr_no IS NOT NULL

      UNION

      SELECT 
        po.mrf_no AS po_mrf_no,
        bi.expected_delivery_date,
        bi.mpn,
        bi.item_description,
        po.make,
        po.part_no,
        bi.po_number,
        bi.status,
        bi.reordered_quantity AS updated_requested_quantity,
        po.uom,
        po.vendor_name,
        bi.mpn_received AS received_mpn,
        bi.make_received AS received_make,
        bi.date_code,
        bi.lot_code,
        bi.received_quantity,
        bi.passed_quantity,
        bi.failed_quantity,
        bi.coc_received,
        bi.note,
        mrr.mrr_no, -- Fetch mrr_no from mrr_documents instead of bi.mrr_no
        bi.backorder_sequence,
        'backorder' AS source
      FROM backorder_items bi
      LEFT JOIN purchase_orders po ON bi.po_number = po.po_number AND bi.mpn = po.mpn
      INNER JOIN mrr_documents mrr ON bi.po_number = mrr.po_number AND bi.backorder_sequence = mrr.backorder_sequence
      WHERE bi.status = 'QC Cleared' AND mrr.mrr_no IS NOT NULL
      ORDER BY po_number, backorder_sequence
    `;

    const result = await db.query(query);

    const processedRows = result.rows.map((row, index) => {
      let formattedDeliveryDate = row.expected_delivery_date;
      if (formattedDeliveryDate && typeof formattedDeliveryDate === 'string') {
        formattedDeliveryDate = formattedDeliveryDate.replace(/\//g, '-');
      }

      return {
        s_no: index + 1,
        mrf_no: row.mrf_no || row.po_mrf_no || "N/A",
        expected_delivery_date: formattedDeliveryDate || "N/A",
        mpn: row.mpn || "N/A",
        item_description: row.item_description || "N/A",
        make: row.make || "-",
        part_no: row.part_no || "-",
        po_number: row.po_number || "N/A",
        status: row.status || "QC Cleared",
        updated_requested_quantity: row.updated_requested_quantity || 0,
        uom: row.uom || "N/A",
        vendor_name: row.vendor_name || "N/A",
        received_mpn: row.received_mpn || "-",
        received_make: row.received_make || "-",
        date_code: row.date_code || "-",
        lot_code: row.lot_code || "-",
        received_quantity: row.received_quantity || "-",
        passed_quantity: row.passed_quantity || "-",
        failed_quantity: row.failed_quantity || "0",
        coc_received: row.coc_received || false,
        note: row.note || "-",
        mrr_no: row.mrr_no || "N/A",
        backorder_sequence: row.backorder_sequence || null,
        source: row.source || "purchase_order",
      };
    });

    // Group for overview table
    const overviewMap = new Map();
    processedRows.forEach((row) => {
      const key = row.backorder_sequence
        ? `${row.po_number}-${row.backorder_sequence}`
        : row.po_number;
      if (!overviewMap.has(key)) {
        overviewMap.set(key, {
          po_number: row.po_number,
          backorder_sequence: row.backorder_sequence,
          mrf_no: row.mrf_no,
          vendor_name: row.vendor_name,
          mrr_no: row.mrr_no,
          status: row.status,
          source: row.source,
        });
      }
    });
    const overviewList = Array.from(overviewMap.values());

    return res.status(200).json({
      data: {
        overview: overviewList,
        components: processedRows,
      },
    });
  } catch (error) {
    console.error("Error fetching quality inspection components:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

const getComponentsForMRR = async (req, res) => {
  try {
    const { role } = req.user;
    let { po_number } = req.params;

    // Decode po_number to handle encoded special characters
    po_number = decodeURIComponent(po_number);
    console.log(`Fetching MRR components for po_number: ${po_number}`);

    // Validate user role
    if (!["quality_head", "quality_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only quality team or admin can view MRR components",
      });
    }

    // Validate po_number
    if (!po_number) {
      return res.status(400).json({
        error: "Missing required field: po_number",
      });
    }

    // Query to check PO status for backorder
    const poStatusQuery = `
      SELECT status
      FROM purchase_orders
      WHERE po_number = $1
      LIMIT 1
    `;
    const poStatusResult = await db.query(poStatusQuery, [po_number]);

    let components = [];
    let hasBackorder = false;

  if (poStatusResult.rows.length > 0) {
  const poStatus = poStatusResult.rows[0].status.toLowerCase() || '';
  
  hasBackorder = (
    poStatus === 'warehouse in (backorder complete)' ||
    poStatus.includes('backordered')
  );
}


    // Query for purchase_orders components
    const poQuery = `
      SELECT 
        part_no,
        item_description,
        mpn,
        mpn_received,
        make,
        make_received,
        updated_requested_quantity,
        received_quantity,
        passed_quantity,
        date_code,
        lot_code,
        vendor_name,
        po_number,
        created_at,
        NULL as backorder_sequence
      FROM purchase_orders
      WHERE po_number = $1 AND LOWER(status) = 'qc cleared'
    `;
    const poResult = await db.query(poQuery, [po_number]);
    components = [...poResult.rows];

    // Query for backorder_items components if backorder exists
    if (hasBackorder) {
      const backorderQuery = `
        SELECT 
          bi.item_description,
          bi.mpn,
          bi.mpn_received,
          bi.make,
          bi.reordered_quantity,
          bi.make_received,
          bi.received_quantity,
          bi.passed_quantity,
          bi.date_code,
          bi.lot_code,
          po.vendor_name,
          po.part_no,
          bi.po_number,
          bi.created_at,
          bi.backorder_sequence
        FROM backorder_items bi
        JOIN purchase_orders po ON bi.po_number = po.po_number
        WHERE bi.po_number = $1 AND LOWER(bi.status) = 'qc cleared'
      `;
      const backorderResult = await db.query(backorderQuery, [po_number]);
      components = [...components, ...backorderResult.rows];
    }

    // Check if components are found
    if (components.length === 0) {
      return res.status(404).json({
        error: "No components found with status 'QC Cleared' for the specified PO number",
      });
    }

    // Process the combined results
    const processedRows = components.map((row, index) => ({
      s_no: index + 1,
      part_no: row.part_no || '-',
      item_description: row.item_description || '-',
      mpn: row.mpn || '-',
      mpn_received: row.mpn_received || '-',
      make: row.make || '-',
      make_received: row.make_received || '-',
      updated_requested_quantity: row.updated_requested_quantity || 0,
      reordered_quantity: row.reordered_quantity || 0,
      received_quantity: row.received_quantity || 0,
      passed_quantity: row.passed_quantity || 0,
      date_code: row.date_code || '-',
      lot_code: row.lot_code || '-',
      vendor_name: row.vendor_name || '-',
      po_number: row.po_number || '-',
      created_at: row.created_at || '-',
      backorder_sequence: row.backorder_sequence || null,
    }));

    return res.status(200).json({ data: processedRows });
  } catch (error) {
    console.error("Error fetching components for MRR:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

// Update the quality inspection status of a component
const updateQualityInspectionStatus = async (req, res) => {
  try {
    const { role } = req.user;
    const {
      po_number,
      mpn,
      status,
      received_mpn,
      received_make,
      date_code,
      lot_code,
      received_quantity,
      passed_quantity,
      failed_quantity,
      coc_received,
      note,
      source
    } = req.body;

    console.log("Received request body:", req.body);

    if (!["quality_head", "quality_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only quality team or admin can update status",
      });
    }

    if (!po_number || !mpn || !status) {
      return res.status(400).json({
        error: "Missing required fields: po_number, mpn, or status",
      });
    }

    const validStatuses = ["QC Cleared", "QC Rejected", "QC Hold"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status value",
      });
    }

    let fetchQuery, fetchResult, updateQuery, tableName;

    if (source === "backorder") {
      tableName = "backorder_items";
      fetchQuery = `
        SELECT mpn, make_received AS make
        FROM backorder_items
        WHERE po_number = $1 AND mpn = $2
      `;
      updateQuery = `
        UPDATE backorder_items
        SET 
          status = $1,
          mpn_received = $2,
          make_received = $3,
          date_code = $4,
          lot_code = $5,
          received_quantity = $6,
          passed_quantity = $7,
          failed_quantity = $8,
          coc_received = $9,
          note = $10
        WHERE po_number = $11 AND mpn = $12
        RETURNING *
      `;
    } else {
      tableName = "purchase_orders";
      fetchQuery = `
        SELECT mpn, make
        FROM purchase_orders
        WHERE po_number = $1 AND mpn = $2
      `;
      updateQuery = `
        UPDATE purchase_orders
        SET 
          status = $1,
          mpn_received = $2,
          make_received = $3,
          date_code = $4,
          lot_code = $5,
          received_quantity = $6,
          passed_quantity = $7,
          failed_quantity = $8,
          coc_received = $9,
          note = $10
        WHERE po_number = $11 AND mpn = $12
        RETURNING *
      `;
    }

    fetchResult = await db.query(fetchQuery, [po_number, mpn]);

    if (fetchResult.rows.length === 0) {
      return res.status(404).json({
        error: `No component found with the specified PO number and MPN in ${tableName}`,
      });
    }

    const { mpn: dbMpn, make: dbMake } = fetchResult.rows[0];

    // Relax make validation for backorder items if make_received is NULL or empty
    if (source === "backorder" && (!dbMake || dbMake === '')) {
      console.log(`No make_received found for backorder item ${po_number}-${mpn}, allowing update`);
    } else if (received_make && received_make !== dbMake) {
      return res.status(400).json({
        error: "Make received does not match the original Make",
      });
    }

    if (received_mpn && received_mpn !== dbMpn) {
      return res.status(400).json({
        error: "MPN received does not match the original MPN",
      });
    }

    if (received_quantity !== undefined && (isNaN(received_quantity) || received_quantity < 0)) {
      return res.status(400).json({
        error: "Received quantity must be a non-negative number",
      });
    }
    if (passed_quantity !== undefined && (isNaN(passed_quantity) || passed_quantity < 0)) {
      return res.status(400).json({
        error: "Passed quantity must be a non-negative number",
      });
    }
    if (failed_quantity !== undefined && (isNaN(failed_quantity) || failed_quantity < 0)) {
      return res.status(400).json({
        error: "Failed quantity must be a non-negative number",
      });
    }

    const values = [
      status,
      received_mpn || null,
      received_make || null,
      date_code || null,
      lot_code || null,
      received_quantity !== undefined ? received_quantity : null,
      passed_quantity !== undefined ? passed_quantity : null,
      failed_quantity !== undefined ? failed_quantity : null,
      coc_received !== undefined ? coc_received : false,
      note || null,
      po_number,
      mpn,
    ];

    const result = await db.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: `No component found with the specified PO number and MPN in ${tableName}`,
      });
    }

    if (status === "QC Cleared") {
      const notificationQuery = `
        INSERT INTO notifications (user_id, umi, mrf_no, message, type, is_read, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)
        RETURNING id, user_id, umi, mrf_no, message, type, is_read, created_at;
      `;
      const message = `QC Cleared against the PO ${po_number}, kindly proceed with the material in of the component`;
      await db.query(notificationQuery, [1, null, null, message, "QC Cleared", false]);

      const io = req.app.get('io');
      const userSocketMap = req.app.get('userSocketMap');
      if (io) {
        const inventoryHeadSocketId = userSocketMap.get("1");
        const notification = { user_id: 1, message, type: "QC Cleared", is_read: false, created_at: new Date().toISOString() };
        if (inventoryHeadSocketId) {
          io.to(inventoryHeadSocketId).emit('notification', notification);
        }
      }
    }

    return res.status(200).json({
      message: "Status updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating quality inspection status:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};


const uploadMRRDocuments = async (req, res) => {
  try {
    const { role, user_id } = req.user;
    const { po_number, mpn, backorder_sequence } = req.body;

    console.log(`Uploading MRR document for po_number: ${po_number}, backorder_sequence: ${backorder_sequence}, mpn: ${mpn}`);

    if (!["quality_head", "quality_employee", "admin"].includes(role)) {
      return res.status(403).json({
        error: "Unauthorized: Only quality team or admin can upload MRR documents",
      });
    }

    if (!po_number || !mpn) {
      return res.status(400).json({
        error: "Missing required fields: po_number, mpn",
      });
    }

    const cocFiles = req.files['coc[]'] || [];
    const idCardFiles = req.files['idCard[]'] || [];

    console.log('Processed files:', {
      cocFiles: cocFiles.map(file => ({
        name: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      })),
      idCardFiles: idCardFiles.map(file => ({
        name: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      })),
    });

    if (cocFiles.length === 0 && idCardFiles.length === 0) {
      return res.status(400).json({
        error: "At least one file (CoC or ID card) must be provided",
      });
    }

    const duplicateCheckQuery = `
      SELECT mrr_no
      FROM mrr_documents
      WHERE po_number = $1 AND (backorder_sequence = $2 OR (backorder_sequence IS NULL AND $2 IS NULL))
    `;
    const duplicateCheckResult = await db.query(duplicateCheckQuery, [po_number, backorder_sequence || null]);

    if (duplicateCheckResult.rows.length > 0) {
      return res.status(409).json({
        error: `MRR document already exists for PO ${po_number}${backorder_sequence ? ` and backorder sequence ${backorder_sequence}` : ''}`,
      });
    }

    const generatedMrrNo = await generateMrrNo();

    const insertedRows = [];
    for (let i = 0; i < Math.max(cocFiles.length, idCardFiles.length); i++) {
      const cocFile = i < cocFiles.length ? cocFiles[i].buffer : null;
      const cocFileMimeType = i < cocFiles.length ? cocFiles[i].mimetype : null;
      const idCardFile = i < idCardFiles.length ? idCardFiles[i].buffer : null;
      const idCardFileMimeType = i < idCardFiles.length ? idCardFiles[i].mimetype : null;

      if (!cocFile && !idCardFile) continue;

      const insertQuery = `
        INSERT INTO mrr_documents (
          mrr_no,
          po_number,
          backorder_sequence,
          mpn,
          coc_file,
          coc_file_mime_type,
          id_card_file,
          id_card_file_mime_type,
          uploaded_by,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;
      const insertValues = [
        generatedMrrNo,
        po_number,
        backorder_sequence || null,
        mpn,
        cocFile || null,
        cocFileMimeType || null,
        idCardFile || null,
        idCardFileMimeType || null,
        user_id,
      ];

      const insertResult = await db.query(insertQuery, insertValues);
      insertedRows.push(insertResult.rows[0]);
    }

    if (insertedRows.length === 0) {
      return res.status(400).json({
        error: "No valid files were provided for upload",
      });
    }

    return res.status(200).json({
      message: "MRR document uploaded successfully",
      mrr_no: generatedMrrNo, // Explicitly include mrr_no
      data: insertedRows,
    });
  } catch (error) {
    console.error("Error uploading MRR document:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};
module.exports = { getQualityInspectionComponents, 
  getBackorderQualityInspectionComponents, 
  updateQualityInspectionStatus, 
  getComponentsForMRR, 
  uploadMRRDocuments, 
  getQCdoneComponents };