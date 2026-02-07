import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styles from "./index.module.css";
import { Logo } from "../logo";

export default function Login() {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");

  const canSubmit = useMemo(() => {
    return login.trim().length > 0 && senha.trim().length > 0;
  }, [login, senha]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    console.log({ login, senha });
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-label="Tela de login">
        <Logo />

        <h1 className={styles.title}>Entrar</h1>

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login">
              Usuário
            </label>
            <input
              id="login"
              className={styles.input}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Digite seu usuário"
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="senha">
              Senha
            </label>
            <input
              id="senha"
              className={styles.input}
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
            />
          </div>

          <button className={styles.button} type="submit" disabled={!canSubmit}>
            Entrar
          </button>
        </form>

        <div className={styles.footer}>
          <span className={styles.muted}>Não tem uma conta?</span>{" "}
          <Link className={styles.link} to="/cadastro">
            Cadastre-se
          </Link>
        </div>
      </section>
    </main>
  );
}
