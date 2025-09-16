import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor
from sqlalchemy.orm import Session

from config.auth_config import ADConfig
from services.enhanced_ad_service import EnhancedADService
from services.auth_service import AuthService
from db.database import get_db, DATABASE_URL
from models import User, UserSession, LoginAttempt, ADSyncLog

logger = logging.getLogger(__name__)

class SyncScheduler:
    def __init__(self):
        self.config = ADConfig()
        self.ad_service = EnhancedADService()
        self.auth_service = AuthService()
        self.scheduler = None
        self._setup_scheduler()
    
    def _setup_scheduler(self):
        """Initialize the job scheduler with database job store"""
        jobstores = {
            'default': SQLAlchemyJobStore(url=DATABASE_URL)
        }
        
        executors = {
            'default': AsyncIOExecutor()
        }
        
        job_defaults = {
            'coalesce': True,  # Combine multiple missed executions into one
            'max_instances': 1,  # Prevent overlapping executions
            'misfire_grace_time': 30 * 60  # 30 minutes grace period
        }
        
        self.scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            timezone='UTC'
        )
    
    async def start(self):
        """Start the scheduler and add recurring jobs"""
        if not self.scheduler.running:
            try:
                self.scheduler.start()
                await self._schedule_recurring_jobs()
                logger.info("Sync scheduler started successfully")
            except Exception as e:
                logger.error(f"Failed to start sync scheduler: {str(e)}")
                raise
    
    async def stop(self):
        """Stop the scheduler"""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown(wait=True)
            logger.info("Sync scheduler stopped")
    
    async def _schedule_recurring_jobs(self):
        """Schedule all recurring sync jobs"""
        try:
            # Remove existing jobs to prevent duplicates
            self.scheduler.remove_all_jobs()
            
            # AD User Sync - Daily at 2 AM
            if self.config.ENABLE_AUTO_SYNC:
                self.scheduler.add_job(
                    self._run_ad_sync,
                    'cron',
                    hour=2,
                    minute=0,
                    id='ad_user_sync',
                    name='Daily Active Directory User Sync',
                    replace_existing=True
                )
                logger.info("Scheduled daily AD sync job")
            
            # Session Cleanup - Every 6 hours
            self.scheduler.add_job(
                self._cleanup_expired_sessions,
                'interval',
                hours=6,
                id='session_cleanup',
                name='Session Cleanup',
                replace_existing=True
            )
            logger.info("Scheduled session cleanup job")
            
            # Login Attempt Cleanup - Daily at 3 AM
            self.scheduler.add_job(
                self._cleanup_old_login_attempts,
                'cron',
                hour=3,
                minute=0,
                id='login_attempt_cleanup',
                name='Login Attempt Cleanup',
                replace_existing=True
            )
            logger.info("Scheduled login attempt cleanup job")
            
            # Health Check - Every hour
            self.scheduler.add_job(
                self._run_health_checks,
                'interval',
                hours=1,
                id='health_check',
                name='System Health Check',
                replace_existing=True
            )
            logger.info("Scheduled health check job")
            
            # Account Lockout Reset - Every 30 minutes
            self.scheduler.add_job(
                self._reset_expired_lockouts,
                'interval',
                minutes=30,
                id='lockout_reset',
                name='Account Lockout Reset',
                replace_existing=True
            )
            logger.info("Scheduled lockout reset job")
            
        except Exception as e:
            logger.error(f"Error scheduling jobs: {str(e)}")
            raise
    
    async def _run_ad_sync(self):
        """Run Active Directory user sync"""
        logger.info("Starting scheduled AD sync")
        
        try:
            # Get database session
            db = next(get_db())
            
            try:
                # Run the sync
                stats = await self.ad_service.bulk_sync_users(db)
                
                logger.info(f"AD sync completed successfully: {stats}")
                
                # Log success
                sync_log = ADSyncLog(
                    sync_type='scheduled_user_sync',
                    status='success',
                    message=f"Scheduled sync completed successfully",
                    users_processed=stats.get('processed', 0),
                    users_updated=stats.get('updated', 0) + stats.get('created', 0),
                    users_deactivated=stats.get('deactivated', 0),
                    started_at=datetime.now(timezone.utc),
                    completed_at=datetime.now(timezone.utc)
                )
                
                db.add(sync_log)
                db.commit()
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Scheduled AD sync failed: {str(e)}")
            
            # Log failure
            try:
                db = next(get_db())
                sync_log = ADSyncLog(
                    sync_type='scheduled_user_sync',
                    status='failed',
                    message=f"Scheduled sync failed: {str(e)}",
                    error_details=str(e),
                    started_at=datetime.now(timezone.utc),
                    completed_at=datetime.now(timezone.utc)
                )
                db.add(sync_log)
                db.commit()
                db.close()
            except Exception as log_error:
                logger.error(f"Failed to log sync failure: {str(log_error)}")
    
    async def _cleanup_expired_sessions(self):
        """Clean up expired user sessions"""
        logger.info("Starting session cleanup")
        
        try:
            db = next(get_db())
            
            try:
                # Find expired sessions
                cutoff_time = datetime.now(timezone.utc)
                expired_sessions = db.query(UserSession).filter(
                    UserSession.expires_at <= cutoff_time,
                    UserSession.is_active == True
                ).all()
                
                # Deactivate expired sessions
                count = 0
                for session in expired_sessions:
                    session.is_active = False
                    session.updated_at = datetime.now(timezone.utc)
                    count += 1
                
                db.commit()
                
                logger.info(f"Cleaned up {count} expired sessions")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Session cleanup failed: {str(e)}")
    
    async def _cleanup_old_login_attempts(self):
        """Clean up old login attempts (keep last 30 days)"""
        logger.info("Starting login attempt cleanup")
        
        try:
            db = next(get_db())
            
            try:
                # Delete attempts older than 30 days
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
                deleted_count = db.query(LoginAttempt).filter(
                    LoginAttempt.created_at < cutoff_date
                ).delete(synchronize_session=False)
                
                db.commit()
                
                logger.info(f"Cleaned up {deleted_count} old login attempts")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Login attempt cleanup failed: {str(e)}")
    
    async def _run_health_checks(self):
        """Run system health checks"""
        logger.debug("Running system health checks")
        
        try:
            # Check AD connectivity
            ad_health = await self.ad_service.health_check()
            
            if ad_health['status'] != 'healthy':
                logger.warning(f"AD health check failed: {ad_health}")
            
            # Check database connectivity
            try:
                db = next(get_db())
                db.execute("SELECT 1")
                db.close()
            except Exception as e:
                logger.error(f"Database health check failed: {str(e)}")
            
            # Log health status periodically (every 6th check = every 6 hours)
            current_hour = datetime.now(timezone.utc).hour
            if current_hour % 6 == 0:
                logger.info(f"Health check completed - AD: {ad_health['status']}")
                
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
    
    async def _reset_expired_lockouts(self):
        """Reset expired account lockouts"""
        logger.debug("Checking for expired lockouts")
        
        try:
            db = next(get_db())
            
            try:
                # Find users with expired lockouts
                current_time = datetime.now(timezone.utc)
                locked_users = db.query(User).filter(
                    User.is_locked == True,
                    User.locked_until <= current_time
                ).all()
                
                # Reset lockouts
                count = 0
                for user in locked_users:
                    user.is_locked = False
                    user.locked_until = None
                    user.failed_login_attempts = 0
                    user.updated_at = current_time
                    count += 1
                
                db.commit()
                
                if count > 0:
                    logger.info(f"Reset {count} expired account lockouts")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Lockout reset failed: {str(e)}")
    
    async def trigger_manual_sync(self) -> str:
        """Trigger manual AD sync and return job ID"""
        try:
            job = self.scheduler.add_job(
                self._run_ad_sync,
                'date',
                run_date=datetime.now(timezone.utc) + timedelta(seconds=5),
                id=f'manual_sync_{datetime.now(timezone.utc).timestamp()}',
                name='Manual AD Sync'
            )
            
            logger.info(f"Triggered manual AD sync with job ID: {job.id}")
            return job.id
            
        except Exception as e:
            logger.error(f"Failed to trigger manual sync: {str(e)}")
            raise
    
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get status of a specific job"""
        try:
            job = self.scheduler.get_job(job_id)
            
            if job:
                return {
                    'id': job.id,
                    'name': job.name,
                    'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                    'pending': job.pending
                }
            else:
                return {'status': 'not_found'}
                
        except Exception as e:
            logger.error(f"Error getting job status: {str(e)}")
            return {'status': 'error', 'message': str(e)}
    
    def get_all_jobs(self) -> List[Dict[str, Any]]:
        """Get status of all scheduled jobs"""
        try:
            jobs = []
            for job in self.scheduler.get_jobs():
                jobs.append({
                    'id': job.id,
                    'name': job.name,
                    'func': job.func.__name__,
                    'trigger': str(job.trigger),
                    'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                    'pending': job.pending
                })
            
            return jobs
            
        except Exception as e:
            logger.error(f"Error getting job list: {str(e)}")
            return []
    
    async def pause_job(self, job_id: str):
        """Pause a specific job"""
        try:
            self.scheduler.pause_job(job_id)
            logger.info(f"Paused job: {job_id}")
        except Exception as e:
            logger.error(f"Failed to pause job {job_id}: {str(e)}")
            raise
    
    async def resume_job(self, job_id: str):
        """Resume a paused job"""
        try:
            self.scheduler.resume_job(job_id)
            logger.info(f"Resumed job: {job_id}")
        except Exception as e:
            logger.error(f"Failed to resume job {job_id}: {str(e)}")
            raise
    
    async def remove_job(self, job_id: str):
        """Remove a job from the scheduler"""
        try:
            self.scheduler.remove_job(job_id)
            logger.info(f"Removed job: {job_id}")
        except Exception as e:
            logger.error(f"Failed to remove job {job_id}: {str(e)}")
            raise

# Global scheduler instance
sync_scheduler = SyncScheduler()

# Startup event handler
async def start_scheduler():
    """Start the sync scheduler"""
    await sync_scheduler.start()

# Shutdown event handler  
async def stop_scheduler():
    """Stop the sync scheduler"""
    await sync_scheduler.stop()