import express from "express";
import FileController from "../controllers/fileController.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Upload files to S3
router.post("/upload", upload.array("files", 50), FileController.uploadFiles);

// Generate presigned URL for file access
router.post("/presigned-url", FileController.generatePresignedUrl);

// List files from S3
router.get("/files", FileController.listFiles);

// List files by category (college, course, semester, subject)
router.get("/files/category", FileController.listFilesByCategory);

// Delete file from S3
router.delete("/files/:key", FileController.deleteFile);

// Get file metadata
router.get("/files/:key/metadata", FileController.getFileMetadata);

export default router;
