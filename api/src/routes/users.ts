import { Router } from "express";
import bcrypt from "bcryptjs";
import { getPool, sql } from "../db";

const router = Router();

router.post("/users", async (req, res) => {
  try {
    const nome = String(req.body?.nome ?? "").trim();
    const login = String(req.body?.login ?? "").trim();
    const senha = String(req.body?.senha ?? "").trim();

    if (!nome || !login || !senha) {
      return res.status(400).json({ error: "VALIDATION", message: "nome, login e senha são obrigatórios" });
    }

    // hash da senha (boa prática)
    const senhaHash = await bcrypt.hash(senha, 10);

    const pool = await getPool();
    const result = await pool
      .request()
      .input("nome", sql.NVarChar(150), nome)
      .input("login", sql.NVarChar(100), login)
      .input("senha", sql.NVarChar(255), senhaHash)
      .query(`
        EXEC dbo.usp_users_create
          @nome=@nome,
          @login=@login,
          @senha=@senha
      `);

    // procedure retorna um SELECT do user criado
    const created = result.recordset?.[0];
    return res.status(201).json(created);
  } catch (err: any) {
    // Ex: procedure THROW 50004 'login já existe'
    const message = String(err?.message ?? "");
    const number = err?.number;

    if (number === 50004 || message.toLowerCase().includes("login já existe")) {
      return res.status(409).json({ error: "LOGIN_EXISTS", message: "Login já existe" });
    }

    return res.status(500).json({ error: "DB_ERROR", message });
  }
});

export default router;
