import mongoose from "mongoose";
import dotenv from "dotenv";
import app from "./app.js";

// Load environment variables
dotenv.config();

// const DB = process.env.MONGODB_URI?.replace(
// 	'<PASSWORD>',
// 	process.env.DATABASE_PASSWORD || ''
// ) || process.env.MONGODB_URI;

// Database configuration
const DB = process.env.MONGODB_URI;

// Connect to MongoDB
if (DB) {
	mongoose
		.connect(DB)
		.then(() => console.log("✅ DB connection successful!"))
		.catch((err) => console.error("❌ DB connection error:", err));
} else {
	console.log("⚠️  No MongoDB URI found in environment variables");
}

// Server configuration
const PORT = process.env.PORT || 5000;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

// Start server
const server = app.listen(PORT, HOST, () => {
	console.log(`🚀 College Notes Server is running on http://${HOST}:${PORT}`);
	console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
	console.log("\n📋 Available endpoints:");
	console.log("  GET  / - Server status");
	console.log("  POST /api/upload - Upload files to S3");
	console.log("  GET  /api/files - List all files from S3");
	console.log("  GET  /api/files/category - List files by category");
	console.log("  POST /api/presigned-url - Generate presigned URL");
	console.log("  DELETE /api/files/:key - Delete file from S3");
	console.log("  GET  /api/files/:key/metadata - Get file metadata");
	console.log("\n✨ Clean setup - AWS S3 functionality restored");
	console.log(
		"📁 S3 Bucket:",
		process.env.AWS_S3_BUCKET_NAME || "Not configured"
	);
	console.log("🌍 AWS Region:", process.env.AWS_REGION || "us-east-1");
});

// Graceful shutdown
process.on("SIGTERM", () => {
	console.log("👋 SIGTERM received. Shutting down gracefully...");
	server.close(() => {
		console.log("💤 Process terminated");
		process.exit(0);
	});
});

process.on("SIGINT", () => {
	console.log("👋 SIGINT received. Shutting down gracefully...");
	server.close(() => {
		console.log("💤 Process terminated");
		process.exit(0);
	});
});
