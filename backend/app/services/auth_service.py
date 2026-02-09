import bcrypt
import jwt
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Any, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from sqlalchemy.sql import func as sql_func
from fastapi import HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models import User, UserType, LoginAttempt, LoginAttemptStatus, UserSession, Role, Permission, PasswordResetToken
from app.config.auth_config import AuthConfig
from app.services.enhanced_ad_service import EnhancedADService
from app.db.database import get_session
import re
import ipaddress

logger = logging.getLogger(__name__)

class AuthService:
    def __init__(self):
        self.config = AuthConfig()
        self.ad_service = EnhancedADService()
        self.security = HTTPBearer()
    
    def _ensure_timezone_aware(self, dt: datetime) -> datetime:
        """Ensure datetime is timezone-aware (UTC)"""
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    
    async def authenticate_user(self, email_or_username: str, password: str, 
                              request: Request, db: Session) -> Dict[str, Any]:
        """
        Comprehensive user authentication supporting both internal and external users.
        Uses database-first lookup to determine user type.
        """
        try:
            # Get client info
            ip_address = self._get_client_ip(request)
            user_agent = request.headers.get("user-agent", "")
            
            # Security: Rate limiting prevents brute force attacks
            await self._check_rate_limit(email_or_username, ip_address, db)
        
            # Authentication routing: Database-first lookup determines user type
            # Internal users authenticate via AD, external users use database passwords
            user = self._get_user_by_email_or_username(email_or_username, db)
        
            if user:
                # User exists: Route to appropriate authentication method based on user_type
                if user.user_type == UserType.INTERNAL:
                    # Internal users: Always authenticate against Active Directory
                    return await self._authenticate_internal_user(
                        email_or_username, password, ip_address, user_agent, db
                    )
                else:
                    # External users: Authenticate using database-stored password hash
                    return await self._authenticate_external_user(
                        email_or_username, password, ip_address, user_agent, db
                    )
            else:
                # User doesn't exist: Try AD authentication for new internal users
                # This enables automatic user creation from AD on first login
                username = email_or_username.split("@")[0] if "@" in email_or_username else email_or_username
                
                try:
                    is_authenticated, ad_user_data, error_detail = self.ad_service.authenticate_user(username, password)
                    
                    if is_authenticated:
                        # Business logic: Auto-create internal user from AD on successful authentication
                        user = await self.ad_service.sync_user_from_ad(username, db)
                        if user:
                            await self._handle_successful_login(user, ip_address, user_agent, db)
                            return await self._generate_auth_response(user, ip_address, user_agent, db)
                    
                    # Security: Log detailed error but return generic message to prevent user enumeration
                    failure_reason = error_detail or "Invalid credentials"
                    logger.warning(f"AD authentication failed for {email_or_username}: {failure_reason}")
                    await self._handle_failed_login(None, email_or_username, ip_address, 
                                                  user_agent, failure_reason, db)
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid credentials"
                    )
                    
                except HTTPException:
                    raise
                except Exception as e:
                    # Log error but return generic message for security
                    logger.error(f"Authentication error for {email_or_username}: {str(e)}")
                    import traceback
                    logger.error(f"Full traceback:\n{traceback.format_exc()}")
                    await self._handle_failed_login(None, email_or_username, ip_address, 
                                                  user_agent, f"Auth error: {str(e)}", db)
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid credentials"
                    )
        except HTTPException:
            raise
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            logger.error(f"Authentication error for {email_or_username}: {str(e)}")
            logger.error(f"Full traceback:\n{error_traceback}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Authentication service error: {str(e)}"
            )
    
    async def _authenticate_internal_user(self, email_or_username: str, password: str,
                                        ip_address: str, user_agent: str, 
                                        db: Session) -> Dict[str, Any]:
        """Authenticate internal user via Active Directory
        
        Security: Always verifies against AD, even if user exists in database
        This ensures user is still active in AD and prevents stale account access
        Account lockout is checked before AD authentication to prevent unnecessary AD calls
        """
        username = email_or_username.split("@")[0] if "@" in email_or_username else email_or_username
        
        try:
            # Security: Check account lockout before attempting authentication
            # Prevents brute force attacks and reduces unnecessary AD calls
            user = self._get_user_by_email_or_username(email_or_username, db)
            if user and self._is_account_locked(user):
                self._log_login_attempt(user.id, email_or_username, ip_address, 
                                      user_agent, LoginAttemptStatus.BLOCKED, 
                                      "Account locked", db)
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail=f"Account locked until {user.locked_until.isoformat()}"
                )
            
            # Security: Always authenticate against AD to verify user is still active
            # This ensures database user records stay in sync with AD
            try:
                is_authenticated, ad_user_data, error_detail = self.ad_service.authenticate_user(username, password)
            except HTTPException as e:
                # Re-raise HTTP exceptions (like service unavailable)
                raise e
            except Exception as e:
                logger.error(f"AD authentication error for {username}: {str(e)}")
                import traceback
                logger.error(f"AD error traceback:\n{traceback.format_exc()}")
                # If AD service fails, treat as authentication failure for security
                await self._handle_failed_login(user, email_or_username, ip_address, 
                                              user_agent, f"AD service error: {str(e)}", db)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Authentication service temporarily unavailable"
                )
            
            if not is_authenticated or not ad_user_data:
                # AD authentication failed - deny access even if user exists in DB
                # Log detailed error but return generic message for security
                failure_reason = error_detail or "Invalid AD credentials or account inactive"
                logger.warning(f"AD authentication failed for {email_or_username}: {failure_reason}")
                await self._handle_failed_login(user, email_or_username, ip_address, 
                                              user_agent, failure_reason, db)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
            
            # User exists and is active in AD - proceed with sync/update
            if not user:
                # Create new user from AD
                user = await self.ad_service.sync_user_from_ad(username, db)
                if not user:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to sync user from Active Directory"
                    )
            else:
                # Update existing user from AD data
                await self._update_user_from_ad_data(user, ad_user_data, db)
                # Ensure user is active in database (may have been deactivated previously)
                user.active = True
                user.updated_at = datetime.now(timezone.utc)
                db.commit()
            
            # Final check - ensure user is active in database
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
            import traceback
            error_traceback = traceback.format_exc()
            logger.error(f"Internal authentication error for {email_or_username}: {str(e)}")
            logger.error(f"Full traceback:\n{error_traceback}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Authentication service error: {str(e)}"
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
        
        # Security: Check account lockout before password verification
        # Prevents brute force attacks on locked accounts
        if self._is_account_locked(user):
            self._log_login_attempt(user.id, email_or_username, ip_address, 
                                  user_agent, LoginAttemptStatus.BLOCKED, 
                                  "Account locked", db)
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account locked until {user.locked_until.isoformat()}"
            )
        
        # Security: Verify password using bcrypt hash comparison
        # Timing-safe comparison prevents timing attacks
        if not user.password or not self._verify_password(password, user.password):
            await self._handle_failed_login(user, email_or_username, ip_address, 
                                          user_agent, "Invalid password", db)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Business rule: Check if account is active before allowing login
        # Deactivated accounts cannot authenticate even with correct password
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
        
        # Security: Validate password strength before creating account
        # Enforces password complexity requirements
        password = user_data.get('password')
        if not self._is_password_strong(password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=self._get_password_requirements()
            )
        
        # Security: Hash password using bcrypt before storing
        # Never store plaintext passwords
        hashed_password = self._hash_password(password)
        
        # Get default 'user' role
        default_role = db.query(Role).filter(Role.name == "user").first()
        if not default_role:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Default 'user' role not found in database. Please ensure roles are initialized."
            )
        
        # Create user
        new_user = User(
            email=user_data['email'],
            username=user_data.get('username') or user_data['email'],
            password=hashed_password,
            first_name=user_data['first_name'],
            last_name=user_data['last_name'],
            phone_number=user_data.get('phone_number'),
            user_type=UserType.EXTERNAL,
            active=True,
            role_id=default_role.id
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
        
        # Ensure both datetimes are timezone-aware for comparison
        now = datetime.now(timezone.utc)
        locked_until = user.locked_until
        
        # If locked_until is naive, make it aware (assume UTC)
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        
        return now < locked_until
    
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
        now = datetime.now(timezone.utc)
        payload = {
            "sub": user.id,
            "email": user.email,
            "username": user.username,
            "user_type": user.user_type.value,
            "role": user.role.name if user.role else None,
            "role_id": user.role_id if user.role else None,
            "exp": int((now + timedelta(minutes=self.config.ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
            "iat": int(now.timestamp()),
            "iss": "university-lost-found-auth"
        }
        
        return jwt.encode(payload, self.config.SECRET_KEY, algorithm=self.config.JWT_ALGORITHM)
    
    def _generate_refresh_token(self) -> str:
        """Generate secure refresh token"""
        return secrets.token_urlsafe(32)
    
    async def refresh_access_token(self, refresh_token: str, db: Session) -> Dict[str, Any]:
        """Refresh access token using refresh token"""
        now = datetime.now(timezone.utc)
        session = db.query(UserSession).filter(
            and_(
                UserSession.session_token == refresh_token,
                UserSession.is_active == True,
                UserSession.expires_at > now
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
        except (jwt.PyJWTError, jwt.InvalidTokenError, jwt.DecodeError):
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
        # Use SQLAlchemy's func.now() for database-level comparison
        # This ensures the comparison happens in SQL, avoiding timezone issues
        from sqlalchemy import text
        
        # Check attempts by IP - use SQL-level datetime comparison
        ip_attempts = db.query(LoginAttempt).filter(
            and_(
                LoginAttempt.ip_address == ip_address,
                LoginAttempt.created_at > text("NOW() - INTERVAL '1 minute'")
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
                LoginAttempt.created_at > text("NOW() - INTERVAL '1 minute'")
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
        now = datetime.now(timezone.utc)
        # Deactivate expired sessions
        expired_sessions = db.query(UserSession).filter(
            and_(
                UserSession.user_id == user_id,
                UserSession.is_active == True,
                UserSession.expires_at <= now
            )
        ).all()
        
        for session in expired_sessions:
            session.is_active = False
            session.updated_at = now
        
        # Limit active sessions per user
        active_sessions = db.query(UserSession).filter(
            and_(
                UserSession.user_id == user_id,
                UserSession.is_active == True,
                UserSession.expires_at > now
            )
        ).order_by(UserSession.created_at.desc()).all()
        
        if len(active_sessions) > self.config.MAX_SESSIONS_PER_USER:
            sessions_to_deactivate = active_sessions[self.config.MAX_SESSIONS_PER_USER:]
            for session in sessions_to_deactivate:
                session.is_active = False
                session.updated_at = now
        
        db.commit()

    async def request_password_reset(self, email: str, db: Session) -> bool:
        """
        Request password reset for external user. Always returns True to avoid email enumeration.
        If user exists and is external, generates token, stores it, and sends email.
        """
        user = db.query(User).filter(User.email == email).first()
        if not user:
            logger.info(f"Password reset requested for non-existent user: {email}")
            return True  # Keep silent for non-existent (avoid enumeration)
        if user.user_type != UserType.EXTERNAL:
            logger.info(f"Password reset requested for internal user: {email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Internal users must reset their password through the organization's website or portal. This form is for external users only."
            )

        # Rate limit: max 3 reset requests per hour per user
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_requests = db.query(PasswordResetToken).filter(
            and_(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.created_at > one_hour_ago
            )
        ).count()
        if recent_requests >= 3:
            logger.warning(f"Password reset rate limit exceeded for {email}")
            return True

        if not user.password:
            logger.info(f"Password reset requested for external user without password: {email}")
            return True

        # Invalidate any existing unused tokens for this user
        db.query(PasswordResetToken).filter(
            and_(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used == False,
                PasswordResetToken.expires_at > datetime.now(timezone.utc)
            )
        ).update({"used": True})

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=self.config.PASSWORD_RESET_TOKEN_EXPIRE_HOURS)

        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=expires_at,
            used=False
        )
        db.add(reset_token)
        db.commit()

        frontend_base = self.config.FRONTEND_BASE_URL.rstrip("/")
        reset_link = f"{frontend_base}/en/auth/reset-password?token={token}"

        try:
            from app.services.notification_service import send_password_reset_email
            user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email
            await send_password_reset_email(user.email, user_name, reset_link)
            logger.info(f"Password reset email sent to {user.email}")
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
            db.rollback()
            raise

        return True

    def confirm_password_reset(self, token: str, new_password: str, db: Session) -> bool:
        """
        Confirm password reset with token. Validates token, updates password, marks token used.
        """
        now = datetime.now(timezone.utc)
        reset_record = db.query(PasswordResetToken).filter(
            and_(
                PasswordResetToken.token == token,
                PasswordResetToken.used == False,
                PasswordResetToken.expires_at > now
            )
        ).first()

        if not reset_record:
            return False

        user = db.query(User).filter(User.id == reset_record.user_id).first()
        if not user or user.user_type != UserType.EXTERNAL:
            return False

        if not self._is_password_strong(new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=self._get_password_requirements()
            )

        user.password = self._hash_password(new_password)
        user.updated_at = now
        reset_record.used = True
        db.commit()

        logger.info(f"Password reset completed for user {user.email}")
        return True

    async def _update_user_from_ad_data(self, user: User, ad_data: Dict[str, Any], db: Session):
        """Update user information from AD data"""
        user.first_name = ad_data.get('first_name') or user.first_name
        user.last_name = ad_data.get('last_name') or user.last_name
        user.email = ad_data.get('email') or user.email
        user.phone_number = ad_data.get('phone_number') or user.phone_number
        user.ad_sync_date = datetime.now(timezone.utc)
        user.updated_at = datetime.now(timezone.utc)
        
        # Ensure user has a role (assign default 'user' role if missing)
        if not user.role_id:
            default_role = db.query(Role).filter(Role.name == "user").first()
            if default_role:
                user.role_id = default_role.id
                logger.info(f"Assigned default 'user' role to user: {user.email}")
            else:
                logger.warning(f"Default 'user' role not found - user {user.email} will not have a role")
        
        db.commit()