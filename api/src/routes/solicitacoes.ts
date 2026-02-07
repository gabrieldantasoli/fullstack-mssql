import { Router } from "express";
import { getPool, sql } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

/** Lista solicitações pendentes dos gabinetes onde o usuário logado é ADMIN */
router.get("/solicitacoes", requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("admin_user_id", sql.Int, Number(req.user!.id))
      .query("EXEC dbo.usp_solicitacoes_list_for_admin @admin_user_id=@admin_user_id");

    res.json(result.recordset);
  } catch (err: any) {
    res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

/** Aprovar */
router.post("/solicitacoes/:id/approve", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "INVALID_ID" });

    const pool = await getPool();
    const result = await pool
      .request()
      .input("admin_user_id", sql.Int, Number(req.user!.id))
      .input("solicitacao_id", sql.Int, id)
      .query("EXEC dbo.usp_solicitacao_approve @admin_user_id=@admin_user_id, @solicitacao_id=@solicitacao_id");

    const row = result.recordset?.[0];
    res.json(row ?? null);
  } catch (err: any) {
    res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

/** Rejeitar */
router.post("/solicitacoes/:id/reject", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "INVALID_ID" });

    const pool = await getPool();
    const result = await pool
      .request()
      .input("admin_user_id", sql.Int, Number(req.user!.id))
      .input("solicitacao_id", sql.Int, id)
      .query("EXEC dbo.usp_solicitacao_reject @admin_user_id=@admin_user_id, @solicitacao_id=@solicitacao_id");

    res.json(result.recordset?.[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

router.post("/solicitacoes/request", requireAuth, async (req, res) => {
  try {
    const gabinete_id = Number(req.body?.gabinete_id);
    const acesso_nome = String(req.body?.acesso_nome ?? "").trim();
    const msg_pedido = String(req.body?.msg_pedido ?? "").trim();

    if (!Number.isFinite(gabinete_id)) {
      return res.status(400).json({ error: "VALIDATION", message: "gabinete_id inválido" });
    }
    if (!acesso_nome) {
      return res.status(400).json({ error: "VALIDATION", message: "acesso_nome é obrigatório" });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, Number(req.user!.id))
      .input("gabinete_id", sql.Int, gabinete_id)
      .input("acesso_nome", sql.NVarChar(20), acesso_nome)
      .input("msg_pedido", sql.NVarChar(500), msg_pedido || null)
      .query(
        "EXEC dbo.usp_solicitacao_request_access @user_id=@user_id, @gabinete_id=@gabinete_id, @acesso_nome=@acesso_nome, @msg_pedido=@msg_pedido"
      );

    res.json(result.recordset?.[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

export default router;
