import { Router } from "express";
import { pool } from "../db";
import { authenticate } from "../middleware/authenticate";
import type { AuthenticatedRequest, VaultCategory } from "../types";

const router = Router();
const categories: VaultCategory[] = ["password", "identity", "note"];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validItem(body: unknown): body is {
  category: VaultCategory;
  encrypted_data: string;
  iv: string;
} {
  if (!body || typeof body !== "object") return false;
  const item = body as Record<string, unknown>;
  return (
    typeof item.category === "string" &&
    categories.includes(item.category as VaultCategory) &&
    typeof item.encrypted_data === "string" &&
    item.encrypted_data.length > 0 &&
    item.encrypted_data.length <= 100_000 &&
    typeof item.iv === "string" &&
    /^[A-Za-z0-9+/]{16}$/.test(item.iv) &&
    Buffer.from(item.iv, "base64").length === 12
  );
}

router.use(authenticate);

router.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, category, encrypted_data, iv, updated_at
       FROM vault_items
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [req.userId],
    );
    res.json({ items: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req: AuthenticatedRequest, res, next) => {
  if (!validItem(req.body)) {
    res.status(400).json({ error: "Invalid encrypted vault item" });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO vault_items (user_id, category, encrypted_data, iv)
       VALUES ($1, $2, $3, $4)
       RETURNING id, category, encrypted_data, iv, updated_at`,
      [
        req.userId,
        req.body.category,
        req.body.encrypted_data,
        req.body.iv,
      ],
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req: AuthenticatedRequest, res, next) => {
  if (!uuidPattern.test(req.params.id) || !validItem(req.body)) {
    res.status(400).json({ error: "Invalid encrypted vault item" });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE vault_items
       SET category = $1, encrypted_data = $2, iv = $3, updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, category, encrypted_data, iv, updated_at`,
      [
        req.body.category,
        req.body.encrypted_data,
        req.body.iv,
        req.params.id,
        req.userId,
      ],
    );
    if (result.rowCount !== 1) {
      res.status(404).json({ error: "Vault item not found" });
      return;
    }
    res.json({ item: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req: AuthenticatedRequest, res, next) => {
  if (!uuidPattern.test(req.params.id)) {
    res.status(400).json({ error: "Invalid vault item ID" });
    return;
  }

  try {
    const result = await pool.query(
      "DELETE FROM vault_items WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId],
    );
    if (result.rowCount !== 1) {
      res.status(404).json({ error: "Vault item not found" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

