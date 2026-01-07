const express = require('express');
const router = express.Router();
const {
  getAllPaymentPlans,
  getPaymentPlanById,
  createPaymentPlan,
  updatePaymentPlan,
  deletePaymentPlan,
  getActivePaymentPlans
} = require('../controllers/paymentPlanController');

router.get('/', getAllPaymentPlans);
router.get('/active', getActivePaymentPlans);
router.get('/:id', getPaymentPlanById);
router.post('/', createPaymentPlan);
router.put('/:id', updatePaymentPlan);
router.delete('/:id', deletePaymentPlan);

module.exports = router;