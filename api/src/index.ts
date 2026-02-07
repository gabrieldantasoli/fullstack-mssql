import "dotenv/config";
import express from "express";
import cors from "cors";
import { getPool, sql } from "./db";
import usersRoutes from "./routes/users";

const app = express();
app.use(express.json());
app.use(cors()); // dev: libera tudo (depois você restringe)

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/tasks", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT id, title, done, created_at
      FROM dbo.tasks
      ORDER BY id DESC
    `);
    res.json(result.recordset);
  } catch (err: any) {
    res.status(500).json({ error: "DB_ERROR", message: err?.message });
  }
});

app.post("/api/tasks", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "TITLE_REQUIRED" });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("title", sql.NVarChar(255), title)
      .query(`
        INSERT INTO dbo.tasks (title)
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.done, INSERTED.created_at
        VALUES (@title)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err: any) {
    res.status(500).json({ error: "DB_ERROR", message: err?.message });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);
  const done = Boolean(req.body?.done);

  if (!Number.isFinite(id)) return res.status(400).json({ error: "INVALID_ID" });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("done", sql.Bit, done)
      .query(`
        UPDATE dbo.tasks
        SET done = @done
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.done, INSERTED.created_at
        WHERE id = @id
      `);

    const row = result.recordset[0];
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });

    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: "DB_ERROR", message: err?.message });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "INVALID_ID" });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM dbo.tasks
        OUTPUT DELETED.id
        WHERE id = @id
      `);

    if (!result.recordset[0]) return res.status(404).json({ error: "NOT_FOUND" });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: "DB_ERROR", message: err?.message });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`API on http://localhost:${port}`);
});

app.use("/api", usersRoutes);
