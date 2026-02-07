import { Request, Response, NextFunction } from "express";
import { getPool, sql } from "../db";

export type AuthUser = { id: number; nome: string; login: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const sid = req.cookies?.sid;
    if (!sid) return res.status(401).json({ error: "NO_SESSION" });

    const pool = await getPool();

    // valida sessão
    const sess = await pool
      .request()
      .input("session_id", sql.UniqueIdentifier, sid)
      .query(`EXEC dbo.usp_sessions_get_valid @session_id=@session_id`);

    const row = sess.recordset?.[0];
    if (!row) return res.status(401).json({ error: "SESSION_INVALID" });

    // carrega usuário
    const userRes = await pool
      .request()
      .input("id", sql.Int, Number(row.user_id))
      .query(`EXEC dbo.usp_users_get_by_id @id=@id`);

    const user = userRes.recordset?.[0];
    if (!user) return res.status(401).json({ error: "USER_NOT_FOUND" });

    req.user = user as AuthUser;
    next();
  } catch (err: any) {
    return res.status(500).json({ error: "AUTH_MIDDLEWARE_ERROR", message: String(err?.message ?? "") });
  }
}
