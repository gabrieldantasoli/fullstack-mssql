import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  KeyRound,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react";
import styles from "./index.module.css";

type AcessoRow = {
  solicitacao_id: number;
  gabinete_id: number;
  gabinete_nome: string;
  acesso_id: number;
  acesso_nome: "viewer" | "editor" | "admin";
  created_at: string;
  is_owner: number; // 1/0
};

type SortMode = "recent" | "gab_az" | "gab_za";

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function acessoLabel(a: string) {
  if (a === "admin") return "Admin";
  if (a === "editor") return "Editor";
  if (a === "viewer") return "Visualizador";
  return a;
}

export default function Acessos() {
  const [items, setItems] = useState<AcessoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

  const [pageSize, setPageSize] = useState<5 | 10 | 20 | 30>(10);
  const [page, setPage] = useState(1);

  // editar
  const [editOpen, setEditOpen] = useState(false);
  const [editGabId, setEditGabId] = useState<number | null>(null);
  const [editGabNome, setEditGabNome] = useState("");
  const [editAcesso, setEditAcesso] = useState<"viewer" | "editor" | "admin">("viewer");
  const [acting, setActing] = useState(false);

  // remover
  const [delOpen, setDelOpen] = useState(false);
  const [delGabId, setDelGabId] = useState<number | null>(null);
  const [delGabNome, setDelGabNome] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/meus-acessos", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error(data?.message || "Erro ao carregar acessos.");
        setItems([]);
        return;
      }
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Falha de rede ao carregar acessos.");
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
      arr = arr.filter((x) => {
        const a = (x.gabinete_nome || "").toLowerCase();
        const b = (x.acesso_nome || "").toLowerCase();
        return a.includes(query) || b.includes(query);
      });
    }

    switch (sort) {
      case "gab_az":
        arr.sort((x, y) => x.gabinete_nome.localeCompare(y.gabinete_nome));
        break;
      case "gab_za":
        arr.sort((x, y) => y.gabinete_nome.localeCompare(x.gabinete_nome));
        break;
      case "recent":
      default:
        arr.sort((x, y) => y.solicitacao_id - x.solicitacao_id);
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

  function openEdit(row: AcessoRow) {
    if (row.is_owner === 1) {
      toast.error("Você é dono deste gabinete. Não é permitido alterar esse acesso.");
      return;
    }
    setEditGabId(row.gabinete_id);
    setEditGabNome(row.gabinete_nome);
    setEditAcesso(row.acesso_nome);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editGabId) return;
    setActing(true);
    try {
      const res = await fetch(`/api/meus-acessos/${editGabId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ acesso_nome: editAcesso }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "Erro ao editar acesso.");
        return;
      }
      toast.success("Acesso atualizado.");
      setEditOpen(false);
      await load();
    } catch {
      toast.error("Falha de rede ao editar acesso.");
    } finally {
      setActing(false);
    }
  }

  function openDelete(row: AcessoRow) {
    if (row.is_owner === 1) {
      toast.error("Você é dono deste gabinete. Não é permitido remover esse acesso.");
      return;
    }
    setDelGabId(row.gabinete_id);
    setDelGabNome(row.gabinete_nome);
    setDelOpen(true);
  }

  async function confirmDelete() {
    if (!delGabId) return;
    setActing(true);
    try {
      const res = await fetch(`/api/meus-acessos/${delGabId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message || "Erro ao remover acesso.");
        return;
      }
      toast.success("Acesso removido.");
      setDelOpen(false);
      await load();
    } catch {
      toast.error("Falha de rede ao remover acesso.");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.titleIcon}>
            <KeyRound className={styles.icon} aria-hidden="true" />
          </div>
          <div>
            <h1 className={styles.title}>Meus acessos</h1>
            <p className={styles.subtitle}>Veja e gerencie seus acessos aprovados aos gabinetes.</p>
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
            placeholder="Filtrar por gabinete ou tipo de acesso..."
          />
        </div>

        <div className={styles.sort}>
          <SlidersHorizontal className={styles.sortIcon} aria-hidden="true" />
          <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="recent">Mais recentes</option>
            <option value="gab_az">Gabinete A–Z</option>
            <option value="gab_za">Gabinete Z–A</option>
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
          <div className={styles.state}>Nenhum acesso aprovado encontrado.</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Gabinete</th>
                  <th>Acesso</th>
                  <th>Desde</th>
                  <th style={{ width: 140, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.solicitacao_id}>
                    <td className={styles.tdStrong}>
                      {r.gabinete_nome}
                      {r.is_owner === 1 ? <span className={styles.ownerBadge}>Dono</span> : null}
                    </td>
                    <td className={styles.badgeCell}>
                      <span className={styles.badge}>{acessoLabel(r.acesso_nome)}</span>
                    </td>
                    <td className={styles.tdMuted}>{fmtDate(r.created_at)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => openEdit(r)}
                          title={r.is_owner === 1 ? "Não é permitido editar acesso do dono" : "Editar acesso"}
                          disabled={acting || r.is_owner === 1}
                        >
                          <Pencil className={styles.btnIcon} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          className={styles.iconBtnDanger}
                          onClick={() => openDelete(r)}
                          title={r.is_owner === 1 ? "Não é permitido remover acesso do dono" : "Remover acesso"}
                          disabled={acting || r.is_owner === 1}
                        >
                          <Trash2 className={styles.btnIcon} aria-hidden="true" />
                        </button>
                      </div>
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

      {/* Modal editar */}
      {editOpen && (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Editar acesso">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Editar acesso</h2>
              <button className={styles.closeBtn} onClick={() => setEditOpen(false)} type="button">
                ✕
              </button>
            </div>

            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Gabinete</label>
                <div className={styles.readonly}>{editGabNome}</div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Tipo de acesso</label>
                <select className={styles.select} value={editAcesso} onChange={(e) => setEditAcesso(e.target.value as any)} disabled={acting}>
                  <option value="viewer">Visualizador</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.secondaryBtn} onClick={() => setEditOpen(false)} type="button" disabled={acting}>
                  Cancelar
                </button>
                <button className={styles.primaryBtn} onClick={saveEdit} type="button" disabled={acting}>
                  {acting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal remover */}
      {delOpen && (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Remover acesso">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Remover acesso</h2>
              <button className={styles.closeBtn} onClick={() => setDelOpen(false)} type="button">
                ✕
              </button>
            </div>

            <div className={styles.form}>
              <p className={styles.confirmText}>
                Tem certeza que deseja remover seu acesso ao gabinete <b>{delGabNome}</b>?
              </p>

              <div className={styles.modalFooter}>
                <button className={styles.secondaryBtn} onClick={() => setDelOpen(false)} type="button" disabled={acting}>
                  Cancelar
                </button>
                <button className={styles.dangerBtn} onClick={confirmDelete} type="button" disabled={acting}>
                  {acting ? "Removendo..." : "Remover"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
