#!/usr/bin/env node

/**
 * Test script to verify enhanced user statistics implementation
 */

import { promises as fs } from "fs";
import path from "path";

const checkFile = async (filePath, description) => {
	try {
		const content = await fs.readFile(filePath, "utf8");
		console.log(`✅ ${description} - File exists and readable`);
		return content;
	} catch (error) {
		console.log(`❌ ${description} - Error: ${error.message}`);
		return null;
	}
};

const checkImplementation = async () => {
	console.log("🔍 Checking Enhanced User Statistics Implementation...\n");

	// Check backend implementation
	const backendFile =
		"d:/codings/reactjs/College-Notes/server/controllers/noteController.js";
	const backendContent = await checkFile(backendFile, "Backend Controller");

	if (backendContent) {
		const hasStatsEnhancement = backendContent.includes(
			"uploadedBy.stats = statsMap[userId]"
		);
		const hasRoleCheck = backendContent.includes(
			"['admin', 'moderator', 'senior moderator']"
		);
		const hasUserStatsQuery = backendContent.includes("Note.countDocuments");

		console.log(
			`   📊 Stats Enhancement: ${hasStatsEnhancement ? "✅" : "❌"}`
		);
		console.log(`   🔐 Role Check: ${hasRoleCheck ? "✅" : "❌"}`);
		console.log(`   📈 User Stats Query: ${hasUserStatsQuery ? "✅" : "❌"}`);
	}

	// Check frontend implementation
	const frontendFile =
		"d:/codings/reactjs/College-Notes/client/src/components/admin/ApproveUploads.jsx";
	const frontendContent = await checkFile(frontendFile, "Frontend Component");

	if (frontendContent) {
		const hasApprovalRate = frontendContent.includes("getApprovalRate");
		const hasStatsDisplay = frontendContent.includes("userGroup.user?.stats");
		const hasColorCoding = frontendContent.includes("getApprovalRateColor");
		const hasMemberSince = frontendContent.includes("Member Since");

		console.log(`   📊 Approval Rate Calc: ${hasApprovalRate ? "✅" : "❌"}`);
		console.log(`   📈 Stats Display: ${hasStatsDisplay ? "✅" : "❌"}`);
		console.log(`   🎨 Color Coding: ${hasColorCoding ? "✅" : "❌"}`);
		console.log(`   📅 Member Since: ${hasMemberSince ? "✅" : "❌"}`);
	}

	// Check user model
	const userModelFile =
		"d:/codings/reactjs/College-Notes/server/models/userModel.js";
	const userModelContent = await checkFile(userModelFile, "User Model");

	if (userModelContent) {
		const hasTimestamps = userModelContent.includes("timestamps: true");
		console.log(`   ⏰ Timestamps Enabled: ${hasTimestamps ? "✅" : "❌"}`);
	}

	console.log("\n🏁 Implementation Check Complete!");
	console.log("\n💡 Next Steps:");
	console.log(
		"   1. Start the server: node d:/codings/reactjs/College-Notes/server/server.js"
	);
	console.log(
		"   2. Start the client: cd d:/codings/reactjs/College-Notes/client && npm run dev"
	);
	console.log("   3. Login as admin and check the pending uploads section");
	console.log("   4. Look for enhanced user cards with statistics");
};

checkImplementation().catch(console.error);
