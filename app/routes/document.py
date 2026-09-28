from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Form
from typing import List, Optional
from datetime import datetime
from app.database.schemas.document_schema import DocumentModel, DocumentCreate, DocumentBase
from app.database import document_collection
import shutil
import os, re

document_router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = "uploaded_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@document_router.post("/upload", response_model=DocumentModel)
async def upload_document(
    type: str = Form(...),
    generated_for: str = Form(...),
    linked_lead: Optional[str] = Form(None),
    linked_franchise: Optional[str] = Form(None),
    linked_invoice: Optional[str] = Form(None),
    file: UploadFile = File(...),
    collection=Depends(document_collection)
):
    # --- Sanitize and construct new filename ---
    safe_name = re.sub(r'[^A-Za-z0-9_-]', '_', generated_for)
    # Optionally add date/time for uniqueness:
    date_str = datetime.now().strftime("%Y%m%d")
    ext = os.path.splitext(file.filename)[-1] or ".pdf"
    filename = f"{safe_name}_{date_str}{ext}"

    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    pdf_url = f"/{UPLOAD_DIR}/{filename}"

    doc = {
        "type": type,
        "generated_for": generated_for,
        "pdf_url": pdf_url,
        "timestamp": datetime.now(),
        "linked_lead": linked_lead,
        "linked_franchise": linked_franchise,
        "linked_invoice": linked_invoice,
    }
    result = collection.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

@document_router.post("/generate", response_model=DocumentModel)
async def generate_document(
    req: DocumentCreate,
    collection=Depends(document_collection)
):
    safe_name = re.sub(r'[^A-Za-z0-9_-]', '_', req.generated_for)
    pdf_url = f"/{UPLOAD_DIR}/{safe_name}.pdf"

    doc = {
        "type": req.type,
        "generated_for": req.generated_for,
        "template_data": req.template_data,
        "pdf_url": pdf_url,
        "timestamp": datetime.now(),
        "linked_lead": req.linked_lead,
        "linked_franchise": req.linked_franchise,
        "linked_invoice": req.linked_invoice,
    }
    result = collection.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return DocumentModel(**doc)

# --- List & Search Documents ---
@document_router.get("/", response_model=List[DocumentModel])
async def list_documents(
    type: Optional[str] = None,
    generated_for: Optional[str] = None,
    linked_lead: Optional[str] = None,
    linked_franchise: Optional[str] = None,
    linked_invoice: Optional[str] = None,
    collection=Depends(document_collection)
):
    query = {}
    if type: query["type"] = type
    if generated_for: query["generated_for"] = generated_for
    if linked_lead: query["linked_lead"] = linked_lead
    if linked_franchise: query["linked_franchise"] = linked_franchise
    if linked_invoice: query["linked_invoice"] = linked_invoice

    docs = list(collection.find(query))
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return docs