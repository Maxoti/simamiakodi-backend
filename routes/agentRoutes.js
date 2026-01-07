const express = require('express');
const router = express.Router();
const {
  getAllAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  getActiveAgents,
  getAgentStats
} = require('../controllers/agentController');

router.get('/', getAllAgents);
router.get('/stats', getAgentStats);
router.get('/active', getActiveAgents);
router.get('/:id', getAgentById);
router.post('/', createAgent);
router.put('/:id', updateAgent);
router.delete('/:id', deleteAgent);

module.exports = router;