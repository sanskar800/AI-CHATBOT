import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import Document from '../models/Document.js';
import langchainService from './fastLangchainService.js';

class DocumentProcessor {
  async processUploadedFile(file) {
    try {
      const filePath = file.path;
      const fileExtension = path.extname(file.originalname).toLowerCase();
      let content = '';

      switch (fileExtension) {
        case '.pdf':
          content = await this.extractPdfText(filePath);
          break;
        case '.docx':
          content = await this.extractDocxText(filePath);
          break;
        case '.txt':
          content = await this.extractTxtText(filePath);
          break;
        default:
          throw new Error('Unsupported file type');
      }

      const chunks = await langchainService.processDocument(
        content,
        file.originalname,
        fileExtension.substring(1)
      );

      const document = new Document({
        filename: file.filename,
        originalName: file.originalname,
        content: content,
        fileType: fileExtension.substring(1),
        chunks: chunks
      });

      await document.save();
      await langchainService.refreshDocumentStore();

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return {
        success: true,
        document: {
          id: document._id,
          filename: document.originalName,
          fileType: document.fileType,
          chunksCount: chunks.length,
          uploadedAt: document.uploadedAt
        }
      };

    } catch (error) {
      console.error('Error processing document:', error);
      
      if (file && file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }

      throw error;
    }
  }

  async extractPdfText(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`PDF file not found at path: ${filePath}`);
      }

      const pdfBuffer = fs.readFileSync(filePath);
      const options = { max: 0, version: 'v1.10.100' };
      const pdfData = await pdfParse(pdfBuffer, options);

      let cleanText = pdfData.text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      if (!cleanText || cleanText.length < 10) {
        const filename = path.basename(filePath);
        return `PDF Document: ${filename}

This PDF file has been processed but contains minimal extractable text. This might be:
- A scanned PDF (image-based)
- A PDF with mostly images or graphics
- An encrypted or protected PDF

For better text extraction, please try:
- Converting to DOCX format
- Using OCR software if it's a scanned document
- Saving as a text-based PDF from the original source`;
      }

      return cleanText;

    } catch (error) {
      console.error('Error extracting PDF text:', error);
      const filename = path.basename(filePath);
      
      if (error.message.includes('Invalid PDF') || error.message.includes('PDF')) {
        return `PDF Document: ${filename}

Error: This PDF file appears to be corrupted or in an unsupported format.

Please try:
- Re-uploading the PDF file
- Converting to DOCX or TXT format
- Ensuring the PDF is not password-protected`;
      } else {
        return `PDF Document: ${filename}

Processing Error: Unable to extract text from this PDF file.

This could be due to:
- File corruption during upload
- Unsupported PDF version
- Protected or encrypted content

Please try uploading the document in DOCX or TXT format for full functionality.`;
      }
    }
  }

  async extractDocxText(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.error('Error extracting DOCX text:', error);
      throw new Error('Failed to extract text from DOCX');
    }
  }

  async extractTxtText(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error('Error reading TXT file:', error);
      throw new Error('Failed to read TXT file');
    }
  }

  async getAllDocuments() {
    try {
      const documents = await Document.find({});

      return documents.map(doc => ({
        id: doc._id,
        filename: doc.originalName,
        fileType: doc.fileType,
        chunksCount: doc.chunks ? doc.chunks.length : 0,
        uploadedAt: doc.uploadedAt
      }));
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }
  }

  async deleteDocument(documentId) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      await Document.findByIdAndDelete(documentId);

      // Refresh the fast document store to remove deleted document
      await langchainService.refreshDocumentStore();

      return { success: true, message: 'Document deleted successfully' };
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
}

export default new DocumentProcessor();