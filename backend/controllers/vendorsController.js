const db = require("../db");
const axios = require('axios');

// Controller to fetch all vendor names
const getVendors = async (req, res) => {
  try {
    const query = `
      SELECT name
      FROM vendors
      ORDER BY name ASC;
    `;
    const result = await db.query(query);
    const vendors = result.rows.map(row => row.name);
    return res.status(200).json(vendors);
  } catch (error) {
    console.error("Error fetching vendors:", error.message, error.stack);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

const updateVendorDetails = async (req, res) => {
    const { mrf_id, component_id, vendor, vendor_link, approx_price, expected_deliverydate, certificate_desired } = req.body;
  
    // Validate required fields
    if (!mrf_id || !component_id) {
      return res.status(400).json({ error: "mrf_id and component_id are required" });
    }
  
    try {
      const query = `
        UPDATE material_request_form
        SET
          vendor = $1,
          vendor_link = $2,
          approx_price = $3,
          expected_deliverydate = $4,
          certificate_desired = $5
        WHERE mrf_id = $6 AND component_id = $7
        RETURNING *;
      `;
      const values = [
        vendor || null,
        vendor_link || null,
        approx_price ? parseFloat(approx_price) : null,
        expected_deliverydate || null,
        certificate_desired || false,
        mrf_id,
        component_id,
      ];
      const result = await db.query(query, values);
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "No matching MRF item found" });
      }
  
      return res.status(200).json({ message: "Vendor details updated successfully", data: result.rows[0] });
    } catch (error) {
      console.error("Error updating vendor details:", error.message, error.stack);
      return res.status(500).json({ error: "Server error", details: error.message });
    }
  };

// Create a vendor
const createVendor = async (req, res) => {
  try {
    console.log('Received vendor creation request:', req.body); // Debugging log
    const {
      gstin,
      name,
      address,
      pan,
      contact_person_name,
      contact_no,
      email_id
    } = req.body;

    // Validate required fields
    if (!gstin || !name || !address || !pan) {
      return res.status(400).json({ error: 'GSTIN, Name, Address, and PAN are required' });
    }

    // Start a transaction
    await db.query('BEGIN');

    const query = `
      INSERT INTO vendors (gstin, name, address, pan, contact_person_name, contact_no, email_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id, gstin, name, address, pan, contact_person_name, contact_no, email_id
    `;
    const values = [gstin, name, address, pan, contact_person_name || null, contact_no || null, email_id || null];

    const result = await db.query(query, values);
    console.log('Database Query Result:', result.rows); // Debugging log

    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(500).json({ error: 'Failed to create vendor' });
    }

    // Commit the transaction
    await db.query('COMMIT');

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error creating vendor:', error.message);
    if (error.code === '23505') { // PostgreSQL unique violation
      return res.status(400).json({ error: 'Vendor with this GSTIN already exists', details: error.message });
    }
    return res.status(500).json({ error: 'Failed to create vendor', details: error.message });
  }
};

// Fetch all vendors --vendorlist.jsx
const getAllVendors = async (req, res) => {
  try {
    const query = `
      SELECT id, gstin, name, address, pan, contact_person_name, contact_no, email_id, created_at
      FROM vendors
      ORDER BY created_at DESC
    `;
    const result = await db.query(query);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching vendors:', error.message);
    return res.status(500).json({ error: 'Failed to fetch vendors', details: error.message });
  }
};

// Update vendor optional fields -- vendorlist.jsx
const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { contact_person_name, contact_no, email_id } = req.body;

    // Check if at least one field is provided
    if (!contact_person_name && !contact_no && !email_id) {
      return res.status(400).json({ error: 'At least one field (Contact Person Name, Contact No., Email ID) must be provided' });
    }

    const query = `
      UPDATE vendors
      SET
        contact_person_name = COALESCE($1, contact_person_name),
        contact_no = COALESCE($2, contact_no),
        email_id = COALESCE($3, email_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, gstin, name, address, pan, contact_person_name, contact_no, email_id
    `;
    const values = [contact_person_name || null, contact_no || null, email_id || null, id];

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vendor:', error.message);
    return res.status(500).json({ error: 'Failed to update vendor', details: error.message });
  }
};

const updateVendorName = async (req, res) => {
  const { mrf_id, component_id, vendor } = req.body;

  // Validate required fields
  if (!mrf_id || !component_id || !vendor) {
    return res.status(400).json({ error: "mrf_id, component_id, and vendor are required" });
  }

  try {
    const query = `
      UPDATE material_request_form
      SET vendor = $1
      WHERE mrf_id = $2 AND component_id = $3
      RETURNING mrf_id, component_id, vendor;
    `;
    const values = [vendor, mrf_id, component_id];
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No matching MRF item found" });
    }

    return res.status(200).json({ message: "Vendor name updated successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Error updating vendor name:", error.message, error.stack);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

module.exports = { createVendor, getAllVendors, updateVendor, updateVendorDetails, getVendors, updateVendorName};