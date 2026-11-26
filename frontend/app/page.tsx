"use client";

import { Check, FileText, GitCompareArrows, LayoutPanelTop, Lightbulb, LockKeyhole, MessageSquareText, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Analyzer from "./analyzer";
import { modeLabels, request, type Mode, type Report } from "./api-client";
import { Ask, categoryInfo, Compare, EmptyState, ReportList, Results } from "./report-views";

const navigation = [
  { id: "analyze", label: "Analyze Policy", icon: LayoutPanelTop, heading: "Analyze a privacy policy", subtitle: "" },
  { id: "compare", label: "Compare Policies", icon: GitCompareArrows, heading: "Compare policies", subtitle: "See how two policies describe their data practices, side by side." },
  { id: "ask", label: "Ask a Question", icon: MessageSquareText, heading: "Ask a question", subtitle: "Get answers and original excerpts from a policy you’ve analyzed." },
  { id: "reports", label: "Reports", icon: FileText, heading: "Analysis reports", subtitle: "Revisit and download reports from this session." },
] as const;
type View = (typeof navigation)[number]["id"];
const steps = [
  { title: "Add a policy", detail: "Upload a PDF, enter a URL or paste the text.", icon: FileText },
  { title: "Review the disclosures", detail: "See findings, concern levels and any gaps.", icon: ScanLine },
  { title: "Read the evidence", detail: "Open the original excerpts behind each finding.", icon: ShieldCheck },
];

function Hero() {
  return <section className="hero">
    <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
      <div className="art-center"><ShieldCheck size={74} strokeWidth={1.18} /></div>
      <span className="art-satellite satellite-doc"><FileText size={21} /></span>
      <span className="art-satellite satellite-lock"><LockKeyhole size={19} /></span>
      <span className="art-glint glint-one">✦</span><span className="art-glint glint-two">✦</span><span className="art-dot" />
    </div>
    <div className="hero-content"><span className="hero-label"><Sparkles size={13} /> PRIVACY POLICY ANALYZER</span>
      <h1>Understand how<br className="hero-break" /> your data is used.</h1>
      <p>Turn complex privacy policies into clear, evidence-backed insights in minutes.</p>
    </div>
  </section>;
}

function Guide() {
  return <aside className="panel guide"><div className="panel-heading"><div className="tile-icon blue"><Lightbulb size={19} /></div><h2>How it works</h2></div>
    <ol>{steps.map(({ title, detail, icon: Icon }) => <li key={title}><span className="guide-icon"><Icon size={16} /></span><div><strong>{title}</strong><p>{detail}</p></div></li>)}</ol>
  </aside>;
}

export default function Page() {
  const [view, setView] = useState<View>("analyze");
  const [reports, setReports] = useState<Report[]>([]);
  const [active, setActive] = useState<Report>();
  const [mode, setMode] = useState<Mode>();
  const results = useRef<HTMLDivElement>(null);
  const current = navigation.find((item) => item.id === view)!;

  useEffect(() => {
    const controller = new AbortController();
    request<{ mode: Mode }>("health", { signal: controller.signal }).then((data) => setMode(data.mode)).catch(() => {});
    return () => controller.abort();
  }, []);

  function go(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function open(report: Report) {
    setActive(report);
    setView("analyze");
    window.requestAnimationFrame(() => {
      results.current?.focus({ preventScroll: true });
      results.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  }

  function addReport(report: Report) {
    setReports((previous) => [report, ...previous]);
    open(report);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => go("analyze")} aria-label="PrivacyLens AI home">
        <span className="brand-icon"><ShieldCheck size={24} strokeWidth={2.15} /></span><span>PrivacyLens <b>AI</b></span>
      </button>
      <div className="nav-block"><p>WORKSPACE</p><nav aria-label="Workspace">
        {navigation.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => go(id)} aria-current={view === id ? "page" : undefined} className={view === id ? "active" : ""}><Icon size={19} /><span>{label}</span></button>)}
      </nav></div>
      <div className="sidebar-bottom">
        <div className="privacy-card"><div><LockKeyhole size={16} /><strong>Session privacy</strong></div><p>Reports expire after one hour. No account or database.</p></div>
        <div className="sidebar-caption"><ShieldCheck size={15} /> PS 43 · Hackathon Project</div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="crumb"><span>Workspace</span><span className="crumb-divider">/</span><strong>{current.label}</strong></div>
        <div className="status-pill"><span />{mode ? modeLabels[mode] : "Policy workspace"}</div>
      </header>
      <main className="main-content">
        <div hidden={view !== "analyze"}>
          <Hero />
          <div className="intake-grid"><Analyzer mode={mode} onReport={addReport} /><Guide /></div>
          <div ref={results} tabIndex={-1} className="analysis-anchor">
            {active ? <Results key={active.id} report={active} onAsk={() => go("ask")} onCompare={() => go("compare")} /> :
              <section aria-labelledby="covers-title" className="coverage">
                <div className="section-title"><div><h2 id="covers-title">What we analyze</h2><p>Four areas that tell you how a policy handles your data.</p></div></div>
                <div className="coverage-grid">{Object.values(categoryInfo).map(({ title, description, icon: Icon, tint }) => <article key={title} className="panel coverage-card">
                  <div className={"tile-icon " + tint}><Icon size={19} /></div><h3>{title}</h3><p>{description}</p>
                </article>)}</div>
              </section>}
          </div>
        </div>
        {view !== "analyze" && <div className="page-intro"><h1>{current.heading}</h1><p>{current.subtitle}</p></div>}
        {view === "compare" && <Compare reports={reports} add={() => go("analyze")} />}
        {view === "ask" && (active ? <>
          <div className="report-select"><label htmlFor="active-report">Policy to ask about</label><select id="active-report" value={active.id} onChange={(event) => setActive(reports.find((report) => report.id === event.target.value))}>
            {reports.map((report, index) => <option key={report.id} value={report.id}>{report.title} · Analysis {reports.length - index}</option>)}
          </select></div><Ask key={active.id} report={active} />
        </> : <EmptyState title="Analyze a policy to ask questions" action={() => go("analyze")} />)}
        {view === "reports" && (reports.length ? <ReportList reports={reports} open={open} /> : <EmptyState title="No reports yet" action={() => go("analyze")} />)}
        <footer><span><ShieldCheck size={15} /> PrivacyLens AI</span><span><Check size={14} /> For information only. No legal advice.</span></footer>
      </main>
    </div>
  </div>;
}

