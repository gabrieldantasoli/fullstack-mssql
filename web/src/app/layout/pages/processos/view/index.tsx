import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ChevronDown, ChevronUp, FileText } from "lucide-react";
import styles from "./index.module.css";

type MetadadoRow = { id: number; nome: string; valor: string | null };

type EventoRow = {
  id: number;
  nome: string;
  created_at: string;
  status_nome: string | null;
  procurador_nome: string | null;
};

function fmtDateValue(v: string) {
  // tenta ISO / Date parseável
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }
  return v;
}

function fmtBytesValue(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return v;

  const units = ["B", "KB", "MB", "GB", "TB"];
  let x = n;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  const fixed = i === 0 ? 0 : x < 10 ? 2 : x < 100 ? 1 : 0;
  return `${x.toFixed(fixed)} ${units[i]}`;
}

function humanMetaName(key: string) {
  const map: Record<string, string> = {
    "upload.gabinete_nome": "Gabinete",
    "upload.original_filename": "Nome do arquivo (upload)",
    "upload.size_bytes": "Tamanho do arquivo",
    "upload.uploaded_at": "Data do upload",
    "upload.uploaded_by_user": "Enviado por",

    // PDFs (se aparecerem)
    "pdf.pages": "Páginas",
    "pdf.version": "Versão do PDF",
    "pdf.title": "Título",
    "pdf.author": "Autor",
    "pdf.subject": "Assunto",
    "pdf.keywords": "Palavras-chave",
    "pdf.creator": "Criador",
    "pdf.producer": "Produtor",
    "pdf.creation_date_raw": "Criado em (raw)",
    "pdf.mod_date_raw": "Modificado em (raw)",
    "pdf.format_version": "Formato (versão)",
    "pdf.is_acroform_present": "Possui AcroForm",
    "pdf.is_xfa_present": "Possui XFA",
    "pdf.xmp_present": "XMP presente",
    "pdf.xmp_length": "Tamanho do XMP",
  };

  if (map[key]) return map[key];

  // fallback: transforma "upload.alguma_coisa" -> "Alguma coisa"
  const last = key.split(".").pop() || key;
  return last
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMetaValue(nome: string, valor: string | null) {
  if (!valor) return "—";

  // data
  if (nome === "upload.uploaded_at") return fmtDateValue(valor);

  // tamanho
  if (nome === "upload.size_bytes") return fmtBytesValue(valor);

  // algumas datas que podem vir do pdfParse (raw às vezes não dá parse)
  if (nome === "pdf.creation_date_raw" || nome === "pdf.mod_date_raw") {
    // tenta parsear, se não der mantém raw
    return fmtDateValue(valor);
  }

  return valor;
}

export default function ProcessoPdfPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const arquivoId = useMemo(() => Number(id), [id]);

  const [metaOpen, setMetaOpen] = useState(true);

  const [metadados, setMetadados] = useState<MetadadoRow[]>([]);
  const [eventos, setEventos] = useState<EventoRow[]>([]);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingEvt, setLoadingEvt] = useState(true);

  const pdfUrl = `/api/arquivos/${arquivoId}/pdf`;

  useEffect(() => {
    if (!Number.isFinite(arquivoId) || arquivoId <= 0) {
      toast.error("ID do arquivo inválido.");
      navigate("/app/processos");
      return;
    }

    async function loadMeta() {
      setLoadingMeta(true);
      try {
        const res = await fetch(`/api/arquivos/${arquivoId}/metadados`, { credentials: "include" });
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          toast.error(data?.message || "Erro ao carregar metadados.");
          setMetadados([]);
          return;
        }
        setMetadados(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Falha de rede ao carregar metadados.");
        setMetadados([]);
      } finally {
        setLoadingMeta(false);
      }
    }

    async function loadEventos() {
      setLoadingEvt(true);
      try {
        const res = await fetch(`/api/arquivos/${arquivoId}/eventos`, { credentials: "include" });
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          toast.error(data?.message || "Erro ao carregar eventos.");
          setEventos([]);
          return;
        }
        setEventos(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Falha de rede ao carregar eventos.");
        setEventos([]);
      } finally {
        setLoadingEvt(false);
      }
    }

    loadMeta();
    loadEventos();
  }, [arquivoId, navigate]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} type="button" onClick={() => navigate("/app/processos")}>
          <ArrowLeft className={styles.btnIcon} aria-hidden="true" />
          Voltar
        </button>

        <div className={styles.titleWrap}>
          <div className={styles.titleIcon}>
            <FileText className={styles.icon} aria-hidden="true" />
          </div>
          <div>
            <h1 className={styles.title}>Visualizar arquivo</h1>
            <p className={styles.subtitle}>PDF à esquerda, metadados e eventos à direita.</p>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        {/* PDF */}
        <section className={styles.viewerCard} aria-label="Visualização do PDF">
          <div className={styles.viewerHeader}>
            <span className={styles.viewerTitle}>PDF</span>
            <a className={styles.viewerLink} href={pdfUrl} target="_blank" rel="noreferrer">
              Abrir em nova aba
            </a>
          </div>

          <iframe title="PDF" className={styles.iframe} src={pdfUrl} />
        </section>

        {/* Direita: Metadados + Eventos */}
        <aside className={styles.side} aria-label="Detalhes do arquivo">
          {/* Metadados (colapsável) */}
          <section className={styles.card}>
            <button
              type="button"
              className={styles.collapseHeader}
              onClick={() => setMetaOpen((v) => !v)}
              aria-expanded={metaOpen}
            >
              <span className={styles.cardTitle}>Metadados</span>
              {metaOpen ? (
                <ChevronUp className={styles.chev} aria-hidden="true" />
              ) : (
                <ChevronDown className={styles.chev} aria-hidden="true" />
              )}
            </button>

            {metaOpen ? (
              <div className={styles.cardBody}>
                {loadingMeta ? (
                  <div className={styles.state}>Carregando metadados...</div>
                ) : metadados.length === 0 ? (
                  <div className={styles.state}>Nenhum metadado encontrado.</div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metadados.map((m) => (
                          <tr key={m.id}>
                            <td className={styles.tdStrong}>{humanMetaName(m.nome)}</td>
                            <td className={styles.tdValue}>{formatMetaValue(m.nome, m.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </section>

          {/* Eventos */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Eventos</span>
            </div>

            <div className={styles.cardBody}>
              {loadingEvt ? (
                <div className={styles.state}>Carregando eventos...</div>
              ) : eventos.length === 0 ? (
                <div className={styles.state}>Nenhum evento registrado para este arquivo.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Evento</th>
                        <th>Status</th>
                        <th>Procurador</th>
                        <th style={{ width: 150 }}>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventos.map((e) => (
                        <tr key={e.id}>
                          <td className={styles.tdStrong}>{e.nome}</td>
                          <td className={styles.tdMuted}>{e.status_nome || "—"}</td>
                          <td className={styles.tdMuted}>{e.procurador_nome || "—"}</td>
                          <td className={styles.tdMuted}>
                            {new Date(e.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
