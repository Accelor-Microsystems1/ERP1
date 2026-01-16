// approvalsRoutes.js
const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");
const {
  getMyRequests,
  getMyRequestDetails,
  getMyMrfRequests,
  getMyMrfRequestDetails,
} = require("../controllers/myRequestsController");
const{
  getMrfRequestDetails,
  approveMrfRequest,
  rejectMrfRequest,
} = require("../controllers/mrfApprovalsController")

const {
  getApprovalRequests,
  getPastApprovedRequests,
  getRequestDetails,
  approveRequest,
  rejectRequest
} = require("../controllers/approvalRequestsController");

const {
  submitReturnForm,
} = require("../controllers/noncocReturnController");
const pool = require("../db");

// My Requests Routes
router.get(
  "/my-requests",
  authenticateToken,
  getMyRequests
);
router.get(
  "/my-request-details/:umi",
  authenticateToken,
  getMyRequestDetails
);

router.get('/mrf-requests', authenticateToken, getMyMrfRequests); 
router.get('/mrf-request-details/:mrf_no', authenticateToken, getMyMrfRequestDetails);

// Approval Requests Routes 
router.get(
  "/approval-requests",
  authenticateToken,
  getApprovalRequests
);
router.get(
  "/past-approved",
  authenticateToken,
  getPastApprovedRequests
);
router.get(
  "/request-details/:umi",
  authenticateToken,
  getRequestDetails
);
router.put(
  "/approve-request/:umi",
  authenticateToken,
  approveRequest
);

router.put(
  "/reject-request/:umi",
  authenticateToken,
  rejectRequest
);
// router.get(
//   "/check-mrf/:umi", // Add this route
//   authenticateToken,
//   checkMrfExistence
// );

router.post(
  "/non_coc_components/submit-return-form",
  authenticateToken,
  submitReturnForm
);

router.get('/request-details/:mrf_no', authenticateToken, getMrfRequestDetails);
router.put('/approve-request/:mrf_no', authenticateToken, approveMrfRequest);

module.exports = router;