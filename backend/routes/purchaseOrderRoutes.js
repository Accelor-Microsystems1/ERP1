const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { raisePurchaseOrder, getPoNumberForMrfs, getAllPurchaseOrders, updatePurchaseOrder, getBackorderedReturnedPOs, raiseDirectPurchaseOrder, updateBackorderItem, getPaymentTerms,  createPaymentTerm,
  getOtherTermsConditions,
  createOtherTermCondition } = require('../controllers/purchaseOrderController');

router.post('/raise', authenticateToken, raisePurchaseOrder);
router.post('/mrf-po', authenticateToken, getPoNumberForMrfs);
router.get('/purchase-orders', authenticateToken, getAllPurchaseOrders);
router.put('/update', authenticateToken, updatePurchaseOrder);
router.get('/backordered-returned', authenticateToken, getBackorderedReturnedPOs);
router.post('/raise-direct', authenticateToken, raiseDirectPurchaseOrder);
router.put('/backorder-items/update', authenticateToken, updateBackorderItem); // New route for updating backorder items
router.get('/payment-terms', authenticateToken, getPaymentTerms);
router.post('/create-payment-terms', authenticateToken, createPaymentTerm);
router.get('/other-terms-conditions', authenticateToken, getOtherTermsConditions);
router.post('/create-other-terms-conditions', authenticateToken, createOtherTermCondition);

module.exports = router;