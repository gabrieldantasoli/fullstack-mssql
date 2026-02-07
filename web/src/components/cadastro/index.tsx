import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import styles from "../login/index.module.css";
import { Logo } from "../logos/big";

export default function Cadastro() {
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const canSubmit = useMemo(() => {
    return nome.trim().length > 0 && login.trim().length > 0 && senha.trim().length > 0 && !loading;
  }, [nome, login, senha, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          login: login.trim(),
          senha: senha.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          toast.error("Esse login já existe. Tente outro.");
          return;
        }
        toast.error(data?.message || "Erro ao cadastrar. Tente novamente.");
        return;
      }

      toast.success("Conta criada com sucesso! Agora faça login.");
      navigate("/login");
    } catch {
      toast.error("Falha de rede. Verifique a API e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-label="Tela de cadastro">
        <Logo />

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
            {loading ? "Cadastrando..." : "Cadastrar"}
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
