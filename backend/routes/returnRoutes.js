const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const { submitReturnForm, getReturnRequests, getPastReturnRequests, approveReturnRequest, rejectReturnRequest, getUserReturnRequests } = require("../controllers/noncocReturnController");

router.post("/submit-return-form", authenticateToken, submitReturnForm);
router.get("/return-requests", authenticateToken, getReturnRequests);
router.get("/past-return-requests", authenticateToken, getPastReturnRequests);
router.put("/approve-return/:urf_id", authenticateToken, approveReturnRequest);
router.put("/reject-return/:urf_id", authenticateToken, rejectReturnRequest);
router.get('/user-return-requests', authenticateToken, getUserReturnRequests);

module.exports = router;