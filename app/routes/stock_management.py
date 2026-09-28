from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId
from typing import Optional, List, Dict
from datetime import datetime
from app.database.schemas.stock_schema import ProductModel, StockModel, StockLogModel
from app.database import products_collection, stock_collection, stock_logs_collection

stock_router = APIRouter(prefix="/api/stock")

def obj_id_to_str(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc

def generate_sku(name: str, products_collection):
    prefix = ''.join([c for c in name if c.isalnum()]).upper()[:2]
    regex = f"^{prefix}-\\d+$"
    last = products_collection.find_one({"sku": {"$regex": regex}}, sort=[("sku", -1)])
    if last and "sku" in last:
        try:
            last_num = int(last["sku"].split("-")[1])
            new_num = last_num + 1
        except Exception:
            new_num = 1
    else:
        new_num = 1
    return f"{prefix}-{new_num:03d}"

@stock_router.post("/products", response_model=ProductModel)
async def add_product(
    product: ProductModel,
    products_collection=Depends(products_collection),
    stock_collection=Depends(stock_collection),
    stock_logs_collection=Depends(stock_logs_collection)
):
    now = datetime.now()
    prod = product.dict(exclude_unset=True, by_alias=True)
    if not prod.get("sku"):
        prod["sku"] = generate_sku(prod["name"], products_collection)
    prod["date"] = now
    result = products_collection.insert_one(prod)
    prod_id = str(result.inserted_id)
    prod["product_id"] = prod_id

    # Initial warehouse stock
    warehouse_qty = prod.get("warehouse_qty", 0)
    if warehouse_qty and warehouse_qty > 0:
        before_qty = 0
        after_qty = warehouse_qty
        stock_collection.update_one(
            {"product_id": prod_id, "location": "Warehouse"},
            {"$set": {"quantity": warehouse_qty, "date": now}},
            upsert=True
        )
        stock_log = StockLogModel(
            product_id=prod_id,
            product_name=prod.get("name"),
            location="Warehouse",
            type="in",
            quantity=warehouse_qty,
            before_quantity=before_qty,
            after_quantity=after_qty,
            by="system",
            status="in",
            remarks="Initial stock-in on product creation",
            date=now
        )
        stock_logs_collection.insert_one(stock_log.dict(exclude_unset=True))

    # Initial depot stock
    depot_qty: Dict[str, int] = prod.get("depot_qty", {}) or {}
    for depot, qty in depot_qty.items():
        if qty and qty > 0:
            before_qty = 0
            after_qty = qty
            stock_collection.update_one(
                {"product_id": prod_id, "location": depot},
                {"$set": {"quantity": qty, "date": now}},
                upsert=True
            )
            stock_log = StockLogModel(
                product_id=prod_id,
                product_name=prod.get("name"),
                location=depot,
                type="in",
                quantity=qty,
                before_quantity=before_qty,
                after_quantity=after_qty,
                by="system",
                status="in",
                remarks="Initial stock-in on product creation",
                date=now
            )
            stock_logs_collection.insert_one(stock_log.dict(exclude_unset=True))

    # Fetch updated stock per location
    stocks = list(stock_collection.find({"product_id": prod_id}))
    warehouse_qty = 0
    depot_qty = {}
    for s in stocks:
        loc = s["location"]
        qty = s["quantity"]
        if loc.lower() == "warehouse":
            warehouse_qty += qty
        else:
            depot_qty[loc] = qty

    prod["warehouse_qty"] = warehouse_qty
    prod["depot_qty"] = depot_qty
    prod["date"] = prod["date"].isoformat()
    return prod

@stock_router.patch("/update", response_model=StockModel)
async def update_stock(
    stock: StockModel,
    type: str = Query(..., description="in or out"),
    remarks: Optional[str] = None,
    stock_collection=Depends(stock_collection),
    products_collection=Depends(products_collection),
    stock_logs_collection=Depends(stock_logs_collection)
):
    query = {"product_id": stock.product_id, "location": stock.location}
    existing = stock_collection.find_one(query)
    change_qty = stock.quantity if type == "in" else -stock.quantity
    now = datetime.now()

    if existing:
        before_qty = existing["quantity"]
        new_qty = before_qty + change_qty
        if new_qty < 0:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        stock_collection.update_one(query, {"$set": {"quantity": new_qty, "date": now}})
        stock_id = existing["_id"]
        after_qty = new_qty
    else:
        before_qty = 0
        if change_qty < 0:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        result = stock_collection.insert_one({
            "product_id": stock.product_id,
            "location": stock.location,
            "quantity": change_qty,
            "date": now
        })
        stock_id = result.inserted_id
        after_qty = change_qty

    product = (
        products_collection.find_one({"_id": ObjectId(stock.product_id)})
        if ObjectId.is_valid(stock.product_id) else None
    )
    product_name = product["name"] if product else "Unknown"

    stock_log = StockLogModel(
        product_id=stock.product_id,
        product_name=product_name,
        location=stock.location,
        type=type,
        quantity=stock.quantity,
        before_quantity=before_qty,
        after_quantity=after_qty,
        by=stock.by if stock.by else "system",
        status=type,  # "in" or "out"
        remarks=remarks,
        date=now
    )
    stock_logs_collection.insert_one(stock_log.dict(exclude_unset=True))

    # Fetch updated stock per location
    stocks = list(stock_collection.find({"product_id": stock.product_id}))
    warehouse_qty = 0
    depot_qty = {}
    for s in stocks:
        loc = s["location"]
        qty = s["quantity"]
        if loc.lower() == "warehouse":
            warehouse_qty += qty
        else:
            depot_qty[loc] = qty

    curr = stock_collection.find_one(query)
    curr = obj_id_to_str(curr)
    curr["stock_id"] = str(stock_id)
    curr["product_name"] = product_name
    curr["type"] = type
    curr["by"] = stock.by if stock.by else "system"
    curr["warehouse_qty"] = warehouse_qty
    curr["depot_qty"] = depot_qty
    curr["date"] = now
    return curr

@stock_router.get("/location/{product_id}/{location}", response_model=StockModel)
async def view_stock(
    product_id: str, 
    location: str, 
    stock_collection=Depends(stock_collection)
):
    stock = stock_collection.find_one({"product_id": product_id, "location": location})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    stock = obj_id_to_str(stock)
    stock["stock_id"] = stock["id"]
    return stock

@stock_router.get("/alerts", response_model=dict)
async def stock_alerts(
    location: str = None,
    threshold: int = 10,
    stock_collection=Depends(stock_collection),
    products_collection=Depends(products_collection)
):
    def enrich_alert(s, loc, threshold):
        if ObjectId.is_valid(s["product_id"]):
            prod = products_collection.find_one({"_id": ObjectId(s["product_id"])})
        else:
            prod = None
        prod_threshold = prod.get("low_stock_threshold", threshold) if prod else threshold
        if s["quantity"] <= prod_threshold:
            return {
                "product_id": s["product_id"],
                "product_name": prod["name"] if prod else "Unknown",
                "quantity": s["quantity"],
                "location": loc,
                "date": s.get("date"),
                "threshold": prod_threshold
            }
        return None

    alerts = {}
    if location:
        low_stocks = []
        for s in stock_collection.find({"location": location}):
            alert = enrich_alert(s, location, threshold)
            if alert:
                low_stocks.append(alert)
        alerts[location] = low_stocks
        return {"low_stock_alerts": alerts}
    else:
        all_locations = stock_collection.distinct("location")
        for loc in all_locations:
            low_stocks = []
            for s in stock_collection.find({"location": loc}):
                alert = enrich_alert(s, loc, threshold)
                if alert:
                    low_stocks.append(alert)
            alerts[loc] = low_stocks
        return {"low_stock_alerts": alerts}

@stock_router.get("/logs")
async def get_stock_logs(
    product_id: Optional[str] = None, 
    location: Optional[str] = None, 
    stock_logs_collection=Depends(stock_logs_collection)
):
    query = {}
    if product_id:
        query["product_id"] = product_id
    if location:
        query["location"] = location
    logs = [obj_id_to_str(log) for log in stock_logs_collection.find(query)]
    for log in logs:
        if isinstance(log.get("date"), datetime):
            log["date"] = log["date"].isoformat()
    return {"logs": logs}

@stock_router.get("/products", response_model=List[ProductModel])
async def get_products(
    products_collection=Depends(products_collection),
    stock_collection=Depends(stock_collection)
):
    products = []
    for prod in products_collection.find():
        prod_id = str(prod.get("_id", prod.get("product_id")))
        low_stock_threshold = prod.get("low_stock_threshold", 10)
        stocks = list(stock_collection.find({"product_id": prod_id}))
        warehouse_qty = 0
        depot_qty = {}
        for s in stocks:
            loc = s["location"]
            qty = s["quantity"]
            if loc.lower() == "warehouse":
                warehouse_qty += qty
            else:
                depot_qty[loc] = qty
        prod_out = {
            "product_id": prod_id,
            "name": prod.get("name"),
            "sku": prod.get("sku"),
            "warehouse_qty": warehouse_qty,
            "depot_qty": depot_qty,
            "low_stock_threshold": low_stock_threshold,
            "unit": prod.get("unit"),
            "category": prod.get("category"),
            "description": prod.get("description"),
            "date": prod.get("date").isoformat() if prod.get("date") else None
        }
        products.append(prod_out)
    return products