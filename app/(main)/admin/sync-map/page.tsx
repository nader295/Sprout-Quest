"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRouter } from "next/navigation";

export default function SyncMapPage() {
  const { isOwner, loading } = useAuth();
  const router = useRouter();

  const [running, setRunning]           = useState(false);
  const [done, setDone]                 = useState(false);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [totalAffected, setTotalAffected]   = useState(0);
  const [totalUsers, setTotalUsers]         = useState(0);
  const [currentBatch, setCurrentBatch]     = useState(0);
  const [logs, setLogs]                 = useState<{ msg: string; type: "info"|"ok"|"err" }[]>([]);
  const stopRef = useRef(false);
  const logRef  = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string, type: "info"|"ok"|"err" = "info") => {
    setLogs(p => [...p, { msg, type }]);
    setTimeout(() => {
      if (logRef.current)
        logRef.current.scrollTop = logRef.current.scrollHeight;
    }, 50);
  }, []);

  const startSync = useCallback(async () => {
    stopRef.current = false;
    setRunning(true);
    setDone(false);
    setTotalProcessed(0);
    setTotalAffected(0);
    setTotalUsers(0);
    setCurrentBatch(0);
    setLogs([{ msg: "بدأت المزامنة من Firebase...", type: "info" }]);

    let batch = 0;
    let affected = 0;

    while (!stopRef.current) {
      try {
        const res = await fetch(`/api/sync-script?batch=${batch}&size=40`);
        if (!res.ok) {
          addLog(`خطأ HTTP ${res.status}`, "err");
          break;
        }
        const data = await res.json();

        if (!data.success) {
          addLog("فشل: " + (data.error || "خطأ غير معروف"), "err");
          break;
        }

        const parts  = (data.processed || "0/0").split("/");
        const proc   = parseInt(parts[0]) || 0;
        const total  = parseInt(parts[1]) || 0;
        affected += data.affected || 0;

        setTotalProcessed(proc);
        setTotalUsers(total);
        setTotalAffected(affected);
        setCurrentBatch(batch);
        addLog(`Batch ${batch}: حُدِّث ${data.affected ?? 0} — ${proc}/${total}`, "ok");

        if (data.done) {
          addLog(`اكتملت المزامنة! إجمالي المحدَّث: ${affected} مستخدم ✓`, "ok");
          setDone(true);
          break;
        }

        batch++;
        await new Promise(r => setTimeout(r, 600));
      } catch (e: unknown) {
        addLog("فشل الطلب: " + (e instanceof Error ? e.message : String(e)), "err");
        break;
      }
    }

    setRunning(false);
  }, [addLog]);

  const stopSync = useCallback(() => {
    stopRef.current = true;
    addLog("تم الإيقاف يدوياً.", "info");
  }, [addLog]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-white/40 font-mono text-sm">Loading...</p>
    </div>
  );

  if (!isOwner) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-400 font-mono text-sm">غير مصرح ⛔</p>
    </div>
  );

  const pct = totalUsers > 0 ? Math.round(totalProcessed / totalUsers * 100) : 0;

  const COLOR = { info: "text-blue-400", ok: "text-emerald-400", err: "text-red-400" };

  return (
    <div className="min-h-screen bg-[#000206] pb-24 px-4 pt-6">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()}
            className="text-white/40 hover:text-white text-xl font-mono">←</button>
          <h1 className="text-white font-black font-mono text-lg tracking-wider">
            SYNC MAP DATA
          </h1>
          <span className={`h-2.5 w-2.5 rounded-full ml-auto ${
            running ? "bg-yellow-400 animate-pulse" : done ? "bg-emerald-400" : "bg-white/20"
          }`}/>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "تمت معالجته", val: totalProcessed },
            { label: "تم تحديثه",   val: totalAffected  },
            { label: "الـ Batch",    val: currentBatch   },
          ].map(s => (
            <div key={s.label}
              className="rounded-2xl p-3 text-center"
              style={{ background: "rgba(0,16,36,0.8)", border: "1px solid rgba(0,200,255,0.1)" }}>
              <p className="text-[9px] font-mono text-white/30 tracking-widest mb-1">{s.label}</p>
              <p className="text-xl font-black text-[#00c8ff] font-mono">{s.val}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="rounded-2xl p-4"
          style={{ background: "rgba(0,16,36,0.8)", border: "1px solid rgba(0,200,255,0.1)" }}>
          <div className="flex justify-between mb-2">
            <span className="text-[10px] font-mono text-white/30">التقدم</span>
            <span className="text-[10px] font-mono text-[#00c8ff]">{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-white/5">
            <div className="h-full bg-[#00c8ff] rounded-full transition-all duration-500"
              style={{ width: pct + "%" }}/>
          </div>
          <p className="text-[9px] font-mono text-white/20 mt-2">
            {totalProcessed} / {totalUsers || "???"}
          </p>
        </div>

        {/* Log */}
        <div ref={logRef}
          className="rounded-2xl p-4 h-52 overflow-y-auto space-y-1"
          style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}>
          {logs.map((l, i) => (
            <p key={i} className={`text-[11px] font-mono ${COLOR[l.type]}`}>{l.msg}</p>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={startSync}
            disabled={running}
            className="flex-1 rounded-2xl py-3 text-sm font-black font-mono tracking-wider disabled:opacity-40 transition-all"
            style={{
              background: running ? "rgba(0,200,255,0.05)" : "linear-gradient(135deg,#00c8ff,#00f5aa)",
              color: running ? "rgba(0,200,255,0.4)" : "#001a10",
            }}>
            {running ? "جارٍ المزامنة..." : done ? "إعادة المزامنة" : "ابدأ المزامنة"}
          </button>
          <button
            onClick={stopSync}
            disabled={!running}
            className="rounded-2xl px-5 py-3 text-sm font-black font-mono tracking-wider disabled:opacity-30 transition-all"
            style={{ background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.2)", color: "#ff6464" }}>
            إيقاف
          </button>
        </div>

        {done && (
          <button
            onClick={() => router.push("/community")}
            className="w-full rounded-2xl py-3 text-sm font-black font-mono tracking-wider text-[#001a10]"
            style={{ background: "linear-gradient(135deg,#00f5aa,#00c8ff)" }}>
            اذهب إلى الخريطة ←
          </button>
        )}

      </div>
    </div>
  );
}
