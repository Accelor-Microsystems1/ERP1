const express = require("express");
const router = express.Router();
const locationsController = require("../controllers/locationsController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, locationsController.getLocations);
router.get("/parents", authenticateToken, locationsController.getParentLocations);
router.post("/", authenticateToken, locationsController.createLocation);
router.put("/noncoc/:component_id", authenticateToken, locationsController.updateLocation);
router.post("/preview-path", authenticateToken, locationsController.previewPath);
// router.put("/locations/:component_id", authenticateToken, locationsController.updateLocation);
router.get("/all", authenticateToken, locationsController.getAllLocations); // New route

module.exports = router;