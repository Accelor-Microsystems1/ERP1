const db = require("../db"); // Import database connection

// Add item to basket
const addToBasket = async (req, res) => {
  try {
    const { component_id } = req.body; // Get component_id from frontend
    const user_id = req.user.id; // Retrieved from middleware

    // Validate inputs
    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized: User ID missing" });
    }
    if (!component_id) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Insert into PostgreSQL
    const query = `
      INSERT INTO public.noncoc_basket (user_id, component_id, status) 
      VALUES ($1, $2, 'Draft')
      RETURNING *;
    `;
    const values = [user_id, component_id];
    const result = await db.query(query, values);

    return res.status(201).json({ message: "Added to basket", data: result.rows[0] });
  } catch (error) {
    console.error("Error adding to basket:", error.message, error.stack);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

// Fetch user's basket items
const getBasketItems = async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized: User ID missing" });
    }

    // Fetch basket items along with item details from non_coc_components
    const query = `
      SELECT 
        nb.basket_id, 
        nb.user_id, 
        nb.component_id, 
        nb.initial_requestedqty, 
        nb.date, 
        nb.status, 
        nb.note, 
        nb.umi,
        nc.item_description, 
        nc.mpn, 
        nc.on_hand_quantity,
        nc.uom
      FROM public.noncoc_basket nb
      JOIN public.non_coc_components nc ON nb.component_id = nc.component_id
      WHERE nb.user_id = $1;
    `;
    const result = await db.query(query, [user_id]);

    return res.status(200).json({ basket: result.rows });
  } catch (error) {
    console.error("Error fetching basket items:", error.message, error.stack);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

// Search components
const searchComponents = async (req, res) => {
  try {
    const { query, type } = req.query;
    if (!query) return res.status(400).json({ error: "Search query is required" });

    let sql = "SELECT * FROM non_coc_components WHERE ";
    let values = [`%${query}%`];

    switch (type) {
      case "description":
        sql += "item_description ILIKE $1";
        break;
      case "mpn":
        sql += "CAST(mpn AS TEXT) ILIKE $1";
        break;
      case "make":
        sql += "make ILIKE $1";
        break;
     case "part_no":
    sql += "part_no ILIKE $1";
    break;
      default:
        sql += "item_description ILIKE $1"; // Default to description
    }

    const result = await db.query(sql, values);
    res.json(result.rows);
  } catch (error) {
    console.error("Search Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all components
const getAllComponents = async (req, res) => {
  try {
    const result = await db.query("SELECT component_id, item_description, mpn, part_no, make, on_hand_quantity, uom FROM non_coc_components");
    res.json(result.rows);
  } catch (error) {
    console.error("Fetch Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Fetch stock card data for a specific component with date filter and join with material_issue_form
const getStockCardData = async (req, res) => {
  try {
    const { componentId } = req.params;
    if (!componentId) {
      return res.status(400).json({ error: "Component ID is required" });
    }

    const { periodFrom, periodTo } = req.query;

    // Subquery to get the latest mrr_document per component_id based on the largest mrr_no
    let query = `
      WITH latest_mrr AS (
        SELECT DISTINCT ON (component_id) 
          component_id,
          po_number,
          mrr_no
        FROM public.mrr_documents
        WHERE component_id = $1
        ORDER BY component_id, mrr_no DESC
      )
      SELECT 
        ns.transaction_date,
        ns.umi,
        mif.mi,
        ns.user_id,
        u.name,
        ns.requested_quantity,
        mif.issued_quantity,
        ns.balance,
        CASE 
          WHEN ns.umi IS NULL THEN latest_mrr.po_number
          ELSE NULL
        END AS po_number,
        CASE 
          WHEN ns.umi IS NULL THEN latest_mrr.mrr_no
          ELSE NULL
        END AS mrr_no
      FROM public.noncoc_stockcard ns
      LEFT JOIN public.material_issue_form mif ON ns.mif_id = mif.mif_id
      LEFT JOIN public.users u ON ns.user_id = u.id
      LEFT JOIN latest_mrr ON ns.component_id = latest_mrr.component_id
      WHERE ns.component_id = $1
    `;

    const values = [componentId];

    // Add date filter if provided, casting transaction_date to DATE for consistency
    if (periodFrom && periodTo) {
      query += ` AND CAST(ns.transaction_date AS DATE) BETWEEN $2 AND $3`;
      values.push(periodFrom, periodTo);
    } else if (periodFrom) {
      query += ` AND CAST(ns.transaction_date AS DATE) >= $2`;
      values.push(periodFrom);
    } else if (periodTo) {
      query += ` AND CAST(ns.transaction_date AS DATE) <= $2`;
      values.push(periodTo);
    }

    // Sort: green entries (umi IS NULL) by mrr_no DESC, red entries (umi IS NOT NULL) by transaction_date DESC
    query += `
      ORDER BY 
        CASE WHEN ns.umi IS NULL THEN 0 ELSE 1 END,
        CASE WHEN ns.umi IS NULL THEN latest_mrr.mrr_no END DESC,
        CASE WHEN ns.umi IS NOT NULL THEN ns.transaction_date END DESC
    `;

    console.log(`Executing query: ${query} with values: ${JSON.stringify(values)}`); // Debug log
    const result = await db.query(query, values);
    console.log(`Stock card data fetched: ${JSON.stringify(result.rows)}`); // Debug log

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching stock card data:", error.message, error.stack);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};
const getPurchaseOrderDetails = async (req, res) => {
  try {
    const { componentId } = req.params;
    if (!componentId) {
      return res.status(400).json({ error: "Component ID is required" });
    }

    const query = `
      -- Fetch Purchase Order entries (excluding Draft status)
      SELECT DISTINCT 
        po.po_id,
        po.po_number,
        po.mrf_no,
        po.vendor_name,
        po.updated_requested_quantity AS ordered_quantity,
        po.status AS po_status,
        CAST(NULL AS TEXT) AS backorder_sequence,
        CAST(NULL AS INTEGER) AS backorder_reordered_quantity,
        CAST(NULL AS TEXT) AS backorder_status,
        po.status AS status,
        CAST(u.name AS TEXT) AS requested_by,
        po.expected_delivery_date,
        'Purchase Order' AS row_type,
        1 AS sort_order,
        po.po_number AS group_id
      FROM public.purchase_orders po
      JOIN public.non_coc_components nc ON po.mpn = nc.mpn
      LEFT JOIN public.material_request_form mrf ON po.mrf_no = mrf.mrf_no
      LEFT JOIN public.users u ON mrf.user_id = u.id
      WHERE nc.component_id = $1
        AND po.status != 'Draft'

      UNION ALL

      -- Fetch Backorder entries with deduplication
      SELECT DISTINCT ON (bi.backorder_sequence)
        po.po_id,
        po.po_number,
        po.mrf_no,
        po.vendor_name,
        CAST(bi.reordered_quantity AS INTEGER) AS ordered_quantity,
        po.status AS po_status,
        bi.backorder_sequence,
        CAST(bi.reordered_quantity AS INTEGER) AS backorder_reordered_quantity,
        bi.status AS backorder_status,
        bi.status AS status,
        CAST(u.name AS TEXT) AS requested_by,
        COALESCE(bi.expected_delivery_date, po.expected_delivery_date) AS expected_delivery_date,
        'Backorder' AS row_type,
        2 AS sort_order,
        po.po_number AS group_id
      FROM public.purchase_orders po
      JOIN public.non_coc_components nc ON po.mpn = nc.mpn
      JOIN public.backorder_items bi 
        ON po.po_number = bi.po_number 
        AND po.mpn = bi.mpn
      LEFT JOIN public.material_request_form mrf ON po.mrf_no = mrf.mrf_no
      LEFT JOIN public.users u ON mrf.user_id = u.id
      WHERE nc.component_id = $1
        AND po.status != 'Draft'

      ORDER BY po_number DESC, sort_order ASC, backorder_sequence ASC;
    `;

    const values = [componentId];

    const result = await db.query(query, values);
    console.log(`Purchase order details fetched: ${JSON.stringify(result.rows)}`); // Debug log

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching purchase order details:", error.message, error.stack);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};
module.exports = {
  addToBasket, 
  getBasketItems, 
  searchComponents,
  getAllComponents,
  getStockCardData,
  getPurchaseOrderDetails
};