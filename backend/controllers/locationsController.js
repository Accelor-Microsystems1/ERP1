const db = require("../db");

// Helper function to build the path dynamically
const buildLocationPath = async (locationId) => {
  const pathParts = [];
  let currentId = locationId;

  while (currentId) {
    const result = await db.query(
      "SELECT id, name, type, parent_id FROM locations WHERE id = $1",
      [currentId]
    );
    if (result.rows.length === 0) break;

    const location = result.rows[0];
    let prefix = "";
    if (location.type === "rack") prefix = "RACK ";
    else if (location.type === "shelf") prefix = "SHELF ";
    else if (location.type === "bin") prefix = "BIN ";
    else if (location.type === "cabinet") prefix = "CABINET ";

    pathParts.unshift(`${prefix}${location.name}`);
    currentId = location.parent_id;
  }

  return pathParts.join("/");
};

// New endpoint to preview the path
exports.previewPath = async (req, res) => {
  const { name, type, parent_id } = req.body;

  try {
    if (!name || !type || !parent_id) {
      throw new Error("Name, type, and parent_id are required");
    }

    // Validate the parent exists and hierarchy is correct
    const parentResult = await db.query(
      "SELECT type FROM locations WHERE id = $1",
      [parent_id]
    );
    if (parentResult.rows.length === 0) {
      throw new Error("Parent location not found");
    }

    const parentType = parentResult.rows[0].type;
    if (
      (type === "rack" && parentType !== "parent") ||
      (type === "cabinet" && parentType !== "parent") ||
      (type === "shelf" && !["rack", "cabinet"].includes(parentType)) ||
      (type === "bin" && parentType !== "shelf")
    ) {
      throw new Error(`Invalid hierarchy: ${type} cannot be created under ${parentType}`);
    }

    // Build the path by appending the new location to the parent's path
    const parentPath = await buildLocationPath(parent_id);
    let prefix = "";
    if (type === "rack") prefix = "RACK ";
    else if (type === "shelf") prefix = "SHELF ";
    else if (type === "bin") prefix = "BIN ";
    else if (type === "cabinet") prefix = "CABINET ";

    const path = `${parentPath}/${prefix}${name}`;

    res.status(200).json({ path });
  } catch (error) {
    console.error("Error previewing path:", error.stack);
    res.status(400).json({ error: error.message });
  }
};

// Fetch locations
exports.getLocations = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        nc.component_id AS component_id,
        nc.location AS location,
        nc.item_description AS description,
        nc.mpn AS mpn,
        nc.make AS make,
        nc.part_no AS part_no,
        nc.on_hand_quantity AS on_hand_quantity
      FROM 
        non_coc_components nc
      WHERE 
        nc.on_hand_quantity >= 0;`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Database error:", error.stack);
    res.status(500).json({ error: "Failed to fetch locations: " + error.message });
  }
};


// New endpoint to fetch all locations from the locations table
exports.getAllLocations = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        path,
        created_at
      FROM 
        locations
      ORDER BY 
        created_at DESC;
    `
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Database error:", error.stack);
    res.status(500).json({ error: "Failed to fetch all locations: " + error.message });
  }
};

// Fetch parent locations based on the desired hierarchy
exports.getParentLocations = async (req, res) => {
  try {
    const { type } = req.query;
    let query = "";
    let values = [];

    if (type === "rack" || type === "cabinet") {
      query = "SELECT id, name, type FROM locations WHERE type = 'parent' AND id = 1";
    } else if (type === "shelf") {
      query = "SELECT id, name, type FROM locations WHERE LOWER(type) IN ('rack', 'cabinet')";
    } else if (type === "bin") {
      query = "SELECT id, name, type FROM locations WHERE LOWER(type) = 'shelf'";
    } else {
      return res.json([]);
    }

    const result = await db.query(query, values);
    console.log(`Parent locations for type ${type}:`, result.rows);

    if (result.rows.length === 0) {
      return res.status(200).json([]);
    }

    const locations = await Promise.all(
      result.rows.map(async (loc) => ({
        ...loc,
        path: await buildLocationPath(loc.id),
      }))
    );

    res.json(locations);
  } catch (error) {
    console.error("Database error:", error.stack);
    res.status(500).json({ error: "Failed to fetch parent locations: " + error.message });
  }
};

// UPDATED: Generate path dynamically in backend
exports.createLocation = async (req, res) => {
  const { name, type, parent_id = null } = req.body;
  const currentTimestamp = new Date().toISOString();

  try {
    // Validate required fields
    if (!name || !type) {
      throw new Error("Name and type are required");
    }

    // Generate path and validate hierarchy
    let path = "WH-STOCK";
    if (parent_id) {
      const parentResult = await db.query(
        "SELECT path, type FROM locations WHERE id = $1",
        [parent_id]
      );
      if (parentResult.rows.length === 0) {
        throw new Error("Parent location not found");
      }
      const parent = parentResult.rows[0];
      path = parent.path;

      // Validate parent type matches frontend hierarchy
      if (type === "rack" && parent.type !== "parent") {
        throw new Error("Rack can only have a parent type as parent");
      }
      if (type === "cabinet" && parent.type !== "parent") {
        throw new Error("Cabinet can only have a parent type as parent");
      }
      if (type === "shelf" && !["rack", "cabinet"].includes(parent.type)) {
        throw new Error("Shelf can only have a rack or cabinet as parent");
      }
      if (type === "bin" && parent.type !== "shelf") {
        throw new Error("Bin can only have a shelf as parent");
      }
    } else if (type !== "parent") {
      throw new Error("Non-parent locations require a parent_id");
    }

    // Append new segment based on type
    switch (type) {
      case "rack":
        path += `/RACK ${name}`;
        break;
      case "shelf":
        path += `/SHELF ${name}`;
        break;
      case "bin":
        path += `/BIN ${name}`;
        break;
      case "cabinet":
        path += `/CABINET ${name}`;
        break;
      case "parent":
        path = name;
        break;
      default:
        throw new Error("Invalid location type");
    }

    const query = `
      INSERT INTO locations 
      (name, type, parent_id, path, created_at, updated_at)
      VALUES 
      ($1, $2, $3, $4, $5, $5)
      RETURNING *;
    `;

    const values = [name, type, parent_id, path.trim(), currentTimestamp];

    console.log("Inserting location with values:", values);
    const result = await db.query(query, values);

    res.status(201).json({
      message: "Location created successfully",
      location: result.rows[0],
    });
  } catch (error) {
    console.error("Create location error:", error.stack);
    res.status(500).json({ error: "Failed to create location: " + error.message });
  }
};

// Update location for non_coc_components 
exports.updateLocation = async (req, res) => {
  try {
    const { component_id } = req.params;
    const { location } = req.body;

    console.log("Updating location for:", { component_id, location });

    if (!component_id || isNaN(Number(component_id)) || !location) {
      return res.status(400).json({ message: "component_id must be a valid number and location is required" });
    }

    const query = `
      UPDATE non_coc_components
      SET location = $1
      WHERE component_id = $2
      RETURNING *;
    `;
    const values = [location, component_id];

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      console.log(`No component found for component_id: ${component_id}`);
      return res.status(404).json({ message: "Component not found" });
    }

    res.status(200).json({ message: "Location updated successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Error updating location:", error.stack); // Log full stack trace
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: "Location already exists" });
    }
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};