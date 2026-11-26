"use client";

import { AlertCircle, ArrowDownToLine, Check, ChevronDown, CircleHelp, Database, FileSearch, FileText, Fingerprint, GitCompareArrows, ListFilter, LoaderCircle, MessageSquareText, Quote, Send, Share2, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { downloadReport, errorMessage, modeLabels, post, type Answer, type Category, type Comparison, type Report } from "./api-client";

export const categoryInfo = {
  collection: { title: "Data Collection", description: "What information is collected and how it’s used.", icon: Fingerprint, tint: "blue" },
  storage: { title: "Data Storage", description: "How your data is stored, protected and retained.", icon: Database, tint: "violet" },
  sharing: { title: "Third-Party Sharing", description: "Who your data is shared with and why.", icon: Share2, tint: "mint" },
  consent: { title: "User Consent", description: "Your choices, permissions and opt-out options.", icon: ShieldCheck, tint: "amber" },
};

const ranking = { low: 1, moderate: 2, high: 3 };
const notice = "Concern indicators reflect the policy’s wording. For information only. No legal advice or compliance certification.";
const suggestions = ["What data do they collect?", "How long is my data kept?", "Can I opt out of cookies?", "What threats does the policy address?"];

export function EmptyState({ title, action }: { title: string; action: () => void }) {
  return <section className="panel empty-state">
    <span className="tile-icon blue"><FileSearch size={24} /></span>
    <h2>{title}</h2>
    <p>Analyze a PDF, website URL or pasted policy to get started.</p>
    <button className="btn primary" onClick={action}>Analyze a policy</button>
  </section>;
}

export function ExportButton({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  async function exportPdf() {
    setState("busy");
    setError("");
    try {
      await downloadReport(id);
      setState("done");
    } catch (problem) {
      setError(errorMessage(problem));
      setState("idle");
    }
  }
  return <div className="export-wrap"><button disabled={state === "busy"} className="btn secondary" onClick={() => void exportPdf()}>
    {state === "busy" ? <LoaderCircle className="animate-spin" size={16} /> : state === "done" ? <Check size={16} /> : <ArrowDownToLine size={16} />}
    Export PDF
  </button>{state === "done" && <span className="sr-only" role="status">PDF download started.</span>}
  {error && <p className="inline-error" role="alert">{error}</p>}</div>;
}

function CategoryContent({ category }: { category: Category }) {
  return <div className="category-content">
    {category.findings.map((finding) => <div className="finding" key={finding.excerpt}>
      <span className={"concern " + finding.concern}>{finding.concern} concern</span>
      <p>{finding.summary}</p>
      <details className="evidence">
        <summary><Quote size={14} /> Original evidence <ChevronDown size={14} className="chevron" /></summary>
        <blockquote>“{finding.excerpt}”</blockquote>
      </details>
    </div>)}
    {!!category.gaps.length && <div className="gaps"><span><AlertCircle size={16} /> Needs clarification</span>
      <ul>{category.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
    </div>}
  </div>;
}

export function Results({ report, onAsk, onCompare }: { report: Report; onAsk: () => void; onCompare: () => void }) {
  const all = report.categories.flatMap((category) => category.findings);
  const highest = all.reduce<Category["findings"][number] | undefined>((best, item) => !best || ranking[item.concern] > ranking[best.concern] ? item : best, undefined);
  return <section className="results-stack" aria-label="Policy analysis results">
    <div className="panel result-overview">
      <div className="result-top">
        <div>
          <span className="mode-label">{modeLabels[report.mode]}</span>
          <h2>{report.title}</h2>
          <p className="result-source">{report.source}</p>
        </div>
        <ExportButton key={report.id} id={report.id} />
      </div>
      <div className="overview-body">
        <div><h3>Policy at a glance</h3>
          {report.highlights.length ? <ul>{report.highlights.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>No evidence-backed findings were identified.</p>}
        </div>
        <div className="overview-metrics">
          <div><span>Verified excerpts</span><strong>{all.length}</strong></div>
          <div><span>Highest finding concern</span>{highest ? <strong className={"metric-concern " + highest.concern}>{highest.concern}</strong> : <strong className="metric-concern">Unrated</strong>}</div>
        </div>
      </div>
      {!!report.discarded && <p className="form-note">{report.discarded} proposed excerpts were omitted because they didn’t match the source.</p>}
      <div className="result-actions">
        <button className="btn secondary" onClick={onAsk}><MessageSquareText size={17} /> Ask about this policy</button>
        <button className="btn secondary" onClick={onCompare}><GitCompareArrows size={17} /> Compare policies</button>
      </div>
    </div>
    <div className="section-title"><div className="tile-icon blue"><ListFilter size={19} /></div><div><h2>Findings by category</h2><p>Review the findings, original policy excerpts and gaps.</p></div></div>
    <div className="results-grid">
      {report.categories.map((category) => {
        const { icon: Icon, tint } = categoryInfo[category.id];
        return <article className="panel result-card" key={category.id}>
          <div className="panel-heading"><div className={"tile-icon " + tint}><Icon size={20} /></div><h3>{category.label}</h3></div>
          <CategoryContent category={category} />
        </article>;
      })}
    </div>
    <p className="disclaimer"><CircleHelp size={16} />{notice}</p>
  </section>;
}

export function Compare({ reports, add }: { reports: Report[]; add: () => void }) {
  const [left, setLeft] = useState(reports[0]?.id ?? "");
  const [right, setRight] = useState(reports[1]?.id ?? "");
  const [result, setResult] = useState<Comparison>();
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  async function compare(event: FormEvent) {
    event.preventDefault();
    if (!left || !right || left === right) return;
    setProblem("");
    setBusy(true);
    try {
      setResult(await post<Comparison>("compare", { left, right }));
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (reports.length < 2) return <EmptyState title="Add two policies to compare them" action={add} />;
  return <>
    <form className="panel work-panel" onSubmit={compare} aria-busy={busy}>
      <div className="panel-heading"><div className="tile-icon blue"><GitCompareArrows size={20} /></div><div><h2>Select two policies</h2><p>Compare disclosures across the same four privacy categories.</p></div></div>
      <div className="pair-fields">
        {[{ label: "Policy A", value: left, other: right, change: setLeft }, { label: "Policy B", value: right, other: left, change: setRight }].map(({ label, value, other, change }) => <label key={label}>{label}
          <select disabled={busy} value={value} onChange={(event) => { change(event.target.value); setResult(undefined); setProblem(""); }}>
            <option value="">Select an analysis</option>
            {reports.map((report, index) => <option disabled={other === report.id} key={report.id} value={report.id}>{report.title} · Analysis {reports.length - index}</option>)}
          </select></label>)}
      </div>
      {problem && <p role="alert" className="error-banner">{problem}</p>}
      <div className="form-actions"><button type="submit" className="btn primary" disabled={busy || !left || !right || left === right}>
        {busy ? <LoaderCircle className="animate-spin" size={17} /> : <GitCompareArrows size={17} />}{busy ? "Comparing…" : "Compare policies"}
      </button><button type="button" className="btn quiet" onClick={add}>Add a policy</button></div>
    </form>
    {result && <section className="panel compare-results" aria-label="Side-by-side results">
      <div className="compare-pair">
        {[result.left, result.right].map((item, index) => <div key={index}><span className="mode-label">{modeLabels[item.mode]}</span><h3>{item.title}</h3></div>)}
      </div>
      {result.rows.map((row) => <div className="compare-row" key={row.label}><h4>{row.label}</h4>
        <div className="compare-pair"><CategoryContent category={row.left} /><CategoryContent category={row.right} /></div>
      </div>)}
      <p className="disclaimer"><CircleHelp size={16} />{notice}</p>
    </section>}
  </>;
}

export function Ask({ report }: { report: Report }) {
  const [question, setQuestion] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<{ question: string; answer: Answer }[]>([]);

  async function ask(value: string) {
    const query = value.trim();
    if (busy || query.length < 3) return;
    setBusy(true);
    setProblem("");
    try {
      const answer = await post<Answer>("reports/" + report.id + "/ask", { question: query });
      setMessages((previous) => [...previous, { question: query, answer }]);
      setQuestion("");
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel work-panel chat-panel" aria-busy={busy}>
    <div className="panel-heading"><div className="tile-icon blue"><MessageSquareText size={20} /></div><div><h2>Ask a policy question</h2><p>{report.title} · {modeLabels[report.mode]}</p></div></div>
    <div className="chat-messages" aria-live="polite">
      {messages.length === 0 ? <div className="chat-empty"><Quote size={25} /><p>Ask about something you’d like to understand in this policy.</p></div> :
        messages.map(({ question: item, answer }, index) => <div className="exchange" key={index}>
          <p className="user-message">{item}</p>
          <div className="assistant-message"><p>{answer.answer}</p>
            {answer.evidence.map((excerpt) => <blockquote key={excerpt}>“{excerpt}”</blockquote>)}</div>
        </div>)}
      {busy && <p role="status" className="form-note">Checking the policy for evidence…</p>}
    </div>
    <div className="chat-suggestions">
      {suggestions.map((item) => <button type="button" disabled={busy} key={item} onClick={() => void ask(item)}>{item}</button>)}
    </div>
    {problem && <p role="alert" className="error-banner">{problem}</p>}
    <form className="chat-form" onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
      <label className="sr-only" htmlFor="question">Your policy question</label>
      <input id="question" disabled={busy} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="Type your policy question…" />
      <button type="submit" className="btn primary" disabled={busy || question.trim().length < 3}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />} Send</button>
    </form>
    {report.mode === "gemini" && <p className="form-note">Your question and policy text are sent to Google Gemini.</p>}
  </section>;
}

export function ReportList({ reports, open }: { reports: Report[]; open: (report: Report) => void }) {
  return <section className="panel work-panel">
    <div className="panel-heading"><div className="tile-icon blue"><FileText size={20} /></div><div><h2>Session reports</h2><p>Reports are temporary. Download a PDF to keep a copy.</p></div></div>
    <ul className="report-list">
      {reports.map((report) => <li key={report.id}>
        <button className="report-link" onClick={() => open(report)}><FileText size={20} /><span><strong>{report.title}</strong><small>{modeLabels[report.mode]} · {report.source}</small></span></button>
        <ExportButton id={report.id} />
      </li>)}
    </ul>
  </section>;
}
