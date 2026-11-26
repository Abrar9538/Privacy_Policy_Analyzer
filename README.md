# PrivacyLens AI

PrivacyLens AI is a PS 43 hackathon application that helps readers understand what a website’s privacy policy says about their data. Import a text-based PDF, enter a public policy URL, or paste a policy. Then review the disclosures and their source excerpts, compare two policies, ask a question, or download a PDF report.

## Run locally

You need Node.js 20.9 or later, npm, and Python 3.11 or later. Run these commands from the project root in two terminals.

**Terminal 1 · FastAPI on port 8000 (Windows PowerShell)**

    cd backend
    python -m venv .venv
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    Copy-Item .env.example .env
    .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000

On macOS or Linux, use `.venv/bin/python` in place of the Windows virtual environment executable and `cp .env.example .env` to copy the file.

**Terminal 2 · Next.js on port 3000**

    cd frontend
    npm ci
    npm run dev

Open [PrivacyLens AI](http://127.0.0.1:3000). For a production build, run `npm run build` and `npm start` in the frontend terminal instead. If you move the backend to another local port, set `PRIVACYLENS_API_URL` in the frontend process environment before starting Next.js or building it.

## Enable generative analysis

Add your [Google AI Studio API key](https://aistudio.google.com/apikey) to `backend/.env` as `GEMINI_API_KEY`, then restart FastAPI. `GEMINI_MODEL` defaults to `gemini-2.5-flash` and accepts a Gemini model ID that supports structured output. The key is read by FastAPI and is never sent to the frontend.

- **Gemini analysis** submits the extracted policy text to Google for structured findings and plain-language summaries. Policy Q&A also sends the question and extracted policy text. Review [Google’s Gemini API terms](https://ai.google.dev/gemini-api/terms) before submitting sensitive content.
- **Local excerpt review** works with a blank key. It uses policy categories and English keyword rules to summarize matching passages and possible gaps. Q&A answers with source passages grounded in the supplied policy. It is not a substitute for a generative model and has limited coverage for complex or ambiguous questions.
- **Try a sample** opens a fictional policy with prepared explanations and verified excerpts without a provider call.

## Review a policy

1. Choose **Analyze Policy** and submit your source. Reports cover **Data Collection**, **Data Storage**, **Third-Party Sharing**, and **User Consent**.
2. Open **Original evidence** under a finding to see the matching source text. **Needs clarification** flags details the analysis could not establish from the supplied policy.
3. Analyze a second policy and use **Compare Policies** to see both sets of findings and evidence.
4. Use **Ask a Question** to select a report and ask questions about its text. Unsupported answers should be displayed as unknown.
5. Use **Export PDF** from an analysis or from **Reports** to keep a copy.

## How the application handles evidence and data

Next.js and Tailwind render the workspace and proxy same-origin API requests to FastAPI. FastAPI uses BeautifulSoup for webpage text and PyMuPDF for PDF extraction and export. The Gemini request separates developer instructions from the untrusted policy data, supplies a JSON schema, and grants the model no tools. The server validates response shape, verifies all displayed excerpts against the extracted source, and omits findings that lack a matching excerpt. A citation confirms the wording exists in the source. Readers should still check whether each excerpt supports its interpretation.

Concern labels apply to individual disclosures. A lower concern indicates a routine or clearly bounded practice, moderate flags a potentially broad practice or ambiguity, and high flags a disclosure that deserves closer review, such as sharing identifiers with advertising partners. The report shows the highest concern among its verified findings and displays gaps separately. Indicators are informational only and offer no legal advice or compliance certification.

No database, accounts, analytics, or model training are used by the application. Report IDs and source text are held in memory for up to one hour of access and are cleared on process restart, with a maximum of 48 live reports. The browser’s report list is reset when the page reloads. The stack is intended to run on loopback for local review. Website imports fetch the requested public site directly. Site restrictions, login walls, and pages that need JavaScript rendering may require pasted text. PDFs are limited to 10 MB and 100 pages. Scanned documents require prior OCR. Extracted text is limited to 160,000 characters.

## Verify locally

From `backend`, run:

    .\.venv\Scripts\python.exe -m unittest discover -s tests -v

From `frontend`, run:

    npm run typecheck
    npm run build

The backend tests cover source validation, all three input types, exact evidence checks, Gemini request and response behavior with a mocked provider, comparison, Q&A, and reading text back from the exported PDF.

## Project layout

- `frontend/app` contains the Next.js dashboard and report workflows.
- `backend/main.py` defines API routes and temporary report storage.
- `backend/extraction.py` validates sources and extracts policy text.
- `backend/analysis.py` implements Gemini analysis, local excerpt review, and citations.
- `backend/reporting.py` generates PDF reports.
