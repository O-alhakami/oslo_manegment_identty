import "dotenv/config";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { initDB, pool } from "./db";
import authRouter from "./routes/auth";
import vaultRouter from "./routes/vault";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters");
}

const app = express();
const port = Number(process.env.PORT ?? 5000);
const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: clientUrl,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "128kb" }));
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many authentication attempts; try again later" },
  }),
);

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});
app.use("/api/auth", authRouter);
app.use("/api/vault", vaultRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("Request failed:", error);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

async function start(): Promise<void> {
  await initDB();
  app.listen(port, "0.0.0.0", () => {
    console.log(`API listening on port ${port}`);
  });
}

start().catch((error: unknown) => {
  console.error("Failed to start API:", error);
  process.exitCode = 1;
});

