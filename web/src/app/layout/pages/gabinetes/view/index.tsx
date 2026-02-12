import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Building2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FileText, Trash2, Users } from "lucide-react";
import styles from "./index.module.css";

type GabineteDetails = {
  id: number;
  nome: string;
  descricao: string | null;
  user_id: number; // dono
};

type MeInfo = {
  user_id: number;
  is_owner: 0 | 1;
  acesso_nome: "viewer" | "editor" | "admin";
};

type GabUser = {
  user_id: number;
  user_nome: string;
  acesso_nome: "viewer" | "editor" | "admin";
  is_owner: 0 | 1; // 1/0
};

type OpenPayload = {
  gabinete: GabineteDetails;
  me: MeInfo;
  usuarios: GabUser[];
};

type ProcessoRow = {
  id: number;
  gabinete_id: number;

  numero?: string | null;
  nome?: string | null;
  titulo?: string | null;
  original_filename?: string | null;

  created_at?: string | null;
  uploaded_at?: string | null;
};

function acessoLabel(a: string) {
  if (a === "admin") return "Admin";
  if (a === "editor") return "Editor";
  if (a === "viewer") return "Visualizador";
  return a;
}

function canRemove(me: MeInfo, row: GabUser) {
  if (row.is_owner === 1) return false; // nunca remove dono
  const myRole = (me.acesso_nome || "").toLowerCase();
  const targetRole = (row.acesso_nome || "").toLowerCase();

  if (me.is_owner === 1) return true; // dono remove qualquer um (exceto dono)
  if (myRole === "admin") return targetRole !== "admin"; // admin não remove admin
  return false; // viewer/editor não remove ninguém
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

async function fetchFirstOk<T = any>(urls: string[]): Promise<T> {
  let lastErr: any = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok) return data as T;
      lastErr = data || { message: `HTTP ${res.status}` };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export default function GabineteOpenPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const gabineteId = useMemo(() => Number(id), [id]);

  const [gab, setGab] = useState<GabineteDetails | null>(null);
  const [me, setMe] = useState<MeInfo | null>(null);

  const [users, setUsers] = useState<GabUser[]>([]);
  const [processos, setProcessos] = useState<ProcessoRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingProc, setLoadingProc] = useState(true);

  // collapse
  const [usersOpen, setUsersOpen] = useState(true);
  const [procOpen, setProcOpen] = useState(true);

  // remover permissão
  const [remOpen, setRemOpen] = useState(false);
  const [remUser, setRemUser] = useState<GabUser | null>(null);
  const [acting, setActing] = useState(false);

  // paginação usuários
  const [usersPageSize, setUsersPageSize] = useState<5 | 10 | 20 | 30>(5);
  const [usersPage, setUsersPage] = useState(1);

  // paginação processos
  const [procPageSize, setProcPageSize] = useState<5 | 10 | 20 | 30>(5);
  const [procPage, setProcPage] = useState(1);

  async function loadAll() {
    setLoading(true);
    setLoadingProc(true);

    try {
      const res = await fetch(`/api/gabinetes/${gabineteId}/open`, { credentials: "include", cache: "no-store" });
      const data = (await res.json().catch(() => null)) as OpenPayload | null;

      if (!res.ok || !data?.gabinete || !data?.me) {
        toast.error((data as any)?.message || "Erro ao carregar gabinete.");
        setGab(null);
        setMe(null);
        setUsers([]);
        setProcessos([]);
        return;
      }

      setGab(data.gabinete);
      setMe(data.me);
      setUsers(Array.isArray(data.usuarios) ? data.usuarios : []);

      setProcPage(1);

      try {
        const all = await fetchFirstOk<any[]>([
          "/api/processos",
          "/api/arquivos",
        ]);

        const arr = Array.isArray(all) ? all : [];
        const onlyThis = arr
          .map((x) => x as ProcessoRow)
          .filter((p) => Number(p.gabinete_id) === gabineteId);

        setProcessos(onlyThis);
      } catch {
        setProcessos([]);
      } finally {
        setLoadingProc(false);
      }
    } catch {
      toast.error("Falha de rede ao carregar gabinete.");
      setGab(null);
      setMe(null);
      setUsers([]);
      setProcessos([]);
      setLoadingProc(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(gabineteId) || gabineteId <= 0) {
      toast.error("ID do gabinete inválido.");
      navigate("/app/gabinetes");
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gabineteId, navigate]);

  function openRemove(u: GabUser) {
    if (!me) return;

    if (!canRemove(me, u)) {
      if (u.is_owner === 1) toast.error("Não é permitido remover o dono do gabinete.");
      else if (me.is_owner === 0 && me.acesso_nome === "admin" && u.acesso_nome === "admin")
        toast.error("Admin não pode remover permissão de outro admin.");
      else toast.error("Você não tem permissão para remover este usuário.");
      return;
    }

    setRemUser(u);
    setRemOpen(true);
  }

  async function confirmRemove() {
    if (!remUser || !me) return;
    setActing(true);

    try {
      const res = await fetch(`/api/gabinetes/${gabineteId}/permissoes/${remUser.user_id}`, {
        method: "DELETE",
        credentials: "include",
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        toast.error(data?.message || "Erro ao remover permissão.");
        return;
      }

      toast.success("Permissão removida.");
      setRemOpen(false);
      setRemUser(null);
      await loadAll();
    } catch {
      toast.error("Falha de rede ao remover permissão.");
    } finally {
      setActing(false);
    }
  }

  // ===== paginação usuários =====
  const usersTotal = users.length;
  const usersTotalPages = Math.max(1, Math.ceil(usersTotal / usersPageSize));

  useEffect(() => {
    setUsersPage((p) => Math.min(Math.max(1, p), usersTotalPages));
  }, [usersTotalPages]);

  const usersPaginated = useMemo(() => {
    const start = (usersPage - 1) * usersPageSize;
    return users.slice(start, start + usersPageSize);
  }, [users, usersPage, usersPageSize]);

  function prevUsersPage() {
    setUsersPage((p) => Math.max(1, p - 1));
  }
  function nextUsersPage() {
    setUsersPage((p) => Math.min(usersTotalPages, p + 1));
  }

  // ===== paginação processos =====
  const procTotal = processos.length;
  const procTotalPages = Math.max(1, Math.ceil(procTotal / procPageSize));

  useEffect(() => {
    setProcPage((p) => Math.min(Math.max(1, p), procTotalPages));
  }, [procTotalPages]);

  const procPaginated = useMemo(() => {
    const start = (procPage - 1) * procPageSize;
    return processos.slice(start, start + procPageSize);
  }, [processos, procPage, procPageSize]);

  function prevProcPage() {
    setProcPage((p) => Math.max(1, p - 1));
  }
  function nextProcPage() {
    setProcPage((p) => Math.min(procTotalPages, p + 1));
  }

  const myBadge = me ? acessoLabel(me.acesso_nome) : "—";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} type="button" onClick={() => navigate("/app/gabinetes")}>
          <ArrowLeft className={styles.btnIcon} aria-hidden="true" />
          Voltar
        </button>

        <div className={styles.titleWrap}>
          <div className={styles.titleIcon}>
            <Building2 className={styles.icon} aria-hidden="true" />
          </div>
          <div>
            <h1 className={styles.title}>Abrir gabinete</h1>
            <p className={styles.subtitle}>Informações, usuários e processos do gabinete.</p>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.state}>Carregando...</div>
        ) : !gab || !me ? (
          <div className={styles.state}>Gabinete não encontrado ou você não tem permissão.</div>
        ) : (
          <>
            <div className={styles.gabHeader}>
              <div className={styles.gabHeaderLeft}>
                <div className={styles.gabName}>{gab.nome}</div>
                <div className={styles.gabDesc}>{gab.descricao?.trim() ? gab.descricao : "—"}</div>
              </div>

              <div className={styles.badgeRight}>
                <span className={styles.badge}>{myBadge}</span>
              </div>
            </div>

            {/* Usuários (collapse) */}
            <div className={styles.section}>
              <button
                type="button"
                className={styles.collapseHeader}
                onClick={() => setUsersOpen((v) => !v)}
                aria-expanded={usersOpen}
              >
                <div className={styles.collapseTitle}>
                  <Users className={styles.collapseIcon} aria-hidden="true" />
                  Usuários ({usersTotal})
                </div>
                {usersOpen ? <ChevronUp className={styles.chev} aria-hidden="true" /> : <ChevronDown className={styles.chev} aria-hidden="true" />}
              </button>

              {usersOpen ? (
                <div className={styles.sectionBody}>
                  {usersTotal === 0 ? (
                    <div className={styles.state}>Nenhum usuário vinculado.</div>
                  ) : (
                    <>
                      <div className={styles.sectionTop}>
                        <span className={styles.pagerLabel}>Por página</span>
                        <select
                          className={styles.select}
                          value={usersPageSize}
                          onChange={(e) => {
                            setUsersPageSize(Number(e.target.value) as any);
                            setUsersPage(1);
                          }}
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={30}>30</option>
                        </select>
                      </div>

                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Usuário</th>
                            <th>Permissão</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usersPaginated.map((u) => (
                            <tr key={u.user_id}>
                              <td className={styles.tdStrong}>
                                {u.user_nome}
                                {u.is_owner === 1 ? <span className={styles.ownerBadge}>Dono</span> : null}
                              </td>

                              <td>
                                <span className={styles.badge}>{acessoLabel(u.acesso_nome)}</span>
                              </td>

                              <td className={styles.tdActions}>
                                {canRemove(me, u) ? (
                                  <button className={styles.dangerBtn} type="button" onClick={() => openRemove(u)} disabled={acting}>
                                    <Trash2 width={16} height={16} aria-hidden="true" />
                                    Remover
                                  </button>
                                ) : (
                                  <span className={styles.muted}>—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className={styles.tableFooter}>
                        <button type="button" className={styles.pageBtn} onClick={prevUsersPage} disabled={usersPage <= 1} aria-label="Página anterior">
                          <ChevronLeft className={styles.pageIcon} aria-hidden="true" />
                        </button>

                        <span className={styles.pageInfo}>
                          Página <b>{usersPage}</b> de <b>{usersTotalPages}</b>
                        </span>

                        <button type="button" className={styles.pageBtn} onClick={nextUsersPage} disabled={usersPage >= usersTotalPages} aria-label="Próxima página">
                          <ChevronRight className={styles.pageIcon} aria-hidden="true" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            {/* Processos (collapse) */}
            <div className={styles.section}>
              <button
                type="button"
                className={styles.collapseHeader}
                onClick={() => setProcOpen((v) => !v)}
                aria-expanded={procOpen}
              >
                <div className={styles.collapseTitle}>
                  <FileText className={styles.collapseIcon} aria-hidden="true" />
                  Processos ({procTotal})
                </div>
                {procOpen ? <ChevronUp className={styles.chev} aria-hidden="true" /> : <ChevronDown className={styles.chev} aria-hidden="true" />}
              </button>

              {procOpen ? (
                <div className={styles.sectionBody}>
                  {loadingProc ? (
                    <div className={styles.state}>Carregando processos...</div>
                  ) : procTotal === 0 ? (
                    <div className={styles.state}>Nenhum processo/arquivo encontrado para este gabinete.</div>
                  ) : (
                    <>
                      <div className={styles.sectionTop}>
                        <span className={styles.pagerLabel}>Por página</span>
                        <select
                          className={styles.select}
                          value={procPageSize}
                          onChange={(e) => {
                            setProcPageSize(Number(e.target.value) as any);
                            setProcPage(1);
                          }}
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={30}>30</option>
                        </select>
                      </div>

                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Processo</th>
                            <th>Criado em</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {procPaginated.map((p) => {
                            const title =
                              p.numero ||
                              p.original_filename ||
                              p.titulo ||
                              p.nome ||
                              `Processo #${p.id}`;

                            const created = p.uploaded_at || p.created_at;

                            return (
                              <tr key={p.id}>
                                <td className={styles.tdStrong}>{title}</td>
                                <td>{fmtDate(created)}</td>
                                <td className={styles.tdActions}>
                                  <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={() => navigate(`/app/processos/${p.id}`)}
                                    title="Abrir processo"
                                  >
                                    Abrir
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className={styles.tableFooter}>
                        <button type="button" className={styles.pageBtn} onClick={prevProcPage} disabled={procPage <= 1} aria-label="Página anterior">
                          <ChevronLeft className={styles.pageIcon} aria-hidden="true" />
                        </button>

                        <span className={styles.pageInfo}>
                          Página <b>{procPage}</b> de <b>{procTotalPages}</b>
                        </span>

                        <button type="button" className={styles.pageBtn} onClick={nextProcPage} disabled={procPage >= procTotalPages} aria-label="Próxima página">
                          <ChevronRight className={styles.pageIcon} aria-hidden="true" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Modal remover permissão */}
      {remOpen && remUser ? (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Remover permissão">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Remover permissão</h2>
              <button className={styles.closeBtn} onClick={() => setRemOpen(false)} type="button" disabled={acting}>
                ✕
              </button>
            </div>

            <div className={styles.form}>
              <p className={styles.confirmText}>
                Tem certeza que deseja remover <b>{remUser.user_nome}</b> deste gabinete?
              </p>

              <div className={styles.modalFooter}>
                <button className={styles.secondaryBtn} onClick={() => setRemOpen(false)} type="button" disabled={acting}>
                  Cancelar
                </button>
                <button className={styles.dangerBtnSolid} onClick={() => void confirmRemove()} type="button" disabled={acting}>
                  {acting ? "Removendo..." : "Remover"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
