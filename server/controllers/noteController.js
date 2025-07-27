import Note from "../models/noteModel.js";
import User from "../models/userModel.js";
import {
	uploadToS3,
	generateSignedUrl,
	deleteFromS3,
	moveToApprovedLocation,
} from "../config/aws.js";
import multer from "multer";

// Helper function to update user upload statistics
const updateUserUploadStats = async (userId) => {
	try {
		// Count user's notes by status
		const totalUploads = await Note.countDocuments({ uploadedBy: userId });
		const approvedUploads = await Note.countDocuments({
			uploadedBy: userId,
			status: "approved",
		});
		const rejectedUploads = await Note.countDocuments({
			uploadedBy: userId,
			status: "rejected",
		});

		// Update user document
		await User.findByIdAndUpdate(userId, {
			totalUploads,
			approvedUploads,
			rejectedUploads,
		});

		console.log(
			`✅ Updated stats for user ${userId}: Total: ${totalUploads}, Approved: ${approvedUploads}, Rejected: ${rejectedUploads}`
		);
	} catch (error) {
		console.error("❌ Error updating user upload stats:", error);
	}
};

// Configure multer for file upload (memory storage for S3 upload)
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 50 * 1024 * 1024, // 50MB limit
	},
	fileFilter: (req, file, cb) => {
		const allowedTypes = [
			"application/pdf",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.ms-powerpoint",
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
			"text/plain",
			"image/jpeg",
			"image/png",
		];

		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(
				new Error(
					"Invalid file type. Please upload PDF, DOC, DOCX, PPT, PPTX, TXT, JPG, or PNG files."
				),
				false
			);
		}
	},
});

// Upload middleware
export const uploadMiddleware = upload.single("file");

// Helper function to validate required fields
const validateNoteFields = (noteData) => {
	const requiredFields = [
		"title",
		"college",
		"course",
		"semester",
		"subject",
		"uploadType",
	];
	const missingFields = requiredFields.filter((field) => !noteData[field]);

	if (missingFields.length > 0) {
		throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
	}

	// Convert semester to a number for validation, but keep original for S3
	const semesterNum = parseInt(noteData.semester, 10);
	if (isNaN(semesterNum) || semesterNum < 1 || semesterNum > 8) {
		throw new Error("Semester must be a number between 1 and 8");
	}

	// Ensure semester is stored as a string for S3 metadata compatibility
	noteData.semester = String(noteData.semester);
};

// Upload a new note
export const uploadNote = async (req, res) => {
	try {
		console.log("📝 Processing note upload request...");

		// Check if file was uploaded
		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: "No file uploaded. Please select a file to upload.",
			});
		}

		// Validate note data
		const noteData = {
			title: req.body.title?.trim(),
			description: req.body.description?.trim() || "",
			college: req.body.college?.trim(),
			course: req.body.course?.trim(),
			subcourse: req.body.subcourse?.trim() || "", // Optional for BHU
			semester: req.body.semester?.trim(), // Keep as string initially
			subject: req.body.subject?.trim(),
			uploadType: req.body.uploadType?.trim(),
			tags: req.body.tags
				? req.body.tags
						.split(",")
						.map((tag) => tag.trim())
						.filter((tag) => tag)
				: [],
		};

		// Validate required fields
		console.log("📋 Validating note data:", JSON.stringify(noteData, null, 2));
		validateNoteFields(noteData);

		// Upload file to S3 with organized folder structure
		console.log("📤 Uploading file to S3...");
		const s3Result = await uploadToS3(req.file, noteData);

		// Create note document in MongoDB (metadata only)
		const newNote = new Note({
			...noteData,
			uploadedBy: req.user.id,
			file: {
				originalName: req.file.originalname, // Store clean original filename in DB
				s3Key: s3Result.s3Key,
				s3Bucket: s3Result.bucket,
				mimeType: req.file.mimetype,
				size: req.file.size,
				uploadDate: new Date(),
			},
			status: "pending", // All uploads start as pending
			moderationHistory: [
				{
					action: "uploaded",
					timestamp: new Date(),
					moderatorId: req.user.id,
					reason: "Initial upload",
				},
			],
		});

		const savedNote = await newNote.save();
		console.log(`✅ Note uploaded successfully with ID: ${savedNote._id}`);
		console.log(`📁 Note details:`, {
			id: savedNote._id,
			title: savedNote.title,
			status: savedNote.status,
			college: savedNote.college,
			course: savedNote.course,
			semester: savedNote.semester,
			subject: savedNote.subject,
			s3Key: savedNote.file.s3Key,
		});

		// Update user upload statistics
		await updateUserUploadStats(req.user.id);

		// Populate user details for response
		await savedNote.populate("uploadedBy", "name email");

		res.status(201).json({
			success: true,
			message:
				"Note uploaded successfully! It will be reviewed by moderators before being published.",
			data: {
				noteId: savedNote._id,
				title: savedNote.title,
				status: savedNote.status,
				uploadDate: savedNote.file.uploadDate,
				fileName: savedNote.title, // Use title as display name
			},
		});
	} catch (error) {
		console.error("❌ Upload Note Error:", error);

		// If S3 upload succeeded but database save failed, clean up S3
		if (req.s3Key) {
			try {
				await deleteFromS3(req.s3Key);
				console.log("🧹 Cleaned up S3 file after database error");
			} catch (cleanupError) {
				console.error("❌ S3 cleanup failed:", cleanupError);
			}
		}

		res.status(500).json({
			success: false,
			message: error.message || "Failed to upload note. Please try again.",
		});
	}
};

// Get all notes (with filtering and pagination)
export const getAllNotes = async (req, res) => {
	try {
		console.log("📋 getAllNotes called with query:", req.query);
		console.log(
			"📋 User:",
			req.user ? `${req.user.name} (${req.user.role})` : "Not authenticated"
		);

		const {
			status = "approved", // Default to approved notes for public
			college,
			course,
			subcourse,
			semester,
			subject,
			uploadType,
			page = 1,
			limit = 20,
			sortBy = "createdAt",
			sortOrder = "desc",
			search,
		} = req.query;

		// Build filter object
		const filters = {
			status,
			college,
			course,
			subcourse,
			semester,
			subject,
			uploadType,
			search,
		};

		// Calculate pagination
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Build sort object
		const sort = {};
		sort[sortBy] = sortOrder === "asc" ? 1 : -1;

		// Get notes with filtering
		console.log("🔍 Calling getFilteredNotes with filters:", filters);
		console.log("👤 User role:", req.user?.role);
		const notesQuery = Note.getFilteredNotes(filters, req.user);
		const notes = await notesQuery
			.populate("uploadedBy", "name email createdAt")
			.populate("approvedBy", "name email")
			.populate("rejectedBy", "name email")
			.sort(sort)
			.skip(skip)
			.limit(parseInt(limit))
			.lean();

		// For admin/moderator requests, enhance user data with upload statistics
		if (
			req.user &&
			["admin", "moderator", "senior moderator"].includes(req.user.role)
		) {
			console.log(
				`🔍 User ${req.user.name} (${req.user.role}) is authorized for enhanced statistics`
			);
			const userIds = [
				...new Set(notes.map((note) => note.uploadedBy?._id).filter(Boolean)),
			];
			console.log(`👥 Found ${userIds.length} unique users in notes`);

			if (userIds.length > 0) {
				// Get user statistics in parallel
				const userStats = await Promise.all(
					userIds.map(async (userId) => {
						const [totalUploads, approvedCount, rejectedCount] =
							await Promise.all([
								Note.countDocuments({ uploadedBy: userId }),
								Note.countDocuments({ uploadedBy: userId, status: "approved" }),
								Note.countDocuments({ uploadedBy: userId, status: "rejected" }),
							]);

						console.log(
							`📊 User ${userId} stats: ${totalUploads} total, ${approvedCount} approved, ${rejectedCount} rejected`
						);

						return {
							userId: userId.toString(),
							totalUploads,
							approvedCount,
							rejectedCount,
							pendingCount: totalUploads - approvedCount - rejectedCount,
						};
					})
				);

				// Create a map for quick lookup
				const statsMap = {};
				userStats.forEach((stat) => {
					statsMap[stat.userId] = stat;
				});

				// Enhance notes with user statistics
				notes.forEach((note) => {
					if (note.uploadedBy && note.uploadedBy._id) {
						const userId = note.uploadedBy._id.toString();
						if (statsMap[userId]) {
							note.uploadedBy.stats = statsMap[userId];
							console.log(
								`✅ Enhanced user ${note.uploadedBy.name} with stats:`,
								statsMap[userId]
							);
						}
					}
				});
			}
		} else {
			console.log(
				`❌ User ${req.user?.name} (${req.user?.role}) not authorized for enhanced statistics`
			);
		}

		console.log(`📊 Found ${notes.length} notes for filter:`, filters);

		// Get total count for pagination
		const totalNotes = await Note.getFilteredNotes(
			filters,
			req.user
		).countDocuments();

		res.json({
			success: true,
			data: {
				notes,
				pagination: {
					currentPage: parseInt(page),
					totalPages: Math.ceil(totalNotes / parseInt(limit)),
					totalNotes,
					hasNext: skip + notes.length < totalNotes,
					hasPrevious: parseInt(page) > 1,
				},
			},
		});
	} catch (error) {
		console.error("❌ Get All Notes Error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch notes",
		});
	}
};

// Get single note by ID
export const getNoteById = async (req, res) => {
	try {
		const { id } = req.params;

		const note = await Note.findById(id)
			.populate("uploadedBy", "name email")
			.populate("approvedBy", "name email");

		if (!note) {
			return res.status(404).json({
				success: false,
				message: "Note not found",
			});
		}

		// Check if user can access this note
		if (!note.canAccess(req.user)) {
			return res.status(403).json({
				success: false,
				message: "Access denied. This note is not yet approved.",
			});
		}

		res.json({
			success: true,
			data: { note },
		});
	} catch (error) {
		console.error("❌ Get Note By ID Error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch note",
		});
	}
};

// Download note file
export const downloadNote = async (req, res) => {
	try {
		const { id } = req.params;

		const note = await Note.findById(id);

		if (!note) {
			return res.status(404).json({
				success: false,
				message: "Note not found",
			});
		}

		// Check access permissions
		if (!note.canAccess(req.user)) {
			return res.status(403).json({
				success: false,
				message: "Access denied. This note is not available for download.",
			});
		}

		// Generate signed URL for secure download
		const downloadUrl = await generateSignedUrl(note.file.s3Key, 3600); // 1 hour expiry

		// Update download count
		note.downloadCount += 1;
		await note.save();

		res.json({
			success: true,
			data: {
				downloadUrl,
				fileName: note.title || note.file.originalName, // Use title as filename, fallback to originalName
				expiresIn: "1 hour",
			},
		});
	} catch (error) {
		console.error("❌ Download Note Error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to generate download link",
		});
	}
};

// Approve note (Moderator+ only)
export const approveNote = async (req, res) => {
	try {
		const { id } = req.params;
		const { reason } = req.body;

		const note = await Note.findById(id);

		if (!note) {
			return res.status(404).json({
				success: false,
				message: "Note not found",
			});
		}

		if (note.status === "approved") {
			return res.status(400).json({
				success: false,
				message: "Note is already approved",
			});
		}

		// Move file from pending to approved location in S3
		let fileMoveSuccess = false;
		try {
			const noteMetadata = {
				college: note.college,
				course: note.course,
				subcourse: note.subcourse,
				semester: note.semester,
				subject: note.subject,
				uploadType: note.uploadType,
			};

			console.log(`🔄 Moving file for note ${id}:`, {
				currentS3Key: note.file.s3Key,
				noteMetadata,
			});

			const moveResult = await moveToApprovedLocation(
				note.file.s3Key,
				noteMetadata
			);

			if (moveResult.success) {
				// Update the s3Key in the note document
				note.file.s3Key = moveResult.newS3Key;
				fileMoveSuccess = true;
				console.log(
					`✅ File moved to approved location: ${moveResult.newS3Key}`
				);
			} else {
				console.error(
					"❌ Failed to move file to approved location:",
					moveResult.error
				);
				// Continue with approval even if file move fails - the file is still accessible from pending location
			}
		} catch (moveError) {
			console.error("❌ Exception during file move:", moveError);
			// Continue with approval even if file move fails - the file is still accessible
		}

		// Update note status
		note.status = "approved";
		note.approvedBy = req.user.id;
		note.approvedAt = new Date();

		// Add to moderation history
		note.moderationHistory.push({
			action: "approved",
			timestamp: new Date(),
			moderatorId: req.user.id,
			reason: reason || "Note approved by moderator",
		});

		await note.save();

		// Update user upload statistics
		await updateUserUploadStats(note.uploadedBy);

		// Populate for response
		await note.populate(["uploadedBy", "approvedBy"], "name email");

		console.log(`✅ Note ${id} approved by ${req.user.name}`);

		res.json({
			success: true,
			message: "Note approved successfully",
			data: { note },
		});
	} catch (error) {
		console.error("❌ Approve Note Error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to approve note",
		});
	}
};

// Reject note (Moderator+ only)
export const rejectNote = async (req, res) => {
	try {
		const { id } = req.params;
		const { reason } = req.body;

		if (!reason || reason.trim().length === 0) {
			return res.status(400).json({
				success: false,
				message: "Rejection reason is required",
			});
		}

		const note = await Note.findById(id);

		if (!note) {
			return res.status(404).json({
				success: false,
				message: "Note not found",
			});
		}

		if (note.status === "rejected") {
			return res.status(400).json({
				success: false,
				message: "Note is already rejected",
			});
		}

		// Update note status
		note.status = "rejected";
		note.rejectedBy = req.user.id;
		note.rejectedAt = new Date();
		note.rejectionReason = reason.trim();

		// Add to moderation history
		note.moderationHistory.push({
			action: "rejected",
			timestamp: new Date(),
			moderatorId: req.user.id,
			reason: reason.trim(),
		});

		await note.save();

		// Update user upload statistics
		await updateUserUploadStats(note.uploadedBy);

		// Optional: Delete file from S3 to save storage costs
		try {
			await deleteFromS3(note.file.s3Key);
			console.log(`🗑️ Deleted rejected note file from S3: ${note.file.s3Key}`);
		} catch (s3Error) {
			console.error("❌ Failed to delete S3 file:", s3Error);
			// Don't fail the rejection if S3 deletion fails
		}

		console.log(`❌ Note ${id} rejected by ${req.user.name}: ${reason}`);

		res.json({
			success: true,
			message: "Note rejected successfully",
			data: { noteId: id, reason: reason.trim() },
		});
	} catch (error) {
		console.error("❌ Reject Note Error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to reject note",
		});
	}
};

// Get user's uploaded notes
export const getUserNotes = async (req, res) => {
	try {
		const userId = req.user.id;
		const { page = 1, limit = 10, status } = req.query;

		const filter = { uploadedBy: userId };
		if (status) filter.status = status;

		const skip = (parseInt(page) - 1) * parseInt(limit);

		const notes = await Note.find(filter)
			.populate("approvedBy", "name email")
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(parseInt(limit))
			.lean();

		const totalNotes = await Note.countDocuments(filter);

		res.json({
			success: true,
			data: {
				notes,
				pagination: {
					currentPage: parseInt(page),
					totalPages: Math.ceil(totalNotes / parseInt(limit)),
					totalNotes,
				},
			},
		});
	} catch (error) {
		console.error("❌ Get User Notes Error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch your notes",
		});
	}
};

// Delete note (User can delete own notes, Moderator+ can delete any)
export const deleteNote = async (req, res) => {
	try {
		const { id } = req.params;

		const note = await Note.findById(id);

		if (!note) {
			return res.status(404).json({
				success: false,
				message: "Note not found",
			});
		}

		// Check permissions
		const canDelete =
			note.uploadedBy.toString() === req.user.id ||
			["moderator", "senior moderator", "admin"].includes(req.user.role);

		if (!canDelete) {
			return res.status(403).json({
				success: false,
				message: "Access denied. You can only delete your own notes.",
			});
		}

		// Delete file from S3
		try {
			await deleteFromS3(note.file.s3Key);
			console.log(`🗑️ Deleted note file from S3: ${note.file.s3Key}`);
		} catch (s3Error) {
			console.error("❌ Failed to delete S3 file:", s3Error);
			// Continue with database deletion even if S3 deletion fails
		}

		// Delete note from database
		await Note.findByIdAndDelete(id);

		console.log(`🗑️ Note ${id} deleted by ${req.user.name}`);

		res.json({
			success: true,
			message: "Note deleted successfully",
		});
	} catch (error) {
		console.error("❌ Delete Note Error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to delete note",
		});
	}
};

// Get moderation statistics (Moderator+ only)
export const getModerationStats = async (req, res) => {
	try {
		console.log(
			"📊 getModerationStats called by user:",
			req.user ? `${req.user.name} (${req.user.role})` : "Not authenticated"
		);

		const stats = await Note.aggregate([
			{
				$group: {
					_id: "$status",
					count: { $sum: 1 },
				},
			},
		]);

		// Get recent activity
		const recentActivity = await Note.find({})
			.populate("uploadedBy", "name email")
			.populate("approvedBy", "name email")
			.sort({ updatedAt: -1 })
			.limit(10)
			.lean();

		// Format stats
		const formattedStats = {
			pending: 0,
			approved: 0,
			rejected: 0,
			total: 0,
		};

		stats.forEach((stat) => {
			formattedStats[stat._id] = stat.count;
			formattedStats.total += stat.count;
		});

		res.json({
			success: true,
			data: {
				stats: formattedStats,
				recentActivity,
			},
		});
	} catch (error) {
		console.error("❌ Get Moderation Stats Error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch moderation statistics",
		});
	}
};
