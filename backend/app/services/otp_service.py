"""
OTP Service for Email Verification

Handles generation, storage, verification, and cleanup of OTP codes for email verification.
"""
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models import EmailVerification

logger = logging.getLogger(__name__)


class OTPService:
    """Service for managing OTP codes for email verification"""
    
    # OTP configuration
    OTP_LENGTH = 6
    OTP_EXPIRY_MINUTES = 10
    MAX_OTP_REQUESTS_PER_HOUR = 3
    
    def __init__(self):
        pass
    
    def generate_otp(self) -> str:
        """
        Generate a secure 6-digit numeric OTP code
        
        Returns:
            str: 6-digit OTP code
        """
        # Generate random number between 100000 and 999999
        otp = secrets.randbelow(900000) + 100000
        return str(otp)
    
    def store_otp(self, email: str, db: Session) -> Tuple[str, datetime]:
        """
        Generate and store OTP for email verification
        
        Args:
            email: Email address to verify
            db: Database session
            
        Returns:
            Tuple[str, datetime]: OTP code and expiration datetime
            
        Raises:
            ValueError: If rate limit exceeded
        """
        # Check rate limiting
        self._check_rate_limit(email, db)
        
        # Generate OTP
        otp_code = self.generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=self.OTP_EXPIRY_MINUTES)
        
        # Invalidate any existing unverified OTPs for this email
        db.query(EmailVerification).filter(
            and_(
                EmailVerification.email == email,
                EmailVerification.verified == False,
                EmailVerification.expires_at > datetime.now(timezone.utc)
            )
        ).update({"verified": True})  # Mark as used to invalidate
        
        # Create new OTP record
        verification = EmailVerification(
            email=email,
            otp_code=otp_code,
            expires_at=expires_at,
            verified=False
        )
        
        db.add(verification)
        db.commit()
        db.refresh(verification)
        
        logger.info(f"OTP generated for email: {email}")
        
        return otp_code, expires_at
    
    def verify_otp(self, email: str, otp_code: str, db: Session) -> bool:
        """
        Verify OTP code for email
        
        Args:
            email: Email address
            otp_code: OTP code to verify
            db: Database session
            
        Returns:
            bool: True if OTP is valid and verified, False otherwise
        """
        # Find valid unverified OTP for this email
        verification = db.query(EmailVerification).filter(
            and_(
                EmailVerification.email == email,
                EmailVerification.otp_code == otp_code,
                EmailVerification.verified == False,
                EmailVerification.expires_at > datetime.now(timezone.utc)
            )
        ).order_by(EmailVerification.created_at.desc()).first()
        
        if not verification:
            logger.warning(f"Invalid OTP attempt for email: {email}")
            return False
        
        # Mark as verified
        verification.verified = True
        db.commit()
        
        logger.info(f"OTP verified successfully for email: {email}")
        return True
    
    def is_email_verified(self, email: str, db: Session) -> bool:
        """
        Check if email has a verified OTP (within expiry window)
        
        Args:
            email: Email address to check
            db: Database session
            
        Returns:
            bool: True if email has been verified recently
        """
        # Check for verified OTP within last 30 minutes (generous window for registration)
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=30)
        
        verification = db.query(EmailVerification).filter(
            and_(
                EmailVerification.email == email,
                EmailVerification.verified == True,
                EmailVerification.created_at > cutoff_time
            )
        ).order_by(EmailVerification.created_at.desc()).first()
        
        return verification is not None
    
    def cleanup_expired_otps(self, db: Session) -> int:
        """
        Clean up expired OTP records (older than 24 hours)
        
        Args:
            db: Database session
            
        Returns:
            int: Number of records deleted
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        
        deleted_count = db.query(EmailVerification).filter(
            EmailVerification.expires_at < cutoff_time
        ).delete()
        
        db.commit()
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} expired OTP records")
        
        return deleted_count
    
    def _check_rate_limit(self, email: str, db: Session):
        """
        Check if email has exceeded OTP request rate limit
        
        Args:
            email: Email address
            db: Database session
            
        Raises:
            ValueError: If rate limit exceeded
        """
        # Count OTP requests in the last hour
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        
        request_count = db.query(EmailVerification).filter(
            and_(
                EmailVerification.email == email,
                EmailVerification.created_at > one_hour_ago
            )
        ).count()
        
        if request_count >= self.MAX_OTP_REQUESTS_PER_HOUR:
            logger.warning(f"Rate limit exceeded for email: {email} ({request_count} requests)")
            raise ValueError(
                f"Too many OTP requests. Please try again after some time. "
                f"Maximum {self.MAX_OTP_REQUESTS_PER_HOUR} requests per hour."
            )


# Global OTP service instance
otp_service = OTPService()



