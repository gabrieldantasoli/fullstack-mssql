import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function AppHome() {
  const navigate = useNavigate();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    toast.success("Sessão encerrada.");
    navigate("/login");
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Área logada</h1>
      <p>Se você está vendo isso, a sessão está funcionando.</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}
