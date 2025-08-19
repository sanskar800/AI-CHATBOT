import express from 'express';
import { sendMessage, getConversationHistory, clearConversation } from '../controllers/chatController.js';

const router = express.Router();

// Send message to chatbot
router.post('/message', sendMessage);

// Get conversation history
router.get('/conversation/:sessionId', getConversationHistory);

// Clear conversation
router.delete('/conversation/:sessionId', clearConversation);

export default router;