import langchainService from '../services/fastLangchainService.js';
import Conversation from '../models/Conversation.js';
import { v4 as uuidv4 } from 'uuid';

export const sendMessage = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const finalSessionId = sessionId || uuidv4();

    const result = await langchainService.handleConversation(message.trim(), finalSessionId);

    res.json({
      success: true,
      response: result.response,
      sessionId: finalSessionId,
      currentStep: result.currentStep
    });

  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getConversationHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    const conversation = await Conversation.findOne({ sessionId });

    if (!conversation) {
      return res.json({
        success: true,
        messages: [],
        currentStep: 'chat'
      });
    }

    res.json({
      success: true,
      messages: conversation.messages,
      currentStep: conversation.context.currentStep
    });

  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const clearConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    await Conversation.findOneAndDelete({ sessionId });

    res.json({
      success: true,
      message: 'Conversation cleared successfully'
    });

  } catch (error) {
    console.error('Error clearing conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};