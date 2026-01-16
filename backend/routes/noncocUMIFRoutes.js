const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const { getBasketItemsForUMIF, submitMaterialIssueForm, submitMaterialRequestForm, deleteBasketItem, updateBasketQuantities, submitDirectPurchaseRequest , getProjects} = require("../controllers/noncocUMIFController");

router.get("/basket-items", authenticateToken, getBasketItemsForUMIF);
router.get("/projects", authenticateToken, getProjects);
router.post("/submit-material-issue", authenticateToken, submitMaterialIssueForm);
router.post("/submit-material-request", authenticateToken, submitMaterialRequestForm);
router.delete("/basket-item/:basketId", authenticateToken, deleteBasketItem);
router.put("/update-quantities", authenticateToken, updateBasketQuantities);
router.post("/submit-direct-purchase-request", authenticateToken, submitDirectPurchaseRequest);

module.exports = router;