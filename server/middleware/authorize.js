import User from "../models/userModel.js";

// Role hierarchy for permission checking
const ROLE_HIERARCHY = {
	user: 0,
	moderator: 1,
	"senior moderator": 2,
	admin: 3,
};

// Check if user has required permission level
const checkPermission = (userRole, requiredRole) => {
	const userLevel = ROLE_HIERARCHY[userRole] || 0;
	const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
	return userLevel >= requiredLevel;
};

// Middleware: Require moderator or above
export const requireModeratorOrAbove = async (req, res, next) => {
	try {
		console.log(
			"🔐 Authorization check - User:",
			req.user?.name,
			"Role:",
			req.user?.role
		);

		if (!req.user) {
			console.log("❌ No user found in request");
			return res.status(401).json({
				success: false,
				message: "Authentication required",
			});
		}

		if (!checkPermission(req.user.role, "moderator")) {
			console.log(`❌ Insufficient permissions: ${req.user.role} < moderator`);
			return res.status(403).json({
				success: false,
				message: "Moderator access required",
			});
		}

		console.log(`✅ Authorization successful for ${req.user.role}`);
		next();
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Authorization error",
		});
	}
};

// Middleware: Require senior moderator or above
export const requireSeniorModeratorOrAbove = async (req, res, next) => {
	try {
		if (!req.user) {
			return res.status(401).json({
				success: false,
				message: "Authentication required",
			});
		}

		if (!checkPermission(req.user.role, "senior_moderator")) {
			return res.status(403).json({
				success: false,
				message: "Senior moderator access required",
			});
		}

		next();
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Authorization error",
		});
	}
};

// Middleware: Require admin only
export const requireAdminOnly = async (req, res, next) => {
	try {
		if (!req.user) {
			return res.status(401).json({
				success: false,
				message: "Authentication required",
			});
		}

		if (!checkPermission(req.user.role, "admin")) {
			return res.status(403).json({
				success: false,
				message: "Admin access required",
			});
		}

		next();
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Authorization error",
		});
	}
};

// Export the permission checker for use in controllers
export { checkPermission };
