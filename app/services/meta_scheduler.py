"""
Background scheduler for Meta leads import
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from app.routes.meta_leads import scheduled_meta_import

logger = logging.getLogger(__name__)

class MetaLeadsScheduler:
    def __init__(self):
        self.running = False
        self.task = None
        
    async def start_scheduler(self):
        """Start the background scheduler for Meta leads import"""
        if self.running:
            logger.info("Meta leads scheduler is already running")
            return
            
        self.running = True
        logger.info("Starting Meta leads scheduler - imports every 3 hours")
        
        # Start the background task
        self.task = asyncio.create_task(self._scheduler_loop())
        
    async def stop_scheduler(self):
        """Stop the background scheduler"""
        if not self.running:
            logger.info("Meta leads scheduler is not running")
            return
            
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Meta leads scheduler stopped")
        
    async def _scheduler_loop(self):
        """Main scheduler loop - runs every 3 hours"""
        try:
            while self.running:
                try:
                    # Run the import
                    logger.info("Starting scheduled Meta leads import")
                    await scheduled_meta_import()
                    logger.info("Completed scheduled Meta leads import")
                    
                    # Wait for 3 hours (10800 seconds)
                    await asyncio.sleep(10800)  # 3 hours = 3 * 60 * 60 = 10800 seconds
                    
                except asyncio.CancelledError:
                    logger.info("Meta leads scheduler cancelled")
                    break
                except Exception as e:
                    logger.error(f"Error in Meta leads scheduler: {str(e)}")
                    # Wait 10 minutes before retrying on error
                    await asyncio.sleep(600)
                    
        except Exception as e:
            logger.error(f"Fatal error in Meta leads scheduler: {str(e)}")
        finally:
            self.running = False

# Global scheduler instance
meta_scheduler = MetaLeadsScheduler()

async def start_meta_scheduler():
    """Start the Meta leads scheduler"""
    await meta_scheduler.start_scheduler()

async def stop_meta_scheduler():
    """Stop the Meta leads scheduler"""
    await meta_scheduler.stop_scheduler()

def get_scheduler_status():
    """Get the status of the Meta leads scheduler"""
    return {
        "running": meta_scheduler.running,
        "next_run": "Every 3 hours" if meta_scheduler.running else "Not scheduled"
    }
