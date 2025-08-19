# AI Document Chatbot

A full-stack AI-powered chatbot that can answer questions from uploaded documents and handle appointment bookings with conversational forms.

## 🚀 Features

- **Document Processing**: Upload and query PDF, DOCX, and TXT files
- **AI-Powered Chat**: Uses Google Gemini 2.0 Flash for intelligent responses
- **Appointment Booking**: Conversational form with natural date parsing
- **Fast Search**: In-memory document store for quick responses
- **Real-time Chat**: WebSocket-like experience with React
- **File Management**: Upload, delete, and manage documents
- **Input Validation**: Email, phone, date, and time validation
- **Toast Notifications**: User-friendly feedback system

## 🛠 Tech Stack

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Toastify** for notifications
- **Axios** for API calls

### Backend
- **Node.js** with Express
- **MongoDB** with Mongoose
- **LangChain** for document processing
- **Google Gemini AI** for chat responses
- **Multer** for file uploads
- **PDF-Parse** for PDF text extraction
- **Mammoth** for DOCX processing

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
4. **Natural Dates**: Use "tomorrow", "next Monday", or "YYYY-MM-DD" format
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