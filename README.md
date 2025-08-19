# AI Document Chatbot

A modern chatbot web application leveraging Google's Gemini AI and LangChain for intelligent document processing, semantic search, and conversational AI.

## 🚀 Features

### Document Processing & Search
- **Multi-format Support**: Upload and query PDF, DOCX, and TXT files
- **Hybrid Search System**: 
  - Semantic search using Google's `text-embedding-004` model
  - Keyword-based fallback for immediate availability
  - Cosine similarity matching for contextual relevance
- **Smart Text Chunking**: LangChain's RecursiveCharacterTextSplitter with 1000-character chunks and 200-character overlap
- **Background Processing**: Fast upload with background embedding generation
- **RAG Architecture**: Retrieval-Augmented Generation for accurate, context-aware responses

### AI-Powered Conversations
- **Google Gemini 2.0 Flash**: Advanced language model for intelligent responses
- **Context-Aware Chat**: Maintains conversation history and document context
- **Natural Language Understanding**: Processes queries in everyday language
- **Intent Detection**: Automatically detects appointment booking requests

### Smart Appointment Booking
- **Guided Conversation Flow**: Step-by-step appointment collection
- **Natural Date Parsing**: Understands "tomorrow", "next Monday", "in 3 days", etc.
- **Multi-format Validation**: Email, phone, date, and time validation
- **Flexible Cancellation**: Cancel/restart functionality at any step
- **State Management**: Maintains booking progress across messages

## 🛠 Tech Stack

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Toastify** for notifications
- **Axios** for API calls

### Backend & AI/ML
- **Node.js** with Express framework
- **MongoDB** with Mongoose ODM
- **LangChain Components**:
  - `ChatGoogleGenerativeAI` for chat completion
  - `GoogleGenerativeAIEmbeddings` for vector embeddings
  - `RecursiveCharacterTextSplitter` for text processing
  - `PromptTemplate` & `RunnableSequence` for chain operations
- **Google Gemini AI** (gemini-2.0-flash) for responses
- **Vector Search**: Custom cosine similarity implementation
- **Document Parsers**: PDF-Parse, Mammoth, native TXT handling

## 📁 Project Structure

```
ai-chatbot/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── Chatbot.jsx
│   │   ├── config/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   └── package.json
├── server/                 # Node.js backend
│   ├── config/
│   │   ├── mongodb.js
│   ├── controllers/
│   │   ├── appointmentController.js
│   │   ├── chatController.js
│   │   └── documentController.js
│   ├── models/
│   │   ├── Appointment.js
│   │   ├── Conversation.js
│   │   └── Document.js
│   ├── routes/
│   │   ├── appointmentRoutes.js
│   │   ├── chatRoutes.js
│   │   └── documentRoutes.js
│   ├── services/
│   │   ├── documentProcessor.js
│   │   └── fastLangchainService.js
│   ├── .env
│   ├── server.js
│   └── package.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB database
- Google Gemini API key

### Installation

1. **Clone and setup**
```bash
cd ai-chatbot
```

2. **Backend setup**
```bash
cd server
npm install
```

3. **Frontend setup**
```bash
cd ../client
npm install
```

4. **Environment variables**

Create `server/.env`:
```env
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
PORT=4000
```

Create `client/.env`:
```env
VITE_API_BASE_URL=http://localhost:4000/api
```

5. **Run the application**

Backend:
```bash
cd server
npm start
```

Frontend:
```bash
cd client
npm run dev
```

## 💡 Usage

1. **Upload Documents**: Click "Upload Document" to add PDF, DOCX, or TXT files
2. **Ask Questions**: Query your documents with natural language
3. **Book Appointments**: Say "book appointment" to start the booking process
4. **Natural Dates**: Use "tomorrow", "next Monday", "in X days" , "day after tomorrow" or "YYYY-MM-DD" format
5. **Cancel Booking**: Say "cancel" anytime during appointment booking

## 🔧 API Endpoints

### Chat
- `POST /api/chat/message` - Send chat message
- `GET /api/chat/history/:sessionId` - Get conversation history

### Documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - Get all documents
- `DELETE /api/documents/:id` - Delete document

### Appointments
- `POST /api/appointments` - Create appointment
- `GET /api/appointments` - Get all appointments
- `GET /api/appointments/:id` - Get specific appointment
