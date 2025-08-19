import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true,
    enum: ['pdf', 'docx', 'txt']
  },
  chunks: [{
    text: String,
    embedding: [Number],
    metadata: {
      page: Number,
      section: String
    }
  }],
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for text search
documentSchema.index({ content: 'text' });
documentSchema.index({ 'chunks.text': 'text' });

export default mongoose.model('Document', documentSchema);