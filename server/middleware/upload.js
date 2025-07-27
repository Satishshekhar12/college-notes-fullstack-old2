import multer from "multer";
import { S3_CONFIG } from "../config/aws.js";

// Configure multer for file upload handling
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
	if (S3_CONFIG.allowedFileTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error(`File type ${file.mimetype} is not allowed`), false);
	}
};

const upload = multer({
	storage: storage,
	limits: {
		fileSize: S3_CONFIG.maxFileSize,
		files: 50, // Maximum 50 files per batch (increased from 10)
	},
	fileFilter: fileFilter,
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
	if (error instanceof multer.MulterError) {
		switch (error.code) {
			case "LIMIT_FILE_SIZE":
				return res.status(400).json({
					success: false,
					error: `File size exceeds ${
						S3_CONFIG.maxFileSize / (1024 * 1024)
					}MB limit`,
				});
			case "LIMIT_FILE_COUNT":
				return res.status(400).json({
					success: false,
					error: "Too many files. Maximum 50 files allowed per batch upload",
				});
			case "LIMIT_UNEXPECTED_FILE":
				return res.status(400).json({
					success: false,
					error: "Unexpected file field",
				});
			default:
				return res.status(400).json({
					success: false,
					error: error.message,
				});
		}
	}
	next(error);
};

export { upload, handleMulterError };
