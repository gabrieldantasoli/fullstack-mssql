import { Router } from "express";
import { getPool, sql } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

function getAuthUserId(req: any): number {
  const n = Number(req.user?.id);
  return Number.isFinite(n) ? n : NaN;
}

function parseId(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

router.get("/gabinetes/accessible", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
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
      .query(`EXEC dbo.usp_gabinete_create @user_id=@user_id, @nome=@nome, @descricao=@descricao`);

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

/** OBTER por id (viewer/editor/admin) */
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

/**
 * ✅ LISTAR usuários + permissões do gabinete (qualquer permissão pode ver)
 * GET /gabinetes/:id/usuarios
 */
router.get("/gabinetes/:id/usuarios", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const gabineteId = parseId(req.params.id);

    if (!Number.isFinite(gabineteId) || gabineteId <= 0) {
      return res.status(400).json({ error: "INVALID_ID", message: "ID do gabinete inválido." });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .input("gabinete_id", sql.Int, gabineteId)
      .execute("dbo.usp_gabinete_users_list");

    return res.json(result.recordset || []);
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    // Se sua SP usa THROW com "Sem permissão..."
    if (msg.toLowerCase().includes("sem permissão")) {
      return res.status(403).json({ error: "FORBIDDEN", message: msg });
    }
    return res.status(500).json({ error: "DB_ERROR", message: msg });
  }
});

/**
 * ✅ REMOVER permissão de um usuário (somente admin)
 * DELETE /gabinetes/:id/usuarios/:userId
 */
router.delete("/gabinetes/:id/usuarios/:userId", requireAuth, async (req, res) => {
  try {
    const actorUserId = getAuthUserId(req);
    const gabineteId = parseId(req.params.id);
    const targetUserId = parseId(req.params.userId);

    if (!Number.isFinite(gabineteId) || gabineteId <= 0) {
      return res.status(400).json({ error: "INVALID_ID", message: "ID do gabinete inválido." });
    }
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "INVALID_USER_ID", message: "ID do usuário inválido." });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("actor_user_id", sql.Int, actorUserId)
      .input("gabinete_id", sql.Int, gabineteId)
      .input("target_user_id", sql.Int, targetUserId)
      .execute("dbo.usp_gabinete_user_remove_access");

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    if (msg.toLowerCase().includes("apenas admin")) {
      return res.status(403).json({ error: "FORBIDDEN", message: msg });
    }
    if (msg.toLowerCase().includes("não é permitido remover o dono")) {
      return res.status(400).json({ error: "CANNOT_REMOVE_OWNER", message: msg });
    }
    if (msg.toLowerCase().includes("sem permissão")) {
      return res.status(403).json({ error: "FORBIDDEN", message: msg });
    }
    return res.status(500).json({ error: "DB_ERROR", message: msg });
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

/**
 * ✅ DELETAR gabinete (somente admin)
 * DELETE /gabinetes/:id
 *
 * OBS: usa procedure admin-only com @actor_user_id
 */
router.delete("/gabinetes/:id", requireAuth, async (req, res) => {
  try {
    const gabineteId = parseId(req.params.id);
    if (!Number.isFinite(gabineteId) || gabineteId <= 0) {
      return res.status(400).json({ error: "INVALID_ID" });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("actor_user_id", sql.Int, Number(req.user!.id))
      .input("gabinete_id", sql.Int, gabineteId)
      .execute("dbo.usp_gabinete_delete");

    // seu frontend aceita ok: true ou 204. Aqui vou manter 204 (padrão REST)
    return res.status(204).send();
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    if (msg.toLowerCase().includes("apenas admin")) {
      return res.status(403).json({ error: "FORBIDDEN", message: msg });
    }
    if (msg.toLowerCase().includes("não é possível deletar") || msg.toLowerCase().includes("existem arquivos")) {
      return res.status(400).json({ error: "HAS_DEPENDENCIES", message: msg });
    }
    if (msg.toLowerCase().includes("não encontrado") || msg.toLowerCase().includes("sem permissão")) {
      return res.status(404).json({ error: "NOT_FOUND_OR_FORBIDDEN", message: msg });
    }
    return res.status(500).json({ error: "DB_ERROR", message: msg });
  }
});

// GET: detalhes do gabinete + meus dados (role/owner) + lista de usuários com permissões
router.get("/gabinetes/:id/open", requireAuth, async (req, res) => {
  try {
    const gabineteId = Number(req.params.id);
    const userId = Number(req.user!.id);

    if (!Number.isFinite(gabineteId) || gabineteId <= 0) {
      return res.status(400).json({ error: "INVALID_ID", message: "ID do gabinete inválido." });
    }

    const pool = await getPool();

    const gabRes = await pool
      .request()
      .input("gabinete_id", sql.Int, gabineteId)
      .query(`
        SELECT id, nome, descricao, user_id
        FROM dbo.gabinete
        WHERE id = @gabinete_id
      `);

    const gabinete = gabRes.recordset?.[0];
    if (!gabinete) return res.status(404).json({ error: "NOT_FOUND", message: "Gabinete não encontrado." });

    const ownerId = Number(gabinete.user_id);
    const meIsOwner = ownerId === userId;

    let myRole: string | null = meIsOwner ? "admin" : null;

    if (!meIsOwner) {
      const meRes = await pool
        .request()
        .input("gabinete_id", sql.Int, gabineteId)
        .input("user_id", sql.Int, userId)
        .query(`
          SELECT TOP 1 a.nome AS acesso_nome
          FROM dbo.solicitacao s
          INNER JOIN dbo.acesso a ON a.id = s.acesso_id
          WHERE s.gabinete_id = @gabinete_id
            AND s.user_id = @user_id
            AND s.atendido = 1
          ORDER BY
            CASE a.nome WHEN 'admin' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END DESC,
            s.id DESC
        `);

      myRole = meRes.recordset?.[0]?.acesso_nome ?? null;
    }

    if (!myRole) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Sem permissão para acessar este gabinete." });
    }

    const usersRes = await pool
      .request()
      .input("gabinete_id", sql.Int, gabineteId)
      .query(`
        ;WITH ranked AS (
          SELECT
            s.user_id,
            u.nome AS user_nome,
            a.nome AS acesso_nome,
            ROW_NUMBER() OVER (
              PARTITION BY s.user_id
              ORDER BY
                CASE a.nome WHEN 'admin' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END DESC,
                s.id DESC
            ) AS rn
          FROM dbo.solicitacao s
          INNER JOIN dbo.users u ON u.id = s.user_id
          INNER JOIN dbo.acesso a ON a.id = s.acesso_id
          WHERE s.gabinete_id = @gabinete_id
            AND s.atendido = 1
        )
        SELECT
          r.user_id,
          r.user_nome,
          r.acesso_nome,
          CASE WHEN r.user_id = g.user_id THEN 1 ELSE 0 END AS is_owner
        FROM ranked r
        INNER JOIN dbo.gabinete g ON g.id = @gabinete_id
        WHERE r.rn = 1
        ORDER BY
          CASE WHEN r.user_id = g.user_id THEN 1 ELSE 0 END DESC,
          CASE r.acesso_nome WHEN 'admin' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END DESC,
          r.user_nome ASC
      `);

    return res.json({
      gabinete,
      me: { user_id: userId, is_owner: meIsOwner ? 1 : 0, acesso_nome: String(myRole) },
      usuarios: usersRes.recordset ?? [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

// DELETE: revogar permissão de um usuário, com regra owner/admin
router.delete("/gabinetes/:id/permissoes/:targetUserId", requireAuth, async (req, res) => {
  try {
    const gabineteId = Number(req.params.id);
    const targetUserId = Number(req.params.targetUserId);
    const userId = Number(req.user!.id);

    if (!Number.isFinite(gabineteId) || gabineteId <= 0) {
      return res.status(400).json({ error: "INVALID_ID", message: "ID do gabinete inválido." });
    }
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "INVALID_TARGET", message: "ID do usuário inválido." });
    }

    const pool = await getPool();

    const gabRes = await pool
      .request()
      .input("gabinete_id", sql.Int, gabineteId)
      .query(`SELECT id, user_id FROM dbo.gabinete WHERE id = @gabinete_id`);

    const gab = gabRes.recordset?.[0];
    if (!gab) return res.status(404).json({ error: "NOT_FOUND", message: "Gabinete não encontrado." });

    const ownerId = Number(gab.user_id);
    const meIsOwner = ownerId === userId;

    if (targetUserId === ownerId) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Não é permitido remover o dono do gabinete." });
    }

    let myRole: string | null = meIsOwner ? "admin" : null;

    if (!meIsOwner) {
      const meRes = await pool
        .request()
        .input("gabinete_id", sql.Int, gabineteId)
        .input("user_id", sql.Int, userId)
        .query(`
          SELECT TOP 1 a.nome AS acesso_nome
          FROM dbo.solicitacao s
          INNER JOIN dbo.acesso a ON a.id = s.acesso_id
          WHERE s.gabinete_id = @gabinete_id
            AND s.user_id = @user_id
            AND s.atendido = 1
          ORDER BY
            CASE a.nome WHEN 'admin' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END DESC,
            s.id DESC
        `);

      myRole = meRes.recordset?.[0]?.acesso_nome ?? null;
    }

    if (!myRole) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Sem permissão para gerenciar este gabinete." });
    }

    const targetRes = await pool
      .request()
      .input("gabinete_id", sql.Int, gabineteId)
      .input("user_id", sql.Int, targetUserId)
      .query(`
        SELECT TOP 1 a.nome AS acesso_nome
        FROM dbo.solicitacao s
        INNER JOIN dbo.acesso a ON a.id = s.acesso_id
        WHERE s.gabinete_id = @gabinete_id
          AND s.user_id = @user_id
          AND s.atendido = 1
        ORDER BY
          CASE a.nome WHEN 'admin' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END DESC,
          s.id DESC
      `);

    const targetRole = String(targetRes.recordset?.[0]?.acesso_nome ?? "").toLowerCase();
    if (!targetRole) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Usuário não possui permissão ativa neste gabinete." });
    }

    const myRoleLower = String(myRole).toLowerCase();
    if (!meIsOwner) {
      if (myRoleLower !== "admin") {
        return res.status(403).json({ error: "FORBIDDEN", message: "Apenas admin/dono pode remover permissões." });
      }
      if (targetRole === "admin") {
        return res.status(403).json({ error: "FORBIDDEN", message: "Admin não pode remover permissão de outro admin." });
      }
    }

    await pool
      .request()
      .input("gabinete_id", sql.Int, gabineteId)
      .input("target_user_id", sql.Int, targetUserId)
      .query(`
        DELETE FROM dbo.solicitacao
        WHERE gabinete_id = @gabinete_id
          AND user_id = @target_user_id
          AND atendido = 1
      `);

    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
  }
});

export default router;
