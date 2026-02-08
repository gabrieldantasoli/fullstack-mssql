import { Router } from "express";
import { getPool, sql } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// GET /api/meus-acessos
router.get("/meus-acessos", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user!.id);

    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .execute("dbo.usp_meus_acessos_list");

    return res.json(result.recordset || []);
  } catch (err: any) {
    return res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

// PUT /api/meus-acessos/:gabineteId  body: { acesso_nome: "viewer" | "editor" | "admin" }
router.put("/meus-acessos/:gabineteId", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user!.id);
    const gabineteId = Number(req.params.gabineteId);
    const acesso_nome = String(req.body?.acesso_nome || "").trim();

    if (!Number.isFinite(gabineteId) || gabineteId <= 0) {
      return res.status(400).json({ error: "INVALID_GABINETE", message: "gabineteId inválido." });
    }
    if (!acesso_nome) {
      return res.status(400).json({ error: "ACESSO_REQUIRED", message: "acesso_nome é obrigatório." });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .input("gabinete_id", sql.Int, gabineteId)
      .input("acesso_nome", sql.NVarChar(20), acesso_nome)
      .execute("dbo.usp_meus_acessos_update");

    const row = result.recordset?.[0];
    return res.json(row ?? null);
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    return res.status(400).json({ error: "UPDATE_FAILED", message: msg });
  }
});

// DELETE /api/meus-acessos/:gabineteId
router.delete("/meus-acessos/:gabineteId", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user!.id);
    const gabineteId = Number(req.params.gabineteId);

    if (!Number.isFinite(gabineteId) || gabineteId <= 0) {
      return res.status(400).json({ error: "INVALID_GABINETE", message: "gabineteId inválido." });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("user_id", sql.Int, userId)
      .input("gabinete_id", sql.Int, gabineteId)
      .execute("dbo.usp_meus_acessos_delete");

    return res.status(204).send();
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    return res.status(400).json({ error: "DELETE_FAILED", message: msg });
  }
});

export default router;
