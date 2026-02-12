import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Send,
  ArrowUpSquare,
  Eye,
} from "lucide-react";
import styles from "./index.module.css";

type Row = {
  id: number;
  nome: string;
  descricao: string | null;
  owner_id: number;
  owner_nome: string;

  minha_solicitacao_id: number | null;
  minha_atendido: number | null; // null pendente, 1 aprovado, 0 rejeitado (e null se não existe via minha_solicitacao_id)
  meu_acesso_nome: string | null;
  minha_msg_pedido: string | null;
  minha_created_at: string | null;
};

type SortMode = "recent" | "oldest" | "az" | "za";

function normalizeStatus(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function statusText(r: Row) {
  if (!r.minha_solicitacao_id) return "Sem solicitação";
  if (r.minha_atendido === null) return "Pendente";
  if (r.minha_atendido === 1) return `Aprovado (${r.meu_acesso_nome || "—"})`;
  return "Rejeitado";
}

function statusClass(r: Row) {
  if (!r.minha_solicitacao_id) return styles.badgeNeutral;
  if (r.minha_atendido === null) return styles.badgeNeutral;
  if (r.minha_atendido === 1) return styles.badgeSuccess;
  return styles.badgeDanger;
}

export default function GabinetesTodosPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

  const [pageSize, setPageSize] = useState<5 | 10 | 20 | 30>(10);
  const [page, setPage] = useState(1);

  // modal solicitar
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Row | null>(null);
  const [acesso, setAcesso] = useState<"viewer" | "editor" | "admin">("viewer");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/gabinetes/all", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error(data?.message || "Erro ao carregar gabinetes.");
        setItems([]);
        return;
      }
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Falha de rede ao carregar gabinetes.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, sort, pageSize]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let arr = [...items];

    if (query) {
      arr = arr.filter((g) => {
        const a = (g.nome || "").toLowerCase();
        const b = (g.descricao || "").toLowerCase();
        const c = (g.owner_nome || "").toLowerCase();
        return a.includes(query) || b.includes(query) || c.includes(query);
      });
    }

    switch (sort) {
      case "az":
        arr.sort((x, y) => x.nome.localeCompare(y.nome));
        break;
      case "za":
        arr.sort((x, y) => y.nome.localeCompare(x.nome));
        break;
      case "oldest":
        arr.sort((x, y) => x.id - y.id);
        break;
      case "recent":
      default:
        arr.sort((x, y) => y.id - x.id);
        break;
    }

    return arr;
  }, [items, q, sort]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  function prevPage() {
    setPage((p) => Math.max(1, p - 1));
  }

  function nextPage() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  function canRequest(r: Row) {
    // Pode solicitar se não existe ou foi rejeitado (0).
    // Se pendente (null) ou aprovado (1), bloqueia.
    if (!r.minha_solicitacao_id) return true;
    if (r.minha_atendido === 0) return true;
    return false;
  }

  function openModal(r: Row) {
    setTarget(r);
    setAcesso("viewer");
    setMsg("");
    setOpen(true);
  }

  async function submitRequest() {
    if (!target) return;

    setSending(true);
    try {
      const res = await fetch("/api/solicitacoes/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          gabinete_id: target.id,
          acesso_nome: acesso,
          msg_pedido: msg.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.message || "Erro ao solicitar acesso.");
        return;
      }

      toast.success("Solicitação enviada!");
      setOpen(false);
      await load();
    } catch {
      toast.error("Falha de rede ao solicitar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.titleIcon}>
            <ArrowUpSquare className={styles.icon} aria-hidden="true" />
          </div>
          <div>
            <h1 className={styles.title}>Todos os gabinetes</h1>
            <p className={styles.subtitle}>
              Explore gabinetes de outros usuários e solicite acesso com o nível desejado.
            </p>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            className={styles.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por gabinete, descrição ou dono..."
          />
        </div>

        <div className={styles.sort}>
          <SlidersHorizontal className={styles.sortIcon} aria-hidden="true" />
          <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="az">A–Z</option>
            <option value="za">Z–A</option>
          </select>
        </div>

        <div className={styles.sort}>
          <span className={styles.pagerLabel}>Por página</span>
          <select className={styles.select} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) as any)}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
          </select>
        </div>
      </div>

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.state}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className={styles.state}>Nenhum gabinete encontrado.</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Gabinete</th>
                  <th>Descrição</th>
                  <th>Dono</th>
                  <th>Status</th>
                  <th className={styles.thActions}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((g) => (
                  <tr key={g.id}>
                    <td className={styles.tdStrong}>{g.nome}</td>
                    <td className={styles.tdMuted}>{g.descricao || "—"}</td>
                    <td className={styles.tdMuted}>{g.owner_nome}</td>
                    <td className={styles.badgeCell}>
                      <span className={`${styles.badge} ${statusClass(g)}`}>{statusText(g)}</span>
                    </td>
                    <td className={styles.tdActions}>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={() => openModal(g)}
                        disabled={!canRequest(g)}
                        title={!canRequest(g) ? "Você já tem uma solicitação pendente ou acesso aprovado." : "Solicitar acesso"}
                      >
                        <KeyRound className={styles.btnIcon} aria-hidden="true" />
                        Solicitar
                      </button>

                      <button
                        type="button"
                        className={styles.ghostBtn}
                        onClick={() => navigate(`/app/gabinetes/${g.id}`)}
                        title="Abrir gabinete"
                      >
                        <Eye className={styles.btnIcon} aria-hidden="true" />
                        Abrir
                      </button>                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.tableFooter}>
              <button type="button" className={styles.pageBtn} onClick={prevPage} disabled={page <= 1} aria-label="Página anterior">
                <ChevronLeft className={styles.pageIcon} aria-hidden="true" />
              </button>

              <span className={styles.pageInfo}>
                Página <b>{page}</b> de <b>{totalPages}</b>
              </span>

              <button type="button" className={styles.pageBtn} onClick={nextPage} disabled={page >= totalPages} aria-label="Próxima página">
                <ChevronRight className={styles.pageIcon} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal solicitar acesso */}
      {open && target && (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Solicitar acesso">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Solicitar acesso</h2>
              <button className={styles.closeBtn} onClick={() => setOpen(false)} type="button">
                ✕
              </button>
            </div>

            <div className={styles.form}>
              <div className={styles.modalInfo}>
                <div className={styles.modalLine}><b>Gabinete:</b> {target.nome}</div>
                <div className={styles.modalLine}><b>Dono:</b> {target.owner_nome}</div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Tipo de acesso *</label>
                <select className={styles.selectSolid} value={acesso} onChange={(e) => setAcesso(e.target.value as any)}>
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option>
                  <option value="admin">admin</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Mensagem (opcional)</label>
                <textarea
                  className={styles.textarea}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="Explique por que precisa do acesso..."
                  rows={4}
                  maxLength={500}
                />
                <div className={styles.counter}>{msg.length}/500</div>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.secondaryBtn} onClick={() => setOpen(false)} type="button" disabled={sending}>
                  Cancelar
                </button>
                <button className={styles.primaryBtn} onClick={submitRequest} type="button" disabled={sending}>
                  <Send className={styles.btnIcon} aria-hidden="true" />
                  {sending ? "Enviando..." : "Enviar solicitação"}
                </button>
              </div>

              <p className={styles.hint}>
                A solicitação ficará <b>pendente</b> até um admin do gabinete aprovar ou rejeitar.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
