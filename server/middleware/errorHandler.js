/**
 * Global error handling middleware
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (error, req, res, next) => {
	console.error("Server Error:", {
		message: error.message,
		stack: error.stack,
		url: req.url,
		method: req.method,
		timestamp: new Date().toISOString(),
	});

	// Ensure we always return JSON for API routes
	if (req.url.startsWith("/api/")) {
		// Default error response
		let statusCode = error.statusCode || 500;
		let message = error.message || "Internal server error";

		// Handle specific error types
		if (error.name === "ValidationError") {
			statusCode = 400;
			message = "Validation error";
		} else if (error.code === "ENOENT") {
			statusCode = 404;
			message = "Resource not found";
		} else if (error.code === "ECONNREFUSED") {
			statusCode = 503;
			message = "Service unavailable";
		} else if (
			error.message === "Your token has expired! Please log in again."
		) {
			statusCode = 401;
		}

		return res.status(statusCode).json({
			success: false,
			error: message,
			...(process.env.NODE_ENV === "development" && { stack: error.stack }),
		});
	}

	// For non-API routes, use default error handling
	res.status(error.statusCode || 500).json({
		success: false,
		error: error.message || "Internal server error",
		...(process.env.NODE_ENV === "development" && { stack: error.stack }),
	});
};

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const notFoundHandler = (req, res) => {
	console.log("🔍 404 - Route not found:", req.method, req.url);

	res.status(404).json({
		success: false,
		error: `Route ${req.method} ${req.url} not found`,
	});
};

export { errorHandler, notFoundHandler };
