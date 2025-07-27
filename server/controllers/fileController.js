import S3Service from "../services/s3Service.js";
import { validateUploadConfig } from "../utils/fileUtils.js";

class FileController {
	/**
	 * Upload files to S3
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	static async uploadFiles(req, res) {
		try {
			// Check if files were provided
			if (!req.files || req.files.length === 0) {
				return res.status(400).json({
					success: false,
					error: "No files provided",
				});
			}

			// Parse and validate upload configuration
			const uploadConfig = JSON.parse(req.body.uploadConfig || "{}");

			const validation = validateUploadConfig(uploadConfig);

			if (!validation.valid) {
				return res.status(400).json({
					success: false,
					error: validation.error,
				});
			}

			// Upload files to S3
			const uploadResults = await S3Service.uploadFiles(
				req.files,
				uploadConfig
			);

			// Send response
			res.json({
				success: true,
				results: uploadResults,
				totalFiles: req.files.length,
				successCount: uploadResults.filter((r) => r.success).length,
			});
		} catch (error) {
			console.error("Upload error:", error);
			res.status(500).json({
				success: false,
				error: error.message || "Upload failed",
			});
		}
	}

	/**
	 * Generate presigned URL for file access
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	static async generatePresignedUrl(req, res) {
		try {
			const { s3Key, expiresIn = 3600 } = req.body;

			console.log("🔍 Presigned URL request:", { s3Key, expiresIn });

			if (!s3Key) {
				return res.status(400).json({
					success: false,
					error: "S3 key is required",
				});
			}

			const url = await S3Service.generatePresignedUrl(s3Key, expiresIn);
			console.log(
				"🔗 Generated presigned URL:",
				url ? "✅ Success" : "❌ Failed"
			);

			res.json({
				success: true,
				url: url,
			});
		} catch (error) {
			console.error("❌ Presigned URL error:", error);
			res.status(500).json({
				success: false,
				error: error.message || "Failed to generate presigned URL",
			});
		}
	}

	/**
	 * Delete file from S3
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	static async deleteFile(req, res) {
		try {
			const s3Key = decodeURIComponent(req.params.key);

			if (!s3Key) {
				return res.status(400).json({
					success: false,
					error: "S3 key is required",
				});
			}

			await S3Service.deleteFile(s3Key);

			res.json({
				success: true,
				message: "File deleted successfully",
			});
		} catch (error) {
			console.error("Delete error:", error);
			res.status(500).json({
				success: false,
				error: error.message || "Failed to delete file",
			});
		}
	}

	/**
	 * Get file metadata
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	static async getFileMetadata(req, res) {
		try {
			const s3Key = decodeURIComponent(req.params.key);

			if (!s3Key) {
				return res.status(400).json({
					success: false,
					error: "S3 key is required",
				});
			}

			const metadata = await S3Service.getFileMetadata(s3Key);

			res.json({
				success: true,
				data: metadata,
			});
		} catch (error) {
			console.error("Metadata error:", error);
			res.status(500).json({
				success: false,
				error: error.message || "Failed to get file metadata",
			});
		}
	}

	/**
	 * List files from S3
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	static async listFiles(req, res) {
		try {
			const { prefix } = req.query;

			const files = await S3Service.listFiles(prefix);

			res.json({
				success: true,
				files: files,
				count: files.length,
			});
		} catch (error) {
			console.error("List files error:", error);
			res.status(500).json({
				success: false,
				error: error.message || "Failed to list files",
			});
		}
	}

	/**
	 * List files by category (college, course, etc.)
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	static async listFilesByCategory(req, res) {
		try {
			const { college, course, semester, subject, type } = req.query;

			if (!college || !course) {
				return res.status(400).json({
					success: false,
					error: "College and course are required",
				});
			}

			// Import Note model
			const Note = (await import("../models/noteModel.js")).default;

			// Build filter for database query
			const filter = {
				status: "approved", // Only show approved notes
				college: college.toLowerCase(),
				course: course, // Keep original case to match DB (chemicalEngineering)
			};

			if (semester) filter.semester = String(semester); // Convert to string to match DB
			if (subject) filter.subject = subject.toUpperCase(); // CH701 is uppercase in DB
			if (type) filter.uploadType = type.toLowerCase();

			console.log("🔍 Fetching notes with filter:", filter);
			console.log("🔍 Original query params:", {
				college,
				course,
				semester,
				subject,
				type,
			});
			console.log("🔍 Type parameter processing:", {
				originalType: type,
				filterUploadType: type ? type.toLowerCase() : "undefined",
				hasTypeFilter: !!type,
			});

			// Fetch notes from database
			const notes = await Note.find(filter)
				.populate("uploadedBy", "name email")
				.sort({ createdAt: -1 })
				.lean();

			console.log(`📊 Found ${notes.length} approved notes`);
			if (notes.length > 0) {
				console.log("📄 Sample note:", {
					title: notes[0].title,
					college: notes[0].college,
					course: notes[0].course,
					semester: notes[0].semester,
					subject: notes[0].subject,
					uploadType: notes[0].uploadType,
				});
			}

			// Format notes for frontend
			const formattedFiles = notes.map((note) => {
				// Determine the best display name
				let displayName = note.title;

				// Check if title looks corrupted (only numbers, very short, etc.)
				const titleLooksCorrupted =
					/^\d+$/.test(note.title.trim()) ||
					note.title.trim().length < 3 ||
					note.title.trim() === note.title.trim().replace(/[a-zA-Z]/g, "");

				// Use original filename if title looks corrupted
				if (titleLooksCorrupted && note.file.originalName) {
					displayName = note.file.originalName;
				}

				return {
					_id: note._id,
					title: note.title, // Keep original title for backend reference
					fileName: displayName, // Use better display name
					displayName: displayName, // Use better display name
					key: note.file.s3Key, // S3 key for generating presigned URL
					size: note.file.size,
					lastModified: note.file.uploadDate || note.createdAt, // Use upload date or creation date
					mimeType: note.file.mimeType, // Add MIME type for better file handling
					originalName: note.file.originalName, // Add original filename
					uploadType: note.uploadType,
					subject: note.subject,
					semester: note.semester,
					uploadedBy: note.uploadedBy,
					createdAt: note.createdAt,
					downloadCount: note.downloadCount || 0,
				};
			});

			res.json({
				success: true,
				files: formattedFiles,
				totalFiles: formattedFiles.length,
			});
		} catch (error) {
			console.error("List files by category error:", error);
			res.status(500).json({
				success: false,
				error: error.message || "Failed to list files by category",
			});
		}
	}
}

export default FileController;
