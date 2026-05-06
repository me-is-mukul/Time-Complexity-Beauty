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
      found.sort((a, b) => a.name.localeCompare(b.name));
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

// ── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ pair, index }) {
  return (
    <div
      className="animate-fade-in-up group bg-zinc-950 border border-zinc-700/70 rounded-sm px-4 py-3.5 hover:border-zinc-500 hover:bg-zinc-900 transition-all duration-200"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-300 truncate font-mono">{pair.file1}</p>
          <div className="flex items-center gap-2 my-1.5">
            <span className="flex-1 border-t border-zinc-800" />
            <span className="text-[9px] text-zinc-700 tracking-widest uppercase shrink-0">vs</span>
            <span className="flex-1 border-t border-zinc-800" />
          </div>
          <p className="text-xs text-zinc-300 truncate font-mono">{pair.file2}</p>
        </div>
        <div className="flex flex-col items-end shrink-0 pl-2">
          <span className="text-xl font-bold text-zinc-100 leading-none tabular-nums">
            {pair.similarity.toFixed(1)}%
          </span>
          <span className={`text-[10px] font-semibold mt-1.5 tracking-widest uppercase ${
            pair.flag ? "text-red-400" : "text-emerald-500"
          }`}>
            {pair.flag ? "flagged" : "clean"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Results Summary Report ───────────────────────────────────────────────────

function ResultsSummaryReport({ results }) {
  const pairs = results.pairs;
  const mean = results.mean;
  const flaggedCount = pairs.filter(p => p.flag).length;
  
  // Calculate statistics
  const similarities = pairs.map(p => p.similarity);
  const sortedSimilarities = [...similarities].sort((a, b) => a - b);
  const median = sortedSimilarities.length % 2 === 0
    ? (sortedSimilarities[sortedSimilarities.length / 2 - 1] + sortedSimilarities[sortedSimilarities.length / 2]) / 2
    : sortedSimilarities[Math.floor(sortedSimilarities.length / 2)];
  
  const minSimilarity = Math.min(...similarities);
  const maxSimilarity = Math.max(...similarities);
  const variance = similarities.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / similarities.length;
  const stdDev = Math.sqrt(variance);
  
  // Categorize results
  const critical = pairs.filter(p => p.similarity > 75);
  const high = pairs.filter(p => p.similarity > 50 && p.similarity <= 75);
  const moderate = pairs.filter(p => p.similarity > 25 && p.similarity <= 50);
  const low = pairs.filter(p => p.similarity <= 25);
  
  // Color mapping
  const severityColor = (similarity) => {
    if (similarity > 75) return "text-red-400";
    if (similarity > 50) return "text-orange-400";
    if (similarity > 25) return "text-yellow-400";
    return "text-emerald-400";
  };
  
  const severityBg = (similarity) => {
    if (similarity > 75) return "bg-red-500/10 border-red-500/30";
    if (similarity > 50) return "bg-orange-500/10 border-orange-500/30";
    if (similarity > 25) return "bg-yellow-500/10 border-yellow-500/30";
    return "bg-emerald-500/10 border-emerald-500/30";
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-sm px-4 py-3">
          <p className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] mb-1">Mean</p>
          <p className={`text-2xl font-bold tabular-nums ${mean > 50 ? "text-red-400" : "text-emerald-400"}`}>
            {mean.toFixed(2)}%
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-sm px-4 py-3">
          <p className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] mb-1">Median</p>
          <p className="text-2xl font-bold text-zinc-300 tabular-nums">
            {median.toFixed(2)}%
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-sm px-4 py-3">
          <p className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] mb-1">Std Dev</p>
          <p className="text-2xl font-bold text-zinc-300 tabular-nums">
            ±{stdDev.toFixed(2)}%
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-sm px-4 py-3">
          <p className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] mb-1">Flagged</p>
          <p className={`text-2xl font-bold tabular-nums ${flaggedCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {flaggedCount}/{pairs.length}
          </p>
        </div>
      </div>

      {/* Range Overview */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-sm px-4 py-3">
        <p className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] mb-3">Range</p>
        <div className="flex items-center justify-between text-sm font-mono">
          <span className="text-emerald-400">{minSimilarity.toFixed(2)}%</span>
          <span className="text-zinc-600">—</span>
          <span className="text-red-400">{maxSimilarity.toFixed(2)}%</span>
        </div>
      </div>

      {/* Severity Distribution */}
      <div className="space-y-2">
        <p className="text-[9px] text-zinc-600 uppercase tracking-[0.2em]">Severity Distribution</p>
        
        <div className={`border rounded-sm px-3 py-2 ${severityBg(75)}`}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-300">
              <span className="text-red-400 font-bold">◆ Critical</span> (&gt;75%)
            </span>
            <span className="font-bold text-red-400">{critical.length}</span>
          </div>
        </div>

        <div className={`border rounded-sm px-3 py-2 ${severityBg(60)}`}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-300">
              <span className="text-orange-400 font-bold">◆ High</span> (50-75%)
            </span>
            <span className="font-bold text-orange-400">{high.length}</span>
          </div>
        </div>

        <div className={`border rounded-sm px-3 py-2 ${severityBg(35)}`}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-300">
              <span className="text-yellow-400 font-bold">◆ Moderate</span> (25-50%)
            </span>
            <span className="font-bold text-yellow-400">{moderate.length}</span>
          </div>
        </div>

        <div className={`border rounded-sm px-3 py-2 ${severityBg(10)}`}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-300">
              <span className="text-emerald-400 font-bold">◆ Low</span> (0-25%)
            </span>
            <span className="font-bold text-emerald-400">{low.length}</span>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-sm px-4 py-3">
        <p className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] mb-3">Key Insights</p>
        <ul className="space-y-2 text-xs text-zinc-400">
          <li className="flex gap-2">
            <span className="text-zinc-600">→</span>
            <span>
              {flaggedCount > 0 
                ? `${flaggedCount} potential plagiarism case${flaggedCount !== 1 ? "s" : ""} detected`
                : "No flagged plagiarism cases detected"}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-zinc-600">→</span>
            <span>
              {critical.length > 0
                ? `${critical.length} critical match${critical.length !== 1 ? "es" : ""} with >75% similarity`
                : "No critical matches (>75%) found"}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-zinc-600">→</span>
            <span>
              Overall confidence: {mean > 75 ? "High plagiarism risk" : mean > 50 ? "Moderate concern" : mean > 25 ? "Low concern" : "Minimal risk"}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-zinc-600">→</span>
            <span>
              Consistency: {stdDev > 20 ? "Highly variable results across pairs" : "Relatively consistent results"}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [folders,          setFolders]          = useState([]);
  const [running,          setRunning]          = useState(false);
  const [results,          setResults]          = useState(null);
  const [error,            setError]            = useState(null);
  const [graphData,        setGraphData]        = useState([]);
  const [currentFolderIdx, setCurrentFolderIdx] = useState(-1);
  const [doneFolders,      setDoneFolders]      = useState(new Set());

  const currentStep = useStepLoader(running);
  const showSplit   = running || results !== null || graphData.length > 0;
  const currentFolderName = currentFolderIdx >= 0 && folders[currentFolderIdx]
    ? folders[currentFolderIdx].name
    : "";

  function handleFolderChange(newFolders) {
    setFolders(newFolders);
    setResults(null);
    setGraphData([]);
    setError(null);
    setDoneFolders(new Set());
    setCurrentFolderIdx(-1);
  }

  async function handleSubmit() {
    if (folders.length === 0) return;
    setError(null);
    setResults(null);
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

        setResults(data);
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
    <div className="flex min-h-screen overflow-hidden bg-[#0a0a0a]">

      {/* ── Left: Form + Graph ── */}
      <div className={`shrink-0 transition-all duration-700 ease-in-out ${
        showSplit ? "w-1/2 overflow-y-auto" : "w-full flex items-center justify-center"
      }`}>
        <div className={`w-full px-8 py-12 ${showSplit ? "max-w-md mx-auto" : "max-w-sm"}`}>

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

          {/* Graph — grows as folders complete */}
          <TimeGraph data={graphData} />

        </div>
      </div>

      {/* ── Right: Latest batch results ── */}
      <div className={`shrink-0 transition-all duration-700 ease-in-out overflow-hidden border-l border-zinc-800 bg-[#0d0d0d] ${
        showSplit ? "w-1/2" : "w-0"
      }`}>
        {results && (
          <div className="h-full overflow-y-auto px-8 py-12 animate-fade-in">

            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-4 border-t border-red-800" />
                <p className="text-[9px] text-red-800/80 uppercase tracking-[0.35em]">Analysis Report</p>
              </div>
              <h2 className="text-2xl font-bold text-zinc-100">Plagiarism Report</h2>
              <p className="text-xs text-zinc-600 mt-2">{results.pairs.length} file pair{results.pairs.length !== 1 ? "s" : ""} analysed</p>
            </div>

            {/* Summary Report */}
            <ResultsSummaryReport results={results} />

            {/* Divider */}
            <div className="flex items-center gap-3 my-8">
              <span className="flex-1 border-t border-zinc-800" />
              <span className="text-[9px] text-zinc-700 tracking-widest uppercase">detailed results</span>
              <span className="flex-1 border-t border-zinc-800" />
            </div>

            {/* Detailed Results Cards */}
            <div className="flex flex-col gap-2">
              {results.pairs.map((pair, i) => (
                <ResultCard key={`${pair.file1}-${pair.file2}`} pair={pair} index={i} />
              ))}
            </div>

          </div>
        )}

        {/* Waiting state while first folder processes */}
        {running && !results && (
          <div className="h-full flex items-center justify-center">
            <p className="text-[10px] text-zinc-700 uppercase tracking-[0.3em]">Awaiting first result…</p>
          </div>
        )}
      </div>

    </div>
  );
}
