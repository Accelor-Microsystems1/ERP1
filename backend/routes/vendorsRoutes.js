const express = require('express');
const router = express.Router();
const { createVendor, getAllVendors, updateVendor,  getVendors,
    updateVendorDetails } = require('../controllers/vendorsController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Routes
router.post('/vendors', authenticateToken, createVendor);
router.get('/vendors', authenticateToken, getAllVendors);
router.put('/vendors/:id', authenticateToken, updateVendor);
router.get("/", getVendors);
router.put("/update", updateVendorDetails);

module.exports = router;