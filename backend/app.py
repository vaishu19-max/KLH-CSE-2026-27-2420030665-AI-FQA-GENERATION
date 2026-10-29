
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pypdf import PdfReader
from docx import Document


from io import BytesIO
from difflib import SequenceMatcher
import re


from database import SessionLocal, engine, Base
import models

from sqlalchemy.orm import joinedload

# ==================================================
# 1. FASTAPI APPLICATION
# ==================================================

app = FastAPI(title="AI-Based Automatic FAQ Generation")

# Create database tables if they do not already exist.
Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# 2. T5 MODEL CONFIGURATION
# ==================================================



# ==================================================
# 3. DOCUMENT TEXT EXTRACTION
# ==================================================

def extract_text(filename, content):
    """Extract text from PDF, DOCX or TXT."""

    if "." not in filename:
        raise ValueError("The file must have an extension.")

    extension = filename.rsplit(".", 1)[-1].lower()

    if extension == "txt":
        return content.decode(
            "utf-8-sig",
            errors="replace"
        )

    if extension == "pdf":
        reader = PdfReader(BytesIO(content))

        if reader.is_encrypted:
            raise ValueError(
                "Password-protected PDFs are not supported."
            )

        return "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        )

    if extension == "docx":
        document = Document(BytesIO(content))

        paragraphs = [
            paragraph.text.strip()
            for paragraph in document.paragraphs
            if paragraph.text.strip()
        ]

        # Include text from tables too.
        for table in document.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        paragraphs.append(cell.text.strip())

        return "\n".join(paragraphs)

    raise ValueError(
        "Only PDF, DOCX and TXT files are supported."
    )


# ==================================================
# 4. TEXT CLEANING AND SENTENCE SEGMENTATION
# ==================================================

def clean_text(text):
    """Remove excessive whitespace and empty lines."""

    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", "\n", text)

    return text.strip()


def split_into_sentences(text):
    """Split document text into useful answer candidates."""

    text = re.sub(r"\s+", " ", text).strip()

    sentences = re.split(
        r"(?<=[.!?])\s+",
        text
    )

    cleaned = []

    for sentence in sentences:
        sentence = sentence.strip()
        words = sentence.split()

        # Avoid very short or excessively long sentences.
        if len(words) < 6:
            continue

        if len(words) > 80:
            continue

        # Ignore sentences without meaningful alphabetic content.
        if not re.search(r"[A-Za-z]{2,}", sentence):
            continue

        cleaned.append(sentence)

    # Remove duplicate source sentences.
    unique_sentences = []
    seen = set()

    for sentence in cleaned:
        key = re.sub(
            r"\W+",
            " ",
            sentence.lower()
        ).strip()

        if key not in seen:
            seen.add(key)
            unique_sentences.append(sentence)

    return unique_sentences


# ==================================================
# 5. QUESTION DEDUPLICATION
# ==================================================

def normalize_question(question):
    """Normalize questions before comparing them."""

    question = question.lower().strip()

    question = re.sub(
        r"^(question|generate question)\s*:\s*",
        "",
        question
    )

    question = re.sub(r"[^a-z0-9 ]", "", question)

    return re.sub(r"\s+", " ", question).strip()


def is_duplicate_question(question, existing_questions):
    """Reject exact and highly similar questions."""

    current = normalize_question(question)

    if not current:
        return True

    for previous in existing_questions:
        previous_normalized = normalize_question(previous)

        similarity = SequenceMatcher(
            None,
            current,
            previous_normalized
        ).ratio()

        # Avoid nearly identical generated questions.
        if similarity >= 0.78:
            return True

        current_words = set(current.split())
        previous_words = set(previous_normalized.split())

        if current_words and previous_words:
            overlap = len(
                current_words & previous_words
            ) / len(
                current_words | previous_words
            )

            if overlap >= 0.80:
                return True

    return False


# ==================================================
# 6. T5 QUESTION GENERATION
# ==================================================



def generate_t5_faqs(text, max_faqs=8):
    """Generate document-grounded FAQs using Groq."""

    import os
    import json
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    client = Groq(api_key=api_key)

    document_text = text[:20000]

    prompt = f"""
Create up to {max_faqs} useful questions and answers based only
on the document below.

Return only a JSON array in this format:
[
  {{
    "question": "A clear question?",
    "answer": "An answer supported by the document.",
    "category": "General"
  }}
]

Do not invent facts or create duplicate questions.

DOCUMENT:
{document_text}
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "system",
                "content": "You generate accurate FAQs from documents."
            },
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        response_format={"type": "json_object"}
    )

    try:
        result = json.loads(response.choices[0].message.content)
        if isinstance(result, dict):
            generated = result.get("faqs", [])
        else:
            generated = result
    except (json.JSONDecodeError, TypeError, AttributeError):
        raise RuntimeError("Groq returned an invalid FAQ response.")

    if not isinstance(generated, list):
        raise RuntimeError("Groq response did not contain a FAQ list.")

    faqs = []
    used_questions = []

    for item in generated:
        if len(faqs) >= max_faqs:
            break

        if not isinstance(item, dict):
            continue

        question = str(item.get("question", "")).strip()
        answer = str(item.get("answer", "")).strip()
        category = str(item.get("category", "General")).strip()

        if not question or not answer:
            continue

        if len(question.split()) < 4:
            continue

        if not question.endswith("?"):
            question += "?"

        if is_duplicate_question(question, used_questions):
            continue

        faqs.append({
            "id": len(faqs) + 1,
            "question": question,
            "answer": answer,
            "category": category or "General"
        })
        used_questions.append(question)

    return faqs




# ==================================================
# 7. HOME ENDPOINT
# ==================================================

@app.get("/")
def home():
    return {
        "message": "AI FAQ Generator backend is running"
    }


# ==================================================
# 8. HEALTH CHECK
# ==================================================

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


# ==================================================
# 9. FAQ GENERATION AND DATABASE SAVING
# ==================================================

@app.post("/api/generate-faqs")
async def generate_faqs(file: UploadFile = File(...)):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Please upload a document."
        )

    try:
        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty."
            )

        # Extract and clean the uploaded document.
        text = extract_text(
            file.filename,
            content
        )

        text = clean_text(text)

        if not text:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No readable text was found. "
                    "Scanned PDFs may require OCR."
                )
            )

        # Generate questions using the T5 model.
        faqs = generate_t5_faqs(
            text,
            max_faqs=8
        )

        if not faqs:
            raise HTTPException(
                status_code=422,
                detail=(
                    "No distinct FAQs could be generated. "
                    "Try a longer document with descriptive sentences."
                )
            )

        

        # ------------------------------------------
        # SAVE DOCUMENT AND FAQS TO SQLITE
        # ------------------------------------------

        db = SessionLocal()

        try:
            new_document = models.Document(
                filename=file.filename,
                file_type=(
                    file.filename.rsplit(".", 1)[-1].lower()
                    if "." in file.filename else "unknown"
                ),
                file_size=len(content)
            )

            db.add(new_document)

            # Assign the database ID to the document.
            db.flush()

            for item in faqs:
                new_faq = models.FAQ(
                    question=item["question"],
                    answer=item["answer"],
                    category=item.get("category", "General"),
                    source=file.filename,
                    document_id=new_document.id
                )

                db.add(new_faq)

            # Save the document and all its FAQs together.
            db.commit()

            print("DOCUMENT ID:", new_document.id)
            print("DOCUMENT SAVED:", file.filename)
            print("FAQS SAVED:", len(faqs))

        except Exception as db_error:
            db.rollback()
            print("DATABASE SAVE ERROR:", repr(db_error))
            raise

        finally:
            db.close()

        # Keep the existing API response structure.
        return {
            "filename": file.filename,
            "characters_extracted": len(text),
            "faq_count": len(faqs),
            "faqs": faqs
        }

    except HTTPException:
        raise

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception as error:
        print("FAQ generation error:", repr(error))

        raise HTTPException(
            status_code=500,
            detail=(
                "FAQ generation failed. "
                "Check the backend terminal for details."
            )
        )

# ==========================================
# GET ALL UPLOADED DOCUMENTS
# ==========================================

@app.get("/api/documents")
def get_documents():
    db = SessionLocal()

    try:
        documents = (
            db.query(models.Document)
            .order_by(models.Document.id.desc())
            .all()
        )

        return [
            {
                "id": doc.id,
                "filename": doc.filename,
                "file_type": doc.file_type,
                "file_size": doc.file_size,
                "faq_count": len(doc.faqs),
                "uploaded_at": (
                    doc.uploaded_at.isoformat()
                    if doc.uploaded_at else None
                )
            }
            for doc in documents
        ]

    finally:
        db.close()


# ==========================================
# GET FAQs FOR ONE SELECTED DOCUMENT
# ==========================================

@app.get("/api/documents/{document_id}/faqs")
def get_document_faqs(document_id: int):
    db = SessionLocal()

    try:
        document = (
            db.query(models.Document)
            .filter(models.Document.id == document_id)
            .first()
        )

        if document is None:
            raise HTTPException(
                status_code=404,
                detail="Document not found."
            )

        return {
            "document_id": document.id,
            "filename": document.filename,
            "faq_count": len(document.faqs),
            "faqs": [
                {
                    "id": faq.id,
                    "question": faq.question,
                    "answer": faq.answer,
                    "category": faq.category,
                    "source": faq.source
                }
                for faq in document.faqs
            ]
        }

    finally:
        db.close()

# ==================================================
# 10. RUN WITH UVICORN
# ==================================================

# Start the application using:
# uvicorn app:app --reload --port 8000
