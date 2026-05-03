"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, RefreshCw, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { LogEntry } from "@/lib/ai/video-processor";

type ClipJob = { scene: number; jobId: string | null; url: string | null };

interface JobRow {
  id: string;
  caption: string | null;
  created_at: string;
  media_urls: string[];
  ai_job_id: string | null;
  platform_data: {
    multi_clip?: boolean;
    clip_jobs?: ClipJob[];
    logs?: LogEntry[];
    voice_url?: string;
  } | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function StatusBadge({ row }: { row: JobRow }) {
  if (row.media_urls?.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="w-3 h-3" /> Completado
      </span>
    );
  }
  const logs = row.platform_data?.logs ?? [];
  const lastError = [...logs].reverse().find((l) => l.level === "error");
  if (lastError) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <XCircle className="w-3 h-3" /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
      <Loader2 className="w-3 h-3 animate-spin" /> Procesando
    </span>
  );
}

function ClipProgress({ clipJobs }: { clipJobs: ClipJob[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {clipJobs.map((c) => (
        <div
          key={c.scene}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border",
            c.url
              ? "bg-green-500 border-green-500 text-white"
              : c.jobId
              ? "bg-yellow-400 border-yellow-400 text-white"
              : "bg-muted border-border text-muted-foreground",
          )}
          title={c.url ? `Clip ${c.scene}: listo` : c.jobId ? `Clip ${c.scene}: procesando (${c.jobId})` : `Clip ${c.scene}: en espera`}
        >
          {c.scene}
        </div>
      ))}
      <span className="text-xs text-muted-foreground ml-1">
        {clipJobs.filter((c) => c.url).length}/{clipJobs.length} clips
      </span>
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const time = new Date(entry.ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className={cn("flex gap-2 text-xs font-mono py-0.5", {
      "text-muted-foreground": entry.level === "info",
      "text-yellow-600 dark:text-yellow-400": entry.level === "warn",
      "text-red-600 dark:text-red-400": entry.level === "error",
    })}>
      <span className="shrink-0 opacity-60">{time}</span>
      <span className={cn("shrink-0 uppercase font-bold w-10", {
        "text-blue-500": entry.level === "info",
        "text-yellow-500": entry.level === "warn",
        "text-red-500": entry.level === "error",
      })}>{entry.level}</span>
      <span className="break-all">{entry.msg}</span>
    </div>
  );
}

function JobCard({ row }: { row: JobRow }) {
  const [expanded, setExpanded] = useState(false);
  const logs = row.platform_data?.logs ?? [];
  const clipJobs = row.platform_data?.clip_jobs;
  const isMulti = row.platform_data?.multi_clip === true;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="mt-0.5 shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge row={row} />
            {isMulti && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Multi-clip</span>}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {relativeTime(row.created_at)}
            </span>
          </div>
          {row.caption && (
            <p className="text-sm text-foreground truncate">{row.caption}</p>
          )}
          {clipJobs && <ClipProgress clipJobs={clipJobs} />}
          <p className="text-xs text-muted-foreground/60 font-mono">{row.id}</p>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">
          {logs.length} entradas
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sin registros aún</p>
          ) : (
            <div className="space-y-0.5 max-h-96 overflow-y-auto">
              {logs.map((entry, i) => (
                <LogLine key={i} entry={entry} />
              ))}
            </div>
          )}
          {row.media_urls?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <a
                href={row.media_urls[0]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline break-all"
              >
                Ver video → {row.media_urls[0]}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/logs");
      if (!res.ok) return;
      const { data } = await res.json();
      setJobs(data ?? []);
      setLastRefresh(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const processing = jobs.filter((j) => j.media_urls?.length === 0).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-500" />
            Registros de generación
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Últimos 7 días — jobs de video Kling
            {processing > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                {processing} en proceso
              </span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {lastRefresh ? lastRefresh.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No hay registros de generación de video aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <JobCard key={job.id} row={job} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">Actualización automática cada 10 segundos</p>
    </div>
  );
}
