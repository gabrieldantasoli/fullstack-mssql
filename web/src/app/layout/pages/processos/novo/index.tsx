import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Upload, Save, FileText } from "lucide-react";
import styles from "./index.module.css";

type GabineteRow = { id: number; nome: string };

export default function NovoProcessoPage() {
    const navigate = useNavigate();

    const [gabs, setGabs] = useState<GabineteRow[]>([]);
    const [gabineteId, setGabineteId] = useState<number | "">("");

    const [nomeProcesso, setNomeProcesso] = useState("");
    const [descricao, setDescricao] = useState("");

    const [pdf, setPdf] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    async function loadGabinetes() {
        try {
            const res = await fetch("/api/gabinetes/accessible", { credentials: "include" });
            const data = await res.json().catch(() => []);

            if (!res.ok) {
                toast.error(data?.message || "Erro ao carregar gabinetes.");
                setGabs([]);
                setGabineteId("");
                return;
            }

            const arr = Array.isArray(data) ? data : [];
            const mapped = arr.map((x: any) => ({ id: Number(x.id), nome: String(x.nome || "") }));

            setGabs(mapped);

            if (mapped.length > 0) setGabineteId(mapped[0].id);
            else setGabineteId("");
        } catch {
            toast.error("Falha de rede ao carregar gabinetes.");
            setGabs([]);
            setGabineteId("");
        }
    }

    useEffect(() => {
        loadGabinetes();
    }, []);

    const canSave = useMemo(() => {
        return (
            !saving &&
            !!pdf &&
            nomeProcesso.trim().length > 0 &&
            Number.isFinite(Number(gabineteId)) &&
            Number(gabineteId) > 0
        );
    }, [saving, pdf, nomeProcesso, gabineteId]);

    async function save() {
        if (!canSave) return;

        setSaving(true);
        try {
            const fd = new FormData();
            fd.append("pdf", pdf!);
            fd.append("nome_processo", nomeProcesso.trim());
            fd.append("descricao", descricao.trim() || "");
            fd.append("gabinete_id", String(gabineteId));

            // ✅ status NÃO é enviado — ficará fixo como "entregue" na API
            const res = await fetch("/api/arquivos", {
                method: "POST",
                credentials: "include",
                body: fd,
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data?.message || "Erro ao salvar arquivo.");
                return;
            }

            toast.success("Arquivo cadastrado com sucesso!");
            navigate("/app/processos");
        } catch {
            toast.error("Falha de rede ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <button className={styles.backBtn} type="button" onClick={() => navigate("/app/processos")}>
                    <ArrowLeft className={styles.btnIcon} aria-hidden="true" />
                    Voltar
                </button>

                <div className={styles.titleWrap}>
                    <div className={styles.titleIcon}>
                        <FileText className={styles.icon} aria-hidden="true" />
                    </div>
                    <div>
                        <h1 className={styles.title}>Adicionar arquivo</h1>
                        <p className={styles.subtitle}>Envie um PDF e preencha os dados do processo.</p>
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.form}>
                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label className={styles.label}>Gabinete *</label>
                            <select
                                className={styles.select}
                                value={gabineteId}
                                onChange={(e) => setGabineteId(Number(e.target.value))}
                            >
                                {gabs.length === 0 ? <option value="">Nenhum gabinete acessível</option> : null}
                                {gabs.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.nome}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Nome do processo *</label>
                            <input
                                className={styles.input}
                                value={nomeProcesso}
                                onChange={(e) => setNomeProcesso(e.target.value)}
                                placeholder="Ex.: Processo 0001234-56.2026..."
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Descrição</label>
                        <textarea
                            className={styles.textarea}
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            placeholder="Opcional"
                            rows={4}
                            maxLength={1000}
                        />
                        <div className={styles.counter}>{descricao.length}/1000</div>
                    </div>

                    <div className={styles.upload}>
                        <label className={styles.uploadBox}>
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setPdf(e.target.files?.[0] || null)}
                                className={styles.fileInput}
                            />
                            <Upload className={styles.uploadIcon} aria-hidden="true" />
                            <div className={styles.uploadText}>
                                <b>Selecionar PDF</b>
                                <span>{pdf ? pdf.name : "Nenhum arquivo selecionado"}</span>
                            </div>
                        </label>
                    </div>

                    <div className={styles.actions}>
                        <button
                            className={styles.secondaryBtn}
                            type="button"
                            onClick={() => navigate("/app/processos")}
                            disabled={saving}
                        >
                            Cancelar
                        </button>

                        <button className={styles.primaryBtn} type="button" onClick={save} disabled={!canSave}>
                            <Save className={styles.btnIcon} aria-hidden="true" />
                            {saving ? "Salvando..." : "Salvar"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
