import styles from "./index.module.css";

export function Logo() {
  return (
    <div className={styles.wrap} aria-label="GabIn - Gabinetes Inteligentes">
      <div className={styles.brand}>
        <span className={styles.gab}>Gab</span>
        <span className={styles.in}>In</span>
      </div>
    </div>
  );
}
