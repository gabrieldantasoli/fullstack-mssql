import { Router } from "express";
import { getPool, sql } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/gabinetes/accessible", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user!.id);
    const pool = await getPool();

    const result = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT DISTINCT
          g.id,
          g.nome
        FROM dbo.solicitacao s
        INNER JOIN dbo.gabinete g ON g.id = s.gabinete_id
        WHERE s.user_id = @user_id
          AND s.atendido = 1
        ORDER BY g.nome ASC
      `);

    return res.json(result.recordset);
  } catch (err: any) {
    return res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

/** LISTAR gabinetes do usuário logado */
router.get("/gabinetes", requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, Number(req.user!.id))
      .query(`EXEC dbo.usp_gabinete_list_by_user @user_id=@user_id`);

    res.json(result.recordset);
  } catch (err: any) {
    res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

/** CRIAR gabinete (e cria solicitacao atendido=1 com admin) */
router.post("/gabinetes", requireAuth, async (req, res) => {
  try {
    const nome = String(req.body?.nome ?? "").trim();
    const descricao = String(req.body?.descricao ?? "").trim() || null;

    if (!nome) return res.status(400).json({ error: "VALIDATION", message: "nome é obrigatório" });

    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, Number(req.user!.id))
      .input("nome", sql.NVarChar(150), nome)
      .input("descricao", sql.NVarChar(500), descricao)
      .query(
        `EXEC dbo.usp_gabinete_create @user_id=@user_id, @nome=@nome, @descricao=@descricao`
      );

    res.status(201).json(result.recordset?.[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

router.get("/gabinetes/all", requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, Number(req.user!.id))
      .query("EXEC dbo.usp_gabinetes_list_all_for_user @user_id=@user_id");

    return res.json(result.recordset);
  } catch (err: any) {
    return res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

/** OBTER por id (somente do usuário logado) */
router.get("/gabinetes/:id", requireAuth, async (req, res) => {
  try {
    const gabineteId = Number(req.params.id);
    if (!Number.isFinite(gabineteId)) return res.status(400).json({ error: "INVALID_ID" });

    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, Number(req.user!.id))
      .input("gabinete_id", sql.Int, gabineteId)
      .query(`EXEC dbo.usp_gabinete_get_by_id @user_id=@user_id, @gabinete_id=@gabinete_id`);

    const row = result.recordset?.[0];
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });

    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

/** ATUALIZAR (somente do usuário logado) */
router.put("/gabinetes/:id", requireAuth, async (req, res) => {
  try {
    const gabineteId = Number(req.params.id);
    const nome = String(req.body?.nome ?? "").trim();
    const descricao = String(req.body?.descricao ?? "").trim() || null;

    if (!Number.isFinite(gabineteId)) return res.status(400).json({ error: "INVALID_ID" });
    if (!nome) return res.status(400).json({ error: "VALIDATION", message: "nome é obrigatório" });

    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, Number(req.user!.id))
      .input("gabinete_id", sql.Int, gabineteId)
      .input("nome", sql.NVarChar(150), nome)
      .input("descricao", sql.NVarChar(500), descricao)
      .query(
        `EXEC dbo.usp_gabinete_update @user_id=@user_id, @gabinete_id=@gabinete_id, @nome=@nome, @descricao=@descricao`
      );

    res.json(result.recordset?.[0] ?? null);
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    if (msg.toLowerCase().includes("não encontrado") || msg.toLowerCase().includes("sem permissão")) {
      return res.status(404).json({ error: "NOT_FOUND_OR_FORBIDDEN", message: msg });
    }
    res.status(500).json({ error: "DB_ERROR", message: msg });
  }
});

/** DELETAR (somente do usuário logado) */
router.delete("/gabinetes/:id", requireAuth, async (req, res) => {
  try {
    const gabineteId = Number(req.params.id);
    if (!Number.isFinite(gabineteId)) return res.status(400).json({ error: "INVALID_ID" });

    const pool = await getPool();
    await pool
      .request()
      .input("user_id", sql.Int, Number(req.user!.id))
      .input("gabinete_id", sql.Int, gabineteId)
      .query(`EXEC dbo.usp_gabinete_delete @user_id=@user_id, @gabinete_id=@gabinete_id`);

    res.status(204).send();
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    if (msg.toLowerCase().includes("não encontrado") || msg.toLowerCase().includes("sem permissão")) {
      return res.status(404).json({ error: "NOT_FOUND_OR_FORBIDDEN", message: msg });
    }
    res.status(500).json({ error: "DB_ERROR", message: msg });
  }
});

export default router;
