import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import Document from '../models/Document.js';
import Conversation from '../models/Conversation.js';
import Appointment from '../models/Appointment.js';
import { formatInTimeZone } from 'date-fns-tz';
import { parse, isValid, addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday } from 'date-fns';

class FastLangChainService {
  constructor() {
    this.model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-2.0-flash',
      temperature: 0.7,
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Simple in-memory document store for fast searching
    this.documentStore = new Map();
    this.initializeDocumentStore();
  }

  async initializeDocumentStore() {
    try {
      this.documentStore.clear();
      const documents = await Document.find({});
      
      for (const doc of documents) {
        this.documentStore.set(doc._id.toString(), {
          id: doc._id.toString(),
          filename: doc.originalName,
          content: doc.content,
          fileType: doc.fileType,
          chunks: doc.chunks || []
        });
      }
    } catch (error) {
      console.error('Error initializing document store:', error);
    }
  }

  async processDocument(content, filename, fileType) {
    try {
      const chunks = await this.textSplitter.splitText(content);
      const processedChunks = [];

      for (let i = 0; i < chunks.length; i++) {
        processedChunks.push({
          text: chunks[i],
          embedding: [],
          metadata: {
            section: `chunk_${i}`,
            page: Math.floor(i / 5) + 1
          }
        });
      }

      return processedChunks;
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }

  async searchDocuments(query, k = 3) {
    try {
      const results = [];
      const queryLower = query.toLowerCase();
      
      const generalQueries = ['what is in', 'what does', 'tell me about', 'content', 'summary', 'document', 'information'];
      const isGeneralQuery = generalQueries.some(phrase => queryLower.includes(phrase));
      
      for (const [docId, doc] of this.documentStore.entries()) {
        const contentLower = doc.content.toLowerCase();
        let score = 0;
        let relevantChunks = [];
        
        if (isGeneralQuery) {
          relevantChunks = doc.chunks.slice(0, 3);
          score = 10;
        } else {
          const queryWords = queryLower.split(' ').filter(word => word.length > 2);
          
          for (const word of queryWords) {
            const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
            score += matches;
          }
          
          if (score > 0) {
            relevantChunks = doc.chunks.filter(chunk => 
              queryWords.some(word => chunk.text.toLowerCase().includes(word))
            );
          }
        }
        
        if (relevantChunks.length > 0) {
          results.push({
            documentId: docId,
            filename: doc.filename,
            score: score,
            chunks: relevantChunks.slice(0, 3)
          });
        }
      }
      
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, k);
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }

  parseNaturalDate(dateString) {
    const today = new Date();
    const lowerDateString = dateString.toLowerCase().trim();

    if (lowerDateString === 'today') {
      return formatInTimeZone(today, 'UTC', 'yyyy-MM-dd');
    }
    
    if (lowerDateString === 'tomorrow') {
      return formatInTimeZone(addDays(today, 1), 'UTC', 'yyyy-MM-dd');
    }

    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayWeekday = today.getDay();
    
    for (let i = 0; i < weekdays.length; i++) {
      if (lowerDateString === weekdays[i] || lowerDateString === `next ${weekdays[i]}`) {
        let daysToAdd = i - todayWeekday;
        if (daysToAdd <= 0) {
          daysToAdd += 7;
        }
        const targetDate = addDays(today, daysToAdd);
        return formatInTimeZone(targetDate, 'UTC', 'yyyy-MM-dd');
      }
    }

    const dateFormats = [
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'dd/MM/yyyy',
      'MM-dd-yyyy',
      'dd-MM-yyyy'
    ];

    for (const format of dateFormats) {
      try {
        const parsed = parse(dateString, format, new Date());
        if (isValid(parsed)) {
          return formatInTimeZone(parsed, 'UTC', 'yyyy-MM-dd');
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  async handleConversation(message, sessionId) {
    try {
      let conversation = await Conversation.findOne({ sessionId });
      
      if (!conversation) {
        conversation = new Conversation({
          sessionId,
          messages: [],
          context: {
            currentStep: 'chat',
            appointmentData: {},
            documentContext: []
          }
        });
      }

      // Add user message
      conversation.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      let response = '';

      // Check for cancellation/restart keywords
      const cancelKeywords = ['cancel', 'stop', 'quit', 'exit', 'start again', 'restart', 'start over', 'wrong', 'mistake'];
      const wantsToCancel = cancelKeywords.some(keyword => 
        message.toLowerCase().includes(keyword)
      );

      if (wantsToCancel && conversation.context.currentStep !== 'chat') {
        // Reset the conversation to chat mode
        conversation.context.currentStep = 'chat';
        conversation.context.appointmentData = {};
        response = "No problem! I've cancelled the appointment booking. How can I help you today? You can:\n\n• Ask questions about your documents\n• Say 'book appointment' to start a new appointment booking\n• Upload new documents\n\nWhat would you like to do?";
      }
      // Check if user wants to book an appointment
      else {
        const appointmentKeywords = ['call me', 'book appointment', 'schedule', 'meeting', 'call back', 'contact me'];
        const wantsAppointment = appointmentKeywords.some(keyword => 
          message.toLowerCase().includes(keyword)
        );

        if (wantsAppointment && conversation.context.currentStep === 'chat') {
          conversation.context.currentStep = 'appointment_name';
          conversation.context.appointmentData = {}; // Reset appointment data
          response = "I'd be happy to help you schedule an appointment! Let me collect some information from you.\n\nFirst, could you please tell me your full name?\n\n(You can say 'cancel' at any time to stop the booking process)";
        } else if (conversation.context.currentStep !== 'chat') {
          // Handle appointment booking flow
          response = await this.handleAppointmentFlow(conversation, message);
        } else {
          // Handle regular chat with fast document search
          response = await this.handleDocumentQuery(message);
        }
      }

      // Add assistant response
      conversation.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date()
      });

      await conversation.save();
      return { response, currentStep: conversation.context.currentStep };

    } catch (error) {
      console.error('FastLangChain: Error handling conversation:', error);
      return { response: 'I apologize, but I encountered an error. Please try again.', currentStep: 'chat' };
    }
  }

  async handleAppointmentFlow(conversation, message) {
    const { currentStep, appointmentData } = conversation.context;

    switch (currentStep) {
      case 'appointment_name':
        if (message.trim().length < 2) {
          return "Please provide a valid name with at least 2 characters.";
        }
        conversation.context.appointmentData.name = message.trim();
        conversation.context.currentStep = 'appointment_email';
        return `Thank you, ${message.trim()}! Now, could you please provide your email address?`;

      case 'appointment_email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(message.trim())) {
          return "Please provide a valid email address (e.g., john@example.com).";
        }
        conversation.context.appointmentData.email = message.trim().toLowerCase();
        conversation.context.currentStep = 'appointment_phone';
        return "Great! Now, please provide your phone number (with country code if international).";

      case 'appointment_phone':
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        const cleanPhone = message.replace(/[\s\-\(\)]/g, '');
        if (!phoneRegex.test(cleanPhone)) {
          return "Please provide a valid phone number (numbers only, with optional + for country code).";
        }
        conversation.context.appointmentData.phone = cleanPhone;
        conversation.context.currentStep = 'appointment_date';
        return "Perfect! When would you like to schedule the appointment? You can say things like 'tomorrow', 'next Monday', or provide a specific date (YYYY-MM-DD format).";

      case 'appointment_date':
        const parsedDate = this.parseNaturalDate(message);
        if (!parsedDate) {
          return "I couldn't understand that date format. Please try again with formats like 'tomorrow', 'next Monday', or 'YYYY-MM-DD' (e.g., 2024-01-15).";
        }
        
        const appointmentDate = new Date(parsedDate);
        if (appointmentDate < new Date()) {
          return "Please select a future date for your appointment.";
        }
        
        conversation.context.appointmentData.date = parsedDate;
        conversation.context.currentStep = 'appointment_time';
        return `Great! I've scheduled it for ${parsedDate}. What time would you prefer? Please provide time in HH:MM format (e.g., 14:30 or 2:30 PM).`;

      case 'appointment_time':
        let timeString = message.trim();
        
        // Handle various time formats
        const timeFormats = [
          /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](\s?(AM|PM))?$/i, // HH:MM format
          /^([1-9]|1[0-2])\s?(AM|PM)$/i, // 5 AM, 12 PM format
          /^([1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i // 5:30 PM format
        ];
        
        let validTime = false;
        let finalTimeString = '';
        
        // Check for simple hour format like "5PM", "5 PM"
        const simpleTimeMatch = timeString.match(/^([1-9]|1[0-2])\s?(AM|PM)$/i);
        if (simpleTimeMatch) {
          const hour = parseInt(simpleTimeMatch[1]);
          const period = simpleTimeMatch[2].toUpperCase();
          
          if (period === 'PM' && hour !== 12) {
            finalTimeString = `${hour + 12}:00`;
          } else if (period === 'AM' && hour === 12) {
            finalTimeString = '00:00';
          } else if (period === 'AM') {
            finalTimeString = `${hour.toString().padStart(2, '0')}:00`;
          } else { // PM and hour is 12
            finalTimeString = '12:00';
          }
          validTime = true;
        }
        // Check for HH:MM AM/PM format
        else if (timeString.match(/^([1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i)) {
          const timeMatch = timeString.match(/^([1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i);
          const hour = parseInt(timeMatch[1]);
          const minute = timeMatch[2];
          const period = timeMatch[3].toUpperCase();
          
          if (period === 'PM' && hour !== 12) {
            finalTimeString = `${hour + 12}:${minute}`;
          } else if (period === 'AM' && hour === 12) {
            finalTimeString = `00:${minute}`;
          } else if (period === 'AM') {
            finalTimeString = `${hour.toString().padStart(2, '0')}:${minute}`;
          } else { // PM and hour is 12
            finalTimeString = `12:${minute}`;
          }
          validTime = true;
        }
        // Check for 24-hour format
        else if (timeString.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
          finalTimeString = timeString;
          validTime = true;
        }

        if (!validTime) {
          return "Please provide a valid time format. Examples: '5 PM', '5:30 PM', '17:00', '14:30'";
        }

        conversation.context.appointmentData.time = finalTimeString;
        conversation.context.currentStep = 'appointment_purpose';
        return "Excellent! Finally, could you briefly describe the purpose of your appointment? (Optional - you can say 'general consultation' if you prefer)";

      case 'appointment_purpose':
        const purpose = message.trim() || 'General consultation';
        conversation.context.appointmentData.purpose = purpose;

        // Get the appointment data from conversation context
        const { name, email, phone, date, time } = conversation.context.appointmentData;

        console.log('Creating appointment with data:', {
          name, email, phone, date, time, purpose
        });

        // Create appointment
        try {
          const appointment = new Appointment({
            name: name,
            email: email,
            phone: phone,
            appointmentDate: new Date(`${date}T${time}:00.000Z`),
            appointmentTime: time,
            purpose: purpose,
            conversationId: conversation.sessionId
          });

          await appointment.save();
          console.log('Appointment saved successfully:', appointment._id);

          // Store the data before resetting context
          const confirmationData = {
            name: name,
            email: email,
            phone: phone,
            date: date,
            time: time,
            purpose: purpose
          };

          // Reset conversation context
          conversation.context.currentStep = 'chat';
          conversation.context.appointmentData = {};

          return `Perfect! I've successfully booked your appointment with the following details:

📅 **Appointment Confirmed**
👤 Name: ${confirmationData.name}
📧 Email: ${confirmationData.email}
📞 Phone: ${confirmationData.phone}
📅 Date: ${confirmationData.date}
⏰ Time: ${confirmationData.time}
📝 Purpose: ${confirmationData.purpose}

You'll receive a confirmation email shortly. Is there anything else I can help you with?`;

        } catch (error) {
          console.error('FastLangChain: Error creating appointment:', error);
          conversation.context.currentStep = 'chat';
          return "I apologize, but there was an error booking your appointment. Please try again or contact us directly.";
        }

      default:
        conversation.context.currentStep = 'chat';
        return "Let me help you with that. How can I assist you today?";
    }
  }

  async handleDocumentQuery(query) {
    try {
      // Fast search for relevant documents
      const relevantDocs = await this.searchDocuments(query, 2);
      
      if (relevantDocs.length === 0) {
        return `I couldn't find specific information about "${query}" in your uploaded documents. You can:

• Upload more documents for me to search through
• Ask me general questions
• Book an appointment by saying "book appointment"

What would you like to do?`;
      }

      // Build context from relevant documents
      let context = '';
      relevantDocs.forEach(doc => {
        context += `\n--- From document: ${doc.filename} ---\n`;
        doc.chunks.forEach(chunk => {
          context += chunk.text + '\n\n';
        });
      });

      const prompt = PromptTemplate.fromTemplate(`
        You are a helpful AI assistant that answers questions based on uploaded documents.
        
        Context from documents:
        {context}
        
        User question: {question}
        
        Instructions:
        1. Answer based ONLY on the information provided in the context
        2. If information comes from multiple documents, clearly indicate which document each piece of information comes from
        3. If the context doesn't contain relevant information, say so clearly
        4. Be specific and accurate - don't mix information from different documents
        5. Keep responses concise but informative
        6. If asked about appointments, suggest they can say "book appointment"
        
        Answer:
      `);

      const chain = RunnableSequence.from([
        prompt,
        this.model,
        new StringOutputParser(),
      ]);

      const response = await chain.invoke({
        context: context,
        question: query,
      });

      return response;
    } catch (error) {
      console.error('FastLangChain: Error handling document query:', error);
      return 'I apologize, but I encountered an error while processing your question. Please try again.';
    }
  }

  // Method to refresh document store when documents are added/deleted
  async refreshDocumentStore() {
    await this.initializeDocumentStore();
  }
}

export default new FastLangChainService();