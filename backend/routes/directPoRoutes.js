const express = require('express');
const router = express.Router();
const {
  fetchDirectPoComponents,
  approveDirectPoRequest,
  rejectDirectPoRequest,
  markDirectPoRequestAsHold,
  fetchPastDirectPoApprovals,
  fetchPreviousPurchases, // Add new controller function
} = require('../controllers/directPoController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Fetch all direct PO components with optional status filter
router.get('/', authenticateToken, fetchDirectPoComponents);

// Fetch past direct PO approvals (CEO Approval Done and PO Raised)
router.get('/past-approvals', authenticateToken, fetchPastDirectPoApprovals);

// Fetch previous purchases with optional filters
router.get('/previous', authenticateToken, fetchPreviousPurchases); // New route

// Approve a direct PO request (bulk or component-wise)
router.post('/direct-po-requests/:direct_sequence/approve', authenticateToken, approveDirectPoRequest);

// Reject a direct PO request (bulk or component-wise)
router.post('/direct-po-requests/:direct_sequence/reject', authenticateToken, rejectDirectPoRequest);

// Mark components as Hold for a direct PO request
router.post('/direct-po-requests/:direct_sequence/hold', authenticateToken, markDirectPoRequestAsHold);

module.exports = router;