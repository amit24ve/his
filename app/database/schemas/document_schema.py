# from pydantic import BaseModel, Field
# from typing import Optional, List, Dict
# from datetime import datetime

# class DocumentBase(BaseModel):
#     type: str  # e.g., "MoU", "quotation", "receipt"
#     generated_for: str  # e.g., entity id (franchise, lead, invoice)
#     template_data: Dict = Field(default_factory=dict)
#     pdf_url: str
#     timestamp: datetime = Field(default_factory=datetime.now)
#     linked_lead: Optional[str] = None
#     linked_franchise: Optional[str] = None
#     linked_invoice: Optional[str] = None

# class DocumentCreate(DocumentBase):
#     pass

# class DocumentModel(DocumentBase):
#     id: str


from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime

class DocumentBase(BaseModel):
    type: str  # e.g., "MoU", "quotation", "receipt"
    generated_for: str  # e.g., entity id (franchise, lead, invoice)
    template_data: Dict = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.now)
    linked_lead: Optional[str] = None
    linked_franchise: Optional[str] = None
    linked_invoice: Optional[str] = None

class DocumentCreate(DocumentBase):
    pass

class DocumentModel(DocumentBase):
    id: str
    pdf_url: str