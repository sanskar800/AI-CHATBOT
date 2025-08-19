import mongoose from "mongoose";

const connectDB = async () => {
    try {
        mongoose.connection.on('connected', () => console.log('MongoDB connected successfully'))
        mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err))

        await mongoose.connect(`${process.env.MONGODB_URI}/chatbot-db`)

        console.log('MongoDB connection established')
    } catch (error) {
        console.error('MongoDB connection failed:', error)
        process.exit(1)
    }
}

export default connectDB;