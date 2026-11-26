from threading import Lock

# PyMuPDF uses native state. Serialize its operations in this local server.
pdf_lock = Lock()
