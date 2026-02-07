import styles from "./index.module.css";

export function Logo() {
  return (
    <div className={styles.wrap} aria-label="GabIn - Gabinetes Inteligentes">
      <div className={styles.brand}>
        <span className={styles.gab}>Gab</span>
        <span className={styles.in}>In</span>
      </div>

      <div className={styles.subtitle}>
        <span className={styles.subGreen}>Gabinetes</span>{" "}
        <span className={styles.subYellow}>Inteligentes</span>
      </div>
    </div>
  );
}
