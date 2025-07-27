import AWS from "aws-sdk";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

// Load environment variables
dotenv.config();

// Configure AWS SDK
AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION || "us-east-1",
});

// Create S3 instance
const s3 = new AWS.S3();

// S3 bucket configuration
const S3_CONFIG = {
	bucket: process.env.AWS_S3_BUCKET_NAME,
	bucketName: process.env.AWS_S3_BUCKET_NAME || "college-notes-bucket", // Added for consistency
	region: process.env.AWS_REGION || "us-east-1",
	maxFileSize: 50 * 1024 * 1024, // 50MB
	allowedFileTypes: [
		"application/pdf",
		"image/jpeg",
		"image/png",
		"text/plain",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.ms-powerpoint",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	],
};

// Helper function to extract original filename by removing timestamp
export const getOriginalFileName = (filename) => {
	if (!filename) return "unknown_file";

	// Check if filename has timestamp pattern: _[timestamp].[extension]
	const timestampPattern = /_\d{13}\./; // 13 digits for timestamp

	if (timestampPattern.test(filename)) {
		// Remove timestamp: "filename_1234567890123.pdf" -> "filename.pdf"
		return filename.replace(/_\d{13}\./, ".");
	}

	return filename; // Return as-is if no timestamp pattern found
};

// Generate organized S3 key based on note metadata
export const generateS3Key = (
	noteMetadata,
	originalFileName,
	isPending = true
) => {
	const { college, course, subcourse, semester, subject, uploadType } =
		noteMetadata;

	// Clean folder names (remove special characters)
	const cleanString = (str) => str.replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase();

	// Build folder path based on approval status
	let folderParts = [];

	if (isPending) {
		folderParts.push("pending"); // Temporary location for unapproved files
	} else {
		folderParts.push("college-notes"); // Approved files go in college-notes folder
	}

	folderParts.push(cleanString(college));

	if (course) folderParts.push(cleanString(course));
	if (subcourse && college === "bhu") folderParts.push(cleanString(subcourse));
	if (semester) folderParts.push(`sem${semester}`); // Remove dash for sem6 format
	if (subject) folderParts.push(cleanString(subject));
	if (uploadType) folderParts.push(cleanString(uploadType));

	const folderPath = folderParts.join("/");

	// Keep original filename with timestamp for uniqueness
	const fileExtension = originalFileName.split(".").pop().toLowerCase();
	const baseFileName = originalFileName.replace(/\.[^/.]+$/, ""); // Remove extension

	// Clean filename of problematic characters for S3 but preserve readability
	const cleanFileName = baseFileName.replace(/[<>:"/\\|?*]/g, "_"); // Replace only truly problematic chars

	// Only add timestamp if not already present (avoid double timestamps)
	const hasTimestamp = /_\d{13}$/.test(cleanFileName);
	let uniqueFileName;

	if (hasTimestamp) {
		// Already has timestamp, use as-is
		uniqueFileName = `${cleanFileName}.${fileExtension}`;
	} else {
		// Add timestamp for uniqueness
		const timestamp = Date.now();
		uniqueFileName = `${cleanFileName}_${timestamp}.${fileExtension}`;
	}

	console.log(
		`📝 Generated filename: ${originalFileName} -> ${uniqueFileName}`
	);
	return `${folderPath}/${uniqueFileName}`;
};

// Upload file to S3 with organized folder structure
export const uploadToS3 = async (file, noteMetadata) => {
	try {
		// Validate file type
		if (!S3_CONFIG.allowedFileTypes.includes(file.mimetype)) {
			throw new Error(`File type ${file.mimetype} is not allowed`);
		}

		// Validate file size
		if (file.size > S3_CONFIG.maxFileSize) {
			throw new Error(
				`File size exceeds ${S3_CONFIG.maxFileSize / (1024 * 1024)}MB limit`
			);
		}

		// Generate S3 key with pending location (isPending = true by default for new uploads)
		const s3Key = generateS3Key(noteMetadata, file.originalname, true);

		const uploadParams = {
			Bucket: S3_CONFIG.bucketName,
			Key: s3Key,
			Body: file.buffer,
			ContentType: file.mimetype,
			ContentDisposition: `attachment; filename="${file.originalname}"`,
			// Add comprehensive metadata for better organization
			// AWS S3 requires all metadata values to be strings
			Metadata: {
				"original-name": String(file.originalname),
				"uploaded-at": String(new Date().toISOString()),
				college: String(noteMetadata.college || "unknown"),
				course: String(noteMetadata.course || "unknown"),
				subcourse: String(noteMetadata.subcourse || ""),
				semester: String(noteMetadata.semester || "unknown"),
				subject: String(noteMetadata.subject || "unknown"),
				"upload-type": String(noteMetadata.uploadType || "notes"),
				"file-size": String(file.size),
			},
			// Set appropriate storage class for cost optimization
			StorageClass: "STANDARD",
		};

		console.log(`📤 Uploading file to S3: ${s3Key}`);
		const result = await s3.upload(uploadParams).promise();
		console.log(`✅ File uploaded successfully: ${result.Location}`);

		return {
			s3Key: result.Key,
			bucket: result.Bucket,
			location: result.Location,
			etag: result.ETag,
		};
	} catch (error) {
		console.error("❌ S3 Upload Error:", error);
		throw new Error("Failed to upload file to S3: " + error.message);
	}
};

// Generate signed URL for secure file download
export const generateSignedUrl = async (s3Key, expiresInSeconds = 3600) => {
	try {
		if (!s3Key) {
			throw new Error("S3 key is required");
		}

		const params = {
			Bucket: S3_CONFIG.bucketName,
			Key: s3Key,
			Expires: expiresInSeconds, // URL expires in 1 hour by default
			ResponseContentDisposition: "attachment", // Force download
		};

		const signedUrl = await s3.getSignedUrlPromise("getObject", params);
		console.log(`🔗 Generated signed URL for: ${s3Key}`);
		return signedUrl;
	} catch (error) {
		console.error("❌ S3 Signed URL Error:", error);
		throw new Error("Failed to generate download URL: " + error.message);
	}
};

// Delete file from S3 (for rejected notes or cleanup)
export const deleteFromS3 = async (s3Key) => {
	try {
		if (!s3Key) {
			throw new Error("S3 key is required for deletion");
		}

		const deleteParams = {
			Bucket: S3_CONFIG.bucketName,
			Key: s3Key,
		};

		await s3.deleteObject(deleteParams).promise();
		console.log(`🗑️ File deleted from S3: ${s3Key}`);
		return { success: true };
	} catch (error) {
		console.error("❌ S3 Delete Error:", error);
		throw new Error("Failed to delete file from S3: " + error.message);
	}
};

// Move file from pending to approved location in S3
export const moveToApprovedLocation = async (currentS3Key, noteMetadata) => {
	try {
		console.log(`🔄 Moving file from ${currentS3Key} to approved location...`);

		// Extract original filename from current key
		const currentFilename = currentS3Key.split("/").pop();
		console.log(`📄 Current filename: ${currentFilename}`);

		// Generate new S3 key for approved location (isPending = false)
		const newS3Key = generateS3Key(
			noteMetadata,
			currentFilename, // Use the current filename as-is
			false // Not pending anymore
		);

		console.log(`📍 New S3 key: ${newS3Key}`);

		// Copy object to new location with proper encoding
		const copyParams = {
			Bucket: S3_CONFIG.bucketName,
			CopySource: encodeURIComponent(`${S3_CONFIG.bucketName}/${currentS3Key}`),
			Key: newS3Key,
			MetadataDirective: "COPY", // Copy existing metadata
		};

		console.log(`📋 Copying file with params:`, {
			bucket: copyParams.Bucket,
			copySource: copyParams.CopySource,
			key: copyParams.Key,
		});

		const copyResult = await s3.copyObject(copyParams).promise();
		console.log(`✅ File copied successfully:`, copyResult);

		// Delete from old location
		console.log(`🗑️ Deleting from old location: ${currentS3Key}`);
		await deleteFromS3(currentS3Key);
		console.log(`✅ File removed from pending location: ${currentS3Key}`);

		return { success: true, newS3Key };
	} catch (error) {
		console.error("❌ S3 Move Error:", error);
		console.error("❌ Error details:", {
			message: error.message,
			code: error.code,
			statusCode: error.statusCode,
			currentS3Key,
			noteMetadata,
		});
		return { success: false, error: error.message };
	}
};

// Legacy exports to maintain existing functionality
export { s3, S3_CONFIG };
