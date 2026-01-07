const express = require('express');
const router = express.Router();
const {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentsByTenant,
  getMonthlyPayments,
  getPaymentsByProperty,
  getPaymentStats
} = require('../controllers/paymentController');

// Statistics route - must come before /:id to avoid conflicts
router.get('/stats', getPaymentStats);

// Query-based routes - must come before /:id
router.get('/monthly', getMonthlyPayments);

// Specific resource routes
router.get('/tenant/:tenant_id', getPaymentsByTenant);
router.get('/property/:property_id', getPaymentsByProperty);

// General CRUD routes
router.get('/', getAllPayments);
router.get('/:id', getPaymentById);
router.post('/', createPayment);
router.put('/:id', updatePayment);
router.delete('/:id', deletePayment);

module.exports = router;