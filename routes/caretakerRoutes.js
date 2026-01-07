const express = require('express');
const router = express.Router();
const {
  getAllCaretakers,
  getCaretakerById,
  createCaretaker,
  updateCaretaker,
  deleteCaretaker,
  getActiveCaretakers
} = require('../controllers/caretakerController');

router.get('/', getAllCaretakers);
router.get('/active', getActiveCaretakers);
router.get('/:id', getCaretakerById);
router.post('/', createCaretaker);
router.put('/:id', updateCaretaker);
router.delete('/:id', deleteCaretaker);

module.exports = router;