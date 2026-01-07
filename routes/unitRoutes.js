const express = require('express');
const router = express.Router();
const {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
  getVacantUnits
} = require('../controllers/unitController');

router.get('/', getAllUnits);
router.get('/vacant', getVacantUnits);
router.get('/:id', getUnitById);
router.post('/', createUnit);
router.put('/:id', updateUnit);
router.delete('/:id', deleteUnit);

module.exports = router;