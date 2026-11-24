import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const saltPattern = /^[A-Za-z0-9+/]{22}==$/;

function isValidAuthKey(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43,44}$/.test(value);
}

function createToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return jwt.sign({}, secret, { subject: userId, expiresIn: "15m" });
}

router.get("/salt/:email", async (req, res, next) => {
  const email = req.params.email.trim().toLowerCase();
  if (!emailPattern.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  try {
    const result = await pool.query<{ kdf_salt: string }>(
      "SELECT kdf_salt FROM users WHERE email = $1",
      [email],
    );
    if (result.rowCount !== 1) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json({ salt: result.rows[0].kdf_salt });
  } catch (error) {
    next(error);
  }
});

router.post("/register", async (req, res, next) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const { auth_key: authKey, kdf_salt: salt } = req.body ?? {};

  if (!emailPattern.test(email) || !isValidAuthKey(authKey)) {
    res.status(400).json({ error: "Invalid registration details" });
    return;
  }
  if (
    typeof salt !== "string" ||
    !saltPattern.test(salt) ||
    Buffer.from(salt, "base64").length !== 16
  ) {
    res.status(400).json({ error: "Invalid key derivation salt" });
    return;
  }

  try {
    const authHash = await bcrypt.hash(authKey, 12);
    const result = await pool.query<{ id: string }>(
      `INSERT INTO users (email, auth_hash, kdf_salt)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email, authHash, salt],
    );
    res.status(201).json({ token: createToken(result.rows[0].id) });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const { auth_key: authKey } = req.body ?? {};
  if (!emailPattern.test(email) || !isValidAuthKey(authKey)) {
    res.status(400).json({ error: "Invalid login details" });
    return;
  }

  try {
    const result = await pool.query<{ id: string; auth_hash: string }>(
      "SELECT id, auth_hash FROM users WHERE email = $1",
      [email],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(authKey, user.auth_hash))) {
      res.status(401).json({ error: "Invalid email or master password" });
      return;
    }
    res.json({ token: createToken(user.id) });
  } catch (error) {
    next(error);
  }
});

export default router;

