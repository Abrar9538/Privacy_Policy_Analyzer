"use client";

import { FileText, Globe2, Link2, LoaderCircle, ScanLine, Sparkles, TextCursorInput, UploadCloud, X } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { errorMessage, post, type Report, type SourceKind } from "./api-client";

const options = [
  { id: "pdf", label: "Upload PDF", icon: FileText },
  { id: "url", label: "Website URL", icon: Link2 },
  { id: "text", label: "Paste Text", icon: TextCursorInput },
] as const;
const maxFile = 10 * 1024 * 1024;

export default function Analyzer({ onReport, mode }: { onReport: (report: Report) => void; mode?: string }) {
  const [kind, setKind] = useState<SourceKind>("pdf");
  const [file, setFile] = useState<File>();
  const [url, setUrl] = useState("");
  const [policy, setPolicy] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState<"policy" | "sample">();
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function choose(next?: File) {
    if (!next) return;
    setProblem("");
    if (!next.name.toLowerCase().endsWith(".pdf")) {
      setProblem("Choose a PDF file.");
      return;
    }
    if (next.size > maxFile) {
      setProblem("Choose a PDF file that is 10 MB or smaller.");
      return;
    }
    setFile(next);
  }

  async function analyze(sample = false) {
    if (busy) return;
    setProblem("");
    const data = new FormData();
    if (!sample) {
      if (kind === "pdf" && !file) return setProblem("Choose a PDF file to analyze.");
      if (kind === "url" && !url.trim()) return setProblem("Enter a privacy policy URL.");
      if (kind === "text" && policy.trim().length < 60) return setProblem("Enter at least 60 characters of policy text.");
      data.set("kind", kind);
      if (kind === "pdf" && file) data.set("file", file);
      if (kind !== "pdf") data.set("value", kind === "url" ? url.trim() : policy.trim());
    }
    setBusy(sample ? "sample" : "policy");
    try {
      onReport(await post<Report>(sample ? "sample" : "analyze", sample ? undefined : data));
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(undefined);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void analyze();
  }

  return (
    <section className="panel input-panel" aria-labelledby="input-title">
      <div className="panel-heading">
        <div className="tile-icon blue"><ScanLine size={20} /></div>
        <div><h2 id="input-title">Analyze a policy</h2><p>Choose how you’d like to provide a privacy policy.</p></div>
      </div>
      <form onSubmit={submit} noValidate aria-busy={!!busy}>
        <div className="source-tabs" role="group" aria-label="Policy input type">
          {options.map(({ id, label, icon: Icon }) => (
            <button type="button" disabled={!!busy} key={id} className={kind === id ? "selected" : ""}
              aria-pressed={kind === id} onClick={() => { setKind(id); setProblem(""); }}>
              <Icon size={17} /><span>{label}</span>
            </button>
          ))}
        </div>
        {kind === "pdf" ? (
          <div className={"drop-zone" + (dragging ? " dragging" : "")} onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }} onDragLeave={() => setDragging(false)} onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy) choose(event.dataTransfer.files[0]);
          }}>
            <input ref={input} type="file" accept=".pdf,application/pdf" hidden disabled={!!busy}
              onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ""; }} />
            <button type="button" className="drop-select" disabled={!!busy} onClick={() => input.current?.click()}>
              <span className="upload-icon">{file ? <FileText size={23} /> : <UploadCloud size={25} />}</span>
              <strong>{file ? file.name : <><span>Click to upload</span> or drag and drop</>}</strong>
              <small>{file ? (file.size / 1024).toFixed(1) + " KB · Click to replace" : "PDF files up to 10 MB"}</small>
            </button>
            {file && <button type="button" className="remove-file" aria-label="Remove PDF" disabled={!!busy} onClick={() => setFile(undefined)}><X size={17} /></button>}
          </div>
        ) : kind === "url" ? (
          <div className="source-fields">
            <label htmlFor="policy-url">Privacy policy URL</label>
            <div className="field-with-icon"><Globe2 size={18} /><input disabled={!!busy} id="policy-url" type="url" placeholder="https://example.com/privacy" maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} /></div>
            <p>Use the direct link to a publicly accessible privacy policy.</p>
          </div>
        ) : (
          <div className="source-fields">
            <label htmlFor="policy-text">Privacy policy text</label>
            <textarea disabled={!!busy} id="policy-text" value={policy} maxLength={160000} placeholder="Paste the full privacy policy here…" onChange={(event) => setPolicy(event.target.value)} />
            <p>{policy.length.toLocaleString("en-US")} / 160,000 characters</p>
          </div>
        )}
        {problem && <p className="error-banner" role="alert">{problem}</p>}
        <div className="form-actions">
          <button className="btn primary" disabled={!!busy} type="submit">
            {busy === "policy" ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />}
            {busy === "policy" ? "Analyzing policy…" : "Analyze Policy"}
          </button>
          <button className="btn quiet" disabled={!!busy} type="button" onClick={() => void analyze(true)}>
            {busy === "sample" && <LoaderCircle className="animate-spin" size={16} />}
            {busy === "sample" ? "Opening sample…" : "Try a sample"}
          </button>
        </div>
        {busy && <p className="form-note" role="status">Reading the source and checking evidence. This may take a moment.</p>}
        {mode === "gemini" && <p className="form-note">Policy text is sent to Google Gemini. Avoid submitting sensitive information.</p>}
      </form>
    </section>
  );
}
