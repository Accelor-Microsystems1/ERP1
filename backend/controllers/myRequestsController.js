const db = require("../db");

// Helper function to get the department from a role
const getDepartmentFromRole = (role) => {
  const match = role.match(/^(\w+)_(head|employee)$/);
  return match ? match[1] : null;
};

// Normalize user_name field in JSON objects (for consistency with mrfApprovalsController.js)
const normalizeUserName = (obj) => {
  if (!obj) return obj;
  return {
    ...obj,
    user_name: obj.user_name || obj.userName || obj.username || "Unknown",
    userName: undefined, // Clean up alternative field names
    username: undefined,
  };
};

// Normalize note field (handles both string and JSONB array formats)
const normalizeNote = (note) => {
  if (typeof note === "string" && note) {
    return [{
      timestamp: new Date().toISOString(),
      user_name: "Unknown",
      role: "Unknown",
      content: note,
    }];
  }
  return Array.isArray(note) ? note.map(normalizeUserName) : [];
};

const getMyRequests = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;

    if (!role || !user_id) {
      return res
        .status(400)
        .json({ error: "User role or ID not found in request." });
    }

    console.log("User ID:", user_id, "Role:", role);

    // Debug Query: Fetch all rows for the user to check raw data
    const debugQuery = `
      SELECT 
        nb.umi, 
        nb.date, 
        nb.status AS raw_status, 
        nb.received_quantity, 
        nb.user_id, 
        mif.umi AS mif_umi, 
        mif.issued_quantity,
        mif.issue_date, 
        nb.project_name, 
        nb.mrf_no
      FROM noncoc_basket nb
      JOIN users u ON nb.user_id = u.id
      LEFT JOIN material_issue_form mif ON nb.umi = mif.umi AND nb.component_id = mif.component_id 
      WHERE nb.user_id = $1
      ORDER BY nb.umi, nb.date DESC
    `;
    const debugParams = [user_id];
    const debugResult = await db.query(debugQuery, debugParams);
    console.log("Debug: All Rows for User:", debugResult.rows);
    console.log("Debug: Raw Status Values:", debugResult.rows.map(row => ({
      umi: row.umi,
      raw_status: row.raw_status,
      issue_date:row.issue_date,
      received_quantity: row.received_quantity,
      issued_quantity: row.issued_quantity,
    })));

    const query = `
      SELECT DISTINCT ON (nb.umi)
        nb.umi, 
        nb.date,
        mif.issue_date,
        mif.remark AS inventory_remark,
        nb.remark AS head_remark,
        CASE 
          WHEN nb.status = 'Rejected' THEN 'Rejected'
          WHEN nb.status = 'Receiving Pending' THEN 'Receiving Pending'
          WHEN mif.umi IS NOT NULL AND mif.issued_quantity IS NOT NULL AND (nb.received_quantity IS NOT NULL OR nb.status = 'Issued') THEN 'Issued'
          ELSE COALESCE(nb.status, 'Unknown')
        END AS status, 
        COALESCE(nb.project_name, 'N/A') AS project_name, 
        COALESCE(nb.mrf_no, 'No MRF') AS mrf_no
      FROM noncoc_basket nb
      JOIN users u ON nb.user_id = u.id
      LEFT JOIN material_issue_form mif ON nb.umi = mif.umi AND nb.component_id = mif.component_id 
      WHERE nb.user_id = $1
      ORDER BY nb.umi, 
        CASE 
          WHEN nb.status = 'Rejected' THEN 0
          WHEN nb.status = 'Receiving Pending' THEN 1
          WHEN mif.umi IS NOT NULL AND mif.issued_quantity IS NOT NULL AND (nb.received_quantity IS NOT NULL OR nb.status = 'Issued') THEN 2
          ELSE 3
        END ASC, 
        nb.mrf_no IS NOT NULL DESC, 
        nb.date DESC
    `;
    const params = [user_id];

    const result = await db.query(query, params);
    console.log("My Requests Query Result (Raw):", result.rows);

    // Format the results
    const formattedResults = result.rows.map(row => ({
      umi: row.umi,
      date: row.date,
      issue_date:row.issue_date,
      status: row.status,
      project_name: row.project_name,
      mrf_no: row.mrf_no,
    }));

    console.log("My Requests Formatted Results:", formattedResults);

    // If no results, return a default empty row
    const finalResults = formattedResults.length > 0
      ? formattedResults
      : [
          {
            umi: "N/A",
            date: "N/A",
            issue_date:"N/A",
            status: "N/A",
            project_name: "N/A",
            mrf_no: "N/A",
          },
        ];

    return res.status(200).json(finalResults);
  } catch (error) {
    console.error("Error fetching my requests:", error.stack);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// // Fetch details of a specific request based on UMI for the logged-in user
// const getMyRequestDetails = async (req, res) => {
//   try {
//     const { role, id: user_id } = req.user;
//     const isEmployee = role.endsWith("_employee");
//     const department = getDepartmentFromRole(role);

//     if (!isEmployee && !department && role !== "admin") {
//       return res
//         .status(400)
//         .json({
//           error: "Invalid role format: Department cannot be determined.",
//         });
//     }

//     const { umi } = req.params;
//     console.log("Fetching details for UMI:", umi, "User ID:", user_id);

//     const query = `
//       SELECT 
//         nb.initial_requestedqty, 
//         nb.date AS created_at, 
//         nb.status, 
//         nb.umi, 
//         nb.updated_requestedqty,
//         nb.received_quantity, 
//         mif.issued_quantity, 
//         nb.remark, 
//         nb.project_name,
//        COALESCE(nb.note::text, '"N/A"') AS note,
//         nc.item_description,
//         nc.mpn,
//         nc.on_hand_quantity,
//         nc.part_no,
//         nc.make,
//         nc.component_id,
//         mrf.mrf_no,
//         mr.return_quantity,
//         mr.remark,
//         mr.status,
//         mif.note as note_inventory
//       FROM noncoc_basket nb
//       JOIN users u ON nb.user_id = u.id
//       JOIN non_coc_components nc ON nb.component_id = nc.component_id
//       LEFT JOIN material_issue_form mif ON nb.umi = mif.umi AND nb.component_id = mif.component_id 
//       LEFT JOIN material_return_form mr ON nb.umi = mr.umi AND nb.component_id = mr.component_id 
//       LEFT JOIN material_request_form mrf ON mrf.mrf_no = nb.mrf_no AND mrf.component_id = nb.component_id
//       WHERE nb.umi = $1 AND nb.user_id = $2;
//     `;
//     const params = [umi, user_id];

//     const result = await db.query(query, params);
//     console.log("Query result rows:", result.rows);

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: `No request found for UMI ${umi}` });
//     }

//     const detailedItems = result.rows.map((item) => ({
//       ...item,
//       part_no: item.part_no || "N/A",
//       make: item.make || "N/A",
//       item_description: item.item_description || "N/A",
//       mpn: item.mpn || "N/A",
//       on_hand_quantity: item.on_hand_quantity || 0,
//     }));

//     return res.status(200).json(detailedItems);
//   } catch (error) {
//     console.error("Error fetching request details:", error.stack);
//     return res
//       .status(500)
//       .json({ error: "Server error", details: error.message });
//   }
// };

const getMyRequestDetails = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    console.log("User role:", role, "User ID:", user_id);

    const isEmployee = role.endsWith("_employee");
    const department = getDepartmentFromRole(role);
    console.log("isEmployee:", isEmployee, "Department:", department);

    if (!isEmployee && !department && role !== "admin") {
      return res
        .status(400)
        .json({
          error: "Invalid role format: Department cannot be determined.",
        });
    }

    const { umi } = req.params;
    console.log("Fetching details for UMI:", umi, "User ID:", user_id);

    // Debug Query: Check the raw join data
    const debugQuery = `
      SELECT 
        nb.umi,
        nb.component_id,
        nc.on_hand_quantity,
        nc.component_id AS nc_component_id
      FROM noncoc_basket nb
      LEFT JOIN non_coc_components nc ON nb.component_id = nc.component_id
      WHERE nb.umi = $1 AND nb.user_id = $2;
    `;
    const debugParams = [umi, user_id];
    const debugResult = await db.query(debugQuery, debugParams);
    console.log("Debug: Raw join data for UMI:", debugResult.rows);

    // Main Query
    const query = `
      SELECT 
        nb.basket_id,
        nb.initial_requestedqty, 
        nb.date AS created_at, 
        nb.status, 
        nb.umi, 
        nb.updated_requestedqty,
        COALESCE(nb.received_quantity, 0) AS received_quantity, 
        COALESCE(mif.issued_quantity, 0) AS issued_quantity, 
        nb.remark AS head_remark,
        nb.note AS head_note,
        nb.project_name,
        nc.item_description,
        nc.mpn,
        nc.on_hand_quantity,
        nc.part_no,
        nc.make,
        nc.uom,
        nc.component_id,
        nb.mrf_no,
        mr.return_quantity,
        mr.remark AS return_remark,
        COALESCE(mr.status, 'Not Initiated') AS return_status,
        mif.note AS inventory_note,
        mif.remark AS inventory_remark,
      mif.mrr_allocations AS mrr_no
      FROM noncoc_basket nb
      JOIN users u ON nb.user_id = u.id
      LEFT JOIN non_coc_components nc ON nb.component_id = nc.component_id  -- Changed to LEFT JOIN
      LEFT JOIN material_issue_form mif ON nb.umi = mif.umi AND nb.component_id = mif.component_id 
      LEFT JOIN material_return_form mr ON nb.umi = mr.umi AND nb.component_id = mr.component_id 
      LEFT JOIN material_request_form mrf ON mrf.mrf_no = nb.mrf_no AND mrf.component_id = nb.component_id 
      WHERE nb.umi = $1 
      AND nb.user_id = $2;
    `;
   
    const params = [umi, user_id];

    const result = await db.query(query, params);
    console.log("Query result rows:", result.rows);
    console.log("Debug: Checking critical fields for return functionality:", result.rows.map(row => ({
      component_id: row.component_id,
      received_quantity: row.received_quantity,
      issued_quantity: row.issued_quantity,
      return_status: row.return_status,
    })));

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `No request found for UMI ${umi}` });
    }

    const detailedItems = result.rows.map((item) => {
      const displayInTable = !(item.initial_requestedqty === 0 );
      console.log(`Component ${item.item_description}: initial_requestedqty=${item.initial_requestedqty}, on_hand_quantity=${item.on_hand_quantity}, mrf_no=${item.mrf_no}, display_in_table=${displayInTable}`);
      return {
        ...item,
        basket_id: item.basket_id || null,
        part_no: item.part_no || "N/A",
        make: item.make || "N/A",
        uom: item.uom || "N/A",
        item_description: item.item_description || "N/A",
        mpn: item.mpn || "N/A",
        on_hand_quantity: item.on_hand_quantity || 0,
        mrf_no: item.mrf_no || "N/A",
         mrr_no: item.mrr_no || null,
        head_remark: item.head_remark || "N/A",
        head_note: normalizeNote(item.head_note),
        inventory_remark: item.inventory_remark || "N/A",
        inventory_note: normalizeNote(item.inventory_note),
        return_remark: item.return_remark || "N/A",
        return_status: item.return_status || "Not Initiated",
        display_in_table: displayInTable,
      };
    });

    return res.status(200).json(detailedItems);
  } catch (error) {
    console.error("Error fetching request details:", error.stack);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

const getMyMrfRequests = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;

    if (!role || !user_id) {
      return res
        .status(400)
        .json({ error: "User role or ID not found in request." });
    }

    const query = `
      SELECT 
        mrf.mrf_no, 
        mrf.date AS created_at, 
        mrf.status, 
        mrf.project_name
      FROM material_request_form mrf
      JOIN users u ON mrf.user_id = u.id
      WHERE mrf.user_id = $1
      GROUP BY mrf.mrf_no, 
      mrf.date, 
      mrf.status, 
      mrf.project_name
    `;
    const params = [user_id];

    const result = await db.query(query, params);
    console.log("My MRF Requests Query Result:", result.rows);
    const formattedResults =
      result.rows.length > 0
        ? result.rows
        : [
            {
              mrf_no: "N/A",
              created_at: "N/A",
              status: "N/A",
              project_name: "N/A",
            },
          ];
    return res.status(200).json(formattedResults);
  } catch (error) {
    console.error("Error fetching my MRF requests:", error.stack);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// Fetch details of a specific MRF request based on MRF No for the logged-in user
const getMyMrfRequestDetails = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const { mrf_no } = req.params;

    if (!role || !user_id) {
      return res
        .status(400)
        .json({ error: "User role or ID not found in request." });
    }

    const isEmployee = role.endsWith("_employee");
    const department = getDepartmentFromRole(role);

    if (!isEmployee && !department && role !== "admin") {
      return res
        .status(400)
        .json({
          error: "Invalid role format: Department cannot be determined.",
        });
    }

    console.log(
      `Fetching MRF details for mrf_no: ${mrf_no}, user_id: ${user_id}, role: ${role}`
    );

    // First, verify that the MRF is associated with an MIF the user has access to
    const accessCheckQuery = `
      SELECT 1
      FROM material_request_form mrf
      WHERE mrf.mrf_no = $1 AND (mrf.user_id = $2 OR EXISTS (
        SELECT 1 FROM noncoc_basket nb WHERE nb.mrf_no = mrf.mrf_no AND nb.user_id = $2
      ))
      LIMIT 1;
    `;
    const accessCheckParams = [mrf_no, user_id];
    const accessCheckResult = await db.query(
      accessCheckQuery,
      accessCheckParams
    );

    if (accessCheckResult.rows.length === 0) {
      return res
        .status(403)
        .json({ error: `You do not have access to MRF No ${mrf_no}` });
    }

    const query = `
    SELECT
      mrf.mrf_id,
      mrf.component_id,
      mrf.initial_requested_quantity,
      mrf.date AS created_at,
      COALESCE(mrf.status, 'N/A') AS status,
      mrf.mrf_no,
      mrf.updated_requested_quantity,
      mrf.note,
      mrf.remark,
      mrf.quantity_change_history,
      COALESCE(mrf.project_name, 'N/A') AS project_name,
      nc.item_description,
      nc.mpn,
      nc.on_hand_quantity,
      nc.part_no,
      nc.make,
      nc.uom,
      mrf.vendor,
      mrf.approx_price,
      mrf.expected_deliverydate,
      mrf.certificate_desired,
      mrf.vendor_link
    FROM material_request_form mrf
    LEFT JOIN non_coc_components nc ON nc.component_id = mrf.component_id
    WHERE mrf.mrf_no = $1;
    `;
    const params = [mrf_no];

    const result = await db.query(query, params);
    console.log(
      `My MRF Request Details Query Result for mrf_no ${mrf_no}:`,
      result.rows
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: `No request found for MRF No ${mrf_no}` });
    }

    const detailedItems = result.rows.map((item) => {
      // Normalize quantity_change_history
      const quantityChangeHistory = Array.isArray(item.quantity_change_history)
        ? item.quantity_change_history.map(normalizeUserName)
        : [];

      // Normalize note
      const normalizedNote = normalizeNote(item.note);

      return {
        ...item,
        item_description: item.item_description || "N/A",
        mpn: item.mpn || "N/A",
        uom: item.uom || "N/A",
        on_hand_quantity: item.on_hand_quantity || 0,
        part_no: item.part_no || "N/A",
        make: item.make || "N/A",
        quantity_change_history: quantityChangeHistory,
        note: normalizedNote,
        remark: item.remark || "",
        vendor: item.vendor || "",
        approx_price: item.approx_price || "",
        expected_deliverydate: item.expected_deliverydate || "",
        certificate_desired: item.certificate_desired || false,
        vendor_link: item.vendor_link || "",
      };
    });

    return res.status(200).json(detailedItems);
  } catch (error) {
    console.error("Error fetching MRF request details:", error.stack);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

module.exports = {
  getMyRequests,
  getMyRequestDetails,
  getMyMrfRequests,
  getMyMrfRequestDetails,
};