"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  ChevronRight, ChevronLeft, Check, Loader2,
  Plus, Trash2, Shield, Eye, FileDown, RefreshCw, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generateBbPdf } from "@/lib/generate-bb-pdf";
import { ChartSection, type AnalysisOptions } from "@/components/chart-section";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Metrics {
  identificados: string;
  inativos: string;
  ocorrencias: string;
  notificados: string;
  eliminados: string;
  notificacoesEnviadas: string;
}

interface HeatmapEntry {
  nome: string;
  score: string;
}

interface ContentionAction {
  domain: string;
  status: string;
}

interface StandbyCase {
  agressor: string;
  status: string;
  nextAction: string;
}

const STEPS = [
  { id: 1, label: "Dados do Relatório" },
  { id: 2, label: "Seções Adicionais" },
  { id: 3, label: "Preview" },
];

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all",
                current > step.id
                  ? "bg-primary border-primary text-white"
                  : current === step.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-muted-foreground bg-white"
              )}
            >
              {current > step.id ? <Check size={14} /> : step.id}
            </div>
            <span className={cn("text-xs font-medium whitespace-nowrap", current === step.id ? "text-primary" : "text-muted-foreground")}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("h-0.5 w-16 mx-1 mt-[-14px] transition-all", current > step.id ? "bg-primary" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
        {number}
      </div>
      <h3 className="font-semibold text-sm text-foreground">{title}</h3>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function BrandBiddingClient() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Identificação
  const [clientName, setClientName] = useState("");
  const [reportType, setReportType] = useState<"Semanal" | "Quinzenal">("Semanal");
  const [periodDays, setPeriodDays] = useState("7");
  const [periodLabel, setPeriodLabel] = useState("");

  // Métricas
  const [metrics, setMetrics] = useState<Metrics>({
    identificados: "",
    inativos: "",
    ocorrencias: "",
    notificados: "",
    eliminados: "",
    notificacoesEnviadas: "",
  });

  // Análises das seções (geradas pela IA, editáveis)
  const [agressoresAnalysis, setAgressoresAnalysis] = useState("");
  const [heatmapAnalysis, setHeatmapAnalysis] = useState("");

  // Heatmap
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([{ nome: "", score: "" }]);

  // Imagens + análises da IA
  const [imageAgressores, setImageAgressores] = useState<File | null>(null);
  const [imageAgressoresPreview, setImageAgressoresPreview] = useState("");
  const [agressoresOptions, setAgressoresOptions] = useState<AnalysisOptions | null>(null);
  const [analyzingAgressores, setAnalyzingAgressores] = useState(false);

  const [imageHeatmap, setImageHeatmap] = useState<File | null>(null);
  const [imageHeatmapPreview, setImageHeatmapPreview] = useState("");
  const [heatmapOptions, setHeatmapOptions] = useState<AnalysisOptions | null>(null);
  const [analyzingHeatmap, setAnalyzingHeatmap] = useState(false);

  // Seções adicionais
  const [contentionActions, setContentionActions] = useState<ContentionAction[]>([{ domain: "", status: "" }]);
  const [standbyCases, setStandbyCases] = useState<StandbyCase[]>([]);
  const [awaitingApproval, setAwaitingApproval] = useState("");
  const [resolved, setResolved] = useState("");

  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    return () => {
      if (imageAgressoresPreview) URL.revokeObjectURL(imageAgressoresPreview);
      if (imageHeatmapPreview) URL.revokeObjectURL(imageHeatmapPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Analisar gráfico via IA ────────────────────────────────────────────────

  async function analyzeChart(file: File, chartType: "agressores" | "heatmap"): Promise<AnalysisOptions | null> {
    const fd = new FormData();
    fd.append("image", file);
    fd.append("chartType", chartType);
    try {
      const res = await fetch("/api/analyze-chart", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) {
        // Mostra erro completo, com mais tempo na tela
        toast.error(json.error || "Erro ao gerar análise.", {
          duration: 8000,
          style: { maxWidth: "500px" },
        });
        console.error("Erro analyze-chart:", json);
        return null;
      }
      return json.data as AnalysisOptions;
    } catch (err) {
      console.error("Erro de rede:", err);
      toast.error("Erro de conexão ao gerar análise. Veja o console (F12).", {
        duration: 6000,
      });
      return null;
    }
  }

  // ── Set imagem + dispara IA ─────────────────────────────────────────────

  async function setAgressoresImage(file: File) {
    if (imageAgressoresPreview) URL.revokeObjectURL(imageAgressoresPreview);
    const url = URL.createObjectURL(file);
    setImageAgressores(file);
    setImageAgressoresPreview(url);

    setAnalyzingAgressores(true);
    setAgressoresOptions(null);
    const opts = await analyzeChart(file, "agressores");
    setAnalyzingAgressores(false);
    if (opts) {
      setAgressoresOptions(opts);
      setAgressoresAnalysis(opts.exemplo1);
      toast.success("Análise gerada!");
    }
  }

  function clearAgressoresImage() {
    if (imageAgressoresPreview) URL.revokeObjectURL(imageAgressoresPreview);
    setImageAgressores(null);
    setImageAgressoresPreview("");
    setAgressoresOptions(null);
    setAgressoresAnalysis("");
  }

  async function regenerateAgressores() {
    if (!imageAgressores) return;
    setAnalyzingAgressores(true);
    const opts = await analyzeChart(imageAgressores, "agressores");
    setAnalyzingAgressores(false);
    if (opts) {
      setAgressoresOptions(opts);
      setAgressoresAnalysis(opts.exemplo1);
      toast.success("Novas análises geradas!");
    }
  }

  async function setHeatmapImage(file: File) {
    if (imageHeatmapPreview) URL.revokeObjectURL(imageHeatmapPreview);
    const url = URL.createObjectURL(file);
    setImageHeatmap(file);
    setImageHeatmapPreview(url);

    setAnalyzingHeatmap(true);
    setHeatmapOptions(null);
    const opts = await analyzeChart(file, "heatmap");
    setAnalyzingHeatmap(false);
    if (opts) {
      setHeatmapOptions(opts);
      setHeatmapAnalysis(opts.exemplo1);
      toast.success("Análise gerada!");
    }
  }

  function clearHeatmapImage() {
    if (imageHeatmapPreview) URL.revokeObjectURL(imageHeatmapPreview);
    setImageHeatmap(null);
    setImageHeatmapPreview("");
    setHeatmapOptions(null);
    setHeatmapAnalysis("");
  }

  async function regenerateHeatmap() {
    if (!imageHeatmap) return;
    setAnalyzingHeatmap(true);
    const opts = await analyzeChart(imageHeatmap, "heatmap");
    setAnalyzingHeatmap(false);
    if (opts) {
      setHeatmapOptions(opts);
      setHeatmapAnalysis(opts.exemplo1);
      toast.success("Novas análises geradas!");
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  function updateHeatmap(i: number, field: keyof HeatmapEntry, value: string) {
    setHeatmap((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  }
  function addHeatmapEntry() { setHeatmap((prev) => [...prev, { nome: "", score: "" }]); }
  function removeHeatmapEntry(i: number) { setHeatmap((prev) => prev.filter((_, idx) => idx !== i)); }

  function updateContention(i: number, field: keyof ContentionAction, value: string) {
    setContentionActions((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  }
  function addContention() { setContentionActions((prev) => [...prev, { domain: "", status: "" }]); }
  function removeContention(i: number) { setContentionActions((prev) => prev.filter((_, idx) => idx !== i)); }

  function updateStandby(i: number, field: keyof StandbyCase, value: string) {
    setStandbyCases((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  }
  function addStandby() { setStandbyCases((prev) => [...prev, { agressor: "", status: "", nextAction: "" }]); }
  function removeStandby(i: number) { setStandbyCases((prev) => prev.filter((_, idx) => idx !== i)); }

  async function downloadPdf() {
    setGeneratingPdf(true);
    try {
      await generateBbPdf({
        clientName, reportType, periodDays, periodLabel, metrics,
        agressoresAnalysis, heatmapAnalysis,
        heatmap: heatmap.filter((h) => h.nome.trim()),
        contentionActions, standbyCases, awaitingApproval, resolved,
        imageAgressores, imageHeatmap,
      });
      toast.success("PDF gerado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF.");
    } finally {
      setGeneratingPdf(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // STEP 1
  // ────────────────────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-5">
        {/* Identificação */}
        <div className="rounded-xl border border-border bg-white p-5">
          <SectionLabel number={0} title="Identificação" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Cliente <span className="font-normal">(opcional)</span>
              </label>
              <input
                type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome do cliente..."
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Período</label>
              <input
                type="text" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="Ex: 22 Abr - 28 Abr"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
          <div className="mt-3 flex items-end gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Tipo</label>
              <div className="flex gap-2">
                {(["Semanal", "Quinzenal"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setReportType(t);
                      setPeriodDays(t === "Semanal" ? "7" : "14");
                    }}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-sm font-medium border transition-all",
                      reportType === t
                        ? "bg-primary text-white border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-28">
              <label className="block text-xs text-muted-foreground mb-1">Nº de dias</label>
              <input
                type="number" min="1" value={periodDays}
                onChange={(e) => setPeriodDays(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* 1. Métricas */}
        <div className="rounded-xl border border-border bg-white p-5">
          <SectionLabel number={1} title="Métricas Consolidadas (Todo o período)" />
          <p className="text-xs text-muted-foreground mb-3 italic">
            A tabela a seguir resume os principais indicadores de Brand Bidding.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { key: "identificados", label: "Identificados" },
                { key: "inativos", label: "Inativos" },
                { key: "ocorrencias", label: "Ocorrências" },
                { key: "notificados", label: "Notificados" },
                { key: "eliminados", label: "Eliminados" },
                { key: "notificacoesEnviadas", label: "Notificações Enviadas" },
              ] as { key: keyof Metrics; label: string }[]
            ).map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                <input
                  type="number" min="0" value={metrics[key]}
                  onChange={(e) => setMetrics((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="—"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 2. Agressores */}
        <div className="rounded-xl border border-border bg-white p-5">
          <SectionLabel number={2} title="Agressores Identificados" />
          <ChartSection
            slot="agressores"
            uploadLabel="Print do gráfico de agressores"
            preview={imageAgressoresPreview}
            analysisText={agressoresAnalysis}
            options={agressoresOptions}
            loading={analyzingAgressores}
            onFile={setAgressoresImage}
            onClear={clearAgressoresImage}
            onSelectAnalysis={setAgressoresAnalysis}
            onEditAnalysis={setAgressoresAnalysis}
            onRegenerate={regenerateAgressores}
          />
        </div>

        {/* 3. Heatmap */}
        <div className="rounded-xl border border-border bg-white p-5">
          <SectionLabel number={3} title="Análise de Ofensores (Heatmap)" />
          <ChartSection
            slot="heatmap"
            uploadLabel="Print do heatmap"
            preview={imageHeatmapPreview}
            analysisText={heatmapAnalysis}
            options={heatmapOptions}
            loading={analyzingHeatmap}
            onFile={setHeatmapImage}
            onClear={clearHeatmapImage}
            onSelectAnalysis={setHeatmapAnalysis}
            onEditAnalysis={setHeatmapAnalysis}
            onRegenerate={regenerateHeatmap}
          />

          <div className="mt-4">
            <label className="block text-xs text-muted-foreground mb-2">
              Top agressores do heatmap <span className="font-normal">(opcional)</span>
            </label>
            <div className="space-y-2">
              {heatmap.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text" value={h.score}
                    onChange={(e) => updateHeatmap(i, "score", e.target.value)}
                    placeholder="Score"
                    className="w-28 shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <input
                    type="text" value={h.nome}
                    onChange={(e) => updateHeatmap(i, "nome", e.target.value)}
                    placeholder="dominio.com.br"
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {heatmap.length > 1 && (
                    <button
                      onClick={() => removeHeatmapEntry(i)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 border border-border transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addHeatmapEntry}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <Plus size={14} />Adicionar agressor
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm"
          >
            Próximo<ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // STEP 2
  // ────────────────────────────────────────────────────────────────────────

  function renderStep2() {
    return (
      <div className="space-y-5">
        {/* 4. Contenção */}
        <div className="rounded-xl border border-border bg-white p-5">
          <SectionLabel number={4} title="Status das Ações de Contenção" />
          <p className="text-xs text-muted-foreground mb-3 italic">
            Detalhe do andamento das principais tratativas com agressores:
          </p>
          <div className="space-y-3">
            {contentionActions.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text" value={item.domain}
                  onChange={(e) => updateContention(i, "domain", e.target.value)}
                  placeholder="dominio.com.br"
                  className="w-44 shrink-0 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <input
                  type="text" value={item.status}
                  onChange={(e) => updateContention(i, "status", e.target.value)}
                  placeholder="Descreva o status atual..."
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                {contentionActions.length > 1 && (
                  <button
                    onClick={() => removeContention(i)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 border border-border transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addContention} className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors">
              <Plus size={14} />Adicionar agressor
            </button>
          </div>
        </div>

        {/* 5. Standby - vem ANTES de Aprovação/Resolvidos, conforme modelo */}
        <div className="rounded-xl border border-border bg-white p-5">
          <SectionLabel number={5} title="Casos em Standby e em Notificação Extrajudicial" />
          <p className="text-xs text-muted-foreground mb-3 italic">
            Os seguintes casos estão em standby ou em processo de notificação extrajudicial, após esgotamento das tentativas de contato direto:
          </p>
          {standbyCases.length === 0 && (
            <p className="text-xs text-muted-foreground italic mb-3">Nenhum caso no período.</p>
          )}
          <div className="space-y-3">
            {standbyCases.map((item, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <input
                  type="text" value={item.agressor}
                  onChange={(e) => updateStandby(i, "agressor", e.target.value)}
                  placeholder="dominio.com.br"
                  className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <input
                  type="text" value={item.status}
                  onChange={(e) => updateStandby(i, "status", e.target.value)}
                  placeholder="Status atual..."
                  className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <div className="flex gap-2">
                  <input
                    type="text" value={item.nextAction}
                    onChange={(e) => updateStandby(i, "nextAction", e.target.value)}
                    placeholder="Próxima ação..."
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <button
                    onClick={() => removeStandby(i)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 border border-border transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addStandby} className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors">
              <Plus size={14} />Adicionar caso
            </button>
          </div>
        </div>

        {/* 6. Aguardando aprovação */}
        <div className="rounded-xl border border-border bg-white p-5">
          <SectionLabel number={6} title="Agressores Aguardando Aprovação" />
          <p className="text-xs text-muted-foreground mb-2 italic">
            A lista abaixo inclui os agressores recém-identificados que aguardam aprovação para o início das tratativas.
          </p>
          <p className="text-xs text-muted-foreground mb-2">Um domínio por linha.</p>
          <textarea
            value={awaitingApproval} onChange={(e) => setAwaitingApproval(e.target.value)}
            rows={5}
            placeholder={"concorrente1.com.br\nconcorrente2.com.br"}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
          />
        </div>

        {/* 7. Resolvidos - último, conforme modelo */}
        <div className="rounded-xl border border-border bg-white p-5">
          <SectionLabel number={7} title="Agressores Resolvidos (Sucesso)" />
          <p className="text-xs text-muted-foreground mb-2 italic">
            Os seguintes agressores tiveram suas atividades contidas com sucesso nos últimos dias:
          </p>
          <p className="text-xs text-muted-foreground mb-2">Um domínio por linha.</p>
          <textarea
            value={resolved} onChange={(e) => setResolved(e.target.value)}
            rows={5}
            placeholder={"sucesso1.com.br\nsucesso2.com.br"}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
          />
        </div>

        <div className="flex justify-between pt-1">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <ChevronLeft size={15} />Voltar
          </button>
          <button
            onClick={() => setStep(3)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm"
          >
            Ver Preview<Eye size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // STEP 3 - PREVIEW (formato do PDF + botões de regenerar)
  // ────────────────────────────────────────────────────────────────────────

  function renderStep3() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Preview do Relatório</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Revise o conteúdo. Use os botões "Regenerar análise" se quiser pedir uma nova versão da IA.
            </p>
          </div>
          <button
            onClick={downloadPdf}
            disabled={generatingPdf}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm disabled:opacity-60"
          >
            {generatingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {generatingPdf ? "Gerando..." : "Baixar PDF"}
          </button>
        </div>

        {/* Documento simulado */}
        <div className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
          {/* Header */}
          <div className="branddi-gradient px-8 py-6">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={16} className="text-white/80" />
              <span className="text-white/80 text-xs font-medium uppercase tracking-wider">Branddi Monitor</span>
            </div>
            <h2 className="text-white font-bold text-xl">Relatório {reportType} de Brand Bidding</h2>
            {clientName && <p className="text-white/80 text-sm mt-1">{clientName}</p>}
            {periodLabel && <p className="text-white/60 text-xs mt-0.5">Período: {periodLabel}</p>}
          </div>

          <div className="p-8 space-y-6 max-h-[700px] overflow-y-auto">
            {/* Introdução */}
            <p className="text-sm text-foreground leading-relaxed">
              Este documento apresenta a consolidação{" "}
              {reportType === "Semanal" ? "semanal" : "quinzenal"} dos resultados e o status das ações de monitoramento e contenção de Brand Bidding, garantindo a proteção da sua marca nos canais de busca.
            </p>

            {/* 1. Métricas */}
            <div>
              <h3 className="font-bold text-primary mb-1.5 text-sm">1. Métricas Consolidadas (Todo o período)</h3>
              <p className="text-xs text-muted-foreground mb-3 italic">
                A tabela a seguir resume os principais indicadores de Brand Bidding.
              </p>
              <div className="grid grid-cols-6 gap-2">
                {[
                  { label: "Identificados", value: metrics.identificados },
                  { label: "Inativos", value: metrics.inativos },
                  { label: "Ocorrências", value: metrics.ocorrencias },
                  { label: "Notificados", value: metrics.notificados },
                  { label: "Eliminados", value: metrics.eliminados },
                  { label: "Notificações Enviadas", value: metrics.notificacoesEnviadas },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-border bg-secondary/40 p-3 text-center">
                    <div className="text-xl font-bold text-primary">{value || "—"}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Agressores */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="font-bold text-primary text-sm">2. Agressores Identificados</h3>
                {imageAgressores && (
                  <button
                    onClick={regenerateAgressores}
                    disabled={analyzingAgressores}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                  >
                    {analyzingAgressores ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    {analyzingAgressores ? "Gerando..." : "Pedir nova análise"}
                  </button>
                )}
              </div>
              {agressoresOptions && (
                <p className="text-[10px] text-emerald font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Sparkles size={10} /> Análise gerada por IA
                </p>
              )}
              {analyzingAgressores ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                  <Loader2 size={14} className="animate-spin text-emerald" />
                  Gerando análise com IA...
                </div>
              ) : (
                <p className="text-sm text-foreground leading-relaxed mb-3">
                  {agressoresAnalysis || (
                    <span className="text-muted-foreground italic">
                      Cole um print do gráfico de agressores no passo 1 para gerar a análise.
                    </span>
                  )}
                </p>
              )}
              {agressoresOptions && !analyzingAgressores && (
                <details className="text-xs mb-3">
                  <summary className="cursor-pointer text-primary font-medium hover:text-primary/80">
                    Ver outra opção de análise
                  </summary>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(["exemplo1", "exemplo2"] as const).map((k, i) => (
                      <button
                        key={k}
                        onClick={() => setAgressoresAnalysis(agressoresOptions[k])}
                        className={cn(
                          "text-left p-2 rounded-lg border text-xs transition",
                          agressoresAnalysis.trim() === agressoresOptions[k].trim()
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <span className="font-bold text-primary text-[10px] uppercase">Exemplo {i + 1}</span>
                        <p className="text-foreground mt-1">{agressoresOptions[k]}</p>
                      </button>
                    ))}
                  </div>
                </details>
              )}
              {imageAgressoresPreview && (
                <div className="rounded-xl overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageAgressoresPreview} alt="Gráfico de agressores" className="w-full object-contain max-h-56" />
                </div>
              )}
            </div>

            {/* 3. Heatmap */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="font-bold text-primary text-sm">3. Análise de Ofensores (Heatmap)</h3>
                {imageHeatmap && (
                  <button
                    onClick={regenerateHeatmap}
                    disabled={analyzingHeatmap}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                  >
                    {analyzingHeatmap ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    {analyzingHeatmap ? "Gerando..." : "Pedir nova análise"}
                  </button>
                )}
              </div>
              {heatmapOptions && (
                <p className="text-[10px] text-emerald font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Sparkles size={10} /> Análise gerada por IA
                </p>
              )}
              {analyzingHeatmap ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                  <Loader2 size={14} className="animate-spin text-emerald" />
                  Gerando análise com IA...
                </div>
              ) : (
                <p className="text-sm text-foreground leading-relaxed mb-3">
                  {heatmapAnalysis || (
                    <span className="text-muted-foreground italic">
                      Cole um print do heatmap no passo 1 para gerar a análise.
                    </span>
                  )}
                </p>
              )}
              {heatmapOptions && !analyzingHeatmap && (
                <details className="text-xs mb-3">
                  <summary className="cursor-pointer text-primary font-medium hover:text-primary/80">
                    Ver outra opção de análise
                  </summary>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(["exemplo1", "exemplo2"] as const).map((k, i) => (
                      <button
                        key={k}
                        onClick={() => setHeatmapAnalysis(heatmapOptions[k])}
                        className={cn(
                          "text-left p-2 rounded-lg border text-xs transition",
                          heatmapAnalysis.trim() === heatmapOptions[k].trim()
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <span className="font-bold text-primary text-[10px] uppercase">Exemplo {i + 1}</span>
                        <p className="text-foreground mt-1">{heatmapOptions[k]}</p>
                      </button>
                    ))}
                  </div>
                </details>
              )}
              {imageHeatmapPreview && (
                <div className="rounded-xl overflow-hidden border border-border mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageHeatmapPreview} alt="Heatmap" className="w-full object-contain max-h-56" />
                </div>
              )}
              {heatmap.some((h) => h.nome.trim()) && (
                <div className="space-y-1.5">
                  {heatmap.filter((h) => h.nome.trim()).map((h, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-secondary/40 border border-border/60">
                      <span className="text-xs font-mono font-bold text-primary w-14 shrink-0">{h.score}</span>
                      <span className="text-sm text-foreground">{h.nome}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Contenção */}
            {contentionActions.some((a) => a.domain.trim()) && (
              <div>
                <h3 className="font-bold text-primary mb-1.5 text-sm">4. Status das Ações de Contenção</h3>
                <p className="text-xs text-muted-foreground mb-3 italic">
                  Detalhe do andamento das principais tratativas com agressores:
                </p>
                <ul className="space-y-2">
                  {contentionActions.filter((a) => a.domain.trim()).map((a, i) => (
                    <li key={i} className="text-sm text-foreground">
                      <span className="font-semibold">{a.domain}:</span>{" "}
                      <span className="text-muted-foreground">{a.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 5. Standby - vem ANTES de Aprovação/Resolvidos */}
            {standbyCases.some((c) => c.agressor.trim()) && (
              <div>
                <h3 className="font-bold text-primary mb-1.5 text-sm">5. Casos em Standby e em Notificação Extrajudicial</h3>
                <p className="text-xs text-muted-foreground mb-3 italic">
                  Os seguintes casos estão em standby ou em processo de notificação extrajudicial, após esgotamento das tentativas de contato direto:
                </p>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Agressor</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Próxima Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standbyCases.filter((c) => c.agressor.trim()).map((c, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-3 font-medium">{c.agressor}</td>
                        <td className="py-2 px-3 text-muted-foreground">{c.status}</td>
                        <td className="py-2 px-3 text-muted-foreground">{c.nextAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 6. Aguardando aprovação */}
            {awaitingApproval.trim() && (
              <div>
                <h3 className="font-bold text-primary mb-1.5 text-sm">6. Agressores Aguardando Aprovação</h3>
                <p className="text-xs text-muted-foreground mb-2 italic">
                  A lista abaixo inclui os agressores recém-identificados que aguardam aprovação para o início das tratativas.
                </p>
                <ul className="space-y-1">
                  {awaitingApproval.split("\n").filter(Boolean).map((d, i) => (
                    <li key={i} className="text-sm text-foreground">• {d.trim()}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 7. Resolvidos - último */}
            {resolved.trim() && (
              <div>
                <h3 className="font-bold text-primary mb-1.5 text-sm">7. Agressores Resolvidos (Sucesso)</h3>
                <p className="text-xs text-muted-foreground mb-2 italic">
                  Os seguintes agressores tiveram suas atividades contidas com sucesso nos últimos dias:
                </p>
                <ul className="space-y-1">
                  {resolved.split("\n").filter(Boolean).map((d, i) => (
                    <li key={i} className="text-sm text-foreground">• {d.trim()}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between pt-1">
          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <ChevronLeft size={15} />Voltar
          </button>
          <button
            onClick={downloadPdf}
            disabled={generatingPdf}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm disabled:opacity-60"
          >
            {generatingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {generatingPdf ? "Gerando..." : "Baixar PDF"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-background overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <StepIndicator current={step} />
          <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>
        </div>
      </div>
    </div>
  );
}
