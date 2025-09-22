import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch, AsyncMock
from fastapi import Request, HTTPException
from sqlalchemy.orm import Session

from services.auth_service import AuthService
from models import User, UserType, LoginAttempt, LoginAttemptStatus
from config.auth_config import AuthConfig

class TestAuthService:
    
    @pytest.fixture
    def auth_service(self):
        return AuthService()
    
    @pytest.fixture
    def mock_db(self):
        return Mock(spec=Session)
    
    @pytest.fixture
    def mock_request(self):
        request = Mock(spec=Request)
        request.client = Mock()
        request.client.host = "127.0.0.1"
        request.headers = {"user-agent": "test-agent"}
        return request
    
    @pytest.fixture
    def sample_external_user(self):
        return User(
            id="test-user-id",
            email="test@example.com",
            username="testuser",
            password="$2b$12$hashed_password",  # Mock bcrypt hash
            first_name="Test",
            last_name="User",
            user_type=UserType.EXTERNAL,
            active=True,
            failed_login_attempts=0,
            is_locked=False
        )
    
    @pytest.fixture
    def sample_internal_user(self):
        return User(
            id="test-internal-user-id",
            email="student@squ.edu.om",
            username="student123",
            first_name="Internal",
            last_name="User",
            user_type=UserType.INTERNAL,
            active=True,
            failed_login_attempts=0,
            is_locked=False
        )
    
    def test_detect_user_type_external_email(self, auth_service):
        """Test user type detection for external email"""
        user_type = auth_service._detect_user_type("user@gmail.com")
        assert user_type == UserType.EXTERNAL
    
    def test_detect_user_type_internal_email(self, auth_service):
        """Test user type detection for internal university email"""
        user_type = auth_service._detect_user_type("student@squ.edu.om")
        assert user_type == UserType.INTERNAL
    
    def test_detect_user_type_username(self, auth_service):
        """Test user type detection for username (internal)"""
        user_type = auth_service._detect_user_type("student123")
        assert user_type == UserType.INTERNAL
    
    def test_password_strength_validation(self, auth_service):
        """Test password strength validation"""
        # Valid password
        assert auth_service._is_password_strong("SecureP@ss123") == True
        
        # Too short
        assert auth_service._is_password_strong("Short1!") == False
        
        # No uppercase
        assert auth_service._is_password_strong("lowercase123!") == False
        
        # No lowercase
        assert auth_service._is_password_strong("UPPERCASE123!") == False
        
        # No numbers
        assert auth_service._is_password_strong("NoNumbers!") == False
        
        # No special characters
        assert auth_service._is_password_strong("NoSpecial123") == False
    
    def test_password_hashing_and_verification(self, auth_service):
        """Test password hashing and verification"""
        password = "TestPassword123!"
        hashed = auth_service._hash_password(password)
        
        # Should not be the same as original
        assert hashed != password
        
        # Should verify correctly
        assert auth_service._verify_password(password, hashed) == True
        
        # Wrong password should not verify
        assert auth_service._verify_password("WrongPassword", hashed) == False
    
    def test_is_account_locked(self, auth_service, sample_external_user):
        """Test account lockout detection"""
        # Not locked
        assert auth_service._is_account_locked(sample_external_user) == False
        
        # Locked but expired
        sample_external_user.is_locked = True
        sample_external_user.locked_until = datetime.now(timezone.utc) - timedelta(minutes=1)
        assert auth_service._is_account_locked(sample_external_user) == False
        
        # Currently locked
        sample_external_user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
        assert auth_service._is_account_locked(sample_external_user) == True
    
    @pytest.mark.asyncio
    async def test_create_external_user_success(self, auth_service, mock_db):
        """Test successful external user creation"""
        mock_db.query().filter().first.return_value = None  # No existing user
        mock_db.add = Mock()
        mock_db.commit = Mock()
        mock_db.refresh = Mock()
        
        user_data = {
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "first_name": "New",
            "last_name": "User",
            "username": "newuser"
        }
        
        result = await auth_service.create_external_user(user_data, mock_db)
        
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        assert result.email == user_data["email"]
        assert result.user_type == UserType.EXTERNAL
    
    @pytest.mark.asyncio
    async def test_create_external_user_duplicate_email(self, auth_service, mock_db, sample_external_user):
        """Test external user creation with duplicate email"""
        mock_db.query().filter().first.return_value = sample_external_user
        
        user_data = {
            "email": "test@example.com",  # Same as existing user
            "password": "SecurePassword123!",
            "first_name": "Duplicate",
            "last_name": "User"
        }
        
        with pytest.raises(HTTPException) as exc_info:
            await auth_service.create_external_user(user_data, mock_db)
        
        assert exc_info.value.status_code == 409
        assert "already exists" in exc_info.value.detail
    
    @pytest.mark.asyncio
    async def test_create_external_user_weak_password(self, auth_service, mock_db):
        """Test external user creation with weak password"""
        mock_db.query().filter().first.return_value = None
        
        user_data = {
            "email": "newuser@example.com",
            "password": "weak",  # Too weak
            "first_name": "New",
            "last_name": "User"
        }
        
        with pytest.raises(HTTPException) as exc_info:
            await auth_service.create_external_user(user_data, mock_db)
        
        assert exc_info.value.status_code == 400
        assert "Password must" in exc_info.value.detail
    
    @patch('services.auth_service.AuthService._verify_password')
    @pytest.mark.asyncio
    async def test_authenticate_external_user_success(self, mock_verify, auth_service, 
                                                    mock_db, mock_request, sample_external_user):
        """Test successful external user authentication"""
        mock_verify.return_value = True
        mock_db.query().filter().first.return_value = sample_external_user
        mock_db.add = Mock()
        mock_db.commit = Mock()
        
        with patch.object(auth_service, '_check_rate_limit', new_callable=AsyncMock):
            with patch.object(auth_service, '_generate_auth_response', new_callable=AsyncMock) as mock_generate:
                mock_generate.return_value = {"access_token": "test_token"}
                
                result = await auth_service.authenticate_user(
                    "test@example.com", "correct_password", mock_request, mock_db
                )
                
                assert result == {"access_token": "test_token"}
                mock_verify.assert_called_once()
    
    @patch('services.auth_service.AuthService._verify_password')
    @pytest.mark.asyncio
    async def test_authenticate_external_user_wrong_password(self, mock_verify, auth_service,
                                                           mock_db, mock_request, sample_external_user):
        """Test external user authentication with wrong password"""
        mock_verify.return_value = False
        mock_db.query().filter().first.return_value = sample_external_user
        mock_db.add = Mock()
        mock_db.commit = Mock()
        
        with patch.object(auth_service, '_check_rate_limit', new_callable=AsyncMock):
            with patch.object(auth_service, '_handle_failed_login', new_callable=AsyncMock):
                with pytest.raises(HTTPException) as exc_info:
                    await auth_service.authenticate_user(
                        "test@example.com", "wrong_password", mock_request, mock_db
                    )
                
                assert exc_info.value.status_code == 401
    
    @pytest.mark.asyncio
    async def test_authenticate_locked_account(self, auth_service, mock_db, 
                                             mock_request, sample_external_user):
        """Test authentication attempt on locked account"""
        sample_external_user.is_locked = True
        sample_external_user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
        
        mock_db.query().filter().first.return_value = sample_external_user
        mock_db.add = Mock()
        mock_db.commit = Mock()
        
        with patch.object(auth_service, '_check_rate_limit', new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc_info:
                await auth_service.authenticate_user(
                    "test@example.com", "password", mock_request, mock_db
                )
            
            assert exc_info.value.status_code == 423
            assert "locked" in exc_info.value.detail
    
    @patch('services.auth_service.AuthService.ad_service')
    @pytest.mark.asyncio
    async def test_authenticate_internal_user_success(self, mock_ad_service, auth_service,
                                                     mock_db, mock_request, sample_internal_user):
        """Test successful internal user authentication via AD"""
        mock_ad_service.authenticate_user.return_value = (True, {
            "username": "student123",
            "email": "student@squ.edu.om",
            "first_name": "Internal",
            "last_name": "User"
        })
        mock_ad_service.sync_user_from_ad.return_value = sample_internal_user
        
        mock_db.query().filter().first.return_value = sample_internal_user
        mock_db.add = Mock()
        mock_db.commit = Mock()
        
        with patch.object(auth_service, '_check_rate_limit', new_callable=AsyncMock):
            with patch.object(auth_service, '_generate_auth_response', new_callable=AsyncMock) as mock_generate:
                mock_generate.return_value = {"access_token": "test_token"}
                
                result = await auth_service.authenticate_user(
                    "student@squ.edu.om", "ad_password", mock_request, mock_db
                )
                
                assert result == {"access_token": "test_token"}
    
    @patch('services.auth_service.AuthService.ad_service')
    @pytest.mark.asyncio
    async def test_authenticate_internal_user_ad_failure(self, mock_ad_service, auth_service,
                                                        mock_db, mock_request, sample_internal_user):
        """Test internal user authentication with AD failure"""
        mock_ad_service.authenticate_user.return_value = (False, None)
        mock_db.query().filter().first.return_value = sample_internal_user
        mock_db.add = Mock()
        mock_db.commit = Mock()
        
        with patch.object(auth_service, '_check_rate_limit', new_callable=AsyncMock):
            with patch.object(auth_service, '_handle_failed_login', new_callable=AsyncMock):
                with pytest.raises(HTTPException) as exc_info:
                    await auth_service.authenticate_user(
                        "student@squ.edu.om", "wrong_password", mock_request, mock_db
                    )
                
                assert exc_info.value.status_code == 401
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self, auth_service, mock_db):
        """Test rate limiting functionality"""
        # Mock recent login attempts
        mock_db.query().filter().count.return_value = 10  # Exceeds limit
        
        with pytest.raises(HTTPException) as exc_info:
            await auth_service._check_rate_limit("test@example.com", "127.0.0.1", mock_db)
        
        assert exc_info.value.status_code == 429
        assert "Too many" in exc_info.value.detail
    
    def test_create_access_token(self, auth_service, sample_external_user):
        """Test JWT access token creation"""
        token = auth_service._create_access_token(sample_external_user)
        
        assert isinstance(token, str)
        assert len(token) > 50  # JWT tokens are typically long
    
    @pytest.mark.asyncio
    async def test_verify_token_valid(self, auth_service, mock_db, sample_external_user):
        """Test token verification with valid token"""
        # Create a real token
        token = auth_service._create_access_token(sample_external_user)
        mock_db.query().filter().first.return_value = sample_external_user
        
        result = await auth_service.verify_token(token, mock_db)
        
        assert result.id == sample_external_user.id
        assert result.email == sample_external_user.email
    
    @pytest.mark.asyncio
    async def test_verify_token_invalid(self, auth_service, mock_db):
        """Test token verification with invalid token"""
        with pytest.raises(HTTPException) as exc_info:
            await auth_service.verify_token("invalid.token.here", mock_db)
        
        assert exc_info.value.status_code == 401
        assert "Invalid token" in exc_info.value.detail
    
    def test_get_client_ip_direct(self, auth_service):
        """Test IP extraction from direct connection"""
        request = Mock()
        request.headers = {}
        request.client = Mock()
        request.client.host = "192.168.1.100"
        
        ip = auth_service._get_client_ip(request)
        assert ip == "192.168.1.100"
    
    def test_get_client_ip_forwarded(self, auth_service):
        """Test IP extraction from X-Forwarded-For header"""
        request = Mock()
        request.headers = {"X-Forwarded-For": "203.0.113.1, 198.51.100.17"}
        request.client = Mock()
        request.client.host = "192.168.1.100"
        
        ip = auth_service._get_client_ip(request)
        assert ip == "203.0.113.1"
    
    @pytest.mark.asyncio
    async def test_handle_failed_login_increments_counter(self, auth_service, mock_db, sample_external_user):
        """Test that failed login increments failure counter"""
        initial_attempts = sample_external_user.failed_login_attempts
        mock_db.add = Mock()
        mock_db.commit = Mock()
        
        await auth_service._handle_failed_login(
            sample_external_user, "test@example.com", "127.0.0.1", 
            "test-agent", "Invalid password", mock_db
        )
        
        assert sample_external_user.failed_login_attempts == initial_attempts + 1
        mock_db.commit.assert_called()
    
    @pytest.mark.asyncio
    async def test_handle_failed_login_applies_lockout(self, auth_service, mock_db, sample_external_user):
        """Test that lockout is applied after max attempts"""
        sample_external_user.failed_login_attempts = AuthConfig.MAX_LOGIN_ATTEMPTS - 1
        mock_db.add = Mock()
        mock_db.commit = Mock()
        
        await auth_service._handle_failed_login(
            sample_external_user, "test@example.com", "127.0.0.1",
            "test-agent", "Invalid password", mock_db
        )
        
        assert sample_external_user.is_locked == True
        assert sample_external_user.locked_until is not None
        assert sample_external_user.locked_until > datetime.now(timezone.utc)
    
    @pytest.mark.asyncio
    async def test_handle_successful_login_resets_counters(self, auth_service, mock_db, sample_external_user):
        """Test that successful login resets failure counters"""
        sample_external_user.failed_login_attempts = 3
        sample_external_user.is_locked = True
        sample_external_user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
        
        mock_db.add = Mock()
        mock_db.commit = Mock()
        
        with patch.object(auth_service, '_cleanup_old_sessions', new_callable=AsyncMock):
            await auth_service._handle_successful_login(
                sample_external_user, "127.0.0.1", "test-agent", mock_db
            )
        
        assert sample_external_user.failed_login_attempts == 0
        assert sample_external_user.is_locked == False
        assert sample_external_user.locked_until is None
        assert sample_external_user.last_login is not None