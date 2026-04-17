import { useState, useEffect, useRef } from "react";

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

function FolderInput({ files, onChange, onError }) {
  const inputRef = useRef(null);
  const pairCount = files.length >= 2 ? (files.length * (files.length - 1)) / 2 : 0;

  async function pick() {
    // Modern API — no browser upload confirmation dialog
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker({ mode: "read" });
        const selected = [];
        for await (const entry of dir.values()) {
          if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".txt")) {
            selected.push(await entry.getFile());
          }
        }
        if (selected.length === 0) onError("No .txt files found in that folder.");
        else { onError(null); onChange(selected); }
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
        // fall through to input fallback
      }
    }
    // Fallback for browsers without showDirectoryPicker
    inputRef.current.click();
  }

  function handleFallbackChange(e) {
    const selected = Array.from(e.target.files).filter((f) =>
      f.name.toLowerCase().endsWith(".txt")
    );
    if (selected.length === 0) onError("No .txt files found in that folder.");
    else { onError(null); onChange(selected); }
  }

  return (
    <div
      onClick={pick}
      className="group cursor-pointer border border-dashed border-zinc-600 rounded-sm px-6 py-10 text-center hover:border-zinc-400 hover:bg-zinc-900/40 transition-all duration-300"
    >
      {files.length > 0 ? (
        <>
          <p className="text-base font-semibold text-zinc-100 tracking-wide">
            {files.length} file{files.length !== 1 ? "s" : ""} selected
          </p>
          <p className="text-xs text-zinc-500 mt-1.5 tracking-widest uppercase">
            {pairCount} pair{pairCount !== 1 ? "s" : ""} to compare
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
          <p className="text-zinc-300 text-sm font-medium tracking-wide">Select a folder</p>
          <p className="text-zinc-600 text-xs mt-1 tracking-wider">all .txt files will be compared</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFallbackChange}
        {...{ webkitdirectory: "" }}
      />
    </div>
  );
}

function LoaderView({ totalPairs, currentStep }) {
  return (
    <div className="animate-fade-in">
      <p className="text-[10px] text-zinc-600 uppercase tracking-[0.3em] mb-7">
        {totalPairs} comparison{totalPairs !== 1 ? "s" : ""} in progress
      </p>
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

export default function App() {
  const [files,   setFiles]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error,   setError]   = useState(null);
  const currentStep = useStepLoader(loading);

  const pairCount  = files.length >= 2 ? (files.length * (files.length - 1)) / 2 : 0;
  const hasResults = results !== null;

  async function handleSubmit() {
    if (files.length < 2) { setError("Select a folder with at least 2 .txt files."); return; }
    setError(null);
    setResults(null);
    setLoading(true);

    const body = new FormData();
    files.forEach((f) => body.append("files", f));

    try {
      const res  = await fetch(API_URL, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");
      setResults(data);
    } catch (err) {
      setError(err.message || "Unexpected error. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen overflow-hidden bg-[#0a0a0a]">

      {/* ── Left: Form ── */}
      <div className={`shrink-0 flex items-center justify-center transition-all duration-700 ease-in-out ${
        hasResults ? "w-1/2" : "w-full"
      }`}>
        <div className="w-full max-w-sm px-8 py-12">

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

          {loading ? (
            <LoaderView totalPairs={pairCount} currentStep={currentStep} />
          ) : (
            <div className="flex flex-col gap-3 animate-fade-in">
              <FolderInput files={files} onChange={setFiles} onError={setError} />

              <button
                type="button"
                onClick={handleSubmit}
                disabled={files.length < 2}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-sm px-4 py-3 text-xs font-semibold text-zinc-200 tracking-widest uppercase hover:bg-zinc-700 hover:border-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
              >
                {pairCount > 0 ? `Run ${pairCount} check${pairCount !== 1 ? "s" : ""}` : "Run checks"}
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

      {/* ── Right: Results — slides in ── */}
      <div className={`shrink-0 transition-all duration-700 ease-in-out overflow-hidden border-l border-zinc-800 bg-[#0d0d0d] ${
        hasResults ? "w-1/2" : "w-0"
      }`}>
        {results && (
          <div className="h-full overflow-y-auto px-8 py-12 animate-fade-in">

            {/* Mean */}
            <div className="mb-8 pl-4 border-l-2 border-zinc-700">
              <p className="text-[9px] text-zinc-600 uppercase tracking-[0.35em] mb-3">
                Mean Similarity
              </p>
              <p className={`text-6xl font-black leading-none tabular-nums ${
                results.mean > 50 ? "text-red-500" : "text-emerald-500"
              }`}>
                {results.mean.toFixed(2)}
                <span className="text-2xl font-semibold text-zinc-500">%</span>
              </p>
              <p className="text-[10px] text-zinc-600 mt-3 tracking-widest uppercase">
                {results.pairs.length} pair{results.pairs.length !== 1 ? "s" : ""} analysed
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <span className="flex-1 border-t border-zinc-800" />
              <span className="text-[9px] text-zinc-700 tracking-widest uppercase">results</span>
              <span className="flex-1 border-t border-zinc-800" />
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {results.pairs.map((pair, i) => (
                <ResultCard key={`${pair.file1}-${pair.file2}`} pair={pair} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
