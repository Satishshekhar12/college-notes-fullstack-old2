import express from "express";
import {
	signup,
	login,
	protect,
	forgotPassword,
	resetPassword,
	updatePassword,
	getMe,
	updateMe,
	updateUploadStats,
	getUserProfile,
	syncUserStats,
} from "../controllers/authController.js";
import { getAllUsers, getUser } from "../controllers/adminController.js";

const router = express.Router();

// User signup route
router.post("/signup", signup);
router.post("/login", login);

// Forgot password route
router.post("/forgotPassword", forgotPassword);

router.patch("/resetPassword/:token", resetPassword);

router.patch("/updatePassword", protect, updatePassword);

// User profile routes (protected)
router.get("/me", protect, getMe);
router.patch("/updateMe", protect, updateMe);
router.get("/profile", protect, getUserProfile);

// Update user upload statistics
router.patch("/updateUploadStats", protect, updateUploadStats);

// Get all users (admin route) - protected
router.get("/users", protect, getAllUsers);
// Get user by ID (admin route) - protected
router.get("/users/:id", protect, getUser);

// Sync user upload statistics (admin route)
router.post("/sync-user-stats", protect, syncUserStats);

// Welcome route
router.get("/", (req, res) => {
	res.status(200).json({
		success: true,
		message: "Welcome to the College Notes API!",
	});
});

export default router;
