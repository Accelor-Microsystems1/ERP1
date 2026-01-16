const express = require("express");
const router = express.Router();

const {
  getPendingNonCOCIssueRequests,
  getPastNonCOCIssuedRequests,
  getNonCOCIssueRequestDetails,
  submitNonCOCMaterialIssueForm,
  rejectNonCOCMaterialIssueForm,
  getPastIssuedRequestDetails,
  getAllPurchaseOrderComponents,
  updatePoStatus,
  updateBoStatus,
  handleBackorderOfBackorder,
  cancelRequest,
} = require("../controllers/noncocRequestsController");

const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

// Apply authentication and role authorization to all routes
router.get(
  "/pending",
  authenticateToken,
  authorizeRole(["inventory_head", "inventory_employee", "admin"]),
  getPendingNonCOCIssueRequests
);

router.get(
  "/past-issued",
  authenticateToken,
  authorizeRole(["inventory_head", "inventory_employee", "admin"]),
  getPastNonCOCIssuedRequests
);

router.get(
  "/issue-details/:umi",
  authenticateToken,
  authorizeRole(["inventory_head", "inventory_employee", "admin"]),
  getNonCOCIssueRequestDetails
);

router.post(
  "/submit-material-issue",
  authenticateToken,
  authorizeRole(["inventory_head", "inventory_employee", "admin"]),
  submitNonCOCMaterialIssueForm
);

router.post(
  "/reject/:umi",
  authenticateToken,
  authorizeRole(["inventory_head", "inventory_employee", "admin"]),
  rejectNonCOCMaterialIssueForm
);

router.get(
  "/past-issued/:umi",
  authenticateToken,
  authorizeRole(["inventory_head", "inventory_employee", "admin"]),
  getPastIssuedRequestDetails
);

router.get(
  "/purchase-order-components",
  authenticateToken,
  authorizeRole(["inventory_head", "inventory_employee", "admin", "purchase_head"]),
  getAllPurchaseOrderComponents
);

router.post(
  "/update-po-status",
  authenticateToken,
  authorizeRole(["inventory_head", "inventory_employee", "admin"]),
  updatePoStatus
);

router.post(
  "/update-bo-status",
  authenticateToken,
  authorizeRole(["inventory_head", "inventory_employee", "admin"]),
  updateBoStatus
);

router.post(
  "/handle-backorder-of-backorder",
  authenticateToken,
  authorizeRole(["inventory_head", "inventory_employee", "admin"]),
  handleBackorderOfBackorder
);

router.post('/cancel/:umi', authenticateToken, cancelRequest);
module.exports = router;