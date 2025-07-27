import cors from "cors";

// CORS middleware configuration
const allowedOrigins = [
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"https://clg-notes.netlify.app",

	process.env.CLIENT_URL || "https://clg-notes.netlify.app",
];

export const corsMiddleware = cors({
	origin: function (origin, callback) {
		// Allow requests with no origin (like mobile apps or curl requests)
		if (!origin) return callback(null, true);

		if (allowedOrigins.includes(origin)) {
			callback(null, true);
		} else {
			callback(new Error("Not allowed by CORS"));
		}
	},
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
	credentials: true,
});
