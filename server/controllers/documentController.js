import documentProcessor from '../services/documentProcessor.js';

export const uploadDocument = async (req, res) => {
  try {
    console.log('Upload request received');
    console.log('File:', req.file);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const allowedTypes = ['.pdf', '.docx', '.txt'];
    const fileExtension = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'));

    console.log('File extension:', fileExtension);

    if (!allowedTypes.includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported file type. Please upload PDF, DOCX, or TXT files.'
      });
    }

    console.log('Processing file with documentProcessor...');
    const result = await documentProcessor.processUploadedFile(req.file);
    console.log('File processed successfully:', result);

    res.json({
      success: true,
      message: 'Document uploaded and processed successfully',
      document: result.document
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process document'
    });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const documents = await documentProcessor.getAllDocuments();

    res.json({
      success: true,
      documents
    });

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents'
    });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }

    const result = await documentProcessor.deleteDocument(documentId);

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete document'
    });
  }
};