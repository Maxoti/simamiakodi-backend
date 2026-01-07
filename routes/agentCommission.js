const express = require('express');
const router = express.Router();
const {
  getAllCommissions,
  getCommissionById,
  createCommission,
  updateCommission,
  markAsPaid,
  getPendingCommissions
} = require('../controllers/agentcommissionController');

router.get('/', getAllCommissions);
router.get('/pending', getPendingCommissions);
router.get('/:id', getCommissionById);
router.post('/', createCommission);
router.put('/:id', updateCommission);
router.put('/:id/pay', markAsPaid);

module.exports = router;