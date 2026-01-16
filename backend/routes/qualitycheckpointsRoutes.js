const express = require('express');
const router = express.Router();
const { getQualityCheckpoints, createQualityCheckpoint } = require('../controllers/qualitycheckpointsController');

// GET: Fetch all quality checkpoints
router.get('/', getQualityCheckpoints);

// POST: Create a new quality checkpoint
router.post('/create', createQualityCheckpoint);
module.exports = router;