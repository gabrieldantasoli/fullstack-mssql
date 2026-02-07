import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import styles from "./Breadcrumb.module.css";

const LABELS: Record<string, string> = {
  "app": "Início",
  "processos": "Processos",
  "gabinetes": "Gabinetes",
  "meus-gabinetes": "Meus Gabinetes",
  "solicitacoes": "Solicitações",
  "favoritos": "Favoritos",
  "meus-acessos": "Meus Acessos",
};

export default function Breadcrumb() {
  const { pathname } = useLocation();

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let acc = "";

  return (
    <nav className={styles.breadcrumb} aria-label="breadcrumb">
      {segments.map((seg, i) => {
        acc += `/${seg}`;
        const isLast = i === segments.length - 1;

        // Ajuste: ao clicar em "Início" (segmento app), mandar pro default /app/processos
        const to = seg === "app" ? "/app/home" : acc;
        const label = LABELS[seg] ?? decodeURIComponent(seg);

        return (
          <span className={styles.crumb} key={acc}>
            {i > 0 && <ChevronRight className={styles.sep} aria-hidden="true" />}
            {isLast ? (
              <span className={styles.current}>{label}</span>
            ) : (
              <Link className={styles.link} to={to}>
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
