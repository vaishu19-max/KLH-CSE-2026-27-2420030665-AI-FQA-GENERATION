
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pypdf import PdfReader
from docx import Document
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

from io import BytesIO
from difflib import SequenceMatcher
import re
import torch

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

MODEL_NAME = "valhalla/t5-base-qg-hl"

tokenizer = None
model = None


def load_t5_model():
    """Load T5 once and reuse it for future requests."""
    global tokenizer, model

    if tokenizer is None or model is None:
        print("Loading T5 question-generation model...")

        tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME,
            use_fast=False
        )

        model = AutoModelForSeq2SeqLM.from_pretrained(
            MODEL_NAME
        )

        model.eval()

        print("T5 model loaded successfully.")

    return tokenizer, model


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
    """
    Generate questions with T5 using different source sentences.

    Answers remain grounded in the uploaded document.
    Similar questions are filtered out.
    """

    tokenizer, model = load_t5_model()

    sentences = split_into_sentences(text)

    if not sentences:
        return []

    faqs = []
    used_questions = []
    used_answers = []

    # Use a wider range of source sentences.
    for index, answer in enumerate(sentences):

        if len(faqs) >= max_faqs:
            break

        # Avoid selecting the same answer twice.
        normalized_answer = normalize_question(answer)

        if normalized_answer in used_answers:
            continue

        # Keep context local to the candidate sentence.
        start = max(0, index - 1)
        end = min(len(sentences), index + 2)

        context_sentences = sentences[start:end]
        context = " ".join(context_sentences)

        # Highlight the answer for T5.
        prompt = (
            f"generate question: {context} "
            f"answer: <hl> {answer} <hl>"
        )

        inputs = tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512
        )

        with torch.no_grad():
            output = model.generate(
                **inputs,
                max_new_tokens=64,
                num_beams=4,
                no_repeat_ngram_size=3,
                early_stopping=True
            )

        question = tokenizer.decode(
            output[0],
            skip_special_tokens=True
        ).strip()

        # Remove a possible model prefix.
        question = re.sub(
            r"^(question|generate question)\s*:\s*",
            "",
            question,
            flags=re.IGNORECASE
        ).strip()

        if not question:
            continue

        # Basic output validation.
        if len(question.split()) < 4:
            continue

        # Reject questions that simply repeat the answer.
        if normalize_question(question) == normalized_answer:
            continue

        if not question.endswith("?"):
            question += "?"

        # Reject repetitive questions.
        if is_duplicate_question(question, used_questions):
            continue

        faqs.append({
            "id": len(faqs) + 1,
            "question": question,
            "answer": answer,
            "category": "General"
        })

        used_questions.append(question)
        used_answers.append(normalized_answer)

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
