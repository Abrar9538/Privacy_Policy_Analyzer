# PrivacyLens AI

**PS 43 — AI-Powered Privacy Policy and Data Protection Analyzer**

## Abstract

Privacy policies are often long and written in legal language, making it difficult for readers to tell what information a service collects, how long it keeps that information, and who receives it. PrivacyLens AI accepts a privacy policy as a PDF, public website URL, or pasted text. It organizes findings into four areas: data collection, data storage, third-party sharing, and user consent.

When configured with Gemini, the application generates plain-language summaries and answers to questions about the policy. The backend checks quoted evidence against the extracted source before displaying a finding or cited answer. The dashboard also flags missing or ambiguous disclosures, lets readers compare two policies side by side, and exports analysis as a PDF report. Concern indicators help readers decide which disclosures to examine more closely. They are informational and carry no legal or compliance certification.

## Technology stack

| Layer | Technology | Role |
| --- | --- | --- |
| Frontend | Next.js App Router, React, TypeScript | Dashboard, source inputs, comparison, policy Q&A, and report downloads |
| UI | Tailwind CSS, Lucide React, Bricolage Grotesque, Poppins | Responsive layouts, icons, and typography |
| Backend | Python, FastAPI, Uvicorn | Input validation, policy processing, and report API |
| Generative AI | Google Gemini API, HTTPX, Pydantic | Structured JSON for summaries and policy Q&A, with server-side response validation |
| Document processing | PyMuPDF, BeautifulSoup | PDF text extraction and report generation, plus text extraction from public web pages |
| Session storage | Python process memory | Temporary analysis reports and policy text. No database required. |

The Gemini API key stays on the server. Without a key, local excerpt review uses keyword matching to surface relevant passages and possible gaps. See the [setup guide](README.md) for installation and configuration.
