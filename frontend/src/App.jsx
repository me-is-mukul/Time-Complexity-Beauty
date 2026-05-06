import { useState, useEffect } from "react";

const API_URL = "http://localhost:3001/check-plagiarism-batch";

const STEPS = [
  "Reading documents",
  "Extracting n-grams",
  "Building similarity matrix",
  "Comparing file pairs",
  "Computing statistics",
  "Finalizing results",
];

function useStepLoader(active) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) { setStep(0); return; }
    const id = setInterval(
      () => setStep((s) => (s < STEPS.length - 1 ? s + 1 : s)),
      900
    );
    return () => clearInterval(id);
  }, [active]);
  return step;
}

// ── Multi-folder picker ──────────────────────────────────────────────────────

function MultiFolderInput({ folders, onChange, onError }) {
  // Natural sort function that handles numeric ordering correctly
  const naturalSort = (a, b) => {
    const reA = /[^0-9]+|\d+/g;
    const reN = /^\D/;
    
    const aA = a.name.match(reA) || [];
    const bA = b.name.match(reA) || [];
    
    for (let i = 0; i < Math.min(aA.length, bA.length); i++) {
      const aa = aA[i];
      const bb = bA[i];
      
      // If both are numbers, compare numerically
      if (!reN.test(aa) && !reN.test(bb)) {
        const aNum = parseInt(aa, 10);
        const bNum = parseInt(bb, 10);
        if (aNum !== bNum) return aNum - bNum;
      } else {
        // Otherwise, compare as strings
        if (aa !== bb) return aa.localeCompare(bb);
      }
    }
    
    return aA.length - bA.length;
  };

  async function pick() {
    if (!window.showDirectoryPicker) {
      onError("showDirectoryPicker not supported — use Chrome or Edge.");
      return;
    }
    try {
      const dir = await window.showDirectoryPicker({ mode: "read" });
      const found = [];
      for await (const entry of dir.values()) {
        if (entry.kind === "directory") {
          const files = [];
          for await (const fe of entry.values()) {
            if (fe.kind === "file" && fe.name.toLowerCase().endsWith(".txt")) {
              files.push(await fe.getFile());
            }
          }
          found.push({ name: entry.name, files });
        }
      }
      found.sort(naturalSort);
      if (found.length === 0) {
        onError("No sub-folders found inside the selected folder.");
      } else {
        onError(null);
        onChange(found);
      }
    } catch (err) {
      if (err.name !== "AbortError") onError("Could not read the folder.");
    }
  }

  const totalFiles = folders.reduce((s, f) => s + f.files.length, 0);

  return (
    <div
      onClick={pick}
      className="group cursor-pointer border border-dashed border-zinc-600 rounded-sm px-6 py-10 text-center hover:border-zinc-400 hover:bg-zinc-900/40 transition-all duration-300"
    >
      {folders.length > 0 ? (
        <>
          <p className="text-base font-semibold text-zinc-100 tracking-wide">
            {folders.length} sub-folder{folders.length !== 1 ? "s" : ""} found
          </p>
          <p className="text-xs text-zinc-500 mt-1.5 tracking-widest uppercase">
            {totalFiles} .txt file{totalFiles !== 1 ? "s" : ""} total
          </p>
        </>
      ) : (
        <>
          <svg
            className="w-6 h-6 mx-auto mb-3 text-zinc-500 group-hover:text-zinc-300 transition-colors"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <p className="text-zinc-300 text-sm font-medium tracking-wide">Select parent folder</p>
          <p className="text-zinc-600 text-xs mt-1 tracking-wider">each sub-folder is benchmarked separately</p>
        </>
      )}
    </div>
  );
}

function FolderList({ folders, activeIdx, doneSet }) {
  if (folders.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
      {folders.map((f, i) => {
        const isActive = i === activeIdx;
        const isDone   = doneSet.has(i);
        return (
          <div
            key={f.name}
            className={`flex items-center justify-between px-3 py-1.5 border rounded-sm transition-colors duration-300 ${
              isActive
                ? "bg-zinc-800 border-zinc-600"
                : isDone
                ? "bg-zinc-950 border-zinc-800/50"
                : "bg-zinc-900 border-zinc-800"
            }`}
          >
            <span className={`text-xs font-mono truncate ${isActive ? "text-zinc-100" : "text-zinc-500"}`}>
              {f.name}
            </span>
            <span className="text-[10px] text-zinc-600 ml-3 shrink-0 tabular-nums">
              {f.files.length} file{f.files.length !== 1 ? "s" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Time Graph ───────────────────────────────────────────────────────────────

function TimeGraph({ data }) {
  if (data.length === 0) return null;

  const W = 500, H = 320;
  const pad = { top: 20, right: 30, bottom: 60, left: 70 };
  const iW  = W - pad.left - pad.right;
  const iH  = H - pad.top  - pad.bottom;

  const maxFiles = Math.max(...data.map(d => d.fileCount));
  const maxTime  = Math.max(...data.map(d => d.timeMs), 10);
  const filesMax = maxFiles  < 3  ? maxFiles  + 1 : maxFiles;
  const timeMax  = Math.ceil(maxTime / 50) * 50;

  const sx = (v) => pad.left + (v / filesMax) * iW;
  const sy = (v) => pad.top  + iH - (v / timeMax) * iH;

  const sorted = [...data].sort((a, b) => a.fileCount - b.fileCount);

  const linePath = sorted.length > 1
    ? sorted.map((d, i) => `${i === 0 ? "M" : "L"} ${sx(d.fileCount).toFixed(1)} ${sy(d.timeMs).toFixed(1)}`).join(" ")
    : "";

  const areaPath = sorted.length > 1
    ? `${linePath} L ${sx(sorted[sorted.length - 1].fileCount).toFixed(1)} ${(pad.top + iH).toFixed(1)} L ${sx(sorted[0].fileCount).toFixed(1)} ${(pad.top + iH).toFixed(1)} Z`
    : "";

  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((i / 4) * timeMax));
  const xTicks = [...new Set(data.map(d => d.fileCount))].sort((a, b) => a - b);

  const fmtTime = (ms) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

  return (
    <div className="mt-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-4 border-t border-zinc-800" />
        <p className="text-[9px] text-zinc-600 uppercase tracking-[0.3em]">Files vs Analysis Time</p>
        <span className="flex-1 border-t border-zinc-800" />
      </div>

      <svg width={W} height={H} className="overflow-visible">
        {/* Grid */}
        {yTicks.map(t => (
          <line key={t} x1={pad.left} y1={sy(t)} x2={W - pad.right} y2={sy(t)}
            stroke="#18181b" strokeWidth={1} />
        ))}

        {/* Axes */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + iH} stroke="#3f3f46" strokeWidth={1.5} />
        <line x1={pad.left} y1={pad.top + iH} x2={W - pad.right} y2={pad.top + iH} stroke="#3f3f46" strokeWidth={1.5} />

        {/* Y ticks */}
        {yTicks.map(t => (
          <g key={t}>
            <line x1={pad.left - 5} y1={sy(t)} x2={pad.left} y2={sy(t)} stroke="#3f3f46" strokeWidth={1} />
            <text x={pad.left - 8} y={sy(t)} textAnchor="end" dominantBaseline="middle"
              fill="#52525b" fontSize={10} fontFamily="ui-monospace,monospace">
              {fmtTime(t)}
            </text>
          </g>
        ))}

        {/* X ticks */}
        {xTicks.map(t => (
          <g key={t}>
            <line x1={sx(t)} y1={pad.top + iH} x2={sx(t)} y2={pad.top + iH + 5} stroke="#3f3f46" strokeWidth={1} />
            <text x={sx(t)} y={pad.top + iH + 18} textAnchor="middle"
              fill="#52525b" fontSize={10} fontFamily="ui-monospace,monospace">
              {t}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text
          x={(pad.left + W - pad.right) / 2} y={H - 8}
          textAnchor="middle" fill="#3f3f46" fontSize={10} letterSpacing="0.15em"
        >
          NUMBER OF FILES
        </text>
        <text
          transform={`translate(12, ${pad.top + iH / 2}) rotate(-90)`}
          textAnchor="middle" fill="#3f3f46" fontSize={10} letterSpacing="0.12em"
        >
          TIME (ms)
        </text>

        {/* Area */}
        {areaPath && <path d={areaPath} fill="#ef4444" opacity={0.08} />}

        {/* Line */}
        {linePath && (
          <path d={linePath} fill="none" stroke="#ef4444" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        )}

        {/* Points */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={sx(d.fileCount)} cy={sy(d.timeMs)} r={7} fill="#ef4444" opacity={0.12} />
            <circle cx={sx(d.fileCount)} cy={sy(d.timeMs)} r={4} fill="#ef4444" opacity={0.9} />
          </g>
        ))}

        {/* Labels on points */}
        {data.map((d, i) => (
          <text
            key={`lbl-${i}`}
            x={sx(d.fileCount)} y={sy(d.timeMs) - 12}
            textAnchor="middle" fill="#71717a" fontSize={9} fontFamily="ui-monospace,monospace"
          >
            {fmtTime(d.timeMs)}
          </text>
        ))}
      </svg>

      {/* Legend row */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
        {data.map((d, i) => (
          <span key={i} className="text-[10px] text-zinc-600 font-mono">
            <span className="text-red-600">●</span> {d.folderName} — {d.fileCount}f / {fmtTime(d.timeMs)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Loader ───────────────────────────────────────────────────────────────────

function LoaderView({ totalFolders, currentFolderIdx, currentFolderName, currentStep }) {
  return (
    <div className="animate-fade-in">
      <p className="text-[10px] text-zinc-600 uppercase tracking-[0.3em] mb-0.5">
        Folder {currentFolderIdx + 1} of {totalFolders}
      </p>
      <p className="text-xs text-zinc-400 font-mono mb-7 truncate">{currentFolderName}</p>
      <div className="flex flex-col gap-5">
        {STEPS.map((label, i) => {
          const done   = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={label} className="flex items-center gap-4">
              <span className="w-4 h-4 flex items-center justify-center shrink-0">
                {done ? (
                  <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : active ? (
                  <span className="w-3 h-3 border border-zinc-300 border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <span className="w-1 h-1 rounded-full bg-zinc-700 inline-block" />
                )}
              </span>
              <span className={`text-sm tracking-wide transition-colors duration-500 ${
                done   ? "text-zinc-700 line-through"  :
                active ? "text-zinc-100 font-medium"   :
                         "text-zinc-700"
              }`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Folder Result Card ──────────────────────────────────────────────────────

function FolderResultCard({ folderName, result, index }) {
  const getRiskColor = () => {
    switch (result.riskLevel) {
      case "critical": return { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", label: "🔴 Critical Risk" };
      case "high": return { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", label: "🟠 High Risk" };
      case "moderate": return { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", label: "🟡 Moderate Risk" };
      case "low": return { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", label: "🟢 Low Risk" };
      default: return { bg: "bg-zinc-500/10", border: "border-zinc-500/30", text: "text-zinc-400", label: "Unknown" };
    }
  };

  const risk = getRiskColor();
  const criticalFlagged = result.flaggedCount > 0;

  return (
    <div
      className={`animate-fade-in-up border rounded-sm px-5 py-4 transition-all duration-200 ${risk.bg} ${risk.border}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate mb-2">{folderName}</p>
          
          {/* Key metrics row */}
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            <span className="text-zinc-400">
              <span className="font-mono font-semibold text-zinc-300">{result.totalPairs}</span> files compared
            </span>
            <span className="text-zinc-400">
              <span className="font-mono font-semibold text-zinc-300">{result.mean.toFixed(1)}%</span> avg similarity
            </span>
          </div>

          {/* Secondary metrics */}
          <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
            <span>Min: <span className="text-zinc-300">{result.minSimilarity.toFixed(1)}%</span></span>
            <span>Max: <span className="text-zinc-300">{result.maxSimilarity.toFixed(1)}%</span></span>
            <span>σ: <span className="text-zinc-300">±{result.stdDev.toFixed(1)}%</span></span>
          </div>
        </div>

        {/* Right: Risk indicator */}
        <div className="flex flex-col items-end shrink-0 pl-4">
          <span className={`text-xs font-bold tracking-wide uppercase mb-2 ${risk.text}`}>
            {risk.label}
          </span>
          <div className="text-center">
            <p className="text-[10px] text-zinc-500 mb-1">Flagged</p>
            <p className={`text-lg font-bold tabular-nums ${criticalFlagged ? "text-red-400" : "text-emerald-400"}`}>
              {result.flaggedCount}/{result.totalPairs}
            </p>
          </div>
        </div>
      </div>

      {/* Alert banner if flagged */}
      {criticalFlagged && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          <p className="text-[10px] text-zinc-300">
            ⚠️ <span className="font-semibold">{result.criticalCount}</span> critical match{result.criticalCount !== 1 ? "es" : ""} detected (&gt;75%)
          </p>
        </div>
      )}
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [folders,           setFolders]           = useState([]);
  const [running,           setRunning]           = useState(false);
  const [folderResults,     setFolderResults]     = useState([]);
  const [error,             setError]             = useState(null);
  const [graphData,         setGraphData]         = useState([]);
  const [currentFolderIdx,  setCurrentFolderIdx]  = useState(-1);
  const [doneFolders,       setDoneFolders]       = useState(new Set());

  const currentStep = useStepLoader(running);
  const showSplit   = running || folderResults.length > 0 || graphData.length > 0;
  const currentFolderName = currentFolderIdx >= 0 && folders[currentFolderIdx]
    ? folders[currentFolderIdx].name
    : "";

  function handleFolderChange(newFolders) {
    setFolders(newFolders);
    setFolderResults([]);
    setGraphData([]);
    setError(null);
    setDoneFolders(new Set());
    setCurrentFolderIdx(-1);
  }

  async function handleSubmit() {
    if (folders.length === 0) return;
    setError(null);
    setFolderResults([]);
    setGraphData([]);
    setDoneFolders(new Set());
    setRunning(true);

    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      setCurrentFolderIdx(i);

      if (folder.files.length < 2) {
        setDoneFolders((prev) => new Set([...prev, i]));
        continue;
      }

      const body = new FormData();
      folder.files.forEach((f) => body.append("files", f));

      const t0 = performance.now();
      try {
        const res  = await fetch(API_URL, { method: "POST", body });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Server error");
        const timeMs = Math.round(performance.now() - t0);

        // Store folder result
        setFolderResults((prev) => [
          ...prev,
          { 
            folderName: folder.name,
            ...data
          }
        ]);

        setGraphData((prev) => [
          ...prev,
          { fileCount: folder.files.length, timeMs, folderName: folder.name },
        ]);
        setDoneFolders((prev) => new Set([...prev, i]));
      } catch (err) {
        setError(`"${folder.name}": ${err.message}`);
      }
    }

    setRunning(false);
    setCurrentFolderIdx(-1);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">

      {/* ── Left: Scrollable Form + Graph ── */}
      <div className={`shrink-0 transition-all duration-700 ease-in-out flex flex-col overflow-y-auto h-screen ${
        showSplit ? "w-1/2" : "w-full"
      }`}>
        {/* Graph at top — scrolls with content */}
        <div className="px-8 py-8">
          <TimeGraph data={graphData} />
        </div>

        {/* Form/Loader below — scrollable */}
        <div className={`flex items-center justify-center ${showSplit ? "" : ""} px-8 py-12`}>
          <div className={`w-full ${showSplit ? "max-w-md" : "max-w-sm"}`}>

            {/* Header */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-4 border-t border-red-800" />
                <p className="text-[9px] text-red-800/80 uppercase tracking-[0.35em]">Forensic Analysis</p>
              </div>
              <h1 className="text-3xl font-bold text-zinc-100 tracking-tight leading-tight">
                Plagiarism<br />
                <span className="text-zinc-500">Checker</span>
              </h1>
            </div>

            {/* Form or Loader */}
            {running ? (
              <LoaderView
                totalFolders={folders.length}
                currentFolderIdx={currentFolderIdx}
                currentFolderName={currentFolderName}
                currentStep={currentStep}
              />
            ) : (
              <div className="flex flex-col gap-3 animate-fade-in">
                <MultiFolderInput folders={folders} onChange={handleFolderChange} onError={setError} />

                <FolderList
                  folders={folders}
                  activeIdx={currentFolderIdx}
                  doneSet={doneFolders}
                />

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={folders.length === 0}
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-sm px-4 py-3 text-xs font-semibold text-zinc-200 tracking-widest uppercase hover:bg-zinc-700 hover:border-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {folders.length > 0
                    ? `Benchmark ${folders.length} folder${folders.length !== 1 ? "s" : ""}`
                    : "Select a folder"}
                </button>

                {error && (
                  <div className="border border-red-900 bg-red-950/40 rounded-sm px-3 py-2.5">
                    <p className="text-xs text-red-400 tracking-wide">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Scrollable Folder Analysis Results ── */}
      <div className={`shrink-0 transition-all duration-700 ease-in-out border-l border-zinc-800 bg-[#0d0d0d] h-screen ${
        showSplit ? "w-1/2 overflow-y-auto" : "w-0 overflow-hidden"
      }`}>
        {folderResults.length > 0 && (
          <div className="animate-fade-in px-8 py-12">

            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-4 border-t border-red-800" />
                <p className="text-[9px] text-red-800/80 uppercase tracking-[0.35em]">Folder Analysis</p>
              </div>
              <h2 className="text-2xl font-bold text-zinc-100">Results Summary</h2>
              <p className="text-xs text-zinc-600 mt-2">{folderResults.length} folder{folderResults.length !== 1 ? "s" : ""} analyzed</p>
            </div>

            {/* Folder Result Cards */}
            <div className="flex flex-col gap-3">
              {folderResults.map((result, i) => (
                <FolderResultCard 
                  key={result.folderName} 
                  folderName={result.folderName} 
                  result={result} 
                  index={i} 
                />
              ))}
            </div>

          </div>
        )}

        {/* Waiting state while first folder processes */}
        {running && folderResults.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-[10px] text-zinc-700 uppercase tracking-[0.3em]">Awaiting first result…</p>
          </div>
        )}
      </div>

    </div>
  );
}
