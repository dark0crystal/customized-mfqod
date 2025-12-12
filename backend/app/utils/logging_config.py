import logging
import logging.handlers
import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import traceback
from sqlalchemy.orm import Session
from app.models import LoginAttempt, LoginAttemptStatus
from app.config.auth_config import AuthConfig

class SecurityLogger:
    """Enhanced logging for security events"""
    
    def __init__(self):
        self.config = AuthConfig()
        self.logger = logging.getLogger('security')
        self._setup_security_logger()
    
    def _setup_security_logger(self):
        """Configure security logger with file handler"""
        # Create logs directory if it doesn't exist
        os.makedirs('logs', exist_ok=True)
        
        # Configure security log handler
        security_handler = logging.handlers.RotatingFileHandler(
            'logs/security.log',
            maxBytes=10*1024*1024,  # 10MB
            backupCount=10
        )
        
        security_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        security_handler.setFormatter(security_formatter)
        
        self.logger.addHandler(security_handler)
        self.logger.setLevel(logging.INFO)
    
    def log_login_attempt(self, email_or_username: str, ip_address: str, 
                         success: bool, reason: Optional[str] = None,
                         user_agent: Optional[str] = None):
        """Log login attempt with security details"""
        event_data = {
            'event_type': 'login_attempt',
            'email_or_username': email_or_username,
            'ip_address': ip_address,
            'success': success,
            'reason': reason,
            'user_agent': user_agent,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        if success:
            self.logger.info(f"LOGIN_SUCCESS: {json.dumps(event_data)}")
        else:
            self.logger.warning(f"LOGIN_FAILED: {json.dumps(event_data)}")
    
    def log_account_lockout(self, email: str, ip_address: str, 
                           failed_attempts: int, lockout_duration: str):
        """Log account lockout event"""
        event_data = {
            'event_type': 'account_lockout',
            'email': email,
            'ip_address': ip_address,
            'failed_attempts': failed_attempts,
            'lockout_duration': lockout_duration,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        self.logger.error(f"ACCOUNT_LOCKOUT: {json.dumps(event_data)}")
    
    def log_password_change(self, user_id: str, ip_address: str, success: bool):
        """Log password change attempt"""
        event_data = {
            'event_type': 'password_change',
            'user_id': user_id,
            'ip_address': ip_address,
            'success': success,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        if success:
            self.logger.info(f"PASSWORD_CHANGED: {json.dumps(event_data)}")
        else:
            self.logger.warning(f"PASSWORD_CHANGE_FAILED: {json.dumps(event_data)}")
    
    def log_privilege_escalation(self, user_id: str, action: str, 
                                resource: str, ip_address: str):
        """Log privilege escalation attempts"""
        event_data = {
            'event_type': 'privilege_escalation',
            'user_id': user_id,
            'action': action,
            'resource': resource,
            'ip_address': ip_address,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        self.logger.warning(f"PRIVILEGE_ESCALATION: {json.dumps(event_data)}")
    
    def log_suspicious_activity(self, event_type: str, details: Dict[str, Any]):
        """Log suspicious activity"""
        event_data = {
            'event_type': 'suspicious_activity',
            'sub_type': event_type,
            'details': details,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        self.logger.error(f"SUSPICIOUS_ACTIVITY: {json.dumps(event_data)}")

class AuditLogger:
    """Audit logger for compliance and monitoring"""
    
    def __init__(self):
        self.logger = logging.getLogger('audit')
        self._setup_audit_logger()
    
    def _setup_audit_logger(self):
        """Configure audit logger"""
        os.makedirs('logs', exist_ok=True)
        
        audit_handler = logging.handlers.RotatingFileHandler(
            'logs/audit.log',
            maxBytes=50*1024*1024,  # 50MB
            backupCount=20
        )
        
        audit_formatter = logging.Formatter(
            '%(asctime)s - AUDIT - %(message)s'
        )
        audit_handler.setFormatter(audit_formatter)
        
        self.logger.addHandler(audit_handler)
        self.logger.setLevel(logging.INFO)
    
    def log_user_action(self, user_id: str, action: str, resource: str, 
                       ip_address: str, details: Optional[Dict] = None):
        """Log user actions for audit trail"""
        audit_data = {
            'user_id': user_id,
            'action': action,
            'resource': resource,
            'ip_address': ip_address,
            'details': details or {},
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        self.logger.info(json.dumps(audit_data))
    
    def log_admin_action(self, admin_user_id: str, action: str, 
                        target_user_id: Optional[str] = None,
                        details: Optional[Dict] = None):
        """Log administrative actions"""
        audit_data = {
            'admin_user_id': admin_user_id,
            'action': action,
            'target_user_id': target_user_id,
            'details': details or {},
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        self.logger.info(f"ADMIN_ACTION: {json.dumps(audit_data)}")

class ErrorLogger:
    """Enhanced error logging with context"""
    
    def __init__(self):
        self.logger = logging.getLogger('errors')
        self._setup_error_logger()
    
    def _setup_error_logger(self):
        """Configure error logger"""
        os.makedirs('logs', exist_ok=True)
        
        error_handler = logging.handlers.RotatingFileHandler(
            'logs/errors.log',
            maxBytes=25*1024*1024,  # 25MB
            backupCount=15
        )
        
        error_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
        )
        error_handler.setFormatter(error_formatter)
        
        self.logger.addHandler(error_handler)
        self.logger.setLevel(logging.ERROR)
    
    def log_exception(self, exception: Exception, context: Optional[Dict] = None,
                     user_id: Optional[str] = None):
        """Log exception with full context"""
        error_data = {
            'exception_type': type(exception).__name__,
            'exception_message': str(exception),
            'traceback': traceback.format_exc(),
            'context': context or {},
            'user_id': user_id,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        self.logger.error(json.dumps(error_data, default=str))
    
    def log_auth_error(self, error_type: str, details: Dict[str, Any]):
        """Log authentication-related errors"""
        error_data = {
            'error_type': 'authentication_error',
            'sub_type': error_type,
            'details': details,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        self.logger.error(f"AUTH_ERROR: {json.dumps(error_data)}")

class PerformanceLogger:
    """Logger for performance monitoring"""
    
    def __init__(self):
        self.logger = logging.getLogger('performance')
        self._setup_performance_logger()
    
    def _setup_performance_logger(self):
        """Configure performance logger"""
        os.makedirs('logs', exist_ok=True)
        
        perf_handler = logging.handlers.RotatingFileHandler(
            'logs/performance.log',
            maxBytes=20*1024*1024,  # 20MB
            backupCount=10
        )
        
        perf_formatter = logging.Formatter(
            '%(asctime)s - PERF - %(message)s'
        )
        perf_handler.setFormatter(perf_formatter)
        
        self.logger.addHandler(perf_handler)
        self.logger.setLevel(logging.INFO)
    
    def log_slow_query(self, query_type: str, duration: float, 
                      details: Optional[Dict] = None):
        """Log slow database queries"""
        if duration > 1.0:  # Log queries slower than 1 second
            perf_data = {
                'type': 'slow_query',
                'query_type': query_type,
                'duration_seconds': duration,
                'details': details or {},
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            self.logger.warning(json.dumps(perf_data))
    
    def log_ad_sync_performance(self, sync_type: str, duration: float, 
                               users_processed: int):
        """Log AD sync performance metrics"""
        perf_data = {
            'type': 'ad_sync_performance',
            'sync_type': sync_type,
            'duration_seconds': duration,
            'users_processed': users_processed,
            'users_per_second': users_processed / duration if duration > 0 else 0,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        self.logger.info(json.dumps(perf_data))

def setup_logging():
    """Setup comprehensive logging configuration"""
    # Create logs directory
    os.makedirs('logs', exist_ok=True)
    
    # Configure root logger
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.handlers.RotatingFileHandler(
                'logs/application.log',
                maxBytes=25*1024*1024,
                backupCount=10
            ),
            logging.StreamHandler()
        ]
    )
    
    # Set specific logger levels
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('fastapi').setLevel(logging.INFO)
    logging.getLogger('uvicorn').setLevel(logging.INFO)
    
    # Disable verbose HTTP logs in production
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    
    return {
        'security': SecurityLogger(),
        'audit': AuditLogger(),
        'error': ErrorLogger(),
        'performance': PerformanceLogger()
    }

# Global logger instances
loggers = setup_logging()
security_logger = loggers['security']
audit_logger = loggers['audit']
error_logger = loggers['error']
performance_logger = loggers['performance']