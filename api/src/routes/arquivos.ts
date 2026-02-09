import { Router } from "express";
import multer from "multer";
import { getPool, sql } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("PDF_ONLY"));
        }
        cb(null, true);
    },
});

// GET /api/arquivos
router.get("/arquivos", requireAuth, async (req, res) => {
    try {
        const userId = Number(req.user!.id);
        const q = String(req.query.q ?? "").trim() || null;

        const statusIdRaw = String(req.query.status_arquivo_id ?? "").trim();
        const status_arquivo_id = statusIdRaw ? Number(statusIdRaw) : null;

        const gabIdRaw = String(req.query.gabinete_id ?? "").trim();
        const gabinete_id = gabIdRaw ? Number(gabIdRaw) : null;

        const pool = await getPool();
        const result = await pool
            .request()
            .input("user_id", sql.Int, userId)
            .input("q", sql.NVarChar(200), q)
            .input("status_arquivo_id", sql.Int, Number.isFinite(Number(status_arquivo_id)) ? (status_arquivo_id as any) : null)
            .input("gabinete_id", sql.Int, Number.isFinite(Number(gabinete_id)) ? (gabinete_id as any) : null)
            .execute("dbo.usp_arquivo_list_for_user");

        return res.json(result.recordset);
    } catch (err: any) {
        return res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
    }
});

// GET /api/arquivos/:id/metadados
router.get("/arquivos/:id/metadados", requireAuth, async (req, res) => {
    try {
        const userId = Number(req.user!.id);
        const arquivo_id = Number(req.params.id);

        if (!Number.isFinite(arquivo_id) || arquivo_id <= 0) {
            return res.status(400).json({ error: "INVALID_ID", message: "ID inválido." });
        }

        const pool = await getPool();
        const result = await pool
            .request()
            .input("user_id", sql.Int, userId)
            .input("arquivo_id", sql.Int, arquivo_id)
            .execute("dbo.usp_metadado_list_for_user");

        return res.json(result.recordset);
    } catch (err: any) {
        return res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
    }
});

// GET /api/arquivos/:id/eventos
router.get("/arquivos/:id/eventos", requireAuth, async (req, res) => {
    try {
        const arquivoId = Number(req.params.id);

        if (!Number.isFinite(arquivoId) || arquivoId <= 0) {
            return res.status(400).json({ error: "INVALID_ID", message: "ID do arquivo inválido." });
        }

        const pool = await getPool();
        const result = await pool
            .request()
            .input("arquivo_id", sql.Int, arquivoId)
            .execute("dbo.usp_eventos_list_by_arquivo");

        const recordsets = (result as any).recordsets as any[] | undefined;
        const rows =
            (Array.isArray(recordsets) && recordsets.length
                ? (recordsets.find((rs) => rs?.columns?.evento_pages_json || rs?.columns?.procurador_pages_json) ??
                    recordsets[recordsets.length - 1])
                : result.recordset) || [];

        return res.json(rows);
    } catch (err: any) {
        const msg = String(err?.message ?? "");
        return res.status(500).json({ error: "DB_ERROR", message: msg });
    }
});

// PUT /api/eventos/:id/pages
router.put("/eventos/:id/pages", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user!.id);
    const eventoId = Number(req.params.id);

    if (!Number.isFinite(eventoId) || eventoId <= 0) {
      return res.status(400).json({ error: "INVALID_ID", message: "ID do evento inválido." });
    }

    const raw = req.body?.pages;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ error: "PAGES_REQUIRED", message: "Envie { pages: number[] }." });
    }

    const cleaned = Array.from(
      new Set(
        raw
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    ).sort((a, b) => a - b);

    const pages_json = JSON.stringify(cleaned);

    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .input("evento_id", sql.Int, eventoId)
      .input("pages_json", sql.NVarChar(sql.MAX), pages_json)
      .execute("dbo.usp_event_pages_update");

    return res.json(result.recordset?.[0] ?? { evento_id: eventoId, pages_json });
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    return res.status(500).json({ error: "DB_ERROR", message: msg });
  }
});

router.post("/arquivos", requireAuth, upload.single("pdf"), async (req, res) => {
    try {
        const userId = Number(req.user!.id);

        const nome_processo = String(req.body?.nome_processo ?? "").trim();
        const descricaoRaw = String(req.body?.descricao ?? "").trim();
        const descricao = descricaoRaw ? descricaoRaw : null;

        const gabinete_id = Number(req.body?.gabinete_id);

        if (!nome_processo) {
            return res.status(400).json({ error: "NOME_REQUIRED", message: "nome_processo é obrigatório." });
        }

        if (!Number.isFinite(gabinete_id) || gabinete_id <= 0) {
            return res.status(400).json({ error: "INVALID_GABINETE", message: "gabinete_id inválido." });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: "PDF_REQUIRED", message: "Envie um PDF." });
        }

        const pdfBuffer = file.buffer;

        const pool = await getPool();

        const st = await pool.request().query(`
      SELECT TOP 1 id
      FROM dbo.status_arquivo
      WHERE nome = 'entregue'
    `);

        const status_arquivo_id: number | undefined = st.recordset?.[0]?.id;

        if (!status_arquivo_id) {
            return res.status(500).json({
                error: "STATUS_ENTREGUE_NOT_FOUND",
                message: "Status 'entregue' não encontrado na tabela dbo.status_arquivo.",
            });
        }

        const [uRes, gRes] = await Promise.all([
            pool
                .request()
                .input("id", sql.Int, userId)
                .query(`SELECT TOP 1 nome FROM dbo.users WHERE id = @id`),

            pool
                .request()
                .input("id", sql.Int, gabinete_id)
                .query(`SELECT TOP 1 nome FROM dbo.gabinete WHERE id = @id`),
        ]);

        const userNome = String(uRes.recordset?.[0]?.nome || `user#${userId}`);
        const gabineteNome = String(gRes.recordset?.[0]?.nome || `gabinete#${gabinete_id}`);

        const metadados: Array<{ nome: string; valor: string }> = [
            { nome: "upload.original_filename", valor: file.originalname },
            { nome: "upload.size_bytes", valor: String(file.size) },
            { nome: "upload.uploaded_by_user", valor: userNome },
            { nome: "upload.gabinete_nome", valor: gabineteNome },
            { nome: "upload.uploaded_at", valor: new Date().toISOString() },
        ];

        try {
            const parsed: any = await pdfParse(pdfBuffer);
            const info: any = parsed?.info || {};

            const add = (key: string, v: any) => {
                const s = String(v ?? "").trim();
                if (s) metadados.push({ nome: key, valor: s });
            };

            add("pdf.pages", parsed?.numpages);
            add("pdf.version", parsed?.version);

            add("pdf.title", info.Title);
            add("pdf.author", info.Author);
            add("pdf.subject", info.Subject);
            add("pdf.keywords", info.Keywords);
            add("pdf.creator", info.Creator);
            add("pdf.producer", info.Producer);
            add("pdf.creation_date_raw", info.CreationDate);
            add("pdf.mod_date_raw", info.ModDate);

            add("pdf.format_version", info.PDFFormatVersion);
            add("pdf.is_acroform_present", info.IsAcroFormPresent);
            add("pdf.is_xfa_present", info.IsXFAPresent);

            if (parsed?.metadata) {
                const m = String(parsed.metadata);
                add("pdf.xmp_present", "true");
                add("pdf.xmp_length", String(m.length));
            }
        } catch { }

        const metadados_json = JSON.stringify(metadados);

        const result = await pool
            .request()
            .input("user_id", sql.Int, userId)
            .input("gabinete_id", sql.Int, gabinete_id)
            .input("status_arquivo_id", sql.Int, status_arquivo_id)
            .input("nome_processo", sql.NVarChar(255), nome_processo)
            .input("descricao", sql.NVarChar(1000), descricao)
            .input("pdf", sql.VarBinary(sql.MAX), pdfBuffer)
            .input("txt", sql.NVarChar(sql.MAX), null)
            .input("metadados_json", sql.NVarChar(sql.MAX), metadados_json)
            .execute("dbo.usp_arquivo_create");

        return res.status(201).json(result.recordset?.[0] ?? null);
    } catch (err: any) {
        const msg = String(err?.message ?? "");
        if (msg.includes("PDF_ONLY")) {
            return res.status(400).json({ error: "PDF_ONLY", message: "Apenas PDF é permitido." });
        }
        return res.status(500).json({ error: "DB_ERROR", message: msg });
    }
});


// GET /api/arquivos/:id/pdf  (sem regex na rota; valida no handler)
router.get("/arquivos/:id/pdf", requireAuth, async (req, res) => {
    try {
        const userId = Number(req.user!.id);
        const arquivo_id = Number(req.params.id);

        if (!Number.isFinite(arquivo_id) || arquivo_id <= 0) {
            return res.status(400).json({ error: "INVALID_ID", message: "ID inválido." });
        }

        const pool = await getPool();
        const result = await pool
            .request()
            .input("user_id", sql.Int, userId)
            .input("arquivo_id", sql.Int, arquivo_id)
            .execute("dbo.usp_arquivo_get_pdf_for_user");

        const row = result.recordset?.[0];
        if (!row) return res.status(404).json({ error: "NOT_FOUND" });

        const pdf: Buffer | null = row.pdf ?? null;
        const nome: string = row.nome_processo ?? "arquivo";

        if (!pdf) return res.status(404).json({ error: "NO_PDF" });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${nome}.pdf"`);

        return res.status(200).send(pdf);
    } catch (err: any) {
        return res.status(500).json({ error: "DB_ERROR", message: String(err?.message ?? "") });
    }
});

export default router;
