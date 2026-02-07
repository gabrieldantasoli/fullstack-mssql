import { Router } from "express";
import bcrypt from "bcryptjs";
import { getPool, sql } from "../db";

const router = Router();

const COOKIE_NAME = "sid";
const TTL_DAYS = 7;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

router.post("/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body?.identifier ?? "").trim(); // login ou nome
    const senha = String(req.body?.senha ?? "").trim();

    if (!identifier || !senha) {
      return res.status(400).json({ error: "VALIDATION", message: "identifier e senha são obrigatórios" });
    }

    const pool = await getPool();

    // Procedure retorna: id, nome, login, senha(hash)
    const userResult = await pool
      .request()
      .input("identifier", sql.NVarChar(100), identifier)
      .input("senha", sql.NVarChar(255), senha) // assinatura pedida (validação real é no Node)
      .query(`EXEC dbo.usp_auth_login @identifier=@identifier, @senha=@senha`);

    const user = userResult.recordset?.[0];
    if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Credenciais inválidas" });

    const ok = await bcrypt.compare(senha, String(user.senha));
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Credenciais inválidas" });

    // Cria sessão no DB
    const ttlMinutes = TTL_DAYS * 24 * 60;
    const sessResult = await pool
      .request()
      .input("user_id", sql.Int, Number(user.id))
      .input("ttl_minutes", sql.Int, ttlMinutes)
      .query(`EXEC dbo.usp_sessions_create @user_id=@user_id, @ttl_minutes=@ttl_minutes`);

    const session = sessResult.recordset?.[0];
    const sid = String(session.session_id);

    res.cookie(COOKIE_NAME, sid, cookieOptions());
    return res.json({ id: user.id, nome: user.nome, login: user.login });
  } catch (err: any) {
    return res.status(500).json({ error: "AUTH_ERROR", message: String(err?.message ?? "") });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const sid = req.cookies?.[COOKIE_NAME];
    if (!sid) return res.status(401).json({ error: "NO_SESSION" });

    const pool = await getPool();

    const sess = await pool
      .request()
      .input("session_id", sql.UniqueIdentifier, sid)
      .query(`EXEC dbo.usp_sessions_get_valid @session_id=@session_id`);

    const row = sess.recordset?.[0];
    if (!row) return res.status(401).json({ error: "SESSION_INVALID" });

    const userRes = await pool
      .request()
      .input("id", sql.Int, Number(row.user_id))
      .query(`EXEC dbo.usp_users_get_by_id @id=@id`);

    const user = userRes.recordset?.[0];
    if (!user) return res.status(401).json({ error: "USER_NOT_FOUND" });

    return res.json(user);
  } catch (err: any) {
    return res.status(500).json({ error: "AUTH_ERROR", message: String(err?.message ?? "") });
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    const sid = req.cookies?.[COOKIE_NAME];
    if (sid) {
      const pool = await getPool();
      await pool
        .request()
        .input("session_id", sql.UniqueIdentifier, sid)
        .query(`EXEC dbo.usp_sessions_revoke @session_id=@session_id`);
    }

    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.status(204).send();
  } catch {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.status(204).send();
  }
});

export default router;
