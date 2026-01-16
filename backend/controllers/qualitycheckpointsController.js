const db = require("../db");

const getQualityCheckpoints = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM quality_checkpoints ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching quality checkpoints:', error);
    res.status(500).json({ error: 'Failed to fetch quality checkpoints' });
  }
};

const createQualityCheckpoint = async (req, res) => {
  const { title, product_categories, control_per, instructions } = req.body;

  // Validate input
  if (!title || !product_categories || !control_per || !instructions) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Generate reference_no (format: QCP-10000, QCP-10001, etc.)
    let reference_no;
    const lastCheckpoint = await db.query(
      'SELECT reference_no FROM quality_checkpoints ORDER BY reference_no DESC LIMIT 1'
    );

    if (lastCheckpoint.rows.length === 0) {
      // If no checkpoints exist, start with QCP-10000
      reference_no = 'QCP-10000';
    } else {
      // Extract the number from the last reference_no (e.g., QCP-10000 -> 10000)
      const lastRefNo = lastCheckpoint.rows[0].reference_no; // e.g., QCP-10000
      const lastNumber = parseInt(lastRefNo.split('-')[1], 10); // e.g., 10000
      const newNumber = lastNumber + 1;
      reference_no = `QCP-${newNumber}`; // e.g., QCP-10001
    }

    // Insert the new checkpoint with the generated reference_no
    const result = await db.query(
      'INSERT INTO quality_checkpoints (reference_no, title, product_categories, control_per, instructions) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [reference_no, title, product_categories, control_per, instructions]
    );

    res.status(201).json({ message: 'Quality checkpoint created successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Error creating quality checkpoint:', error);
    res.status(500).json({ error: 'Failed to create quality checkpoint' });
  }
};

module.exports = {
  getQualityCheckpoints,
  createQualityCheckpoint,
};