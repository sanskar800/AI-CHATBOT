// API Configuration
const config = {
  // Get API base URL from environment variables
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',

  // API timeout settings
  TIMEOUT: {
    DEFAULT: 15000, // 15 seconds
    UPLOAD: 120000, // 2 minutes for file uploads
    CHAT: 30000,    // 30 seconds for chat responses
  },

  // File upload settings
  UPLOAD: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ],
    ALLOWED_EXTENSIONS: ['.pdf', '.docx', '.txt']
  }
}

export default config