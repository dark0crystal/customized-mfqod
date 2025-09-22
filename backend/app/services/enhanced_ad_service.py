import ldap
import ssl
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
from ldap import LDAPError
from sqlalchemy.orm import Session
from config.auth_config import ADConfig
from models import User, UserType, ADSyncLog
from db.database import get_db
from fastapi import HTTPException, status
import asyncio
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json

logger = logging.getLogger(__name__)

class EnhancedADService:
    def __init__(self):
        self.config = ADConfig()
        self.executor = ThreadPoolExecutor(max_workers=5)
    
    def _get_ldap_connection(self) -> ldap.ldapobject.LDAPObject:
        """Create and return LDAP connection with enhanced error handling"""
        try:
            protocol = "ldaps" if self.config.USE_SSL else "ldap"
            ldap_uri = f"{protocol}://{self.config.SERVER}:{self.config.PORT}"
            
            conn = ldap.initialize(ldap_uri)
            
            # Enhanced connection options
            conn.set_option(ldap.OPT_REFERRALS, 0)
            conn.set_option(ldap.OPT_PROTOCOL_VERSION, 3)
            conn.set_option(ldap.OPT_TIMEOUT, self.config.CONNECTION_TIMEOUT)
            conn.set_option(ldap.OPT_NETWORK_TIMEOUT, self.config.CONNECTION_TIMEOUT)
            
            if self.config.USE_SSL:
                conn.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_DEMAND)
                conn.set_option(ldap.OPT_X_TLS_NEWCTX, 0)
            
            return conn
            
        except Exception as e:
            logger.error(f"Failed to create LDAP connection: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Active Directory service unavailable"
            )
    
    def authenticate_user(self, username: str, password: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Authenticate user against Active Directory with enhanced verification
        Returns: (is_authenticated, user_data)
        """
        conn = None
        try:
            conn = self._get_ldap_connection()
            
            # Bind with service account
            conn.simple_bind_s(self.config.BIND_USER, self.config.BIND_PASSWORD)
            
            # Search for user
            search_filter = self.config.USER_SEARCH_FILTER.format(username=username)
            result = conn.search_s(
                self.config.USER_DN,
                ldap.SCOPE_SUBTREE,
                search_filter,
                self.config.USER_ATTRIBUTES,
                timeout=self.config.SEARCH_TIMEOUT
            )
            
            if not result:
                logger.warning(f"User {username} not found in AD")
                return False, None
            
            user_dn, user_attrs = result[0]
            
            # Check if account is active and not expired
            if not self._is_account_active(user_attrs):
                logger.warning(f"User {username} account is disabled or expired")
                return False, None
            
            # Try to authenticate with user credentials
            try:
                user_conn = self._get_ldap_connection()
                user_conn.simple_bind_s(user_dn, password)
                user_conn.unbind_s()
            except ldap.INVALID_CREDENTIALS:
                logger.warning(f"Invalid credentials for user {username}")
                return False, None
            except Exception as e:
                logger.error(f"Authentication error for user {username}: {str(e)}")
                return False, None
            
            # Process user attributes
            user_data = self._process_user_attributes(user_attrs)
            user_data['dn'] = user_dn
            
            logger.info(f"User {username} authenticated successfully via AD")
            return True, user_data
            
        except LDAPError as e:
            logger.error(f"LDAP error during authentication: {str(e)}")
            return False, None
        except Exception as e:
            logger.error(f"Unexpected error during AD authentication: {str(e)}")
            return False, None
        finally:
            if conn:
                try:
                    conn.unbind_s()
                except:
                    pass
    
    def _is_account_active(self, attrs: Dict) -> bool:
        """Check if AD account is active and not expired"""
        try:
            # Check userAccountControl flag
            uac_values = attrs.get('userAccountControl', [])
            if uac_values:
                uac = int(uac_values[0].decode('utf-8') if isinstance(uac_values[0], bytes) else uac_values[0])
                # Check if account is disabled (flag 0x2)
                if uac & 0x2:
                    return False
            
            # Check account expiration
            if self.config.CHECK_ACCOUNT_STATUS:
                expires_values = attrs.get('accountExpires', [])
                if expires_values:
                    expires_raw = expires_values[0]
                    if isinstance(expires_raw, bytes):
                        expires_raw = expires_raw.decode('utf-8')
                    
                    expires_timestamp = int(expires_raw)
                    # 0 or 9223372036854775807 means never expires
                    if expires_timestamp not in (0, 9223372036854775807):
                        # Convert from Windows FILETIME to Unix timestamp
                        expires_unix = (expires_timestamp - 116444736000000000) / 10000000
                        expires_date = datetime.fromtimestamp(expires_unix, tz=timezone.utc)
                        
                        if expires_date < datetime.now(timezone.utc):
                            return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking account status: {str(e)}")
            return False
    
    def _process_user_attributes(self, attrs: Dict) -> Dict[str, Any]:
        """Process LDAP attributes with enhanced mapping"""
        def get_attr_value(attr_name: str) -> Optional[str]:
            values = attrs.get(attr_name, [])
            if values:
                if isinstance(values[0], bytes):
                    return values[0].decode('utf-8')
                return str(values[0])
            return None
        
        def get_attr_list(attr_name: str) -> List[str]:
            values = attrs.get(attr_name, [])
            result = []
            for value in values:
                if isinstance(value, bytes):
                    result.append(value.decode('utf-8'))
                else:
                    result.append(str(value))
            return result
        
        # Extract groups and roles
        member_of = get_attr_list('memberOf')
        groups = []
        roles = []
        
        for group_dn in member_of:
            if group_dn.startswith('CN='):
                group_name = group_dn.split(',')[0][3:]  # Remove "CN="
                groups.append(group_name)
                
                # Map to application roles
                if group_name in self.config.ROLE_MAPPING:
                    role = self.config.ROLE_MAPPING[group_name]
                    if role not in roles:
                        roles.append(role)
        
        # If no roles found, assign default
        if not roles:
            roles.append(self.config.DEFAULT_INTERNAL_ROLE)
        
        return {
            'username': get_attr_value('sAMAccountName'),
            'email': get_attr_value('mail') or get_attr_value('userPrincipalName'),
            'display_name': get_attr_value('displayName'),
            'first_name': get_attr_value('givenName'),
            'last_name': get_attr_value('sn'),
            'employee_id': get_attr_value('employeeID'),
            'department': get_attr_value('department'),
            'groups': groups,
            'roles': roles,
            'user_type': UserType.INTERNAL.value,
            'last_logon': self._parse_ad_timestamp(get_attr_value('lastLogon')),
            'account_control': get_attr_value('userAccountControl')
        }
    
    def _parse_ad_timestamp(self, timestamp_str: Optional[str]) -> Optional[datetime]:
        """Parse AD timestamp to Python datetime"""
        if not timestamp_str or timestamp_str in ('0', '9223372036854775807'):
            return None
        try:
            timestamp = int(timestamp_str)
            if timestamp == 0:
                return None
            # Convert from Windows FILETIME to Unix timestamp
            unix_timestamp = (timestamp - 116444736000000000) / 10000000
            return datetime.fromtimestamp(unix_timestamp, tz=timezone.utc)
        except (ValueError, OSError):
            return None
    
    async def sync_user_from_ad(self, username: str, db: Session) -> Optional[User]:
        """Sync a specific user from AD to local database"""
        try:
            # Run AD lookup in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            user_data = await loop.run_in_executor(
                self.executor, 
                self._get_ad_user_data, 
                username
            )
            
            if not user_data:
                return None
            
            # Check if user exists in local database
            existing_user = db.query(User).filter(
                (User.username == user_data['username']) | 
                (User.email == user_data['email'])
            ).first()
            
            if existing_user:
                # Update existing user
                existing_user.first_name = user_data['first_name'] or existing_user.first_name
                existing_user.last_name = user_data['last_name'] or existing_user.last_name
                existing_user.email = user_data['email'] or existing_user.email
                existing_user.username = user_data['username'] or existing_user.username
                existing_user.user_type = UserType.INTERNAL
                existing_user.ad_sync_date = datetime.now(timezone.utc)
                existing_user.active = True
                existing_user.updated_at = datetime.now(timezone.utc)
                
                db.commit()
                db.refresh(existing_user)
                return existing_user
            else:
                # Create new user
                new_user = User(
                    username=user_data['username'],
                    email=user_data['email'],
                    first_name=user_data['first_name'] or '',
                    last_name=user_data['last_name'] or '',
                    user_type=UserType.INTERNAL,
                    ad_dn=user_data.get('dn'),
                    ad_sync_date=datetime.now(timezone.utc),
                    active=True,
                    password=None  # No local password for AD users
                )
                
                db.add(new_user)
                db.commit()
                db.refresh(new_user)
                return new_user
                
        except Exception as e:
            logger.error(f"Error syncing user {username} from AD: {str(e)}")
            db.rollback()
            return None
    
    def _get_ad_user_data(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user data from AD (blocking operation)"""
        conn = None
        try:
            conn = self._get_ldap_connection()
            conn.simple_bind_s(self.config.BIND_USER, self.config.BIND_PASSWORD)
            
            search_filter = self.config.USER_SEARCH_FILTER.format(username=username)
            result = conn.search_s(
                self.config.USER_DN,
                ldap.SCOPE_SUBTREE,
                search_filter,
                self.config.USER_ATTRIBUTES,
                timeout=self.config.SEARCH_TIMEOUT
            )
            
            if not result:
                return None
            
            user_dn, user_attrs = result[0]
            
            if not self._is_account_active(user_attrs):
                return None
            
            user_data = self._process_user_attributes(user_attrs)
            user_data['dn'] = user_dn
            
            return user_data
            
        except Exception as e:
            logger.error(f"Error getting AD user data for {username}: {str(e)}")
            return None
        finally:
            if conn:
                try:
                    conn.unbind_s()
                except:
                    pass
    
    async def bulk_sync_users(self, db: Session) -> Dict[str, int]:
        """Perform bulk sync of users from AD"""
        sync_log = ADSyncLog(
            sync_type='user_sync',
            status='running',
            started_at=datetime.now(timezone.utc)
        )
        db.add(sync_log)
        db.commit()
        
        stats = {
            'processed': 0,
            'updated': 0,
            'created': 0,
            'deactivated': 0,
            'errors': 0
        }
        
        try:
            # Get all users from AD
            loop = asyncio.get_event_loop()
            ad_users = await loop.run_in_executor(
                self.executor,
                self._get_all_ad_users
            )
            
            if not ad_users:
                sync_log.status = 'failed'
                sync_log.message = 'Failed to retrieve users from AD'
                sync_log.completed_at = datetime.now(timezone.utc)
                db.commit()
                return stats
            
            # Process users in batches
            batch_size = self.config.SYNC_BATCH_SIZE
            for i in range(0, len(ad_users), batch_size):
                batch = ad_users[i:i + batch_size]
                
                for user_data in batch:
                    try:
                        stats['processed'] += 1
                        
                        # Check if user exists
                        existing_user = db.query(User).filter(
                            (User.username == user_data['username']) |
                            (User.email == user_data['email'])
                        ).first()
                        
                        if existing_user:
                            # Update existing user
                            self._update_user_from_ad(existing_user, user_data)
                            stats['updated'] += 1
                        else:
                            # Create new user
                            self._create_user_from_ad(user_data, db)
                            stats['created'] += 1
                            
                    except Exception as e:
                        logger.error(f"Error processing user {user_data.get('username', 'unknown')}: {str(e)}")
                        stats['errors'] += 1
                
                db.commit()
            
            # Deactivate users no longer in AD
            if self.config.DEACTIVATE_EXPIRED_ACCOUNTS:
                stats['deactivated'] = await self._deactivate_missing_users(db, ad_users)
            
            # Update sync log
            sync_log.status = 'success' if stats['errors'] == 0 else 'partial'
            sync_log.users_processed = stats['processed']
            sync_log.users_updated = stats['updated'] + stats['created']
            sync_log.users_deactivated = stats['deactivated']
            sync_log.completed_at = datetime.now(timezone.utc)
            sync_log.message = f"Processed {stats['processed']} users with {stats['errors']} errors"
            
            db.commit()
            
            logger.info(f"AD sync completed: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"Bulk sync failed: {str(e)}")
            sync_log.status = 'failed'
            sync_log.error_details = str(e)
            sync_log.completed_at = datetime.now(timezone.utc)
            db.commit()
            raise
    
    def _get_all_ad_users(self) -> List[Dict[str, Any]]:
        """Get all active users from AD (blocking operation)"""
        conn = None
        try:
            conn = self._get_ldap_connection()
            conn.simple_bind_s(self.config.BIND_USER, self.config.BIND_PASSWORD)
            
            # Search for all active user accounts
            search_filter = "(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
            result = conn.search_s(
                self.config.USER_DN,
                ldap.SCOPE_SUBTREE,
                search_filter,
                self.config.USER_ATTRIBUTES,
                timeout=self.config.SEARCH_TIMEOUT
            )
            
            users = []
            for user_dn, user_attrs in result:
                if user_attrs and self._is_account_active(user_attrs):
                    user_data = self._process_user_attributes(user_attrs)
                    user_data['dn'] = user_dn
                    users.append(user_data)
            
            logger.info(f"Retrieved {len(users)} active users from AD")
            return users
            
        except Exception as e:
            logger.error(f"Error getting all AD users: {str(e)}")
            return []
        finally:
            if conn:
                try:
                    conn.unbind_s()
                except:
                    pass
    
    def _update_user_from_ad(self, user: User, ad_data: Dict[str, Any]):
        """Update existing user with AD data"""
        user.first_name = ad_data.get('first_name') or user.first_name
        user.last_name = ad_data.get('last_name') or user.last_name
        user.email = ad_data.get('email') or user.email
        user.username = ad_data.get('username') or user.username
        user.user_type = UserType.INTERNAL
        user.ad_dn = ad_data.get('dn')
        user.ad_sync_date = datetime.now(timezone.utc)
        user.active = True
        user.updated_at = datetime.now(timezone.utc)
    
    def _create_user_from_ad(self, ad_data: Dict[str, Any], db: Session):
        """Create new user from AD data"""
        new_user = User(
            username=ad_data.get('username'),
            email=ad_data.get('email'),
            first_name=ad_data.get('first_name') or '',
            last_name=ad_data.get('last_name') or '',
            user_type=UserType.INTERNAL,
            ad_dn=ad_data.get('dn'),
            ad_sync_date=datetime.now(timezone.utc),
            active=True,
            password=None
        )
        db.add(new_user)
    
    async def _deactivate_missing_users(self, db: Session, ad_users: List[Dict[str, Any]]) -> int:
        """Deactivate users that are no longer in AD"""
        ad_usernames = {user['username'] for user in ad_users if user.get('username')}
        ad_emails = {user['email'] for user in ad_users if user.get('email')}
        
        internal_users = db.query(User).filter(
            User.user_type == UserType.INTERNAL,
            User.active == True
        ).all()
        
        deactivated_count = 0
        for user in internal_users:
            if (user.username not in ad_usernames and 
                user.email not in ad_emails):
                user.active = False
                user.updated_at = datetime.now(timezone.utc)
                deactivated_count += 1
        
        db.commit()
        return deactivated_count
    
    async def health_check(self) -> Dict[str, Any]:
        """Check AD service health"""
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._perform_health_check
            )
            return result
        except Exception as e:
            logger.error(f"AD health check failed: {str(e)}")
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
    
    def _perform_health_check(self) -> Dict[str, Any]:
        """Perform AD health check (blocking operation)"""
        conn = None
        try:
            start_time = datetime.now(timezone.utc)
            conn = self._get_ldap_connection()
            
            # Test connection and binding
            conn.simple_bind_s(self.config.BIND_USER, self.config.BIND_PASSWORD)
            
            # Test search capability
            result = conn.search_s(
                self.config.USER_DN,
                ldap.SCOPE_BASE,
                "(objectClass=*)",
                ["dn"],
                timeout=10
            )
            
            end_time = datetime.now(timezone.utc)
            response_time = (end_time - start_time).total_seconds()
            
            return {
                'status': 'healthy',
                'response_time_seconds': response_time,
                'server': self.config.SERVER,
                'port': self.config.PORT,
                'ssl': self.config.USE_SSL,
                'timestamp': end_time.isoformat()
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'server': self.config.SERVER,
                'port': self.config.PORT,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
        finally:
            if conn:
                try:
                    conn.unbind_s()
                except:
                    pass