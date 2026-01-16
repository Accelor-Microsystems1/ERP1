const db = require('../db');

const getDocuments = async (req, res) => {
  const allowedUserIds = [1, 3, 4]; // Added user ID 4
  if (!allowedUserIds.includes(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to access these documents' });
  }

  try {
    const result = await db.query(
      'SELECT id, po_number, mrr_no, mpn, part_no, coc_file, coc_file_mime_type, id_card_file, id_card_file_mime_type FROM mrr_documents WHERE po_number IS NOT NULL OR mrr_no IS NOT NULL OR mpn IS NOT NULL OR part_no IS NOT NULL'
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No documents found' });
    }

    const response = result.rows.map(row => ({
      id: row.id,
      po_number: row.po_number,
      mrr_no: row.mrr_no,
      mpn: row.mpn,
      part_no: row.part_no, // Added part_no to response
      coc_file: row.coc_file ? row.coc_file.toString('base64') : null,
      coc_file_mime_type: row.coc_file_mime_type || null,
      id_card_file: row.id_card_file ? row.id_card_file.toString('base64') : null,
      id_card_file_mime_type: row.id_card_file_mime_type || null,
    }));

    res.json(response); // Fixed from res.json(response.data)
  } catch (err) {
    console.error('Error fetching documents:', err.message, err.stack);
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
};

module.exports = { getDocuments };