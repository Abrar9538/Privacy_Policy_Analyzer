from html import escape
from io import BytesIO

import pymupdf

NOTICE = "These indicators reflect the wording of the supplied policy. This report is for information only and offers no legal advice or compliance certification."
MODE_LABELS = {"gemini": "Gemini analysis", "local": "Local excerpt review", "sample": "Fictional sample"}


def report_pdf(report):
    def plain(value):
        return escape(str(value)).replace("\n", " ")

    parts = [
        "<h4>PRIVACYLENS AI · POLICY ANALYSIS</h4>",
        f"<h1>{plain(report['title'])}</h1>",
        f"<p>{plain(MODE_LABELS[report['mode']])} · {plain(report['source'])}</p>",
        f"<p>{plain(NOTICE)}</p>",
        "<h2>Policy overview</h2>",
    ]
    parts.extend(f"<p>{plain(item)}</p>" for item in report["highlights"] or ["No verified findings were available."])
    for category in report["categories"]:
        parts.append(f"<h2>{plain(category['label'])}</h2>")
        for finding in category["findings"]:
            parts.append(f"<p><b>{plain(finding['concern'].capitalize())} concern</b> · {plain(finding['summary'])}</p>")
            parts.append(f"<blockquote>“{plain(finding['excerpt'])}”</blockquote>")
        for gap in category["gaps"]:
            parts.append(f"<p><b>Needs clarification:</b> {plain(gap)}</p>")
    if report["discarded"]:
        parts.append(f"<p>{report['discarded']} proposed findings were omitted because their excerpts did not match the policy.</p>")
    body = """
        body {font-family:sans-serif; color:#14233c; font-size:10pt;}
        h1 {font-size:26pt; margin-top:8pt;}
        h2 {color:#174cc4; font-size:16pt; margin-top:15pt;}
        h4 {color:#174cc4; font-size:9pt;}
        blockquote {background-color:#eef4ff; color:#33476a; padding:8pt; margin:0 0 8pt 0;}
        p {margin:0 0 8pt 0;}
    """
    page = pymupdf.paper_rect("a4")
    content = page + (45, 48, -45, -48)
    stream = BytesIO()
    writer = pymupdf.DocumentWriter(stream)
    story = pymupdf.Story(html="".join(parts), user_css=body)
    try:
        story.write(writer, lambda *_: (page, content, None))
    finally:
        writer.close()
    return stream.getvalue()
