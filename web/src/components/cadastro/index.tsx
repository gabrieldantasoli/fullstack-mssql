import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styles from "../login/index.module.css";
import { Logo } from "../logo";


export default function Cadastro() {
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");

  const canSubmit = useMemo(() => {
    return nome.trim().length > 0 && login.trim().length > 0 && senha.trim().length > 0;
  }, [nome, login, senha]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    // Protótipo: depois liga na API
    console.log({ nome, login, senha });
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-label="Tela de cadastro">
        <Logo />

        <h1 className={styles.title}>Criar conta</h1>

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="nome">
              Nome
            </label>
            <input
              id="nome"
              className={styles.input}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite seu nome"
              autoComplete="name"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login">
              Login
            </label>
            <input
              id="login"
              className={styles.input}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Escolha um login"
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
              placeholder="Crie uma senha"
              autoComplete="new-password"
            />
          </div>

          <button className={styles.button} type="submit" disabled={!canSubmit}>
            Cadastrar
          </button>
        </form>

        <div className={styles.footer}>
          <span className={styles.muted}>Já tem uma conta?</span>{" "}
          <Link className={styles.link} to="/login">
            Entrar
          </Link>
        </div>
      </section>
    </main>
  );
}
