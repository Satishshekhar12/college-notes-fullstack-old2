import express from "express";
import { corsMiddleware } from "./middleware/cors.js";
import { handleMulterError } from "./middleware/upload.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import routes from "./routes/index.js";
import bodyParser from "body-parser";

// Initialize Express app
const app = express();

// Middleware
app.use(corsMiddleware);
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/", routes);

// Error handling middleware
app.use(handleMulterError);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
