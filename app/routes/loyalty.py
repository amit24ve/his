"""
Loyalty Platform API Routes
Handles: Members, Cashback, Tiers, Campaigns, Referrals, Analytics
"""
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
import string, random, json

from app.database.schemas.customer_schema import (
    CustomerProfileModel,
    CashbackTransactionModel,
    LoyaltyCampaignModel,
    ReferralModel,
    LoyaltyTierConfigModel,
)
from app.database import (
    customers_collection,
    cashback_transactions_collection,
    loyalty_campaigns_collection,
    referrals_collection,
    redemptions_collection,
    tier_config_collection,
)

loyalty_router = APIRouter(prefix="/api/loyalty", tags=["loyalty"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _str(doc: dict) -> dict:
    """Convert _id ObjectId to string id."""
    if doc is None:
        return doc
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


def _tier_for_spend(spend: float) -> str:
    if spend >= 100000:
        return "Diamond"
    elif spend >= 50000:
        return "Platinum"
    elif spend >= 10000:
        return "Gold"
    return "Silver"


def _tier_next_target(spend: float) -> float:
    if spend < 10000:
        return 10000
    elif spend < 50000:
        return 50000
    elif spend < 100000:
        return 100000
    return 100000  # already Diamond


def _generate_referral_code(name: str) -> str:
    prefix = "".join(c for c in name.upper() if c.isalpha())[:4].ljust(4, "X")
    suffix = "".join(random.choices(string.digits, k=4))
    return f"{prefix}{suffix}"


# ---------------------------------------------------------------------------
# Dashboard / Analytics
# ---------------------------------------------------------------------------

@loyalty_router.get("/dashboard")
async def get_loyalty_dashboard():
    """Returns aggregate stats for the loyalty platform dashboard."""
    members = list(customers_collection.find({"loyalty_status": {"$exists": True}}))

    total_members = len(members)
    total_cashback_earned = sum(m.get("total_cashback_earned", 0) or 0 for m in members)
    cashback_balance = sum(m.get("cashback_balance", 0) or 0 for m in members)
    total_txns = sum(m.get("total_transactions_count", 0) or 0 for m in members)

    tier_counts = {"Silver": 0, "Gold": 0, "Platinum": 0, "Diamond": 0}
    for m in members:
        t = m.get("loyalty_tier", "Silver")
        if t in tier_counts:
            tier_counts[t] += 1

    active_campaigns = loyalty_campaigns_collection.count_documents({"status": "active"})
    pending_referrals = referrals_collection.count_documents({"status": "pending"})
    rewarded_referrals = referrals_collection.count_documents({"status": "rewarded"})

    return {
        "total_members": total_members,
        "total_cashback_earned": round(total_cashback_earned, 2),
        "pending_cashback": round(cashback_balance, 2),
        "total_transactions": total_txns,
        "tier_breakdown": tier_counts,
        "active_campaigns": active_campaigns,
        "pending_referrals": pending_referrals,
        "rewarded_referrals": rewarded_referrals,
    }


# ---------------------------------------------------------------------------
# Members (Loyalty-enriched customers)
# ---------------------------------------------------------------------------

@loyalty_router.get("/members", response_model=List[CustomerProfileModel])
async def list_members(
    tier: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    query: dict = {}
    if tier:
        query["loyalty_tier"] = tier
    if status:
        query["loyalty_status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"referral_code": {"$regex": search, "$options": "i"}},
        ]
    docs = list(customers_collection.find(query).sort("created_at", -1).skip(skip).limit(limit))
    return [_str(d) for d in docs]


@loyalty_router.post("/members", response_model=CustomerProfileModel)
async def enroll_member(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    address: str = Form(""),
    city: str = Form(None),
    state: str = Form(None),
    country: str = Form(None),
    company: str = Form(None),
    customer_type: str = Form("regular"),
    referred_by: str = Form(None),
    profile_picture: UploadFile = File(None),
):
    import os

    # Duplicate check
    if customers_collection.find_one({"$or": [{"email": email}, {"phone": phone}]}):
        raise HTTPException(status_code=409, detail="Member with this email or phone already exists.")

    # Auto-generate ID
    last = customers_collection.find_one({"id": {"$regex": "^cus-\\d+$"}}, sort=[("id", -1)])
    next_num = int(last["id"].replace("cus-", "")) + 1 if last and "id" in last else 1
    custom_id = f"cus-{next_num:03d}"

    # Handle referral
    if referred_by:
        ref_doc = customers_collection.find_one({"referral_code": referred_by})
        if not ref_doc:
            raise HTTPException(status_code=400, detail="Invalid referral code.")
        # Create referral record
        referrals_collection.insert_one({
            "referrer_id": ref_doc["id"],
            "referred_phone": phone,
            "referral_code": referred_by,
            "status": "pending",
            "referrer_reward": 200.0,
            "referred_reward": 100.0,
            "created_at": datetime.now(),
        })

    # Profile picture
    pic_url = None
    if profile_picture:
        upload_dir = os.path.join("uploaded_pdfs", f"customer_{custom_id}")
        os.makedirs(upload_dir, exist_ok=True)
        ext = os.path.splitext(profile_picture.filename)[-1]
        fp = os.path.join(upload_dir, f"profile{ext}")
        with open(fp, "wb") as f:
            f.write(await profile_picture.read())
        pic_url = f"/{fp}"

    now = datetime.now()
    referral_code = _generate_referral_code(name)
    doc = {
        "id": custom_id,
        "name": name,
        "email": email,
        "phone": phone,
        "address": address,
        "city": city,
        "state": state,
        "country": country,
        "company": company,
        "customer_type": customer_type,
        "status": "active",
        "lifetime_value": 0.0,
        "profile_picture": pic_url,
        # Loyalty fields
        "loyalty_tier": "Silver",
        "loyalty_points": 0,
        "total_cashback_earned": 0.0,
        "cashback_balance": 0.0,
        "milestone_target": 10000.0,
        "milestone_progress": 0.0,
        "referral_code": referral_code,
        "referred_by": referred_by,
        "total_transactions_count": 0,
        "qr_identifier": f"QR-{custom_id}",
        "loyalty_enrolled_at": now,
        "loyalty_status": "active",
        "created_at": now,
        "updated_at": now,
    }
    customers_collection.insert_one(doc)
    return _str(customers_collection.find_one({"id": custom_id}))


@loyalty_router.get("/members/{member_id}", response_model=CustomerProfileModel)
async def get_member(member_id: str):
    doc = customers_collection.find_one({"id": member_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Member not found")
    return _str(doc)


@loyalty_router.put("/members/{member_id}")
async def update_member(member_id: str, data: dict):
    data.pop("id", None)
    data.pop("_id", None)
    data["updated_at"] = datetime.now()
    result = customers_collection.update_one({"id": member_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    return _str(customers_collection.find_one({"id": member_id}))


# ---------------------------------------------------------------------------
# Cashback Transactions
# ---------------------------------------------------------------------------

@loyalty_router.get("/members/{member_id}/cashback")
async def get_member_cashback(member_id: str):
    txns = list(cashback_transactions_collection.find({"member_id": member_id}).sort("created_at", -1))
    return [_str(t) for t in txns]


@loyalty_router.post("/members/{member_id}/cashback/earn")
async def earn_cashback(
    member_id: str,
    invoice_amount: float = Form(...),
    reference_invoice: str = Form(None),
    channel: str = Form("direct"),
    campaign_id: str = Form(None),
    remarks: str = Form(None),
):
    """Add purchase → compute cashback → update member balance & tier."""
    member = customers_collection.find_one({"id": member_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Determine cashback rate from tier
    tier_rates = {"Silver": 2.0, "Gold": 4.0, "Platinum": 6.0, "Diamond": 8.0}
    current_tier = member.get("loyalty_tier", "Silver")
    rate = tier_rates.get(current_tier, 2.0)

    # If campaign_id provided, use campaign reward
    if campaign_id:
        campaign = loyalty_campaigns_collection.find_one({"id": campaign_id})
        if campaign and campaign.get("status") == "active":
            if campaign.get("reward_type") == "percent":
                rate = campaign["reward_value"]
            elif campaign.get("reward_type") == "flat":
                # flat cashback regardless of invoice amount
                cashback_amount = campaign["reward_value"]
                rate = None

    if rate is not None:
        cashback_amount = round(invoice_amount * rate / 100, 2)

    points_earned = int(invoice_amount // 10)  # 1 point per ₹10

    # Insert cashback transaction
    txn = {
        "member_id": member_id,
        "transaction_type": "earn",
        "amount": cashback_amount,
        "points": points_earned,
        "reference_invoice": reference_invoice,
        "channel": channel,
        "campaign_id": campaign_id,
        "status": "credited",
        "remarks": remarks,
        "created_at": datetime.now(),
    }
    cashback_transactions_collection.insert_one(txn)

    # Update member aggregates
    new_lifetime = (member.get("lifetime_value") or 0) + invoice_amount
    new_cashback_earned = (member.get("total_cashback_earned") or 0) + cashback_amount
    new_cashback_balance = (member.get("cashback_balance") or 0) + cashback_amount
    new_points = (member.get("loyalty_points") or 0) + points_earned
    new_txn_count = (member.get("total_transactions_count") or 0) + 1
    new_tier = _tier_for_spend(new_lifetime)
    new_target = _tier_next_target(new_lifetime)

    customers_collection.update_one(
        {"id": member_id},
        {"$set": {
            "lifetime_value": new_lifetime,
            "total_cashback_earned": new_cashback_earned,
            "cashback_balance": new_cashback_balance,
            "loyalty_points": new_points,
            "total_transactions_count": new_txn_count,
            "loyalty_tier": new_tier,
            "milestone_progress": new_lifetime,
            "milestone_target": new_target,
            "updated_at": datetime.now(),
        }}
    )

    # Update campaign stats
    if campaign_id:
        loyalty_campaigns_collection.update_one(
            {"id": campaign_id},
            {"$inc": {"redemption_count": 1, "total_reward_given": cashback_amount}}
        )

    return {
        "cashback_earned": cashback_amount,
        "points_earned": points_earned,
        "new_tier": new_tier,
        "new_balance": round(new_cashback_balance, 2),
        "new_points": new_points,
    }


@loyalty_router.post("/members/{member_id}/cashback/redeem")
async def redeem_cashback(
    member_id: str,
    redeem_amount: float = Form(...),
    remarks: str = Form(None),
):
    """Redeem available cashback balance."""
    member = customers_collection.find_one({"id": member_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    balance = member.get("cashback_balance") or 0
    if redeem_amount > balance:
        raise HTTPException(status_code=400, detail=f"Insufficient cashback balance. Available: ₹{balance}")

    txn = {
        "member_id": member_id,
        "transaction_type": "redeem",
        "amount": -redeem_amount,
        "points": 0,
        "status": "redeemed",
        "remarks": remarks,
        "created_at": datetime.now(),
    }
    cashback_transactions_collection.insert_one(txn)

    customers_collection.update_one(
        {"id": member_id},
        {"$set": {
            "cashback_balance": round(balance - redeem_amount, 2),
            "updated_at": datetime.now(),
        }}
    )
    return {"redeemed": redeem_amount, "remaining_balance": round(balance - redeem_amount, 2)}


# ---------------------------------------------------------------------------
# Campaigns
# ---------------------------------------------------------------------------

@loyalty_router.get("/campaigns")
async def list_campaigns(status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    docs = list(loyalty_campaigns_collection.find(query).sort("created_at", -1))
    return [_str(d) for d in docs]


@loyalty_router.post("/campaigns")
async def create_campaign(campaign: LoyaltyCampaignModel):
    data = campaign.dict(exclude_unset=True)
    data["created_at"] = datetime.now()
    # Auto-generate ID
    last = loyalty_campaigns_collection.find_one(sort=[("created_at", -1)])
    if last:
        last_num = int(str(last.get("id", "camp-0")).replace("camp-", "") or 0)
    else:
        last_num = 0
    data["id"] = f"camp-{last_num + 1:03d}"
    loyalty_campaigns_collection.insert_one(data)
    return _str(loyalty_campaigns_collection.find_one({"id": data["id"]}))


@loyalty_router.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, data: dict):
    data.pop("id", None)
    data.pop("_id", None)
    loyalty_campaigns_collection.update_one({"id": campaign_id}, {"$set": data})
    doc = loyalty_campaigns_collection.find_one({"id": campaign_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _str(doc)


@loyalty_router.delete("/campaigns/{campaign_id}", status_code=204)
async def delete_campaign(campaign_id: str):
    result = loyalty_campaigns_collection.delete_one({"id": campaign_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")


# ---------------------------------------------------------------------------
# Referrals
# ---------------------------------------------------------------------------

@loyalty_router.get("/referrals")
async def list_referrals(status: Optional[str] = None, referrer_id: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    if referrer_id:
        query["referrer_id"] = referrer_id
    docs = list(referrals_collection.find(query).sort("created_at", -1))
    return [_str(d) for d in docs]


@loyalty_router.post("/referrals/{referral_id}/reward")
async def reward_referral(referral_id: str):
    """Mark a referral as rewarded and credit cashback to both parties."""
    doc = referrals_collection.find_one({"_id": ObjectId(referral_id)}) if ObjectId.is_valid(referral_id) else None
    if not doc:
        raise HTTPException(status_code=404, detail="Referral not found")
    if doc.get("status") == "rewarded":
        raise HTTPException(status_code=400, detail="Already rewarded")

    now = datetime.now()

    # Credit referrer
    referrer = customers_collection.find_one({"id": doc["referrer_id"]})
    if referrer:
        customers_collection.update_one(
            {"id": doc["referrer_id"]},
            {"$inc": {"cashback_balance": doc.get("referrer_reward", 200), "total_cashback_earned": doc.get("referrer_reward", 200)}}
        )
        cashback_transactions_collection.insert_one({
            "member_id": doc["referrer_id"],
            "transaction_type": "bonus",
            "amount": doc.get("referrer_reward", 200),
            "status": "credited",
            "remarks": "Referral bonus",
            "created_at": now,
        })

    # Credit referred member
    if doc.get("referred_member_id"):
        customers_collection.update_one(
            {"id": doc["referred_member_id"]},
            {"$inc": {"cashback_balance": doc.get("referred_reward", 100), "total_cashback_earned": doc.get("referred_reward", 100)}}
        )
        cashback_transactions_collection.insert_one({
            "member_id": doc["referred_member_id"],
            "transaction_type": "bonus",
            "amount": doc.get("referred_reward", 100),
            "status": "credited",
            "remarks": "Welcome bonus via referral",
            "created_at": now,
        })

    referrals_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "rewarded", "rewarded_at": now}}
    )
    return {"message": "Referral rewarded successfully"}


# ---------------------------------------------------------------------------
# Tier Configuration
# ---------------------------------------------------------------------------

@loyalty_router.get("/tiers")
async def list_tiers():
    docs = list(tier_config_collection.find().sort("min_spend", 1))
    if not docs:
        # Return defaults
        return [
            {"tier_name": "Silver",   "min_spend": 0,      "cashback_rate": 2.0, "points_multiplier": 1.0, "color": "#9CA3AF", "icon": "⭐",   "benefits": ["2% Cashback", "Birthday Bonus"]},
            {"tier_name": "Gold",     "min_spend": 10000,  "cashback_rate": 4.0, "points_multiplier": 1.5, "color": "#F59E0B", "icon": "🥇",   "benefits": ["4% Cashback", "Priority Support", "Double Points Events"]},
            {"tier_name": "Platinum", "min_spend": 50000,  "cashback_rate": 6.0, "points_multiplier": 2.0, "color": "#6366F1", "icon": "💎",   "benefits": ["6% Cashback", "Free Delivery", "Exclusive Offers"]},
            {"tier_name": "Diamond",  "min_spend": 100000, "cashback_rate": 8.0, "points_multiplier": 3.0, "color": "#EC4899", "icon": "👑",   "benefits": ["8% Cashback", "Dedicated Manager", "VIP Events", "Early Access"]},
        ]
    return [_str(d) for d in docs]


@loyalty_router.put("/tiers/{tier_name}")
async def update_tier(tier_name: str, data: dict):
    data.pop("_id", None)
    tier_config_collection.update_one(
        {"tier_name": tier_name},
        {"$set": data},
        upsert=True,
    )
    return {"message": f"Tier '{tier_name}' updated"}
