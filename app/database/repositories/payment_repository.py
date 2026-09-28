from datetime import datetime
from typing import List, Dict, Any, Optional
from bson import ObjectId
from app.database import db

class PaymentRepository:
    def __init__(self):
        self.db = db()
        self.milestones = self.db.payment_milestones
        self.transactions = self.db.payment_transactions
        print(f"[{datetime.now().isoformat()}] PaymentRepository initialized successfully")

    def create_milestone(self, milestone_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new payment milestone"""
        milestone_data["created_at"] = datetime.now()
        milestone_data["updated_at"] = milestone_data["created_at"]
        milestone_data["status"] = milestone_data.get("status", "pending")
        milestone_data["paid_amount"] = 0
        milestone_data["remaining_amount"] = milestone_data.get("amount", 0)
        
        # Insert milestone in database
        result = self.milestones.insert_one(milestone_data)
        
        # Get the created milestone
        created_milestone = self.get_milestone_by_id(str(result.inserted_id))
        return created_milestone
    
    def get_milestone_by_id(self, milestone_id: str) -> Optional[Dict[str, Any]]:
        """Get a payment milestone by ID"""
        if isinstance(milestone_id, str):
            try:
                milestone_id = ObjectId(milestone_id)
            except:
                return None
                
        milestone = self.milestones.find_one({"_id": milestone_id})
        
        if milestone:
            milestone["id"] = str(milestone.pop("_id"))
            return milestone
        return None
    
    def list_milestones(self, filters: Dict[str, Any] = None, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """List payment milestones with optional filtering"""
        if filters is None:
            filters = {}
            
        cursor = self.milestones.find(filters).sort("due_date", 1).skip(skip).limit(limit)
        
        milestones = []
        for milestone in cursor:
            milestone["id"] = str(milestone.pop("_id"))
            milestones.append(milestone)
            
        return milestones
    
    def update_milestone(self, milestone_id: str, update_data: Dict[str, Any]) -> bool:
        """Update a payment milestone"""
        if isinstance(milestone_id, str):
            try:
                milestone_id = ObjectId(milestone_id)
            except:
                return False
                
        update_data["updated_at"] = datetime.now()
        
        result = self.milestones.update_one(
            {"_id": milestone_id},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    def delete_milestone(self, milestone_id: str) -> bool:
        """Delete a payment milestone"""
        if isinstance(milestone_id, str):
            try:
                milestone_id = ObjectId(milestone_id)
            except:
                return False
                
        result = self.milestones.delete_one({"_id": milestone_id})
        return result.deleted_count > 0
    
    def create_transaction(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Record a payment transaction"""
        transaction_data["created_at"] = datetime.now()
        
        # Set transaction date to current time if not provided
        if "transaction_date" not in transaction_data:
            transaction_data["transaction_date"] = transaction_data["created_at"]
        
        # Insert transaction in database
        result = self.transactions.insert_one(transaction_data)
        
        # Get the created transaction
        created_transaction = self.get_transaction_by_id(str(result.inserted_id))
        
        # Update milestone paid amount and status
        if created_transaction:
            milestone_id = created_transaction.get("milestone_id")
            if milestone_id:
                self._update_milestone_after_payment(milestone_id)
        
        return created_transaction
    
    def _update_milestone_after_payment(self, milestone_id: str) -> None:
        """Update milestone's paid amount and status after payment transaction"""
        milestone = self.get_milestone_by_id(milestone_id)
        if not milestone:
            return
            
        # Calculate total paid amount
        transactions = self.list_transactions(filters={"milestone_id": milestone_id})
        total_paid = sum(txn.get("amount", 0) for txn in transactions)
        
        # Calculate remaining amount
        milestone_amount = milestone.get("amount", 0)
        remaining = milestone_amount - total_paid
        
        # Determine new status
        new_status = milestone.get("status")
        if remaining <= 0:
            new_status = "completed"
        elif total_paid > 0:
            new_status = "partial"
        
        # Update milestone
        self.update_milestone(
            milestone_id,
            {
                "paid_amount": total_paid,
                "remaining_amount": max(0, remaining),
                "status": new_status
            }
        )
    
    def get_transaction_by_id(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        """Get a payment transaction by ID"""
        if isinstance(transaction_id, str):
            try:
                transaction_id = ObjectId(transaction_id)
            except:
                return None
                
        transaction = self.transactions.find_one({"_id": transaction_id})
        
        if transaction:
            transaction["id"] = str(transaction.pop("_id"))
            return transaction
        return None
    
    def list_transactions(self, filters: Dict[str, Any] = None, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """List payment transactions with optional filtering"""
        if filters is None:
            filters = {}
            
        cursor = self.transactions.find(filters).sort("transaction_date", -1).skip(skip).limit(limit)
        
        transactions = []
        for transaction in cursor:
            transaction["id"] = str(transaction.pop("_id"))
            transactions.append(transaction)
            
        return transactions
    
    def get_milestone_transactions(self, milestone_id: str) -> List[Dict[str, Any]]:
        """Get all transactions for a specific milestone"""
        return self.list_transactions(filters={"milestone_id": milestone_id})
    
    def get_quotation_milestones(self, quotation_id: str) -> List[Dict[str, Any]]:
        """Get all payment milestones for a quotation"""
        return self.list_milestones(filters={"quotation_id": quotation_id})
    
    def get_overdue_milestones(self, user_id: str = None) -> List[Dict[str, Any]]:
        """Get overdue payment milestones, optionally filtered by user"""
        today = datetime.now()
        
        filters = {
            "due_date": {"$lt": today},
            "status": {"$in": ["pending", "partial"]}
        }
        
        if user_id:
            filters["created_by"] = user_id
            
        return self.list_milestones(filters=filters)