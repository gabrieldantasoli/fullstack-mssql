import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Search, SlidersHorizontal, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./index.module.css";

type Gabinete = {
  id: number;
  nome: string;
  descricao: string | null;
  user_id: number;
};

type SortMode = "recent" | "oldest" | "az" | "za";

export default function GabinetesPage() {
  const [items, setItems] = useState<Gabinete[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

  const [pageSize, setPageSize] = useState<5 | 10 | 20 | 30>(5);
  const [page, setPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/gabinetes", { credentials: "include" });
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
        return a.includes(query) || b.includes(query);
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

  function openModal() {
    setNome("");
    setDescricao("");
    setOpen(true);
  }

  async function createGabinete() {
    const n = nome.trim();
    const d = descricao.trim();

    if (!n) {
      toast.error("Informe o nome do gabinete.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/gabinetes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nome: n, descricao: d || null }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.message || "Erro ao criar gabinete.");
        return;
      }

      toast.success("Gabinete criado com sucesso!");
      setOpen(false);
      await load();
      setPage(1);
    } catch {
      toast.error("Falha de rede ao criar gabinete.");
    } finally {
      setSaving(false);
    }
  }

  function prevPage() {
    setPage((p) => Math.max(1, p - 1));
  }

  function nextPage() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.titleIcon}>
            <Building2 className={styles.icon} aria-hidden="true" />
          </div>
          <div>
            <h1 className={styles.title}>Meus Gabinetes</h1>
            <p className={styles.subtitle}>Gerencie seus gabinetes.</p>
          </div>
        </div>

        <button className={styles.primaryBtn} onClick={openModal} type="button">
          <Plus className={styles.btnIcon} aria-hidden="true" />
          Novo gabinete
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            className={styles.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por nome ou descrição..."
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
          <div className={styles.state}>Nenhum gabinete encontrado.</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((g) => (
                  <tr key={g.id}>
                    <td className={styles.tdStrong}>{g.nome}</td>
                    <td className={styles.tdMuted}>{g.descricao || "—"}</td>
                    <td>
                      <button type="button" className={styles.ghostBtn} onClick={() => toast("Abrir gabinete: em breve 🙂")}>
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.tableFooter}>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={prevPage}
                disabled={page <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft className={styles.pageIcon} aria-hidden="true" />
              </button>

              <span className={styles.pageInfo}>
                Página <b>{page}</b> de <b>{totalPages}</b>
              </span>

              <button
                type="button"
                className={styles.pageBtn}
                onClick={nextPage}
                disabled={page >= totalPages}
                aria-label="Próxima página"
              >
                <ChevronRight className={styles.pageIcon} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>

      {open && (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Criar gabinete">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Novo gabinete</h2>
              <button className={styles.closeBtn} onClick={() => setOpen(false)} type="button">
                ✕
              </button>
            </div>

            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Nome *</label>
                <input className={styles.input} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Gabinete Central" />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Descrição</label>
                <textarea className={styles.textarea} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" rows={4} />
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.secondaryBtn} onClick={() => setOpen(false)} type="button" disabled={saving}>
                  Cancelar
                </button>
                <button className={styles.primaryBtn} onClick={createGabinete} type="button" disabled={saving}>
                  {saving ? "Criando..." : "Criar"}
                </button>
              </div>

              <p className={styles.hint}>
                Ao criar, o sistema gera automaticamente uma <b>solicitação atendida</b> com acesso <b>admin</b> para você.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
