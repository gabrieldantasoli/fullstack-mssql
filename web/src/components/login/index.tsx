import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import styles from "./index.module.css";
import { Logo } from "../logos/big";
import { useAuth } from "../../auth/AuthProvider";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login: setAuthedUser } = useAuth();

  const canSubmit = useMemo(() => {
    return identifier.trim().length > 0 && senha.trim().length > 0 && !loading;
  }, [identifier, senha, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          identifier: identifier.trim(),
          senha: senha.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.message || "Credenciais inválidas.");
        return;
      }

      setAuthedUser(data);

      toast.success(`Bem-vindo, ${data.nome}!`);

      navigate("/app/home", { replace: true });
    } catch {
      toast.error("Falha de rede. Verifique a API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-label="Tela de login">
        <Logo />

        <h1 className={styles.title}>Entrar</h1>

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="identifier">
              Usuário
            </label>
            <input
              id="identifier"
              className={styles.input}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Digite seu login ou nome"
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
            {loading ? "Entrando..." : "Entrar"}
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
