const express = require('express');
const router = express.Router();
const mrfApprovalsController = require('../controllers/mrfApprovalsController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/approval-requests', authenticateToken, mrfApprovalsController.getMrfApprovalRequests);
router.get('/past-approved', authenticateToken, mrfApprovalsController.getPastMrfApprovedRequests);
router.get("/rejected", authenticateToken, mrfApprovalsController.getRejectedMrfRequests);
router.get('/request-details/:mrf_no', authenticateToken, mrfApprovalsController.getMrfRequestDetails);
router.put('/approve-request/:mrf_no', authenticateToken, mrfApprovalsController.approveMrfRequest);
router.get('/search-components', authenticateToken, mrfApprovalsController.searchMrfComponents);
router.get('/search-components-purchase-head', authenticateToken, mrfApprovalsController.searchMrfComponentsForPurchaseHead);
router.get('/search-components-po-raised', authenticateToken, mrfApprovalsController.searchMrfComponentsForPORaised);
router.put('/reject-request/:mrf_no', authenticateToken, mrfApprovalsController.rejectMrfRequest);
router.post('/confirm-receipt/:mrf_no', authenticateToken, mrfApprovalsController.confirmReceipt);
router.get('/next-po-number', authenticateToken, mrfApprovalsController.getNextPoNumber);


module.exports = router;