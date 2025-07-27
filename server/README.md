# 🎯 College Notes Server

### Current Clean Structure:

```
server/
├── app.js                    # Main server file (clean S3-only)
├── package.json             # Optimized dependencies
├── .env                     # Clean environment (AWS only)
├── config/
│   ├── aws.js              # AWS S3 configuration
│   └── database.js         # Empty (cleaned up)
├── controllers/
│   └── fileController.js   # S3 file operations
├── middleware/
│   ├── cors.js            # CORS configuration
│   ├── errorHandler.js    # Error handling
│   └── upload.js          # Multer file upload
├── routes/
│   ├── index.js           # Main router
│   └── fileRoutes.js      # S3 file routes
├── services/
│   └── s3Service.js       # AWS S3 service layer
└── utils/
    └── fileUtils.js       # File utilities for S3
```

## 🚀 Current Functionality

### Core Features:

- ✅ **AWS S3 File Upload**: Multi-file upload with organization by college/course/semester
- ✅ **File Management**: List, delete, get metadata for S3 files
- ✅ **Presigned URLs**: Generate secure download links
- ✅ **File Organization**: Automatic S3 key generation with hierarchical structure
- ✅ **Error Handling**: Comprehensive error middleware
- ✅ **CORS Support**: Cross-origin requests enabled

### API Endpoints:

- `POST /api/upload` - Upload files to S3
- `GET /api/files` - List all files from S3
- `GET /api/files/category` - List files by category filters
- `POST /api/presigned-url` - Generate presigned download URL
- `DELETE /api/files/:key` - Delete file from S3
- `GET /api/files/:key/metadata` - Get file metadata

### Dependencies (Optimized):

- **express**: Web framework
- **aws-sdk**: Amazon S3 integration
- **multer**: File upload handling
- **cors**: Cross-origin resource sharing
- **body-parser**: Request body parsing
- **dotenv**: Environment variable management

## 🎯 How to Use

### Start Server:

```bash
npm start          # Production mode
npm run dev        # Development mode (with nodemon)
```

### Environment Setup:

Ensure `.env` contains your AWS credentials:

```
PORT=5000
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region
AWS_S3_BUCKET_NAME=your_bucket_name
```

## 📈 Performance Improvements
