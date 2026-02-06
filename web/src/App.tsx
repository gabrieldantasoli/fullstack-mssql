import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Task = {
  id: number;
  title: string;
  done: boolean;
  created_at: string;
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const remaining = useMemo(() => tasks.filter(t => !t.done).length, [tasks]);

  async function loadTasks() {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      const data = (await res.json()) as Task[];
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value })
    });

    if (!res.ok) return;

    const created = (await res.json()) as Task;
    setTasks(prev => [created, ...prev]);
    setTitle("");
  }

  async function toggleTask(t: Task) {
    const res = await fetch(`/api/tasks/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !t.done })
    });

    if (!res.ok) return;
    const updated = (await res.json()) as Task;

    setTasks(prev => prev.map(x => (x.id === t.id ? updated : x)));
  }

  async function deleteTask(id: number) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) return;
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Tasks</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        {loading ? "Carregando..." : `${remaining} pendente(s) • ${tasks.length} total`}
      </p>

      <form onSubmit={addTask} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nova task..."
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
        />
        <button type="submit" style={{ padding: "10px 14px", borderRadius: 10 }}>
          Adicionar
        </button>
      </form>

      <div style={{ display: "grid", gap: 10 }}>
        {tasks.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 12,
              borderRadius: 14,
              border: "1px solid #e5e5e5"
            }}
          >
            <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleTask(t)}
              />
              <span style={{ textDecoration: t.done ? "line-through" : "none" }}>
                {t.title}
              </span>
            </label>

            <button
              onClick={() => deleteTask(t.id)}
              style={{ padding: "8px 10px", borderRadius: 10 }}
              title="Excluir"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
