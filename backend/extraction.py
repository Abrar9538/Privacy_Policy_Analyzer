import http.client
import ipaddress
import re
import socket
import time
from dataclasses import dataclass
from urllib.parse import quote, urljoin, urlsplit, urlunsplit

import pymupdf
from bs4 import BeautifulSoup

from pdf_runtime import pdf_lock

MAX_FILE = 10 * 1024 * 1024
MAX_HTML = 3 * 1024 * 1024
MAX_TEXT = 160_000


class InputError(ValueError):
    pass


@dataclass(frozen=True)
class Policy:
    title: str
    source: str
    text: str


def clean(text: str) -> str:
    return re.sub(r"[^\S\n]+", " ", text.replace("\r\n", "\n").replace("\r", "\n")).strip()


def make_policy(title: str, source: str, text: str) -> Policy:
    text = clean(text)
    if len(text) < 60:
        raise InputError("Provide at least 60 characters of readable policy text. Scanned PDFs need OCR first.")
    if len(text) > MAX_TEXT:
        raise InputError("The extracted text exceeds 160,000 characters. Submit a shorter policy or split it into sections.")
    return Policy(title[:120], source, text)


def read_pdf(data: bytes, filename: str) -> Policy:
    if not data.startswith(b"%PDF-"):
        raise InputError("Choose a valid PDF file.")
    try:
        with pdf_lock, pymupdf.open(stream=data, filetype="pdf") as doc:
            if doc.needs_pass:
                raise InputError("Unlock the password-protected PDF before uploading it.")
            if len(doc) > 100:
                raise InputError("Choose a PDF with up to 100 pages.")
            pages, count = [], 0
            for page in doc:
                page_text = page.get_text(sort=True)
                pages.append(page_text)
                count += len(page_text)
                if count > MAX_TEXT:
                    raise InputError("The PDF text exceeds 160,000 characters.")
    except InputError:
        raise
    except (RuntimeError, ValueError, OverflowError):
        raise InputError("This PDF could not be read. Try a different file.") from None
    title = filename.replace("\\", "/").rsplit("/", 1)[-1]
    return make_policy(title or "Uploaded PDF", "PDF upload", "\n\n".join(pages))


def _public_target(url: str):
    try:
        parts = urlsplit(url)
        port = parts.port
        host = (parts.hostname or "").encode("idna").decode("ascii").lower().rstrip(".")
        if (len(url) > 2048 or "\\" in url or re.search(r"[\x00-\x20\x7f]", url)
                or parts.scheme not in {"http", "https"} or not host or "%" in host
                or parts.username is not None or parts.password is not None
                or port not in {None, 443 if parts.scheme == "https" else 80}):
            raise ValueError
    except (UnicodeError, ValueError):
        raise InputError("Enter a public HTTP or HTTPS policy URL on its standard port.") from None

    port = port or (443 if parts.scheme == "https" else 80)
    try:
        addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError:
        raise InputError("The website address could not be resolved.") from None
    ips = [ipaddress.ip_address(address[4][0]) for address in addresses]
    if not ips or any(not ip.is_global or ip.is_multicast or
                      (ip.version == 6 and (ip.ipv4_mapped or ip.sixtofour or ip.teredo))
                      for ip in ips):
        raise InputError("Only publicly reachable website addresses are supported.")
    target = quote(parts.path or "/", safe="/%:@!$&'()*+,;=-._~")
    if parts.query:
        target += "?" + quote(parts.query, safe="/?%:@!$&'()*+,;=-._~")
    return parts, host, port, ips, target


def fetch_public_html(url: str) -> tuple[bytes, str]:
    deadline = time.monotonic() + 24
    for _ in range(5):
        parts, host, port, ips, target = _public_target(url)
        connection_type = http.client.HTTPSConnection if parts.scheme == "https" else http.client.HTTPConnection
        connection = connection_type(host, port, timeout=7)

        def connect_public(_address, timeout, source_address):
            for ip in sorted(set(ips), key=lambda address: address.version):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                try:
                    return socket.create_connection((str(ip), port), min(timeout, remaining), source_address)
                except OSError:
                    continue
            raise OSError("Public connection unavailable.")

        # Preserve the original hostname for Host, TLS SNI and certificate validation.
        connection._create_connection = connect_public
        try:
            connection.request("GET", target, headers={"User-Agent": "PrivacyLensAI/1.0", "Accept": "text/html, text/plain"})
            response = connection.getresponse()
            with response:
                if response.status in {301, 302, 303, 307, 308} and response.getheader("Location"):
                    url = urljoin(url, response.getheader("Location"))
                    continue
                if response.status != 200:
                    raise InputError(f"The site responded with HTTP {response.status}. Try pasting the policy text.")
                if response.headers.get_content_type() not in {"text/html", "application/xhtml+xml", "text/plain"}:
                    raise InputError("This URL did not return a readable web page. Download and upload any PDF separately.")
                if response.getheader("Content-Encoding", "identity").lower() != "identity":
                    raise InputError("The site returned an unsupported encoding. Try pasting the policy text.")
                data = bytearray()
                while True:
                    if time.monotonic() > deadline:
                        raise InputError("The website took too long to respond.")
                    chunk = response.read1(65_536)
                    if not chunk:
                        break
                    data.extend(chunk)
                    if len(data) > MAX_HTML:
                        raise InputError("The web page is too large. Try pasting the policy text.")
                # Keep private query parameters out of reports.
                return bytes(data), urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
        except (OSError, http.client.HTTPException):
            raise InputError("The website could not be loaded. Check the URL or paste the policy text.") from None
        finally:
            connection.close()
    raise InputError("The URL redirected too many times.")


def read_website(url: str) -> Policy:
    data, source = fetch_public_html(url)
    soup = BeautifulSoup(data, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else None
    for node in soup.select("script, style, noscript, nav, footer, aside, form, template, svg, [hidden], [aria-hidden=true]"):
        node.decompose()
    body = soup.find("main") or soup.find("article") or soup.body or soup
    # Preserve inline spans while putting individual paragraphs on separate lines.
    for node in body.select("p, li, h1, h2, h3, h4, tr, br"):
        node.insert_before("\n")
        node.insert_after("\n")
    return make_policy(title or urlsplit(source).hostname or "Website policy", source, body.get_text(" ", strip=False))

