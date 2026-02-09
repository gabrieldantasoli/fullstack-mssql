import styles from "./index.module.css";
import { Logo } from "../../../../components/logos/big";


export default function HomePage() {

  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <Logo />

        <p className={styles.subtitle}>
          Aqui você pode analisar e contribuir com processos de triagem: visualize documentos, confira metadados, acompanhe eventos e
          organize páginas com rapidez e clareza.
        </p>
      </div>
    </div>
  );
}
