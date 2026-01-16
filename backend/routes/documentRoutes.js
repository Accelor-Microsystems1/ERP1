const express = require('express');
const router = express.Router();
const { getDocuments } = require('../controllers/documentController');
const { authenticateToken } = require('../middleware/authMiddleware');

// START CHANGE: Single route for fetching all documents
router.get('/', authenticateToken, getDocuments);
// END CHANGE

module.exports = router;