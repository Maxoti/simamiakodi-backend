const express = require('express');
const router = express.Router();
const {
  getAllUtilities,
  getUtilityById,
  createUtility,
  updateUtility,
  deleteUtility,
  getPendingUtilities
} = require('../controllers/utilityController');

router.get('/', getAllUtilities);
router.get('/pending', getPendingUtilities);
router.get('/:id', getUtilityById);
router.post('/', createUtility);
router.put('/:id', updateUtility);
router.delete('/:id', deleteUtility);

module.exports = router;