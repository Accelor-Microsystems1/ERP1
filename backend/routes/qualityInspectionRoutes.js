const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getQualityInspectionComponents,
  updateQualityInspectionStatus,
  getComponentsForMRR,
  uploadMRRDocuments,
  getQCdoneComponents,
  getBackorderQualityInspectionComponents,
} = require('../controllers/qualityInspectionController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Configure Multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory as buffers
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB limit per file
    files: 20, // Increase to 20 files total
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'application/pdf'];
    console.log('Multer file:', { field: file.fieldname, mimetype: file.mimetype, size: file.size }); // Debug
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, JPEG, or PDF files are allowed'), false);
    }
    cb(null, true);
  },
}).fields([
  { name: 'coc[]', maxCount: 20 }, // Explicitly allow multiple files
  { name: 'idCard[]', maxCount: 20 }, // Explicitly allow multiple
  { name: 'po_number', maxCount: 1 },
]);

router.get('/mrr-components/:po_number(.+)', authenticateToken, getComponentsForMRR);
router.get('/quality-inspection-components', authenticateToken, getQualityInspectionComponents);
router.get('/backorder-quality-inspection', authenticateToken, getBackorderQualityInspectionComponents);
router.get('/quality-inspection-done', authenticateToken, getQCdoneComponents);
router.put('/quality-inspection-components/status', authenticateToken, updateQualityInspectionStatus);
//('/mrr-upload-documents', authenticateToken, upload, uploadMRRDocuments);
router.post('/mrr-upload-documents', authenticateToken, (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('MulterError:', { code: err.code, message: err.message }); // Debug
      return res.status(400).json({
        error: 'Multer error',
        details: err.message,
        code: err.code,
      });
    } else if (err) {
      console.error('File upload error:', err.message); // Debug
      return res.status(400).json({
        error: 'File upload error',
        details: err.message,
      });
    }
    next();
  });
}, uploadMRRDocuments);
module.exports = router;