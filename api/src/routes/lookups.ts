import { Router } from "express";
import { getPool, sql } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// GET /api/status-arquivo
router.get("/status-arquivo", requireAuth, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().execute("dbo.usp_status_arquivo_list");
    return res.json(result.recordset);
  } catch (err: any) {
    return res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

// GET /api/gabinetes/accessible
router.get("/gabinetes/accessible", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user!.id);

    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .execute("dbo.usp_gabinetes_accessible_list");

    return res.json(result.recordset);
  } catch (err: any) {
    return res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

export default router;
