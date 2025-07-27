import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
	{
		// Basic note information
		title: {
			type: String,
			required: [true, "Note title is required"],
			trim: true,
			maxlength: [200, "Title cannot exceed 200 characters"],
		},
		description: {
			type: String,
			trim: true,
			maxlength: [1000, "Description cannot exceed 1000 characters"],
		},

		// Course structure (optimized for existing JSON structure)
		college: {
			type: String,
			required: [true, "College is required"],
			enum: ["bhu", "nitk"],
		},
		course: {
			type: String,
			required: [true, "Course is required"],
			trim: true,
		},
		subcourse: {
			type: String,
			trim: true,
			// Only required for BHU courses with specializations
		},
		semester: {
			type: String, // Changed from Number to String to match S3 metadata requirements
			required: [true, "Semester is required"],
			validate: {
				validator: function (v) {
					const num = parseInt(v, 10);
					return !isNaN(num) && num >= 1 && num <= 8;
				},
				message: "Semester must be a number between 1 and 8",
			},
		},
		subject: {
			type: String,
			required: [true, "Subject is required"],
			trim: true,
		},

		// Upload classification
		uploadType: {
			type: String,
			required: [true, "Upload type is required"],
			enum: ["notes", "pyqs", "books", "assignments", "lab-manuals", "others"],
		},

		// File information (S3 references only - no file storage in MongoDB)
		file: {
			originalName: {
				type: String,
				required: true,
			},
			s3Key: {
				type: String,
				required: true,
				unique: true,
			},
			s3Bucket: {
				type: String,
				required: true,
			},
			mimeType: {
				type: String,
				required: true,
			},
			size: {
				type: Number,
				required: true,
			},
			uploadDate: {
				type: Date,
				default: Date.now,
			},
		},

		// User and approval tracking
		uploadedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		status: {
			type: String,
			enum: ["pending", "approved", "rejected"],
			default: "pending",
		},
		approvedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		approvedAt: {
			type: Date,
		},
		rejectedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		rejectedAt: {
			type: Date,
		},
		rejectionReason: {
			type: String,
			trim: true,
		},

		// Moderation history for transparency
		moderationHistory: [
			{
				action: {
					type: String,
					enum: ["uploaded", "approved", "rejected"],
					required: true,
				},
				timestamp: {
					type: Date,
					default: Date.now,
				},
				moderatorId: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "User",
				},
				reason: {
					type: String,
					trim: true,
				},
			},
		],

		// Additional metadata
		tags: [
			{
				type: String,
				trim: true,
				lowercase: true,
			},
		],
		downloadCount: {
			type: Number,
			default: 0,
		},

		// Search optimization
		searchKeywords: {
			type: String,
			// This will be auto-generated from title, subject, tags for better search
		},
	},
	{
		timestamps: true,
		// Add indexes for better query performance
		index: {
			college: 1,
			course: 1,
			semester: 1,
			subject: 1,
			status: 1,
			uploadedBy: 1,
		},
	}
);

// Pre-save middleware to generate search keywords
noteSchema.pre("save", function (next) {
	const keywords = [
		this.title,
		this.subject,
		this.course,
		this.subcourse,
		...this.tags,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	this.searchKeywords = keywords;
	next();
});

// Instance method to check if user can access this note
noteSchema.methods.canAccess = function (user) {
	// Public access for approved notes
	if (this.status === "approved") return true;

	// Owner can always access their own notes
	if (user && this.uploadedBy.toString() === user._id.toString()) return true;

	// Moderators and above can access all notes
	if (user && ["moderator", "senior moderator", "admin"].includes(user.role)) {
		return true;
	}

	return false;
};

// Static method to get notes with filtering
noteSchema.statics.getFilteredNotes = function (filters = {}, user = null) {
	console.log("🔍 getFilteredNotes called with:", {
		filters,
		userRole: user?.role,
	});
	const query = {};

	// Status filter - non-moderators only see approved
	if (user && ["moderator", "senior moderator", "admin"].includes(user.role)) {
		if (filters.status && filters.status !== "all") {
			query.status = filters.status;
		}
		console.log("✅ Admin/Moderator access - status filter:", filters.status);
	} else {
		query.status = "approved";
		console.log("👤 Regular user access - only approved notes");
	}

	// Course structure filters
	if (filters.college) query.college = filters.college;
	if (filters.course) query.course = new RegExp(filters.course, "i");
	if (filters.subcourse) query.subcourse = new RegExp(filters.subcourse, "i");
	if (filters.semester) query.semester = String(filters.semester); // Keep as string to match model
	if (filters.subject) query.subject = new RegExp(filters.subject, "i");
	if (filters.uploadType) query.uploadType = filters.uploadType;

	// Search query
	if (filters.search) {
		query.searchKeywords = new RegExp(filters.search, "i");
	}

	console.log("📋 Final MongoDB query:", JSON.stringify(query, null, 2));
	return this.find(query);
};

const Note = mongoose.model("Note", noteSchema);

export default Note;
