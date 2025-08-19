import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Bot, User, Upload, FileText } from 'lucide-react'
import axios from 'axios'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import config from '../config/api.js'

const FastChatbot = () => {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [currentStep, setCurrentStep] = useState('chat')
  const [documents, setDocuments] = useState([])
  const messagesEndRef = useRef(null)

  // Optimized axios instance with timeout
  const api = axios.create({
    baseURL: config.API_BASE_URL,
    timeout: config.TIMEOUT.DEFAULT,
  })

  useEffect(() => {
    // Generate session ID
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setSessionId(newSessionId)

    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: `Hello! I'm your AI assistant. I can help you with:

📄 **Document Queries** - Upload documents and ask me questions about them
📅 **Appointment Booking** - Say "book appointment" or "call me" to schedule a meeting

How can I assist you today?`,
      timestamp: new Date()
    }])

    // Fetch existing documents
    fetchDocuments()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await api.get('/documents')
      if (response.data.success) {
        setDocuments(response.data.documents)
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast.error('Failed to fetch documents')
    }
  }, [])

  const handleFileUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return

    const file = files[0]

    if (!config.UPLOAD.ALLOWED_TYPES.includes(file.type)) {
      toast.error('Please upload only PDF, DOCX, or TXT files')
      return
    }

    if (file.size > config.UPLOAD.MAX_SIZE) {
      toast.error(`File size must be less than ${config.UPLOAD.MAX_SIZE / (1024 * 1024)}MB`)
      return
    }

    const uploadToast = toast.loading(`Uploading and processing "${file.name}"...`)
    const formData = new FormData()
    formData.append('document', file)

    try {
      const response = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: config.TIMEOUT.UPLOAD
      })

      if (response.data.success) {
        const fileType = file.type.includes('pdf') ? 'PDF' :
          file.type.includes('word') ? 'DOCX' : 'TXT';

        toast.update(uploadToast, {
          render: `${fileType} document "${file.name}" uploaded and processed successfully!`,
          type: 'success',
          isLoading: false,
          autoClose: 4000
        })

        fetchDocuments()

        // Add system message
        setMessages(prev => [...prev, {
          role: 'system',
          content: `📄 ${fileType} document "${file.name}" has been uploaded and processed. You can now ask questions about it!`,
          timestamp: new Date()
        }])
      }
    } catch (error) {
      console.error('Error uploading document:', error)

      let errorMessage = 'Failed to upload document. Please try again.';

      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Upload timeout. PDF processing can take longer. Please try a smaller file.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      toast.update(uploadToast, {
        render: errorMessage,
        type: 'error',
        isLoading: false,
        autoClose: 6000
      })
    }
  }, [fetchDocuments])

  const handleDeleteDocument = useCallback(async (documentId, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return
    }

    const deleteToast = toast.loading(`Deleting "${filename}"...`)

    try {
      const response = await api.delete(`/documents/${documentId}`)
      if (response.data.success) {
        toast.update(deleteToast, {
          render: `Document "${filename}" deleted successfully!`,
          type: 'success',
          isLoading: false,
          autoClose: 3000
        })

        fetchDocuments()

        // Add system message
        setMessages(prev => [...prev, {
          role: 'system',
          content: `📄 Document "${filename}" has been deleted from the system.`,
          timestamp: new Date()
        }])
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.update(deleteToast, {
        render: 'Failed to delete document. Please try again.',
        type: 'error',
        isLoading: false,
        autoClose: 5000
      })
    }
  }, [fetchDocuments])

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = inputMessage
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await api.post('/chat/message', {
        message: currentInput,
        sessionId: sessionId
      })

      if (response.data.success) {
        const assistantMessage = {
          role: 'assistant',
          content: response.data.response,
          timestamp: new Date()
        }

        setMessages(prev => [...prev, assistantMessage])
        setCurrentStep(response.data.currentStep)
      } else {
        throw new Error(response.data.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = {
        role: 'assistant',
        content: error.code === 'ECONNABORTED'
          ? 'Request timeout. The AI is taking too long to respond. Please try again.'
          : 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date(),
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])

      if (error.code === 'ECONNABORTED') {
        toast.error('Response timeout. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [inputMessage, isLoading, sessionId])

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  const getStepIndicator = () => {
    if (currentStep === 'chat') return 'Chat Mode'
    if (currentStep.startsWith('appointment_')) return 'Booking Appointment'
    return currentStep
  }

  return (
    <>
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bot className="w-6 h-6 mr-2" />
                <h1 className="text-xl font-semibold">AI Document Chatbot</h1>
              </div>
              <div className="text-sm bg-blue-500 px-3 py-1 rounded-full">
                {getStepIndicator()}
              </div>
            </div>
          </div>

          {/* Document Upload Section */}
          <div className="p-4 bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="w-5 h-5 mr-2 text-gray-600" />
                <span className="text-sm text-gray-700">
                  Documents: {documents.length} uploaded
                </span>
              </div>
              <div>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </label>
              </div>
            </div>

            {documents.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-gray-600 mb-2">Uploaded Documents:</div>
                <div className="flex flex-wrap gap-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center bg-white rounded-lg px-3 py-1 text-xs border">
                      <span className="mr-2 truncate max-w-32" title={doc.filename}>{doc.filename}</span>
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                        className="text-red-500 hover:text-red-700 ml-1 text-lg leading-none"
                        title="Delete document"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat Messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-xs lg:max-w-md ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 ${message.role === 'user' ? 'ml-2' : 'mr-2'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : message.role === 'system'
                          ? 'bg-green-500 text-white'
                          : message.isError
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                      }`}>
                      {message.role === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : message.role === 'system' ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-lg ${message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.role === 'system'
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : message.isError
                          ? 'bg-red-50 text-red-800 border border-red-200'
                          : 'bg-gray-100 text-gray-800'
                    }`}>
                    <div className="whitespace-pre-wrap text-sm">
                      {message.content}
                    </div>
                    <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-4 py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span className="text-gray-600 text-sm">AI is thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  currentStep === 'chat'
                    ? "Ask about your documents or say 'book appointment'..."
                    : "Please provide the requested information..."
                }
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {currentStep !== 'chat' && (
              <div className="mt-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-2">
                <strong>Appointment Booking:</strong> Please provide the requested information to complete your booking.
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">How to use:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Upload documents using the "Upload Document" button</li>
            <li>• Ask questions about your documents</li>
            <li>• Say "book appointment" or "call me" to schedule a meeting</li>
            <li>• Use natural language for dates like "tomorrow" or "next Monday"</li>
          </ul>
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  )
}

export default FastChatbot