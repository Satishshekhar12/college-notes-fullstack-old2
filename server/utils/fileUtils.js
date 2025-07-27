/**
 * Generate S3 key for file upload
 * @param {Object} file - File object from multer
 * @param {Object} uploadConfig - Upload configuration
 * @returns {string} - S3 key
 */
export const generateS3Key = (file, uploadConfig) => {
	const timestamp = Date.now();
	const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");

	// Create path based on upload config
	const { college, course, semester, subject, uploadType } = uploadConfig;

	let basePath = "college-notes";

	if (college) basePath += `/${college.toLowerCase().replace(/\s+/g, "-")}`;
	if (course) basePath += `/${course.toLowerCase().replace(/\s+/g, "-")}`;
	if (semester) basePath += `/sem${semester}`;
	if (subject) basePath += `/${subject.toLowerCase().replace(/\s+/g, "-")}`;
	if (uploadType) basePath += `/${uploadType}`;

	return `${basePath}/${timestamp}_${sanitizedFileName}`;
};

/**
 * Create file metadata for S3
 * @param {Object} file - File object from multer
 * @param {Object} uploadConfig - Upload configuration
 * @returns {Object} - Metadata object
 */
export const createFileMetadata = (file, uploadConfig) => {
	return {
		originalName: file.originalname,
		uploadedAt: new Date().toISOString(),
		college: uploadConfig.college || "",
		course: uploadConfig.course || "",
		semester: uploadConfig.semester || "",
		subject: uploadConfig.subject || "",
		uploadType: uploadConfig.uploadType || "others",
		fileSize: file.size.toString(),
	};
};

/**
 * Validate upload configuration
 * @param {Object} uploadConfig - Upload configuration
 * @returns {Object} - Validation result
 */
export const validateUploadConfig = (uploadConfig) => {
	const required = ["college", "course", "semester", "subject"];
	const missing = required.filter((field) => !uploadConfig[field]);

	if (missing.length > 0) {
		return {
			valid: false,
			error: `Missing required fields: ${missing.join(", ")}`,
		};
	}

	return { valid: true };
};
