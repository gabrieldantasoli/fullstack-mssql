import { NavLink, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import styles from "./Sidebar.module.css";
import { Logo } from "../logos/small";
import { KeyRound } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";

function IconProcessos() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 7h8M8 11h8M8 15h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconGabinetes() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9.5 21v-7h5v7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSolicitacoes() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path d="M7 7h14v10H7z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M7 12H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 10h8M10 14h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconFavoritos() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path d="M12 17.3 6.7 20l1-6-4.4-4.1 6.1-.9L12 3.5l2.6 5.5 6.1.9L16.3 14l1 6Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function IconSair() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path d="M10 17l5-5-5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 12H3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 3v18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      toast.success("Sessão encerrada.");
      navigate("/login", { replace: true });
    }
  }

  return (
    <aside className={styles.sidebar} aria-label="Menu lateral">
      <div className={styles.top}>
        <div className={styles.logoWrap}>
          <NavLink to="/app/home">
            <Logo />
          </NavLink>

        </div>

        <nav className={styles.nav}>
          <NavLink to="/app/processos" className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}>
            <IconProcessos />
            <span>Processos</span>
          </NavLink>

          <NavLink to="/app/gabinetes" className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}>
            <IconGabinetes />
            <span>Gabinetes</span>
          </NavLink>

          <NavLink to="/app/solicitacoes" className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}>
            <IconSolicitacoes />
            <span>Solicitações</span>
          </NavLink>

          <NavLink to="/app/favoritos" className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}>
            <IconFavoritos />
            <span>Favoritos</span>
          </NavLink>
          <NavLink to="/app/meus-acessos" className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}>
            <KeyRound className={styles.icon} aria-hidden="true" />
            <span>Meus Acessos</span>
          </NavLink>

        </nav>
      </div>

      <div className={styles.bottom}>
        <button className={styles.logout} onClick={handleLogout} type="button">
          <IconSair />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
