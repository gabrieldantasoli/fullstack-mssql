import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Search,
  SlidersHorizontal,
  Inbox,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Eye,
  User,
  Building2,
  Shield,
  CalendarClock,
} from "lucide-react";
import styles from "./index.module.css";

type SolicitacaoRow = {
  id: number;
  user_id: number;
  user_nome: string;
  gabinete_id: number;
  gabinete_nome: string;
  acesso_id: number;
  acesso_nome: string;
  atendido: number | null;
  msg_pedido: string | null;
  created_at: string;
};

type SortMode = "recent" | "oldest" | "gab_az" | "gab_za";

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function SolicitacoesPage() {
  const [items, setItems] = useState<SolicitacaoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

  const [pageSize, setPageSize] = useState<5 | 10 | 20 | 30>(10);
  const [page, setPage] = useState(1);

  // modal detalhes
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SolicitacaoRow | null>(null);

  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/solicitacoes", { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error(data?.message || "Erro ao carregar solicitações.");
        setItems([]);
        return;
      }
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Falha de rede ao carregar solicitações.");
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
      arr = arr.filter((s) => {
        const a = (s.user_nome || "").toLowerCase();
        const b = (s.gabinete_nome || "").toLowerCase();
        const c = (s.acesso_nome || "").toLowerCase();
        const d = (s.msg_pedido || "").toLowerCase();
        return a.includes(query) || b.includes(query) || c.includes(query) || d.includes(query);
      });
    }

    switch (sort) {
      case "gab_az":
        arr.sort((x, y) => x.gabinete_nome.localeCompare(y.gabinete_nome));
        break;
      case "gab_za":
        arr.sort((x, y) => y.gabinete_nome.localeCompare(x.gabinete_nome));
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

  function openDetails(row: SolicitacaoRow) {
    setSelected(row);
    setOpen(true);
  }

  function closeDetails() {
    setOpen(false);
    setSelected(null);
  }

  async function approve(id: number) {
    setActing(true);
    try {
      const res = await fetch(`/api/solicitacoes/${id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "Erro ao aprovar.");
        return;
      }
      toast.success("Solicitação aprovada.");
      closeDetails();
      await load();
    } catch {
      toast.error("Falha de rede ao aprovar.");
    } finally {
      setActing(false);
    }
  }

  async function reject(id: number) {
    setActing(true);
    try {
      // ✅ sem body (não existe mais msg de rejeição)
      const res = await fetch(`/api/solicitacoes/${id}/reject`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "Erro ao rejeitar.");
        return;
      }
      toast.success("Solicitação rejeitada.");
      closeDetails();
      await load();
    } catch {
      toast.error("Falha de rede ao rejeitar.");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.titleIcon}>
            <Inbox className={styles.icon} aria-hidden="true" />
          </div>
          <div>
            <h1 className={styles.title}>Solicitações</h1>
            <p className={styles.subtitle}>Pedidos de acesso pendentes aos gabinetes em que você é admin.</p>
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
            placeholder="Filtrar por usuário, gabinete, acesso ou mensagem..."
          />
        </div>

        <div className={styles.sort}>
          <SlidersHorizontal className={styles.sortIcon} aria-hidden="true" />
          <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
            <option value="gab_az">Gabinete A–Z</option>
            <option value="gab_za">Gabinete Z–A</option>
          </select>
        </div>

        <div className={styles.sort}>
          <span className={styles.pagerLabel}>Por página</span>
          <select
            className={styles.select}
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) as any)}
            aria-label="Itens por página"
          >
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
          <div className={styles.state}>Nenhuma solicitação pendente.</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Gabinete</th>
                  <th>Acesso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((s) => (
                  <tr key={s.id}>
                    <td className={styles.tdStrong}>{s.user_nome}</td>
                    <td className={styles.tdMuted}>{s.gabinete_nome}</td>
                    <td className={styles.badgeCell}>
                      <span className={styles.badge}>{s.acesso_nome}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.eyeBtn}
                        onClick={() => openDetails(s)}
                        aria-label="Ver solicitação"
                        title="Ver solicitação"
                      >
                        <Eye className={styles.eyeIcon} aria-hidden="true" />
                      </button>
                    </td>
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

      {/* Modal detalhes (card) */}
      {open && selected && (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Detalhes da solicitação">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Solicitação</h2>
              <button className={styles.closeBtn} onClick={closeDetails} type="button">
                ✕
              </button>
            </div>

            <div className={styles.form}>
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <User className={styles.detailIcon} aria-hidden="true" />
                  <div>
                    <div className={styles.detailLabel}>Usuário</div>
                    <div className={styles.detailValue}>{selected.user_nome}</div>
                  </div>
                </div>

                <div className={styles.detailItem}>
                  <Building2 className={styles.detailIcon} aria-hidden="true" />
                  <div>
                    <div className={styles.detailLabel}>Gabinete</div>
                    <div className={styles.detailValue}>{selected.gabinete_nome}</div>
                  </div>
                </div>

                <div className={styles.detailItem}>
                  <Shield className={styles.detailIcon} aria-hidden="true" />
                  <div>
                    <div className={styles.detailLabel}>Acesso solicitado</div>
                    <div className={styles.detailValue}>
                      <span className={styles.badge}>{selected.acesso_nome}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.detailItem}>
                  <CalendarClock className={styles.detailIcon} aria-hidden="true" />
                  <div>
                    <div className={styles.detailLabel}>Data</div>
                    <div className={styles.detailValue}>{fmtDate(selected.created_at)}</div>
                  </div>
                </div>
              </div>

              <div className={styles.msgBox} aria-label="Mensagem do requerimento">
                <div className={styles.msgTitle}>Mensagem do requerimento</div>
                <div className={styles.msgText}>
                  {selected.msg_pedido?.trim()?.length ? selected.msg_pedido : "Sem mensagem de requerimento."}
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.rejectBtn} onClick={() => reject(selected.id)} type="button" disabled={acting}>
                  <XCircle className={styles.btnIcon} aria-hidden="true" />
                  {acting ? "Aguarde..." : "Rejeitar"}
                </button>

                <button className={styles.approveBtn} onClick={() => approve(selected.id)} type="button" disabled={acting}>
                  <CheckCircle2 className={styles.btnIcon} aria-hidden="true" />
                  {acting ? "Aguarde..." : "Aprovar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
