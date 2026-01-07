const express = require('express');
const router = express.Router();
const {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpensesByCategory,
  getMonthlyExpenses
} = require('../controllers/expenseController');

router.get('/', getAllExpenses);
router.get('/monthly', getMonthlyExpenses);
router.get('/category', getExpensesByCategory);
router.get('/:id', getExpenseById);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;