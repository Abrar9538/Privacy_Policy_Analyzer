import time
from collections import OrderedDict
from threading import Lock
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

import analysis
from analysis import ProviderError, SAMPLE, answer_question, build_report
from extraction import InputError, MAX_FILE, make_policy, read_pdf, read_website
from reporting import report_pdf
from pdf_runtime import pdf_lock

app = FastAPI(title="PrivacyLens AI")
reports = OrderedDict()
lock = Lock()
TTL = 60 * 60
CAPACITY = 48


@app.middleware("http")
async def request_limits(request, call_next):
    if request.url.path.startswith("/api/") and request.headers.get("sec-fetch-site") == "cross-site":
        return JSONResponse({"detail": "Cross-site requests are blocked."}, status_code=403)
    content_length = request.headers.get("content-length")
    if content_length and (not content_length.isdecimal() or len(content_length) > 12 or int(content_length) > MAX_FILE + 64 * 1024):
        return JSONResponse({"detail": "The request is too large. PDFs are limited to 10 MB."}, status_code=413)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def purge_expired():
    current = time.monotonic()
    while reports and next(iter(reports.values()))[0] <= current:
        reports.popitem(last=False)


def save(policy, sample=False):
    try:
        report = build_report(policy, sample)
    except ProviderError as error:
        raise HTTPException(502, str(error)) from None
    report["id"] = uuid4().hex
    with lock:
        purge_expired()
        reports[report["id"]] = (time.monotonic() + TTL, policy, report)
        if len(reports) > CAPACITY:
            reports.popitem(last=False)
    return report


def lookup(report_id):
    with lock:
        purge_expired()
        entry = reports.get(report_id)
    if not entry:
        raise HTTPException(404, "This analysis has expired or is unavailable. Analyze the policy again.")
    return entry[1:]


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": "gemini" if analysis.API_KEY else "local"}


@app.post("/api/sample")
def sample_report():
    return save(SAMPLE, sample=True)


@app.post("/api/analyze")
async def analyze(
    kind: Annotated[Literal["pdf", "text", "url"], Form()],
    value: Annotated[str, Form(max_length=160_000)] = "",
    file: Annotated[UploadFile | None, File()] = None,
):
    try:
        if kind == "pdf":
            if not file:
                raise InputError("Choose a PDF file to upload.")
            data = await file.read(MAX_FILE + 1)
            if len(data) > MAX_FILE:
                raise HTTPException(413, "Choose a PDF that is 10 MB or smaller.")
            policy = await run_in_threadpool(read_pdf, data, file.filename or "")
        elif kind == "url":
            policy = await run_in_threadpool(read_website, value.strip())
        else:
            policy = make_policy("Pasted Privacy Policy", "Pasted text", value)
        return await run_in_threadpool(save, policy)
    except InputError as error:
        raise HTTPException(400, str(error)) from None
    finally:
        if file:
            await file.close()


class Question(BaseModel):
    question: str = Field(min_length=3, max_length=500, pattern=r"\S")


@app.post("/api/reports/{report_id}/ask")
def ask(report_id: str, body: Question):
    policy, report = lookup(report_id)
    try:
        return answer_question(policy, report["mode"], body.question.strip())
    except ProviderError as error:
        raise HTTPException(502, str(error)) from None


class Pair(BaseModel):
    left: str = Field(min_length=32, max_length=32)
    right: str = Field(min_length=32, max_length=32)


@app.post("/api/compare")
def compare(body: Pair):
    if body.left == body.right:
        raise HTTPException(400, "Choose two different analyses.")
    _, left = lookup(body.left)
    _, right = lookup(body.right)
    return {"left": {"title": left["title"], "mode": left["mode"]},
            "right": {"title": right["title"], "mode": right["mode"]},
            "rows": [{"label": left_cat["label"], "left": left_cat, "right": right_cat}
                     for left_cat, right_cat in zip(left["categories"], right["categories"], strict=True)]}


@app.get("/api/reports/{report_id}/pdf")
def export(report_id: str):
    _, report = lookup(report_id)
    with pdf_lock:
        content = report_pdf(report)
    return Response(content, media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="privacylens-report.pdf"'})

