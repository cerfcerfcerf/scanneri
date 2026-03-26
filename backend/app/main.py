from pathlib import Path
from uuid import uuid4

import pypdfium2 as pdfium
import pytesseract
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session, joinedload

from .database import Base, engine, get_db
from .models import Document, Student
from .schemas import DocumentRead, DocumentUpdate, StudentCreate, StudentRead

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)


def ensure_schema_updates():
    columns = {column["name"] for column in inspect(engine).get_columns("documents")}
    if "ocr_text" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE documents ADD COLUMN ocr_text TEXT"))


ensure_schema_updates()

app = FastAPI(title="School Archive MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


def resolve_file_path(file_path: str) -> Path:
    return BASE_DIR / file_path.lstrip("/")


def run_ocr(path: Path) -> str:
    extension = path.suffix.lower()
    if extension == ".pdf":
        pdf = pdfium.PdfDocument(str(path))
        chunks = []
        for page_number in range(len(pdf)):
            page = pdf.get_page(page_number)
            image = page.render(scale=2).to_pil()
            chunks.append(pytesseract.image_to_string(image, lang="rus+eng").strip())
            page.close()
        pdf.close()
        return "\n\n".join(filter(None, chunks)).strip()

    with Image.open(path) as image:
        return pytesseract.image_to_string(image, lang="rus+eng").strip()


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/students", response_model=list[StudentRead])
def list_students(db: Session = Depends(get_db)):
    return db.scalars(select(Student).order_by(Student.full_name)).all()


@app.post("/students", response_model=StudentRead, status_code=201)
def create_student(payload: StudentCreate, db: Session = Depends(get_db)):
    student = Student(full_name=payload.full_name.strip(), class_name=payload.class_name.strip())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@app.post("/documents", response_model=DocumentRead, status_code=201)
def upload_document(
    student_id: int = Form(...),
    type: str = Form(...),
    year: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and image files are allowed")

    filename = f"{uuid4().hex}{ext}"
    destination = UPLOADS_DIR / filename
    with destination.open("wb") as buffer:
        buffer.write(file.file.read())

    document = Document(
        student_id=student_id,
        type=type.strip(),
        year=year,
        file_path=f"/uploads/{filename}",
    )
    db.add(document)
    db.commit()

    return (
        db.query(Document)
        .options(joinedload(Document.student))
        .filter(Document.id == document.id)
        .one()
    )


@app.get("/documents", response_model=list[DocumentRead])
def list_documents(search: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Document).options(joinedload(Document.student)).join(Student)
    if search:
        query = query.filter(Student.full_name.ilike(f"%{search.strip()}%"))

    return query.order_by(Document.created_at.desc()).all()




@app.patch("/documents/{document_id}", response_model=DocumentRead)
def update_document_metadata(document_id: int, payload: DocumentUpdate, db: Session = Depends(get_db)):
    document = (
        db.query(Document)
        .options(joinedload(Document.student))
        .filter(Document.id == document_id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    student = db.get(Student, payload.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    document.student_id = payload.student_id
    document.type = payload.type.strip()
    document.year = payload.year

    db.commit()
    db.refresh(document)
    return document

@app.get("/documents/{document_id}", response_model=DocumentRead)
def get_document(document_id: int, db: Session = Depends(get_db)):
    document = (
        db.query(Document)
        .options(joinedload(Document.student))
        .filter(Document.id == document_id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@app.post("/documents/{document_id}/ocr", response_model=DocumentRead)
def recognize_document_text(document_id: int, db: Session = Depends(get_db)):
    document = (
        db.query(Document)
        .options(joinedload(Document.student))
        .filter(Document.id == document_id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = resolve_file_path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found on disk")

    try:
        recognized = run_ocr(file_path)
    except pytesseract.TesseractNotFoundError as exc:
        raise HTTPException(status_code=500, detail="Tesseract is not installed on server") from exc

    document.ocr_text = recognized or ""
    db.commit()
    db.refresh(document)
    return document
