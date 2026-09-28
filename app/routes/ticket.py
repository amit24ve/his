from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from bson import ObjectId
from bson.errors import InvalidId
from app.database import get_next_sequence,ticket_collection,users_collection
from datetime import datetime

from app.database.schemas.ticket_schema import TicketCreate, TicketUpdate, TicketModel
from app.database import (
    insert_ticket,
    update_ticket,
    get_tickets,
    get_ticket_by_id,
)


ticket_router = APIRouter(prefix="/api/tickets", tags=["tickets"])

def ensure_objectid(ticket_id: str):
    try:
        return ObjectId(ticket_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid ticket id")

@ticket_router.post("/", response_model=TicketModel)
def raise_ticket(ticket: TicketCreate, collection=Depends(ticket_collection)):
    db = collection.database  # Get the database from the collection instance
    seq_num = get_next_sequence(db, "ticketid")
    # ticket_number = f"TKT-{seq_num:06d}"
    ticket_number=f"TKT_{str(ticket.user_id).upper()}-00"
    ticket_dict = ticket.dict()
    ticket_dict["ticket_number"] = ticket_number
    ticket_dict["created_at"] = datetime.now()
    ticket_dict["status"] = ticket_dict.get("status", "open")
    ticket_dict["resolution_log"] = []
    ticket_dict["closed_at"] = None
    ticket_dict["feedback"] = None
    # Add status_history
    ticket_dict["status_history"] = [{
        "status": ticket_dict["status"],
        "timestamp": datetime.now()
    }]

    result = collection.insert_one(ticket_dict)
    ticket_data = collection.find_one({"_id": result.inserted_id})
    if not ticket_data:
        raise HTTPException(status_code=404, detail="Ticket not found after creation")
    ticket_data["id"] = str(ticket_data.pop("_id"))
    return ticket_data



@ticket_router.patch("/{ticket_id}", response_model=TicketModel)
def resolve_ticket(ticket_id: str, update: TicketUpdate, collection=Depends(ticket_collection)):
    # Try to find by ObjectId, fallback to ticket_number
    try:
        obj_id = ObjectId(ticket_id)
        ticket = collection.find_one({"_id": obj_id})
    except (InvalidId, TypeError):
        ticket = collection.find_one({"ticket_number": ticket_id})

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    obj_id = ticket["_id"]

    update_data = update.dict(exclude_unset=True)
    # Add status_history if status is changed
    if "status" in update_data and update_data["status"] and update_data["status"] != ticket.get("status"):
        # Append to status_history
        current_history = ticket.get("status_history", [])
        current_history.append({
            "status": update_data["status"],
            "timestamp": datetime.now()
        })
        update_data["status_history"] = current_history

    if "resolution_log" in update_data and update_data["resolution_log"] is not None:
        ticket_log = ticket.get("resolution_log", [])
        ticket_log += update_data["resolution_log"]
        update_data["resolution_log"] = ticket_log

    modified = update_ticket(collection, obj_id, update_data)
    if not modified:
        raise HTTPException(status_code=404, detail="Ticket not found or not updated")
    ticket_data = get_ticket_by_id(collection, obj_id)
    if not ticket_data:
        raise HTTPException(status_code=404, detail="Ticket not found after update")
    ticket_data["id"] = str(ticket_data.pop("_id"))
    return ticket_data

@ticket_router.get("/", response_model=List[TicketModel])
def list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    collection=Depends(ticket_collection)
):
    query = {}
    if status:
        if status.lower() == "pending-or-active":
            query["status"] = {"$in": ["open", "in_progress"]}
        else:
            query["status"] = status
    if priority:
        query["priority"] = priority
    tickets = get_tickets(collection, query)
    result = []
    for t in tickets:
        t["id"] = str(t.pop("_id"))
        result.append(t)
    return result

@ticket_router.get("/{ticket_id}", response_model=TicketModel)
def get_ticket(ticket_id: str, collection=Depends(ticket_collection)):
    # Try to treat ticket_id as ObjectId, fallback to ticket_number
    try:
        obj_id = ObjectId(ticket_id)
        ticket = collection.find_one({"_id": obj_id})
    except (InvalidId, TypeError):
        ticket = collection.find_one({"ticket_number": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket["id"] = str(ticket.pop("_id"))
    return ticket