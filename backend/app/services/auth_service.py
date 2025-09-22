import bcrypt
import jwt
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Any, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from fastapi import HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from models import User, UserType, LoginAttempt, LoginAttemptStatus, UserSession, Role, Permission
from config.auth_config import AuthConfig
from services.enhanced_ad_service import EnhancedADService
from db.database import get_db
import re
import ipaddress

logger = logging.getLogger(__name__)

class AuthService:
    def __init__(self):
        self.config = AuthConfig()
        self.ad_service = EnhancedADService()
        self.security = HTTPBearer()
    
    async def authenticate_user(self, email_or_username: str, password: str, 
                              request: Request, db: Session) -> Dict[str, Any]:
        """
        Comprehensive user authentication supporting both internal and external users
        """
        # Get client info
        ip_address = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        
        # Check rate limiting
        await self._check_rate_limit(email_or_username, ip_address, db)
        
        # Determine user type and authenticate
        user_type = self._detect_user_type(email_or_username)
        
        if user_type == UserType.INTERNAL:
            return await self._authenticate_internal_user(
                email_or_username, password, ip_address, user_agent, db
            )
        else:
            return await self._authenticate_external_user(
                email_or_username, password, ip_address, user_agent, db
            )
    
    def _detect_user_type(self, email_or_username: str) -> UserType:
        """
        Detect if user is internal or external based on email domain or username format
        """
        # Check if it's an email with university domain
        if "@" in email_or_username:
            domain = email_or_username.split("@")[1].lower()
            university_domains = ["squ.edu.om", "student.squ.edu.om", "staff.squ.edu.om"]
            if domain in university_domains:
                return UserType.INTERNAL
        
        # Check if it's a username pattern (no @ symbol, typical AD username)
        elif not "@" in email_or_username and len(email_or_username) <= 20:
            # Assume internal user if it looks like a username
            return UserType.INTERNAL
            
        return UserType.EXTERNAL
    
    async def _authenticate_internal_user(self, email_or_username: str, password: str,
                                        ip_address: str, user_agent: str, 
                                        db: Session) -> Dict[str, Any]:
        """Authenticate internal user via Active Directory"""
        username = email_or_username.split("@")[0] if "@" in email_or_username else email_or_username
        
        try:
            # Check account lockout first
            user = self._get_user_by_email_or_username(email_or_username, db)
            if user and self._is_account_locked(user):
                self._log_login_attempt(user.id, email_or_username, ip_address, 
                                      user_agent, LoginAttemptStatus.BLOCKED, 
                                      "Account locked", db)
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail=f"Account locked until {user.locked_until.isoformat()}"
                )
            
            # Authenticate against AD
            is_authenticated, ad_user_data = self.ad_service.authenticate_user(username, password)
            
            if not is_authenticated:
                await self._handle_failed_login(user, email_or_username, ip_address, 
                                              user_agent, "Invalid AD credentials", db)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
            
            # Sync user from AD or create if doesn't exist
            if not user:
                user = await self.ad_service.sync_user_from_ad(username, db)
                if not user:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to sync user from Active Directory"
                    )
            else:
                # Update user info from AD
                await self._update_user_from_ad_data(user, ad_user_data, db)
            
            # Verify user is still active in AD
            if not user.active:
                self._log_login_attempt(user.id, email_or_username, ip_address, 
                                      user_agent, LoginAttemptStatus.FAILED, 
                                      "Account deactivated", db)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Account has been deactivated"
                )
            
            # Success - reset failed attempts and generate tokens
            await self._handle_successful_login(user, ip_address, user_agent, db)
            
            return await self._generate_auth_response(user, ip_address, user_agent, db)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Internal authentication error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service error"
            )
    
    async def _authenticate_external_user(self, email_or_username: str, password: str,
                                        ip_address: str, user_agent: str,
                                        db: Session) -> Dict[str, Any]:
        """Authenticate external user via local database"""
        user = self._get_user_by_email_or_username(email_or_username, db)
        
        if not user or user.user_type != UserType.EXTERNAL:
            await self._handle_failed_login(None, email_or_username, ip_address, 
                                          user_agent, "User not found", db)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Check account lockout
        if self._is_account_locked(user):
            self._log_login_attempt(user.id, email_or_username, ip_address, 
                                  user_agent, LoginAttemptStatus.BLOCKED, 
                                  "Account locked", db)
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account locked until {user.locked_until.isoformat()}"
            )
        
        # Verify password
        if not user.password or not self._verify_password(password, user.password):
            await self._handle_failed_login(user, email_or_username, ip_address, 
                                          user_agent, "Invalid password", db)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Check if account is active
        if not user.active:
            self._log_login_attempt(user.id, email_or_username, ip_address, 
                                  user_agent, LoginAttemptStatus.FAILED, 
                                  "Account deactivated", db)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account has been deactivated"
            )
        
        # Success
        await self._handle_successful_login(user, ip_address, user_agent, db)
        return await self._generate_auth_response(user, ip_address, user_agent, db)
    
    async def create_external_user(self, user_data: Dict[str, Any], db: Session) -> User:
        """Create new external user account"""
        # Validate email uniqueness
        existing_user = db.query(User).filter(
            or_(User.email == user_data['email'], 
                User.username == user_data.get('username'))
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email or username already exists"
            )
        
        # Validate password strength
        password = user_data.get('password')
        if not self._is_password_strong(password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=self._get_password_requirements()
            )
        
        # Hash password
        hashed_password = self._hash_password(password)
        
        # Create user
        new_user = User(
            email=user_data['email'],
            username=user_data.get('username') or user_data['email'],
            password=hashed_password,
            first_name=user_data['first_name'],
            last_name=user_data['last_name'],
            phone_number=user_data.get('phone_number'),
            user_type=UserType.EXTERNAL,
            active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(f"Created external user account: {new_user.email}")
        return new_user
    
    def _get_user_by_email_or_username(self, email_or_username: str, db: Session) -> Optional[User]:
        """Get user by email or username"""
        return db.query(User).filter(
            or_(User.email == email_or_username, 
                User.username == email_or_username)
        ).first()
    
    def _is_account_locked(self, user: User) -> bool:
        """Check if account is currently locked"""
        if not user.is_locked or not user.locked_until:
            return False
        return datetime.now(timezone.utc) < user.locked_until
    
    async def _handle_failed_login(self, user: Optional[User], email_or_username: str,
                                 ip_address: str, user_agent: str, reason: str, 
                                 db: Session):
        """Handle failed login attempt with progressive lockout"""
        user_id = user.id if user else None
        
        # Log the attempt
        self._log_login_attempt(user_id, email_or_username, ip_address, user_agent, 
                               LoginAttemptStatus.FAILED, reason, db)
        
        if user:
            user.failed_login_attempts += 1
            user.updated_at = datetime.now(timezone.utc)
            
            # Apply lockout if threshold exceeded
            if user.failed_login_attempts >= self.config.MAX_LOGIN_ATTEMPTS:
                lockout_duration = self.config.get_lockout_duration(user.failed_login_attempts)
                user.is_locked = True
                user.locked_until = datetime.now(timezone.utc) + lockout_duration
                
                logger.warning(f"Account locked for user {user.email}: {user.failed_login_attempts} failed attempts")
            
            db.commit()
    
    async def _handle_successful_login(self, user: User, ip_address: str, 
                                     user_agent: str, db: Session):
        """Handle successful login - reset counters and log"""
        # Reset lockout counters
        user.failed_login_attempts = 0
        user.is_locked = False
        user.locked_until = None
        user.last_login = datetime.now(timezone.utc)
        user.updated_at = datetime.now(timezone.utc)
        
        # Log successful attempt
        self._log_login_attempt(user.id, user.email, ip_address, user_agent, 
                               LoginAttemptStatus.SUCCESS, None, db)
        
        # Clean up old sessions
        await self._cleanup_old_sessions(user.id, db)
        
        db.commit()
    
    async def _generate_auth_response(self, user: User, ip_address: str, 
                                    user_agent: str, db: Session) -> Dict[str, Any]:
        """Generate authentication response with tokens and user info"""
        # Generate access token
        access_token = self._create_access_token(user)
        
        # Generate refresh token and create session
        refresh_token = self._generate_refresh_token()
        session = UserSession(
            user_id=user.id,
            session_token=refresh_token,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=datetime.now(timezone.utc) + timedelta(days=self.config.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        
        db.add(session)
        db.commit()
        
        # Get user permissions
        permissions = self._get_user_permissions(user, db)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": self.config.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "user_type": user.user_type.value,
                "role": user.role.name if user.role else None,
                "permissions": permissions,
                "last_login": user.last_login.isoformat() if user.last_login else None
            }
        }
    
    def _create_access_token(self, user: User) -> str:
        """Create JWT access token"""
        payload = {
            "sub": user.id,
            "email": user.email,
            "username": user.username,
            "user_type": user.user_type.value,
            "role": user.role.name if user.role else None,
            "exp": datetime.utcnow() + timedelta(minutes=self.config.ACCESS_TOKEN_EXPIRE_MINUTES),
            "iat": datetime.utcnow(),
            "iss": "university-lost-found-auth"
        }
        
        return jwt.encode(payload, self.config.SECRET_KEY, algorithm=self.config.JWT_ALGORITHM)
    
    def _generate_refresh_token(self) -> str:
        """Generate secure refresh token"""
        return secrets.token_urlsafe(32)
    
    async def refresh_access_token(self, refresh_token: str, db: Session) -> Dict[str, Any]:
        """Refresh access token using refresh token"""
        session = db.query(UserSession).filter(
            and_(
                UserSession.session_token == refresh_token,
                UserSession.is_active == True,
                UserSession.expires_at > datetime.now(timezone.utc)
            )
        ).first()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )
        
        user = db.query(User).filter(User.id == session.user_id).first()
        if not user or not user.active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive"
            )
        
        # Generate new access token
        access_token = self._create_access_token(user)
        
        # Update session
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": self.config.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    
    async def verify_token(self, token: str, db: Session) -> User:
        """Verify JWT token and return user"""
        try:
            payload = jwt.decode(token, self.config.SECRET_KEY, 
                               algorithms=[self.config.JWT_ALGORITHM])
            user_id = payload.get("sub")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
            
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not user.active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or inactive"
                )
            
            return user
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    
    async def logout(self, refresh_token: str, db: Session):
        """Logout user by invalidating session"""
        session = db.query(UserSession).filter(
            UserSession.session_token == refresh_token
        ).first()
        
        if session:
            session.is_active = False
            session.updated_at = datetime.now(timezone.utc)
            db.commit()
    
    def _hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        salt = bcrypt.gensalt(rounds=self.config.BCRYPT_ROUNDS)
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def _verify_password(self, password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    
    def _is_password_strong(self, password: str) -> bool:
        """Check password strength according to policy"""
        if len(password) < self.config.PASSWORD_MIN_LENGTH:
            return False
        
        if self.config.PASSWORD_REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
            return False
            
        if self.config.PASSWORD_REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
            return False
            
        if self.config.PASSWORD_REQUIRE_NUMBERS and not re.search(r'\d', password):
            return False
            
        if self.config.PASSWORD_REQUIRE_SPECIAL_CHARS and not re.search(r'[!@#$%^&*(),.?\":{}|<>]', password):
            return False
            
        return True
    
    def _get_password_requirements(self) -> str:
        """Get password requirements message"""
        requirements = [f"at least {self.config.PASSWORD_MIN_LENGTH} characters"]
        
        if self.config.PASSWORD_REQUIRE_UPPERCASE:
            requirements.append("at least one uppercase letter")
        if self.config.PASSWORD_REQUIRE_LOWERCASE:
            requirements.append("at least one lowercase letter")
        if self.config.PASSWORD_REQUIRE_NUMBERS:
            requirements.append("at least one number")
        if self.config.PASSWORD_REQUIRE_SPECIAL_CHARS:
            requirements.append("at least one special character")
            
        return f"Password must contain {', '.join(requirements)}"
    
    def _log_login_attempt(self, user_id: Optional[str], email_or_username: str,
                          ip_address: str, user_agent: str, status: LoginAttemptStatus,
                          failure_reason: Optional[str], db: Session):
        """Log login attempt"""
        if not self.config.ENABLE_AUDIT_LOGGING:
            return
            
        attempt = LoginAttempt(
            user_id=user_id,
            email_or_username=email_or_username,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status,
            failure_reason=failure_reason
        )
        
        db.add(attempt)
        db.commit()
    
    async def _check_rate_limit(self, email_or_username: str, ip_address: str, db: Session):
        """Check rate limiting for login attempts"""
        time_window = datetime.now(timezone.utc) - timedelta(minutes=1)
        
        # Check attempts by IP
        ip_attempts = db.query(LoginAttempt).filter(
            and_(
                LoginAttempt.ip_address == ip_address,
                LoginAttempt.created_at > time_window
            )
        ).count()
        
        if ip_attempts >= self.config.LOGIN_RATE_LIMIT_PER_MINUTE:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Please try again later."
            )
        
        # Check attempts by email/username
        user_attempts = db.query(LoginAttempt).filter(
            and_(
                LoginAttempt.email_or_username == email_or_username,
                LoginAttempt.created_at > time_window
            )
        ).count()
        
        if user_attempts >= self.config.LOGIN_RATE_LIMIT_PER_MINUTE:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts for this account. Please try again later."
            )
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request"""
        # Check for forwarded IP first (proxy/load balancer)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP if multiple are present
            return forwarded_for.split(",")[0].strip()
        
        # Check other common headers
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
            
        # Fall back to direct connection IP
        return request.client.host if request.client else "unknown"
    
    def _get_user_permissions(self, user: User, db: Session) -> List[str]:
        """Get user permissions based on role"""
        if not user.role:
            return []
        
        permissions = db.query(Permission).join(
            Permission.roles
        ).filter(Role.id == user.role.id).all()
        
        return [permission.name for permission in permissions]
    
    async def _cleanup_old_sessions(self, user_id: str, db: Session):
        """Clean up old sessions for user"""
        # Deactivate expired sessions
        expired_sessions = db.query(UserSession).filter(
            and_(
                UserSession.user_id == user_id,
                UserSession.is_active == True,
                UserSession.expires_at <= datetime.now(timezone.utc)
            )
        ).all()
        
        for session in expired_sessions:
            session.is_active = False
            session.updated_at = datetime.now(timezone.utc)
        
        # Limit active sessions per user
        active_sessions = db.query(UserSession).filter(
            and_(
                UserSession.user_id == user_id,
                UserSession.is_active == True,
                UserSession.expires_at > datetime.now(timezone.utc)
            )
        ).order_by(UserSession.created_at.desc()).all()
        
        if len(active_sessions) > self.config.MAX_SESSIONS_PER_USER:
            sessions_to_deactivate = active_sessions[self.config.MAX_SESSIONS_PER_USER:]
            for session in sessions_to_deactivate:
                session.is_active = False
                session.updated_at = datetime.now(timezone.utc)
        
        db.commit()
    
    async def _update_user_from_ad_data(self, user: User, ad_data: Dict[str, Any], db: Session):
        """Update user information from AD data"""
        user.first_name = ad_data.get('first_name') or user.first_name
        user.last_name = ad_data.get('last_name') or user.last_name
        user.email = ad_data.get('email') or user.email
        user.ad_sync_date = datetime.now(timezone.utc)
        user.updated_at = datetime.now(timezone.utc)
        db.commit()