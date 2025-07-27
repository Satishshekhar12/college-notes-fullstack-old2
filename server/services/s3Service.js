import { s3, S3_CONFIG } from "../config/aws.js";
import { generateS3Key, createFileMetadata } from "../utils/fileUtils.js";

class S3Service {
	/**
	 * Upload a single file to S3
	 * @param {Object} file - File object from multer
	 * @param {Object} uploadConfig - Upload configuration
	 * @returns {Promise<Object>} - Upload result
	 */
	static async uploadFile(file, uploadConfig) {
		try {
			const s3Key = generateS3Key(file, uploadConfig);
			const metadata = createFileMetadata(file, uploadConfig);

			const params = {
				Bucket: S3_CONFIG.bucket,
				Key: s3Key,
				Body: file.buffer,
				ContentType: file.mimetype,
				ACL: "private",
				Metadata: metadata,
			};

			const result = await s3.upload(params).promise();

			return {
				success: true,
				data: {
					originalName: file.originalname,
					s3Key: s3Key,
					s3Url: result.Location,
					eTag: result.ETag,
					size: file.size,
					contentType: file.mimetype,
					uploadedAt: new Date().toISOString(),
				},
			};
		} catch (error) {
			console.error(`Failed to upload ${file.originalname}:`, error);
			return {
				success: false,
				fileName: file.originalname,
				error: error.message,
			};
		}
	}

	/**
	 * Upload multiple files to S3
	 * @param {Array} files - Array of file objects
	 * @param {Object} uploadConfig - Upload configuration
	 * @returns {Promise<Array>} - Array of upload results
	 */
	static async uploadFiles(files, uploadConfig) {
		try {
			// Upload all files in parallel for better performance
			const uploadPromises = files.map((file) =>
				this.uploadFile(file, uploadConfig)
			);
			const uploadResults = await Promise.allSettled(uploadPromises);

			// Convert Promise.allSettled results to our expected format
			return uploadResults.map((result, index) => {
				if (result.status === "fulfilled") {
					return result.value;
				} else {
					return {
						success: false,
						fileName: files[index].originalname,
						error: result.reason?.message || "Upload failed",
					};
				}
			});
		} catch (error) {
			console.error("Error in uploadFiles:", error);
			// Fallback to sequential upload if parallel fails
			const uploadResults = [];
			for (const file of files) {
				const result = await this.uploadFile(file, uploadConfig);
				uploadResults.push(result);
			}
			return uploadResults;
		}
	}

	/**
	 * Generate presigned URL for file access
	 * @param {string} s3Key - S3 key of the file
	 * @param {number} expiresIn - URL expiration time in seconds
	 * @returns {Promise<string>} - Presigned URL
	 */
	static async generatePresignedUrl(s3Key, expiresIn = 3600) {
		try {
			console.log("🔍 S3Service generating presigned URL:", {
				bucket: S3_CONFIG.bucket,
				key: s3Key,
				expires: expiresIn,
			});

			const params = {
				Bucket: S3_CONFIG.bucket,
				Key: s3Key,
				Expires: expiresIn,
				ResponseContentDisposition: "inline", // Force inline viewing instead of download
				ResponseContentType: "application/pdf", // Ensure proper MIME type for PDFs
			};

			const url = s3.getSignedUrl("getObject", params);
			console.log(
				"🔗 S3 presigned URL generated successfully with inline disposition"
			);
			return url;
		} catch (error) {
			console.error("❌ Error generating presigned URL:", error);
			throw new Error("Failed to generate presigned URL");
		}
	}

	/**
	 * Delete file from S3
	 * @param {string} s3Key - S3 key of the file to delete
	 * @returns {Promise<void>}
	 */
	static async deleteFile(s3Key) {
		try {
			const params = {
				Bucket: S3_CONFIG.bucket,
				Key: s3Key,
			};

			await s3.deleteObject(params).promise();
		} catch (error) {
			console.error("Error deleting file:", error);
			throw new Error("Failed to delete file");
		}
	}

	/**
	 * Get file metadata from S3
	 * @param {string} s3Key - S3 key of the file
	 * @returns {Promise<Object>} - File metadata
	 */
	static async getFileMetadata(s3Key) {
		try {
			const params = {
				Bucket: S3_CONFIG.bucket,
				Key: s3Key,
			};

			const result = await s3.headObject(params).promise();

			return {
				contentLength: result.ContentLength,
				contentType: result.ContentType,
				lastModified: result.LastModified,
				eTag: result.ETag,
				metadata: result.Metadata,
			};
		} catch (error) {
			console.error("Error getting file metadata:", error);
			throw new Error("Failed to get file metadata");
		}
	}

	/**
	 * List files from S3 based on path prefix
	 * @param {string} prefix - S3 path prefix to filter files
	 * @returns {Promise<Array>} - Array of file objects
	 */
	static async listFiles(prefix = "") {
		try {
			const params = {
				Bucket: S3_CONFIG.bucket,
				Prefix: prefix,
				MaxKeys: 1000, // Adjust as needed
			};

			const result = await s3.listObjectsV2(params).promise();

			if (!result.Contents) {
				return [];
			}

			// Process and format the file list
			const files = result.Contents.map((item) => {
				const pathParts = item.Key.split("/");
				const fileName = pathParts[pathParts.length - 1];

				// Extract timestamp and original name
				const fileNameParts = fileName.split("_");
				const timestamp = fileNameParts[0];
				const originalName = fileNameParts.slice(1).join("_");

				return {
					key: item.Key,
					fileName: originalName || fileName,
					displayName: originalName || fileName,
					size: item.Size,
					lastModified: item.LastModified,
					path: pathParts.slice(0, -1).join("/"),
					fullPath: item.Key,
				};
			});

			return files;
		} catch (error) {
			console.error("Error listing files:", error);
			throw new Error("Failed to list files from S3");
		}
	}

	/**
	 * List files by college, course, semester, and subject
	 * @param {Object} params - Filter parameters
	 * @returns {Promise<Object>} - Organized file list
	 */
	static async listFilesByCategory(params) {
		try {
			const { college, course, semester, subject } = params;

			// Build the base prefix for the subject
			let basePrefix = "college-notes";

			if (college) basePrefix += `/${college.toLowerCase()}`;
			if (course) basePrefix += `/${course.toLowerCase()}`;
			if (semester) basePrefix += `/sem${semester}`;
			if (subject) basePrefix += `/${subject.toLowerCase()}`;

			// Initialize organized files structure
			const organizedFiles = {
				notes: [],
				pyqs: [],
				assignments: [],
				others: [],
			};

			// Get files from each category folder
			const categories = ["notes", "pyqs", "assignments", "others"];

			for (const category of categories) {
				const categoryPrefix = `${basePrefix}/${category}`;
				const categoryFiles = await this.listFiles(categoryPrefix);
				organizedFiles[category] = categoryFiles;
			}

			// Also check for files directly in the subject folder (legacy files)
			const legacyFiles = await this.listFiles(basePrefix);

			// Filter out files that are already in category subfolders
			const directFiles = legacyFiles.filter((file) => {
				const pathParts = file.key.split("/");
				const lastFolderIndex = pathParts.length - 2; // Index of the folder containing the file
				const containingFolder = pathParts[lastFolderIndex];

				// If the containing folder is not a category, it's a direct file
				return !categories.includes(containingFolder);
			});

			// Categorize legacy files using filename analysis (for backward compatibility)
			directFiles.forEach((file) => {
				const fileName = file.fileName.toLowerCase();

				if (
					fileName.includes("pyq") ||
					fileName.includes("question") ||
					fileName.includes("exam") ||
					fileName.includes("test") ||
					fileName.includes("quiz") ||
					fileName.includes("paper") ||
					fileName.includes("previous") ||
					fileName.includes("sample")
				) {
					organizedFiles.pyqs.push(file);
				} else if (
					fileName.includes("assignment") ||
					fileName.includes("homework") ||
					fileName.includes("hw") ||
					fileName.includes("lab") ||
					fileName.includes("practical") ||
					fileName.includes("exercise") ||
					fileName.includes("project")
				) {
					organizedFiles.assignments.push(file);
				} else if (
					fileName.includes("note") ||
					fileName.includes("chapter") ||
					fileName.includes("lecture") ||
					fileName.includes("study") ||
					fileName.includes("material") ||
					fileName.includes("book") ||
					fileName.includes("tutorial") ||
					fileName.includes("guide") ||
					// Default: If it's a document file and not clearly something else, treat as notes
					fileName.endsWith(".pdf") ||
					fileName.endsWith(".doc") ||
					fileName.endsWith(".docx")
				) {
					organizedFiles.notes.push(file);
				} else {
					organizedFiles.others.push(file);
				}
			});

			return organizedFiles;
		} catch (error) {
			console.error("Error listing files by category:", error);
			throw new Error("Failed to list files by category");
		}
	}

	/**
	 * Copy a file from one location to another within the same bucket
	 * @param {string} bucketName - S3 bucket name
	 * @param {string} sourceKey - Source file key
	 * @param {string} destinationKey - Destination file key
	 * @returns {Promise<void>}
	 */
	static async copyFile(bucketName, sourceKey, destinationKey) {
		try {
			const params = {
				Bucket: bucketName,
				CopySource: `${bucketName}/${sourceKey}`,
				Key: destinationKey,
				ACL: "private",
			};

			await s3.copyObject(params).promise();
		} catch (error) {
			console.error(
				`Failed to copy file from ${sourceKey} to ${destinationKey}:`,
				error
			);
			throw new Error(`Failed to copy file: ${error.message}`);
		}
	}

	/**
	 * Upload file directly with bucket, key, and buffer (for admin approval system)
	 * @param {string} bucketName - S3 bucket name
	 * @param {string} key - S3 key
	 * @param {Buffer} buffer - File buffer
	 * @param {string} contentType - File content type
	 * @returns {Promise<Object>} - Upload result
	 */
	static async uploadFileBuffer(bucketName, key, buffer, contentType) {
		try {
			const params = {
				Bucket: bucketName,
				Key: key,
				Body: buffer,
				ContentType: contentType,
				ACL: "private",
			};

			const result = await s3.upload(params).promise();
			return {
				success: true,
				location: result.Location,
				eTag: result.ETag,
			};
		} catch (error) {
			console.error(`Failed to upload file buffer to ${key}:`, error);
			throw new Error(`Failed to upload file: ${error.message}`);
		}
	}
}

export default S3Service;
