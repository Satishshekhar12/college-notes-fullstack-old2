import express from "express";
import fileRoutes from "./fileRoutes.js";
import adminRoutes from "./adminRoutes.js";
import noteRoutes from "./noteRoutes.js";
import visitRoutes from "./visitRoutes.js";

const router = express.Router();

// Admin routes (includes signup and welcome)
router.use("/", adminRoutes);

// File routes (S3 functionality)
router.use("/api", fileRoutes);

// Note routes (note management system)
router.use("/api/notes", noteRoutes);

// Visit counter routes
router.use("/api", visitRoutes);

// Express route to check server health
router.get("/ping", (req, res) => {
	res.status(200).send("pong");
});

export default router;
