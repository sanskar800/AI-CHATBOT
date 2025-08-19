import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
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

    // Initialize embeddings model
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'text-embedding-004',
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Enhanced document store with embeddings
    this.documentStore = new Map();
    this.initializeDocumentStore();
  }

  // Cosine similarity function
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  async initializeDocumentStore() {
    try {
      console.log('Initializing document store with embeddings...');
      this.documentStore.clear();
      const documents = await Document.find({});

      for (const doc of documents) {
        console.log(`Processing document: ${doc.originalName}`);

        // If document already has embeddings, use them
        let chunks = doc.chunks || [];

        // If no embeddings exist, generate them
        if (chunks.length === 0 || !chunks[0].embedding || chunks[0].embedding.length === 0) {
          console.log(`Generating embeddings for ${doc.originalName}...`);
          chunks = await this.processDocument(doc.content, doc.originalName, doc.fileType);

          // Update document with embeddings
          await Document.findByIdAndUpdate(doc._id, { chunks: chunks });
        }

        this.documentStore.set(doc._id.toString(), {
          id: doc._id.toString(),
          filename: doc.originalName,
          content: doc.content,
          fileType: doc.fileType,
          chunks: chunks
        });
      }

      console.log(`Document store initialized with ${this.documentStore.size} documents`);
    } catch (error) {
      console.error('Error initializing document store:', error);
    }
  }

  // Fast document processing without embeddings (for immediate upload)
  async processDocumentFast(content, filename, fileType) {
    try {
      console.log(`Fast processing document: ${filename}`);
      const chunks = await this.textSplitter.splitText(content);
      const processedChunks = [];

      // Create chunks without embeddings for immediate processing
      for (let i = 0; i < chunks.length; i++) {
        processedChunks.push({
          text: chunks[i],
          embedding: [], // Empty embedding array - will be filled later
          metadata: {
            section: `chunk_${i}`,
            page: Math.floor(i / 5) + 1,
            filename: filename
          }
        });
      }

      console.log(`Fast processed ${processedChunks.length} chunks for ${filename}`);
      return processedChunks;
    } catch (error) {
      console.error('Error in fast processing document:', error);
      throw error;
    }
  }

  // Background embedding generation (slow but thorough)
  async processDocument(content, filename, fileType) {
    try {
      console.log(`Processing document with embeddings: ${filename}`);
      const chunks = await this.textSplitter.splitText(content);
      const processedChunks = [];

      // Process embeddings in batches to avoid overwhelming the API
      const batchSize = 3;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, Math.min(i + batchSize, chunks.length));
        const embeddingPromises = batch.map(async (chunk, batchIndex) => {
          const chunkIndex = i + batchIndex;
          try {
            const embedding = await this.embeddings.embedQuery(chunk);
            return {
              text: chunk,
              embedding: embedding,
              metadata: {
                section: `chunk_${chunkIndex}`,
                page: Math.floor(chunkIndex / 5) + 1,
                filename: filename
              }
            };
          } catch (embeddingError) {
            console.error(`Error generating embedding for chunk ${chunkIndex}:`, embeddingError);
            return {
              text: chunk,
              embedding: [],
              metadata: {
                section: `chunk_${chunkIndex}`,
                page: Math.floor(chunkIndex / 5) + 1,
                filename: filename
              }
            };
          }
        });

        const batchResults = await Promise.all(embeddingPromises);
        processedChunks.push(...batchResults);

        // Small delay between batches to avoid rate limits
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Processed ${processedChunks.length} chunks with embeddings for ${filename}`);
      return processedChunks;
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }

  async searchDocuments(query, k = 3) {
    try {
      console.log(`Searching documents for query: "${query}"`);

      // Check if we have any documents with embeddings
      let hasEmbeddedDocs = false;
      for (const [docId, doc] of this.documentStore.entries()) {
        if (doc.chunks.some(chunk => chunk.embedding && chunk.embedding.length > 0)) {
          hasEmbeddedDocs = true;
          break;
        }
      }

      // If no embedded documents, use keyword search
      if (!hasEmbeddedDocs) {
        console.log('No embedded documents found, using keyword search');
        return this.fallbackKeywordSearch(query, k);
      }

      // Generate embedding for the query
      let queryEmbedding;
      try {
        queryEmbedding = await this.embeddings.embedQuery(query);
      } catch (embeddingError) {
        console.error('Error generating query embedding:', embeddingError);
        // Fallback to keyword search
        return this.fallbackKeywordSearch(query, k);
      }

      const embeddedResults = [];
      const keywordResults = [];

      // Search through all documents and chunks
      for (const [docId, doc] of this.documentStore.entries()) {
        let hasEmbeddedChunks = false;

        for (const chunk of doc.chunks) {
          // If chunk has embeddings, use semantic search
          if (chunk.embedding && chunk.embedding.length > 0) {
            hasEmbeddedChunks = true;
            const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);

            if (similarity > 0.3) { // Threshold for relevance
              embeddedResults.push({
                documentId: docId,
                filename: doc.filename,
                score: similarity,
                chunk: chunk,
                text: chunk.text,
                type: 'semantic'
              });
            }
          }
        }

        // If document has no embedded chunks yet, use keyword search for it
        if (!hasEmbeddedChunks) {
          const keywordResult = this.searchDocumentKeywords(doc, query, docId);
          if (keywordResult) {
            keywordResults.push(keywordResult);
          }
        }
      }

      // Combine results
      let allResults = [...embeddedResults, ...keywordResults];

      // Sort by similarity score (descending)
      allResults.sort((a, b) => b.score - a.score);

      // Group results by document and limit chunks per document
      const groupedResults = {};
      const finalResults = [];

      for (const result of allResults) {
        if (!groupedResults[result.documentId]) {
          groupedResults[result.documentId] = {
            documentId: result.documentId,
            filename: result.filename,
            score: result.score,
            chunks: [],
            searchType: result.type || 'keyword'
          };
        }

        // Limit to 3 chunks per document
        if (groupedResults[result.documentId].chunks.length < 3) {
          groupedResults[result.documentId].chunks.push({
            text: result.text || result.chunk?.text,
            score: result.score
          });
        }
      }

      // Convert to array and sort by best score per document
      for (const docResult of Object.values(groupedResults)) {
        finalResults.push(docResult);
      }

      finalResults.sort((a, b) => b.score - a.score);

      console.log(`Found ${finalResults.length} relevant documents (${embeddedResults.length} semantic, ${keywordResults.length} keyword)`);
      return finalResults.slice(0, k);

    } catch (error) {
      console.error('Error in search:', error);
      return this.fallbackKeywordSearch(query, k);
    }
  }

  // Helper method for keyword search on individual document
  searchDocumentKeywords(doc, query, docId) {
    const queryLower = query.toLowerCase();
    const contentLower = doc.content.toLowerCase();
    let score = 0;

    const queryWords = queryLower.split(' ').filter(word => word.length > 2);

    for (const word of queryWords) {
      const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
      score += matches;
    }

    if (score > 0) {
      const relevantChunks = doc.chunks.filter(chunk =>
        queryWords.some(word => chunk.text.toLowerCase().includes(word))
      ).slice(0, 3);

      if (relevantChunks.length > 0) {
        return {
          documentId: docId,
          filename: doc.filename,
          score: score / 10, // Normalize keyword scores to be lower than semantic scores
          chunks: relevantChunks.map(chunk => ({ text: chunk.text, score: score / 10 })),
          type: 'keyword'
        };
      }
    }

    return null;
  }

  // Fallback keyword search when embeddings fail
  fallbackKeywordSearch(query, k = 3) {
    console.log('Using fallback keyword search');
    try {
      const results = [];
      const queryLower = query.toLowerCase();

      for (const [docId, doc] of this.documentStore.entries()) {
        const contentLower = doc.content.toLowerCase();
        let score = 0;
        let relevantChunks = [];

        const queryWords = queryLower.split(' ').filter(word => word.length > 2);

        for (const word of queryWords) {
          const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
          score += matches;
        }

        if (score > 0) {
          relevantChunks = doc.chunks.filter(chunk =>
            queryWords.some(word => chunk.text.toLowerCase().includes(word))
          ).slice(0, 3);
        }

        if (relevantChunks.length > 0) {
          results.push({
            documentId: docId,
            filename: doc.filename,
            score: score,
            chunks: relevantChunks.map(chunk => ({ text: chunk.text, score: score }))
          });
        }
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, k);
    } catch (error) {
      console.error('Error in fallback search:', error);
      return [];
    }
  }

  parseNaturalDate(dateString) {
    const today = new Date();
    const lowerDateString = dateString.toLowerCase().trim();

    // Handle basic day references
    if (lowerDateString === 'today') {
      return formatInTimeZone(today, 'UTC', 'yyyy-MM-dd');
    }

    if (lowerDateString === 'tomorrow') {
      return formatInTimeZone(addDays(today, 1), 'UTC', 'yyyy-MM-dd');
    }

    // Handle "day after tomorrow" and variations
    if (lowerDateString === 'day after tomorrow' ||
      lowerDateString === 'the day after tomorrow' ||
      lowerDateString === 'overmorrow') {
      return formatInTimeZone(addDays(today, 2), 'UTC', 'yyyy-MM-dd');
    }

    // Handle "in X days" format
    const inDaysMatch = lowerDateString.match(/^in (\d+) days?$/);
    if (inDaysMatch) {
      const daysToAdd = parseInt(inDaysMatch[1]);
      return formatInTimeZone(addDays(today, daysToAdd), 'UTC', 'yyyy-MM-dd');
    }

    // Handle "X days from now" format
    const daysFromNowMatch = lowerDateString.match(/^(\d+) days? from now$/);
    if (daysFromNowMatch) {
      const daysToAdd = parseInt(daysFromNowMatch[1]);
      return formatInTimeZone(addDays(today, daysToAdd), 'UTC', 'yyyy-MM-dd');
    }

    // Handle weekdays
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayWeekday = today.getDay();

    for (let i = 0; i < weekdays.length; i++) {
      if (lowerDateString === weekdays[i]) {
        let daysToAdd = i - todayWeekday;
        if (daysToAdd <= 0) {
          daysToAdd += 7; // Next occurrence of this weekday
        }
        const targetDate = addDays(today, daysToAdd);
        return formatInTimeZone(targetDate, 'UTC', 'yyyy-MM-dd');
      }

      if (lowerDateString === `next ${weekdays[i]}`) {
        let daysToAdd = i - todayWeekday;
        if (daysToAdd <= 0) {
          daysToAdd += 7;
        }
        // For "next Monday" always go to the following week if it's currently Monday
        if (daysToAdd === 0) {
          daysToAdd = 7;
        }
        const targetDate = addDays(today, daysToAdd);
        return formatInTimeZone(targetDate, 'UTC', 'yyyy-MM-dd');
      }

      if (lowerDateString === `this ${weekdays[i]}`) {
        let daysToAdd = i - todayWeekday;
        if (daysToAdd < 0) {
          daysToAdd += 7; // This week's occurrence (if not passed)
        }
        const targetDate = addDays(today, daysToAdd);
        return formatInTimeZone(targetDate, 'UTC', 'yyyy-MM-dd');
      }
    }

    // Handle relative expressions like "next week", "next month"
    if (lowerDateString === 'next week') {
      return formatInTimeZone(addDays(today, 7), 'UTC', 'yyyy-MM-dd');
    }

    // Handle date formats
    const dateFormats = [
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'dd/MM/yyyy',
      'MM-dd-yyyy',
      'dd-MM-yyyy',
      'M/d/yyyy',
      'd/M/yyyy'
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
          // Handle regular chat with semantic document search
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
      console.log(`Handling document query: ${query}`);

      // Check embedding status for better user feedback
      let pendingEmbeddings = 0;
      let totalDocs = 0;
      for (const [docId, doc] of this.documentStore.entries()) {
        totalDocs++;
        const hasEmbeddings = doc.chunks.some(chunk => chunk.embedding && chunk.embedding.length > 0);
        if (!hasEmbeddings) {
          const status = this.getEmbeddingStatus(docId);
          if (status === 'queued' || status === 'processing') {
            pendingEmbeddings++;
          }
        }
      }

      // Hybrid search (semantic + keyword)
      const relevantDocs = await this.searchDocuments(query, 2);

      if (relevantDocs.length === 0) {
        let message = `I couldn't find specific information about "${query}" in your uploaded documents.`;

        if (pendingEmbeddings > 0) {
          message += ` Note: ${pendingEmbeddings} document(s) are still being processed for better search accuracy.`;
        }

        message += ` This could mean:

• The information isn't in the uploaded documents
• Try rephrasing your question differently
• The documents may need more time to process

You can also:
• Upload more documents for me to search through
• Ask me general questions
• Book an appointment by saying "book appointment"

What would you like to do?`;

        return message;
      }

      // Build context from relevant documents
      let context = '';
      let searchTypeInfo = '';

      relevantDocs.forEach(doc => {
        const searchType = doc.searchType === 'semantic' ? 'Semantic similarity' : 'Keyword match';
        context += `\n--- From document: ${doc.filename} (${searchType}: ${Math.round(doc.score * 100)}%) ---\n`;
        doc.chunks.forEach(chunk => {
          context += chunk.text + '\n\n';
        });
      });

      const prompt = PromptTemplate.fromTemplate(`
        You are a helpful AI assistant that answers questions based on uploaded documents using hybrid search (semantic and keyword).
        
        Context from documents (ranked by relevance):
        {context}
        
        User question: {question}
        
        Instructions:
        1. Answer based ONLY on the information provided in the context
        2. The documents are ranked by relevance to the question
        3. If information comes from multiple documents, clearly indicate which document each piece of information comes from
        4. If the context doesn't contain relevant information, say so clearly
        5. Be specific and accurate - don't mix information from different documents
        6. Keep responses concise but informative
        7. If asked about appointments, suggest they can say "book appointment"
        
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

      return response + searchTypeInfo;
    } catch (error) {
      console.error('FastLangChain: Error handling document query:', error);
      return 'I apologize, but I encountered an error while processing your question. Please try again.';
    }
  }

  // Method to refresh document store when documents are added/deleted
  async refreshDocumentStore() {
    await this.initializeDocumentStore();
  }

  // Background embedding generation queue
  embeddingQueue = new Map(); // documentId -> processing status

  // Method to add document for fast upload (without waiting for embeddings)
  async addDocumentFast(documentId, content, filename, fileType) {
    try {
      // Fast processing without embeddings
      const chunks = await this.processDocumentFast(content, filename, fileType);

      // Add to document store immediately
      this.documentStore.set(documentId, {
        id: documentId,
        filename: filename,
        content: content,
        fileType: fileType,
        chunks: chunks
      });

      // Queue for background embedding processing
      this.queueEmbeddingGeneration(documentId, content, filename, fileType);

      console.log(`Document ${filename} added fast, embeddings queued for background processing`);
      return chunks;
    } catch (error) {
      console.error('Error in fast document addition:', error);
      throw error;
    }
  }

  // Queue embedding generation for background processing
  async queueEmbeddingGeneration(documentId, content, filename, fileType) {
    if (this.embeddingQueue.has(documentId)) {
      console.log(`Document ${documentId} already queued for embedding processing`);
      return;
    }

    this.embeddingQueue.set(documentId, 'queued');
    // Process in background (non-blocking)
    setTimeout(async () => {
      try {
        console.log(`Starting background embedding generation for ${filename}`);
        this.embeddingQueue.set(documentId, 'processing');
        // Generate embeddings with full processing
        const chunksWithEmbeddings = await this.processDocument(content, filename, fileType);

        // Update document store
        if (this.documentStore.has(documentId)) {
          const docData = this.documentStore.get(documentId);
          docData.chunks = chunksWithEmbeddings;
          this.documentStore.set(documentId, docData);
        }

        // Update database
        await Document.findByIdAndUpdate(documentId, { chunks: chunksWithEmbeddings });
        this.embeddingQueue.set(documentId, 'completed');
        console.log(`Background embedding generation completed for ${filename}`);

        // Clean up queue entry after some time
        setTimeout(() => {
          this.embeddingQueue.delete(documentId);
        }, 300000); // 5 minutes

      } catch (error) {
        console.error(`Error in background embedding generation for ${filename}:`, error);
        this.embeddingQueue.set(documentId, 'error');
      }
    }, 100);
  }

  // Check embedding status for a document
  getEmbeddingStatus(documentId) {
    return this.embeddingQueue.get(documentId) || 'completed';
  }

  // Method to reprocess documents and regenerate embeddings
  async reprocessAllDocuments() {
    try {
      console.log('Reprocessing all documents with embeddings...');
      const documents = await Document.find({});
      for (const doc of documents) {
        console.log(`Reprocessing ${doc.originalName}...`);
        const chunks = await this.processDocument(doc.content, doc.originalName, doc.fileType);
        await Document.findByIdAndUpdate(doc._id, { chunks: chunks });
      }

      await this.refreshDocumentStore();
      console.log('All documents reprocessed successfully');
      return true;
    } catch (error) {
      console.error('Error reprocessing documents:', error);
      return false;
    }
  }
}
export default new FastLangChainService();