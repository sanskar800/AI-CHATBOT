import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './config/mongodb.js'
import chatRoutes from './routes/chatRoutes.js'
import documentRoutes from './routes/documentRoutes.js'
import appointmentRoutes from './routes/appointmentRoutes.js'

//app config
const app = express()
const port = process.env.PORT || 4000
connectDB()

//middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cors())

//api endpoints
app.get('/', (req, res) => {
    res.send('AI Chatbot API is Working!')
})

// Routes
app.use('/api/chat', chatRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/appointments', appointmentRoutes)

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
    });
});

app.listen(port, () => console.log('AI Chatbot Server Started on port', port))
