import fs from "fs";
import path from "path";

const VISIT_COUNT_FILE = path.join(process.cwd(), "data", "visitCount.json");

// Ensure data directory exists
const dataDir = path.dirname(VISIT_COUNT_FILE);
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize visit count file if it doesn't exist
if (!fs.existsSync(VISIT_COUNT_FILE)) {
	fs.writeFileSync(VISIT_COUNT_FILE, JSON.stringify({ count: 0 }));
}

export const getVisitCount = async (req, res) => {
	try {
		const data = fs.readFileSync(VISIT_COUNT_FILE, "utf8");
		const visitData = JSON.parse(data);
		res.json({ count: visitData.count });
	} catch (error) {
		console.error("Error reading visit count:", error);
		res.status(500).json({ error: "Failed to get visit count" });
	}
};

export const incrementVisitCount = async (req, res) => {
	try {
		const data = fs.readFileSync(VISIT_COUNT_FILE, "utf8");
		const visitData = JSON.parse(data);
		visitData.count += 1;

		fs.writeFileSync(VISIT_COUNT_FILE, JSON.stringify(visitData));
		res.json({ count: visitData.count });
	} catch (error) {
		console.error("Error incrementing visit count:", error);
		res.status(500).json({ error: "Failed to increment visit count" });
	}
};
