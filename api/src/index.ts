import "dotenv/config";
import express from "express";
import cors from "cors";
import { getPool, sql } from "./db";
import usersRoutes from "./routes/users";
import authRoutes from "./routes/auth";
import cookieParser from "cookie-parser";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

/** Rotas (ANTES do listen) */
app.use("/api", usersRoutes);
app.use("/api", authRoutes);

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`API on http://localhost:${port}`);
});


app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
