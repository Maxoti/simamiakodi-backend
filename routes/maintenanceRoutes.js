const express = require('express');
const router = express.Router();
const {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequest,
  completeRequest,
  getPendingRequests
} = require('../controllers/maintenanceController');

router.get('/', getAllRequests);
router.get('/pending', getPendingRequests);
router.get('/:id', getRequestById);
router.post('/', createRequest);
router.put('/:id', updateRequest);
router.put('/:id/complete', completeRequest);

module.exports = router;