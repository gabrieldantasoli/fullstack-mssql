import { Outlet } from "react-router-dom";
import styles from "./AppLayout.module.css";
import Breadcrumb from "../breadcrumb/Breadcrumb";
import Sidebar from "../sidebar/Sidebar";

export default function AppLayout() {
  return (
    <div className={styles.shell}>
      <Sidebar />

      <main className={styles.main}>
        <header className={styles.header}>
          <Breadcrumb />
        </header>

        <section className={styles.content}>
          <Outlet />
        </section>
      </main>
    </div>
  );
}
