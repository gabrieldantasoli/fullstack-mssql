import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Files,
  Plus,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  FileDown,
} from "lucide-react";
import styles from "./index.module.css";

type ArquivoRow = {
  id: number;
  nome_processo: string;
  descricao: string | null;
  status_arquivo_id: number;
  status_nome: string;
  gabinete_id: number;
  gabinete_nome: string;
  created_at: string;
};

type StatusRow = { id: number; nome: string };
type GabineteRow = { id: number; nome: string };

type SortMode = "recent" | "oldest" | "az" | "za";

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function ProcessosPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<ArquivoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [gabs, setGabs] = useState<GabineteRow[]>([]);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [statusFilter, setStatusFilter] = useState<number | "all">("all");
  const [gabFilter, setGabFilter] = useState<number | "all">("all");

  const [pageSize, setPageSize] = useState<5 | 10 | 20 | 30>(10);
  const [page, setPage] = useState(1);

  async function loadLookups() {
    try {
      const [stRes, gbRes] = await Promise.all([
        fetch("/api/status-arquivo", { credentials: "include" }),
        fetch("/api/gabinetes/accessible", { credentials: "include" }),
      ]);

      const st = await stRes.json().catch(() => []);
      const gb = await gbRes.json().catch(() => []);

      if (stRes.ok) setStatuses(Array.isArray(st) ? st : []);
      if (gbRes.ok) setGabs((Array.isArray(gb) ? gb : []).map((x: any) => ({ id: x.id, nome: x.nome })));
    } catch {
      // lookups não são críticos
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/arquivos", { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error(data?.message || "Erro ao carregar processos.");
        setItems([]);
        return;
      }
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Falha de rede ao carregar processos.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLookups();
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, sort, statusFilter, gabFilter, pageSize]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let arr = [...items];

    if (query) {
      arr = arr.filter((a) => {
        const x = (a.nome_processo || "").toLowerCase();
        const y = (a.descricao || "").toLowerCase();
        const z = (a.gabinete_nome || "").toLowerCase();
        const w = (a.status_nome || "").toLowerCase();
        return x.includes(query) || y.includes(query) || z.includes(query) || w.includes(query);
      });
    }

    if (statusFilter !== "all") {
      arr = arr.filter((a) => a.status_arquivo_id === statusFilter);
    }

    if (gabFilter !== "all") {
      arr = arr.filter((a) => a.gabinete_id === gabFilter);
    }

    switch (sort) {
      case "az":
        arr.sort((x, y) => x.nome_processo.localeCompare(y.nome_processo));
        break;
      case "za":
        arr.sort((x, y) => y.nome_processo.localeCompare(x.nome_processo));
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
  }, [items, q, sort, statusFilter, gabFilter]);

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

  async function openPdf(id: number) {
    try {
      const res = await fetch(`/api/arquivos/${id}/pdf`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message || "Erro ao abrir PDF.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Falha de rede ao abrir PDF.");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.titleIcon}>
            <Files className={styles.icon} aria-hidden="true" />
          </div>
          <div>
            <h1 className={styles.title}>Processos</h1>
            <p className={styles.subtitle}>Liste e cadastre arquivos (PDF) vinculados aos gabinetes.</p>
          </div>
        </div>

        <button className={styles.primaryBtn} onClick={() => navigate("/app/processos/novo")} type="button">
          <Plus className={styles.btnIcon} aria-hidden="true" />
          Adicionar arquivos
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            className={styles.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por processo, gabinete, status..."
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
          <span className={styles.pagerLabel}>Status</span>
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">Todos</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.sort}>
          <span className={styles.pagerLabel}>Gabinete</span>
          <select
            className={styles.select}
            value={gabFilter}
            onChange={(e) => setGabFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">Todos</option>
            {gabs.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
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
          <div className={styles.state}>Nenhum processo encontrado.</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Processo</th>
                  <th>Gabinete</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th style={{ width: 90, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((a) => (
                  <tr key={a.id}>
                    <td className={styles.tdStrong}>{a.nome_processo}</td>
                    <td className={styles.tdMuted}>{a.gabinete_nome}</td>
                    <td className={styles.badgeCell}>
                      <span className={styles.badge}>{a.status_nome}</span>
                    </td>
                    <td className={styles.tdMuted}>{fmtDate(a.created_at)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className={styles.ghostBtn} type="button" onClick={() => openPdf(a.id)} title="Abrir PDF">
                        <FileDown className={styles.btnIcon} aria-hidden="true" />
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
    </div>
  );
}
