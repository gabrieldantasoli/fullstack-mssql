import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Building2, ChevronDown, ChevronUp, Trash2, Users } from "lucide-react";
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

export default function GabineteOpenPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const gabineteId = useMemo(() => Number(id), [id]);

  const [gab, setGab] = useState<GabineteDetails | null>(null);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [users, setUsers] = useState<GabUser[]>([]);
  const [loading, setLoading] = useState(true);

  // collapse usuários
  const [usersOpen, setUsersOpen] = useState(true);

  // remover permissão
  const [remOpen, setRemOpen] = useState(false);
  const [remUser, setRemUser] = useState<GabUser | null>(null);
  const [acting, setActing] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const res = await fetch(`/api/gabinetes/${gabineteId}/open`, { credentials: "include", cache: "no-store" });
      const data = (await res.json().catch(() => null)) as OpenPayload | null;

      if (!res.ok || !data?.gabinete || !data?.me) {
        toast.error((data as any)?.message || "Erro ao carregar gabinete.");
        setGab(null);
        setMe(null);
        setUsers([]);
        return;
      }

      setGab(data.gabinete);
      setMe(data.me);
      setUsers(Array.isArray(data.usuarios) ? data.usuarios : []);
    } catch {
      toast.error("Falha de rede ao carregar gabinete.");
      setGab(null);
      setMe(null);
      setUsers([]);
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
      // mensagens mais “certinhas” por cenário
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

      // DELETE 204 não tem body — então só tenta ler JSON se houver
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
            <p className={styles.subtitle}>Informações e usuários com permissões.</p>
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
                  Usuários ({users.length})
                </div>
                {usersOpen ? (
                  <ChevronUp className={styles.chev} aria-hidden="true" />
                ) : (
                  <ChevronDown className={styles.chev} aria-hidden="true" />
                )}
              </button>

              {usersOpen ? (
                <div className={styles.sectionBody}>
                  {users.length === 0 ? (
                    <div className={styles.state}>Nenhum usuário vinculado.</div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Usuário</th>
                          <th>Permissão</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
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
                <button className={styles.dangerBtnSolid} onClick={confirmRemove} type="button" disabled={acting}>
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
