const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const { 
  addToBasket, 
  getBasketItems, 
  searchComponents, 
  getAllComponents,
  getStockCardData,
  getPurchaseOrderDetails
} = require("../controllers/noncocBasketController");

// Search components API
router.get("/search", searchComponents);

// Get all components API
router.get("/all", getAllComponents);

// Add item to basket
router.post("/add-to-basket", authenticateToken, addToBasket);

// Get user's basket items
router.get("/basket", authenticateToken, getBasketItems);

// Fetch stock card data for a component
router.get('/nc-requests/stock-card/:componentId', authenticateToken, getStockCardData);

// Fetch purchase order details for a component
router.get('/nc-requests/purchase-orders/:componentId', authenticateToken, getPurchaseOrderDetails);

module.exports = router;