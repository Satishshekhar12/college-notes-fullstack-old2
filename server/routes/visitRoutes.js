import express from "express";
import {
	getVisitCount,
	incrementVisitCount,
} from "../controllers/visitController.js";

const router = express.Router();

// GET /api/visit-counter - Get current visit count
router.get("/visit-counter", getVisitCount);

// POST /api/visit-counter - Increment and get visit count
router.post("/visit-counter", incrementVisitCount);

export default router;
