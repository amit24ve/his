from fastapi import APIRouter, HTTPException,Depends
from app.database.schemas.task_schema import TaskModel, TaskStatusUpdate
from app.database import tasks_collection
from datetime import datetime, date
from typing import List, Optional
from app.services.hierarchy_helper import HierarchyHelper
from app.dependencies import get_current_user
import logging

logger = logging.getLogger(__name__)

task_router = APIRouter(prefix="/api/tasks")

def ensure_datetime(d):
    if isinstance(d, date) and not isinstance(d, datetime):
        return datetime.combine(d, datetime.min.time())
    return d

def ensure_datetime_recursive(obj):
    if isinstance(obj, dict):
        return {k: ensure_datetime_recursive(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [ensure_datetime_recursive(item) for item in obj]
    else:
        return ensure_datetime(obj)
    
def generate_task_id(tasks_collection):
    # Find the maximum current task id
    last_task = tasks_collection.find_one(
        {"id": {"$regex": "^tsk-\\d+$"}},
        sort=[("created_at", -1)]
    )
    if last_task and "id" in last_task:
        try:
            last_num = int(last_task["id"].split("-")[1])
            new_num = last_num + 1
        except Exception:
            new_num = 1
    else:
        new_num = 1
    return f"tsk-{new_num:02d}"


# Create task
@task_router.post("/", response_model=TaskModel)
async def create_task(task: TaskModel, current_user: dict = Depends(get_current_user), tasks_collection=Depends(tasks_collection)):
    """
    Create a new task with hierarchy-based access control
    """
    user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
    logger.info(f"Task creation requested by user: {user_id}")
    
    # Check if user can assign tasks to the specified assignee
    if task.assigned_to and task.assigned_to != user_id:
        is_admin = await HierarchyHelper.is_user_admin(user_id)
        if not is_admin:
            can_assign = await HierarchyHelper.can_access_resource(user_id, task.assigned_to)
            if not can_assign:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You can only assign tasks to yourself or your subordinates"
                )
    
    task_dict = task.dict(exclude_unset=True)
    task_dict = ensure_datetime_recursive(task_dict)
    task_dict["created_at"] = datetime.now()
    task_dict["created_by"] = user_id  # Track who created the task
    task_dict["id"] = generate_task_id(tasks_collection)
    result = tasks_collection.insert_one(task_dict)
    # Do not overwrite with MongoDB's ObjectId!
    return task_dict

# Update task status & handle approval
@task_router.patch("/{task_id}/status")
async def update_task_status(task_id: str, update: TaskStatusUpdate, current_user: dict = Depends(get_current_user), tasks_collection=Depends(tasks_collection)):
    """
    Update task status with hierarchy-based access control
    """
    user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
    logger.info(f"Task status update requested by user: {user_id} for task: {task_id}")
    
    # Get the task first
    task = tasks_collection.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if user can update this task
    is_admin = await HierarchyHelper.is_user_admin(user_id)
    task_assignee = task.get("assigned_to")
    task_creator = task.get("created_by")
    
    if not is_admin:
        # User can update if they are the assignee, creator, or can access the assignee
        can_update = (
            user_id == task_assignee or 
            user_id == task_creator or
            (task_assignee and await HierarchyHelper.can_access_resource(user_id, task_assignee))
        )
        
        if not can_update:
            raise HTTPException(
                status_code=403,
                detail="Access denied: You don't have permission to update this task"
            )
    
    update_dict = update.dict(exclude_unset=True)
    if update_dict.get("status") == "approved":
        update_dict["approved_at"] = datetime.now()
        update_dict["approved_by"] = user_id  # Track who approved
    
    result = tasks_collection.update_one({"id": task_id}, {"$set": update_dict})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Task not found or not updated")
    return {"message": "Status updated"}

# List tasks by user or status
@task_router.get("/", response_model=List[TaskModel])
async def list_tasks(
    assigned_to: Optional[str] = None, 
    status: Optional[str] = None, 
    current_user: dict = Depends(get_current_user),
    tasks_collection=Depends(tasks_collection)
):
    """
    List tasks with hierarchy-based filtering
    Users can only see tasks assigned to themselves or their subordinates
    """
    user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
    logger.info(f"Task list requested by user: {user_id}")
    
    # Check if user is admin
    is_admin = await HierarchyHelper.is_user_admin(user_id)
    
    query = {}
    
    # Apply status filter if provided
    if status:
        query["status"] = status
    
    if is_admin:
        # Admin can see all tasks, apply assigned_to filter if provided
        if assigned_to:
            query["assigned_to"] = assigned_to
        logger.info(f"Admin user {user_id} accessing all tasks")
    else:
        # Non-admin users: apply hierarchy filtering
        accessible_user_ids = await HierarchyHelper.get_accessible_user_ids(user_id)
        logger.info(f"Non-admin user {user_id} can access users: {accessible_user_ids}")
        
        if assigned_to:
            # Check if user can access the specified assignee
            if assigned_to not in accessible_user_ids:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You don't have permission to view tasks for this user"
                )
            query["assigned_to"] = assigned_to
        else:
            # Show tasks assigned to accessible users
            hierarchy_filter = HierarchyHelper.create_multi_field_hierarchy_filter(
                user_id,
                accessible_user_ids,
                ["assigned_to", "created_by"]
            )
            query.update(hierarchy_filter)
    
    tasks = list(tasks_collection.find(query))
    logger.info(f"Found {len(tasks)} tasks for user {user_id}")
    
    for t in tasks:
        # No need to pop _id, just return the custom id
        if isinstance(t.get("due_date"), datetime):
            t["due_date"] = t["due_date"].date()
        if t.get("approved_at") and isinstance(t["approved_at"], datetime):
            t["approved_at"] = t["approved_at"].date()
    return tasks

# Get a single task
@task_router.get("/assign/{task_id}", response_model=TaskModel)
async def get_task(task_id: str, current_user: dict = Depends(get_current_user), tasks_collection=Depends(tasks_collection)):
    """
    Get a single task with hierarchy-based access control
    """
    user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("username")
    logger.info(f"Task details requested by user: {user_id} for task: {task_id}")
    
    t = tasks_collection.find_one({"id": task_id})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if user can access this task
    is_admin = await HierarchyHelper.is_user_admin(user_id)
    task_assignee = t.get("assigned_to")
    task_creator = t.get("created_by")
    
    if not is_admin:
        # User can view if they are the assignee, creator, or can access the assignee
        can_view = (
            user_id == task_assignee or 
            user_id == task_creator or
            (task_assignee and await HierarchyHelper.can_access_resource(user_id, task_assignee))
        )
        
        if not can_view:
            raise HTTPException(
                status_code=403,
                detail="Access denied: You don't have permission to view this task"
            )
    
    if isinstance(t.get("due_date"), datetime):
        t["due_date"] = t["due_date"].date()
    if t.get("approved_at") and isinstance(t["approved_at"], datetime):
        t["approved_at"] = t["approved_at"].date()
    return t
