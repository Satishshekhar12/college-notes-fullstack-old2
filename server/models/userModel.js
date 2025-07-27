import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "please tell us your name !,"],
		},
		email: {
			type: String,
			required: [true, "Please Provide your email"],
			unique: true,
			lowercase: true,
			validate: [validator.isEmail, "Please Provide a valid email"],
		},
		role: {
			type: String,
			enum: ["user", "admin", "moderator", "senior moderator"],
			default: "user", // Default role is user
		},
		password: {
			type: String,
			required: [true, "Please provide a password"],
			minlength: [8, "Password must be at least 8 characters long"],
			select: false, // Ensures password is not returned in queries
		},
		passwordConfirm: {
			type: String,
			required: [true, "Please confirm your password"],
			validate: {
				// This only works on CREATE and SAVE!!! not in update
				validator: function (el) {
					return el === this.password;
				},
				message: "Passwords are not the same!",
			},
		},
		// New academic profile fields
		collegeName: {
			type: String,
			required: [true, "Please provide your college name"],
		},
		course: {
			type: String,
			required: [true, "Please provide your course"],
		},
		semester: {
			type: Number,
			required: [true, "Please provide your current semester"],
			min: [1, "Semester must be at least 1"],
			max: [12, "Semester cannot exceed 12"],
		},
		studentType: {
			type: String,
			enum: ["UG", "PG", "PhD"],
			required: [true, "Please specify if you are UG/PG/PhD student"],
		},
		// Upload statistics
		totalUploads: {
			type: Number,
			default: 0,
		},
		approvedUploads: {
			type: Number,
			default: 0,
		},
		rejectedUploads: {
			type: Number,
			default: 0,
		},
		passwordChangedAt: Date,
		passwordResetToken: String,
		passwordResetExpires: Date,
	},
	{
		timestamps: true, // This will add createdAt and updatedAt fields
	}
);

userSchema.pre("save", async function (next) {
	//only run this function when password is actually modified
	if (!this.isModified("password")) return next();

	//hash the password with cost 12
	this.password = await bcrypt.hash(this.password, 12);

	//delete passwordConfirm field
	this.passwordConfirm = undefined;

	// Update passwordChangedAt field only if this is not a new document
	if (!this.isNew) {
		this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to account for token issuance delay
	}
	next();
});

userSchema.pre("save", function (next) {
	if (!this.isModified("password") || this.isNew) return next();
	// If password is modified, set passwordChangedAt to current time
	this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to account for token issuance delay
	next();
});

userSchema.methods.correctPassword = async function (
	candidatePassword,
	userPassword
) {
	//compare the password with the hashed password
	return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
	if (this.passwordChangedAt) {
		console.log(this.passwordChangedAt, JWTTimestamp);
		const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000);
		return JWTTimestamp < changedTimestamp;
		//logic for time comparison is if < JWTTimestamp is less than changedTimestamp
		//if true then password is changed after token issued
	}
	return false; // Password not changed after token issued
};

userSchema.methods.createPasswordResetToken = function () {
	const resetToken = crypto.randomBytes(32).toString("hex");
	this.passwordResetToken = crypto
		.createHash("sha256")
		.update(resetToken)
		.digest("hex");

	console.log({ resetToken }, this.passwordResetToken);

	this.passwordResetExpires = Date.now() + 30 * 60 * 1000; // Token valid for 30 minutes
	return resetToken; // Return the plain text token for sending via email
};

const User = mongoose.model("User", userSchema);

export default User;
