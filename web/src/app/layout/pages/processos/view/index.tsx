import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ChevronDown, ChevronUp, FileText, Plus, X } from "lucide-react";
import styles from "./index.module.css";

type MetadadoRow = { id: number; nome: string; valor: string | null };

type EventoRow = {
  id: number;
  nome: string;
  created_at: string;
  status_nome: string | null;

  procurador_id: number | null;
  procurador_nome: string | null;

  evento_pages_json: string | null;
};

function humanMetaName(key: string) {
  const map: Record<string, string> = {
    "upload.gabinete_nome": "Gabinete",
    "upload.original_filename": "Nome do arquivo (upload)",
    "upload.size_bytes": "Tamanho do arquivo",
    "upload.uploaded_at": "Data do upload",
    "upload.uploaded_by_user": "Enviado por",

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
    "pdf.xmp_present": "XMP presente",
    "pdf.xmp_length": "Tamanho do XMP",
  };

  if (map[key]) return map[key];
  const last = key.split(".").pop() || key;
  return last.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
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

function formatMetaValue(nome: string, valor: string | null) {
  if (!valor) return "—";
  if (nome === "upload.uploaded_at") return fmtDate(valor);
  if (nome === "upload.size_bytes") return fmtBytesValue(valor);
  if (nome === "pdf.creation_date_raw" || nome === "pdf.mod_date_raw") return fmtDate(valor);
  return valor;
}

function parsePages(json: string | null): number[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

function statusLabel(s: string | null) {
  const v = (s || "").toLowerCase();
  if (v === "processado") return "Processado";
  if (v === "processando") return "Processando";
  if (v === "aguardando_processamento") return "Aguardando";
  return s || "—";
}

function parseInputPages(s: string): number[] {
  const parts = s
    .split(/[\s,;]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

  const nums = parts.map((p) => Number(p)).filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
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

  // accordion
  const [openEvents, setOpenEvents] = useState<Record<number, boolean>>({});

  // edição de páginas
  const [pageInput, setPageInput] = useState<Record<number, string>>({});
  const [savingPages, setSavingPages] = useState<Record<number, boolean>>({});

  // ✅ controle do PDF (página + reload hard)
  const [pdfPage, setPdfPage] = useState<number | null>(null);
  const [pdfNonce, setPdfNonce] = useState(0);

  const pdfBaseUrl = `/api/arquivos/${arquivoId}/pdf`;

  // ✅ url final do PDF com #page=
  const pdfSrc = useMemo(() => {
    // adiciona query p/ bust cache + força reload do viewer
    const base = `${pdfBaseUrl}?v=${pdfNonce}`;
    if (pdfPage && pdfPage > 0) return `${base}#page=${pdfPage}`;
    return base;
  }, [pdfBaseUrl, pdfNonce, pdfPage]);

  function toggleEvent(eventoId: number) {
    setOpenEvents((prev) => ({ ...prev, [eventoId]: !prev[eventoId] }));
  }

  // ✅ vai pra página clicada (força reload do object)
  function goToPdfPage(p: number) {
    if (!Number.isFinite(p) || p <= 0) return;
    setPdfPage(p);
    setPdfNonce((n) => n + 1);
  }

  async function loadMeta() {
    setLoadingMeta(true);
    try {
      const res = await fetch(`/api/arquivos/${arquivoId}/metadados`, {
        credentials: "include",
        cache: "no-store",
      });
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
      const res = await fetch(`/api/arquivos/${arquivoId}/eventos`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error(data?.message || "Erro ao carregar eventos.");
        setEventos([]);
        return;
      }
      const arr = Array.isArray(data) ? data : [];
      setEventos(arr);
      setOpenEvents({});
    } catch {
      toast.error("Falha de rede ao carregar eventos.");
      setEventos([]);
    } finally {
      setLoadingEvt(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(arquivoId) || arquivoId <= 0) {
      toast.error("ID do arquivo inválido.");
      navigate("/app/processos");
      return;
    }
    loadMeta();
    loadEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivoId, navigate]);

  async function updateEventoPages(eventoId: number, pages: number[]) {
    setSavingPages((p) => ({ ...p, [eventoId]: true }));
    try {
      const res = await fetch(`/api/eventos/${eventoId}/pages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pages }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "Erro ao atualizar páginas.");
        return;
      }

      const newJson = String(data?.pages_json ?? JSON.stringify(pages));
      setEventos((prev) => prev.map((e) => (e.id === eventoId ? { ...e, evento_pages_json: newJson } : e)));

      toast.success("Páginas atualizadas.");
    } catch {
      toast.error("Falha de rede ao atualizar páginas.");
    } finally {
      setSavingPages((p) => ({ ...p, [eventoId]: false }));
    }
  }

  function addPages(eventoId: number, current: number[]) {
    const input = (pageInput[eventoId] || "").trim();
    const toAdd = parseInputPages(input);

    if (toAdd.length === 0) {
      toast.error("Digite páginas (ex.: 4 ou 4, 5, 10).");
      return;
    }

    const merged = Array.from(new Set([...current, ...toAdd])).sort((a, b) => a - b);
    setPageInput((p) => ({ ...p, [eventoId]: "" }));
    updateEventoPages(eventoId, merged);
  }

  function removePage(eventoId: number, page: number, current: number[]) {
    const next = current.filter((p) => p !== page);
    updateEventoPages(eventoId, next);

    if (pdfPage === page) {
      setPdfPage(null);
      setPdfNonce((n) => n + 1);
    }
  }

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
        {/* PDF (60%) */}
        <section className={styles.viewerCard} aria-label="Visualização do PDF">
          <div className={styles.viewerHeader}>
            <span className={styles.viewerTitle}>PDF</span>

            <div className={styles.viewerActions}>
              {pdfPage ? (
                <span className={styles.viewerPage}>
                  Página: <b>{pdfPage}</b>
                </span>
              ) : null}

              <a className={styles.viewerLink} href={pdfBaseUrl} target="_blank" rel="noreferrer">
                Abrir em nova aba
              </a>
            </div>
          </div>

          {/* ✅ object é mais confiável que iframe para #page */}
          <object
            key={`pdf-${arquivoId}-${pdfNonce}-${pdfPage ?? 0}`}
            className={styles.pdfObject}
            data={pdfSrc}
            type="application/pdf"
            aria-label="PDF"
          >
            <div className={styles.state}>
              Seu navegador não conseguiu exibir o PDF aqui.{" "}
              <a href={pdfBaseUrl} target="_blank" rel="noreferrer">
                Abrir em nova aba
              </a>
            </div>
          </object>
        </section>

        {/* Direita (40%) */}
        <aside className={styles.side} aria-label="Detalhes do arquivo">
          {/* Metadados */}
          <section className={styles.card}>
            <button
              type="button"
              className={styles.collapseHeader}
              onClick={() => setMetaOpen((v) => !v)}
              aria-expanded={metaOpen}
            >
              <span className={styles.cardTitle}>Metadados</span>
              {metaOpen ? <ChevronUp className={styles.chev} aria-hidden="true" /> : <ChevronDown className={styles.chev} aria-hidden="true" />}
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
          <section className={`${styles.card} ${styles.eventsCard}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Eventos</span>
            </div>

            <div className={styles.cardBody}>
              {loadingEvt ? (
                <div className={styles.state}>Carregando eventos...</div>
              ) : eventos.length === 0 ? (
                <div className={styles.state}>Nenhum evento registrado para este arquivo.</div>
              ) : (
                <div className={styles.eventList}>
                  {eventos.map((e) => {
                    const isOpen = !!openEvents[e.id];
                    const isProcessed = (e.status_nome || "").toLowerCase() === "processado";
                    const pagesEvento = isProcessed ? parsePages(e.evento_pages_json) : [];
                    const busy = !!savingPages[e.id];

                    return (
                      <div key={e.id} className={styles.eventItem}>
                        <button type="button" className={styles.eventHeader} onClick={() => toggleEvent(e.id)} aria-expanded={isOpen}>
                          <div className={styles.eventHeaderLeft}>
                            <div className={styles.eventTitleRow}>
                              <span className={styles.eventTitle}>{e.nome}</span>
                              <span className={styles.eventBadge}>{statusLabel(e.status_nome)}</span>
                            </div>
                            <div className={styles.eventSub}>
                              <span className={styles.eventMuted}>Criado em: {fmtDate(e.created_at)}</span>
                              {e.procurador_nome ? <span className={styles.eventMuted}>• Procurador: {e.procurador_nome}</span> : null}
                            </div>
                          </div>

                          {isOpen ? <ChevronUp className={styles.chev} aria-hidden="true" /> : <ChevronDown className={styles.chev} aria-hidden="true" />}
                        </button>

                        {isOpen ? (
                          <div className={styles.eventBody}>
                            {!isProcessed ? (
                              <div className={styles.state}>
                                Páginas só aparecem quando o status estiver como <b>Processado</b>.
                              </div>
                            ) : (
                              <div className={styles.eventSection}>
                                <div className={styles.eventSectionTitle}>Páginas</div>

                                <div className={styles.pagesRow}>
                                  {pagesEvento.length === 0 ? (
                                    <span className={styles.pagesEmpty}>—</span>
                                  ) : (
                                    pagesEvento.map((p) => (
                                      <div key={p} className={styles.pagePill}>
                                        <button
                                          type="button"
                                          className={`${styles.pageChip} ${pdfPage === p ? styles.pageChipActive : ""}`}
                                          onClick={() => goToPdfPage(p)}
                                          title={`Exibir página ${p} no PDF`}
                                        >
                                          {p}
                                        </button>

                                        <button
                                          type="button"
                                          className={styles.pageRemove}
                                          onClick={() => removePage(e.id, p, pagesEvento)}
                                          disabled={busy}
                                          title="Remover página"
                                        >
                                          <X className={styles.pageRemoveIcon} aria-hidden="true" />
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>

                                <div className={styles.pageEditor}>
                                  <input
                                    className={styles.pageInput}
                                    value={pageInput[e.id] || ""}
                                    onChange={(ev) => setPageInput((p) => ({ ...p, [e.id]: ev.target.value }))}
                                    placeholder="Adicionar páginas: 4 ou 4, 5, 10"
                                    disabled={busy}
                                  />
                                  <button
                                    type="button"
                                    className={styles.pageAddBtn}
                                    onClick={() => addPages(e.id, pagesEvento)}
                                    disabled={busy}
                                    title="Adicionar"
                                  >
                                    <Plus className={styles.pageAddIcon} aria-hidden="true" />
                                    {busy ? "Salvando..." : "Adicionar"}
                                  </button>
                                </div>

                                <div className={styles.pagesHint}>Clique no número para exibir a página no PDF.</div>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
