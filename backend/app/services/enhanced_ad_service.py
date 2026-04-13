import ldap
import ldap.filter
import ssl
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
from ldap import LDAPError
from sqlalchemy.orm import Session
from app.config.auth_config import ADConfig
from app.models import User, UserType, ADSyncLog, Role
from app.db.database import get_session
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
    
    def _apply_ldap_tls_cert_policy(self, conn: ldap.ldapobject.LDAPObject) -> None:
        """Match AD_VERIFY_SSL: demand server cert vs allow mis-matched / self-signed (testing only)."""
        if self.config.VERIFY_SSL:
            conn.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_DEMAND)
        else:
            conn.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_NEVER)
        conn.set_option(ldap.OPT_X_TLS_NEWCTX, 0)

    def _get_ldap_connection(self) -> ldap.ldapobject.LDAPObject:
        """Create and return LDAP connection with enhanced error handling"""
        try:
            if self.config.USE_SSL and self.config.USE_TLS:
                logger.warning("AD_USE_SSL and AD_USE_TLS are both true; using LDAPS only")

            protocol = "ldaps" if self.config.USE_SSL else "ldap"
            ldap_uri = f"{protocol}://{self.config.SERVER}:{self.config.PORT}"

            conn = ldap.initialize(ldap_uri)

            conn.set_option(ldap.OPT_REFERRALS, 0)
            conn.set_option(ldap.OPT_PROTOCOL_VERSION, 3)
            conn.set_option(ldap.OPT_TIMEOUT, self.config.CONNECTION_TIMEOUT)
            conn.set_option(ldap.OPT_NETWORK_TIMEOUT, self.config.CONNECTION_TIMEOUT)

            if self.config.USE_SSL:
                self._apply_ldap_tls_cert_policy(conn)
            elif self.config.USE_TLS:
                self._apply_ldap_tls_cert_policy(conn)
                conn.start_tls_s()

            return conn

        except Exception as e:
            logger.error(f"Failed to create LDAP connection: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Active Directory service unavailable"
            )

    def service_bind_configured(self) -> bool:
        return bool(self.config.BIND_USER and self.config.BIND_PASSWORD)

    def _sam_account_from_login(self, username: str, login_input: Optional[str]) -> str:
        u = (username or "").strip()
        li = (login_input or "").strip()
        if li and "@" in li:
            return li.split("@", 1)[0].strip() or u
        return u

    def _direct_bind_identity_candidates(
        self, username: str, login_input: Optional[str]
    ) -> List[str]:
        """UPN candidates: full login if user@domain, then each template with SAM name."""
        sam = self._sam_account_from_login(username, login_input)
        if not sam or "\x00" in sam:
            raise ValueError("Invalid username")
        li = (login_input or "").strip()
        templates = self.config.USER_BIND_IDENTITY_TEMPLATES
        seen = set()
        out: List[str] = []

        if li and "@" in li:
            if li not in seen:
                seen.add(li)
                out.append(li)

        for tmpl in templates:
            try:
                cand = tmpl.format(username=sam)
            except KeyError as e:
                raise ValueError(
                    "AD_USER_BIND_IDENTITY_TEMPLATE entries may only use the {username} placeholder"
                ) from e
            if cand not in seen:
                seen.add(cand)
                out.append(cand)

        if not out:
            raise ValueError(
                "Set AD_USER_BIND_IDENTITY_TEMPLATE (comma-separated for multiple UPN suffixes) "
                "or sign in with a full UPN/email (user@domain)"
            )
        return out

    def _minimal_ad_user_dict(self, username: str, bind_identity: str) -> Dict[str, Any]:
        email: Optional[str] = None
        if "@" in bind_identity:
            email = bind_identity
        elif self.config.DEFAULT_EMAIL_DOMAIN:
            email = f"{username}@{self.config.DEFAULT_EMAIL_DOMAIN}"
        if not email:
            raise ValueError(
                "Cannot derive user email: use a UPN-style template (e.g. {username}@squ.edu.om) "
                "or set AD_DEFAULT_EMAIL_DOMAIN"
            )
        return {
            "username": username,
            "email": email,
            "display_name": None,
            "first_name": username,
            "last_name": "-",
            "phone_number": None,
            "employee_id": None,
            "department": None,
            "groups": [],
            "user_type": UserType.INTERNAL.value,
            "last_logon": None,
            "account_control": None,
            "dn": bind_identity,
        }

    def _ldap_search_as_bound_user(
        self,
        conn: ldap.ldapobject.LDAPObject,
        sam: str,
        bind_identity: str,
    ) -> Optional[Tuple[str, Dict]]:
        """
        After a successful user bind, read the user's own directory entry (name, mail, etc.).
        Works when AD allows authenticated users to search under the configured base.
        """
        sam_esc = ldap.filter.escape_filter_chars(sam)
        upn_esc = ldap.filter.escape_filter_chars(bind_identity)

        search_filters: List[str] = []
        try:
            search_filters.append(self.config.USER_SEARCH_FILTER.format(username=sam_esc))
        except Exception:
            logger.debug("Could not format AD_USER_SEARCH_FILTER for self-read", exc_info=True)

        search_filters.extend(
            [
                f"(&(objectClass=user)(sAMAccountName={sam_esc}))",
                f"(&(objectClass=user)(userPrincipalName={upn_esc}))",
                f"(&(objectClass=person)(sAMAccountName={sam_esc}))",
                f"(&(objectClass=person)(uid={sam_esc}))",
                f"(&(objectClass=person)(cn={sam_esc}))",
            ]
        )

        seen_f = set()
        unique_filters: List[str] = []
        for sf in search_filters:
            if sf and sf not in seen_f:
                seen_f.add(sf)
                unique_filters.append(sf)

        bases = [self.config.USER_DN, self.config.BASE_DN]
        seen_b = set()
        unique_bases: List[str] = []
        for b in bases:
            if b and b not in seen_b:
                seen_b.add(b)
                unique_bases.append(b)

        attr_list = list(self.config.USER_ATTRIBUTES)

        for base in unique_bases:
            for sf in unique_filters:
                try:
                    result = conn.search_s(
                        base,
                        ldap.SCOPE_SUBTREE,
                        sf,
                        attr_list,
                    )
                    if result:
                        user_dn, user_attrs = result[0]
                        if user_attrs:
                            return user_dn, user_attrs
                except ldap.LDAPError as e:
                    logger.debug(
                        "Self LDAP search skipped base=%s: %s",
                        base,
                        e,
                    )
                    continue
        return None

    def _authenticate_via_direct_bind(
        self,
        username: str,
        password: str,
        login_input: Optional[str] = None,
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        if password is None or password == "":
            return False, None, "Password required"
        try:
            candidates = self._direct_bind_identity_candidates(username, login_input)
        except ValueError as e:
            return False, None, str(e)

        sam = self._sam_account_from_login(username, login_input)
        last_err: Optional[str] = None

        for bind_identity in candidates:
            conn = None
            try:
                conn = self._get_ldap_connection()
                conn.simple_bind_s(bind_identity, password)

                row = self._ldap_search_as_bound_user(conn, sam, bind_identity)
                if row:
                    user_dn, user_attrs = row
                    if not self._is_account_active(user_attrs):
                        logger.warning(
                            "Direct bind OK but account inactive in directory: %s",
                            sam,
                        )
                        return False, None, "Account disabled or expired"

                    user_data = self._process_user_attributes(user_attrs)
                    user_data["dn"] = user_dn
                    if not user_data.get("email") and "@" in bind_identity:
                        user_data["email"] = bind_identity
                    logger.info(
                        "User %s authenticated via direct LDAP bind as %s (profile from LDAP)",
                        sam,
                        bind_identity,
                    )
                else:
                    user_data = self._minimal_ad_user_dict(sam, bind_identity)
                    logger.info(
                        "User %s authenticated via direct LDAP bind as %s (minimal profile; "
                        "directory self-read not allowed or no matching entry)",
                        sam,
                        bind_identity,
                    )

                return True, user_data, None
            except ldap.INVALID_CREDENTIALS:
                last_err = "Invalid credentials"
                logger.debug(
                    "Direct bind failed for %s as %s (invalid credentials; may try next identity)",
                    sam,
                    bind_identity,
                )
            except ldap.SERVER_DOWN:
                err = "LDAP server is down or unreachable"
                logger.error(err)
                return False, None, err
            except LDAPError as e:
                err = f"LDAP error: {str(e)}"
                logger.error("Direct bind LDAP error for %s: %s", sam, err)
                return False, None, err
            except Exception as e:
                err = f"Unexpected error: {str(e)}"
                logger.error("Direct bind error for %s: %s", sam, err)
                return False, None, err
            finally:
                if conn:
                    try:
                        conn.unbind_s()
                    except Exception:
                        pass

        return False, None, last_err or "Invalid credentials"

    def authenticate_user(
        self,
        username: str,
        password: str,
        login_input: Optional[str] = None,
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Authenticate user against Active Directory with enhanced verification
        Returns: (is_authenticated, user_data, error_detail)
        error_detail is None on success, contains diagnostic info on failure
        """
        conn = None
        error_detail = None
        try:
            if self.config.DIRECT_USER_BIND:
                return self._authenticate_via_direct_bind(username, password, login_input)

            # Step 1: Create connection
            try:
                conn = self._get_ldap_connection()
                logger.debug(f"LDAP connection established to {self.config.SERVER}:{self.config.PORT}")
            except Exception as e:
                error_detail = f"Connection failed: {str(e)}"
                logger.error(f"Failed to create LDAP connection: {error_detail}")
                return False, None, error_detail

            if not self.service_bind_configured():
                error_detail = (
                    "AD_BIND_USER and AD_BIND_PASSWORD must be set when AD_DIRECT_USER_BIND=false"
                )
                logger.error(error_detail)
                return False, None, error_detail

            # Step 2: Bind with service account
            try:
                conn.simple_bind_s(self.config.BIND_USER, self.config.BIND_PASSWORD)
                logger.debug(f"Service account bind successful: {self.config.BIND_USER}")
            except ldap.INVALID_CREDENTIALS:
                error_detail = "Service account credentials invalid"
                logger.error(f"Service account bind failed: {error_detail}")
                return False, None, error_detail
            except Exception as e:
                error_detail = f"Service account bind error: {str(e)}"
                logger.error(f"Service account bind failed: {error_detail}")
                return False, None, error_detail
            
            # Step 3: Search for user - try multiple search filters for compatibility
            # Business logic: Supports different LDAP configurations (production AD, test LDAP)
            search_filters = [
                self.config.USER_SEARCH_FILTER.format(username=username),
                f"(&(objectClass=person)(uid={username}))",  # For test LDAP
                f"(&(objectClass=person)(cn={username}))",     # Fallback
            ]
            
            result = None
            used_filter = None
            for search_filter in search_filters:
                try:
                    logger.debug(f"Trying search filter: {search_filter}")
                    result = conn.search_s(
                        self.config.USER_DN,
                        ldap.SCOPE_SUBTREE,
                        search_filter,
                        self.config.USER_ATTRIBUTES
                    )
                    if result:
                        used_filter = search_filter
                        logger.debug(f"User found using filter: {search_filter}")
                        break
                except Exception as e:
                    logger.debug(f"Search filter failed: {search_filter} - {str(e)}")
                    continue
            
            if not result:
                error_detail = f"User '{username}' not found in AD. Tried filters: {', '.join(search_filters)}"
                logger.warning(f"User {username} not found in AD. Search base: {self.config.USER_DN}")
                return False, None, error_detail
            
            user_dn, user_attrs = result[0]
            logger.debug(f"User found: {user_dn}")
            
            # Step 4: Security check - verify account is active and not expired
            # Prevents authentication for disabled or expired accounts
            if not self._is_account_active(user_attrs):
                uac = user_attrs.get('userAccountControl', [])
                uac_str = uac[0].decode('utf-8') if uac and isinstance(uac[0], bytes) else str(uac[0]) if uac else "N/A"
                error_detail = f"Account disabled or expired (userAccountControl: {uac_str})"
                logger.warning(f"User {username} account is disabled or expired. DN: {user_dn}")
                return False, None, error_detail
            
            # Step 5: Security - Authenticate user credentials against AD
            # This is the actual password verification step
            user_conn = None
            try:
                user_conn = self._get_ldap_connection()
                user_conn.simple_bind_s(user_dn, password)
                user_conn.unbind_s()
                logger.debug(f"User credential bind successful for {username}")
            except ldap.INVALID_CREDENTIALS:
                error_detail = "Invalid password provided"
                logger.warning(f"Invalid credentials for user {username} (DN: {user_dn})")
                return False, None, error_detail
            except ldap.SERVER_DOWN:
                error_detail = "LDAP server unavailable during authentication"
                logger.error(f"LDAP server down during user authentication for {username}")
                return False, None, error_detail
            except Exception as e:
                error_detail = f"Authentication bind error: {str(e)}"
                logger.error(f"Authentication error for user {username}: {error_detail}")
                return False, None, error_detail
            finally:
                if user_conn:
                    try:
                        user_conn.unbind_s()
                    except:
                        pass
            
            # Step 6: Process user attributes
            try:
                user_data = self._process_user_attributes(user_attrs)
                user_data['dn'] = user_dn
                logger.info(f"User {username} authenticated successfully via AD")
                return True, user_data, None
            except Exception as e:
                error_detail = f"Error processing user attributes: {str(e)}"
                logger.error(f"Error processing attributes for {username}: {error_detail}")
                return False, None, error_detail
            
        except ldap.SERVER_DOWN:
            error_detail = "LDAP server is down or unreachable"
            logger.error(f"LDAP server down: {error_detail}")
            return False, None, error_detail
        except ldap.INVALID_CREDENTIALS:
            error_detail = "LDAP bind rejected (check service account or user credentials)"
            logger.error("LDAP invalid credentials: %s", error_detail)
            return False, None, error_detail
        except LDAPError as e:
            error_detail = f"LDAP error: {str(e)}"
            logger.error(f"LDAP error during authentication: {error_detail}")
            import traceback
            logger.debug(f"LDAP error traceback:\n{traceback.format_exc()}")
            return False, None, error_detail
        except Exception as e:
            error_detail = f"Unexpected error: {str(e)}"
            logger.error(f"Unexpected error during AD authentication: {error_detail}")
            import traceback
            logger.debug(f"Unexpected error traceback:\n{traceback.format_exc()}")
            return False, None, error_detail
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
        
        # Extract groups (for reference only - roles are managed in database)
        member_of = get_attr_list('memberOf')
        groups = []
        
        for group_dn in member_of:
            if group_dn.startswith('CN='):
                group_name = group_dn.split(',')[0][3:]  # Remove "CN="
                groups.append(group_name)
        
        # Note: Roles are no longer mapped from AD groups
        # Roles will be assigned based on database configuration

        cn = get_attr_value("cn")
        display_name_val = get_attr_value("displayName") or cn
        fn = get_attr_value("givenName")
        ln = get_attr_value("sn")
        if fn is None and ln is None and display_name_val:
            parts = display_name_val.strip().split(None, 1)
            fn = parts[0]
            ln = parts[1] if len(parts) > 1 else "-"
        if fn is None:
            fn = cn or get_attr_value("sAMAccountName") or get_attr_value("uid")
        if ln is None or ln == "":
            ln = "-"

        return {
            'username': get_attr_value('sAMAccountName') or get_attr_value('uid') or get_attr_value('cn'),
            'email': get_attr_value('mail') or get_attr_value('userPrincipalName'),
            'display_name': display_name_val,
            'first_name': fn,
            'last_name': ln,
            'phone_number': (
                get_attr_value('telephoneNumber')
                or get_attr_value('mobile')
                or get_attr_value('homePhone')
                or get_attr_value('ipPhone')
            ),
            'employee_id': get_attr_value('employeeID'),
            'department': get_attr_value('department'),
            'groups': groups,
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
    
    async def sync_user_from_ad(
        self,
        username: str,
        db: Session,
        bind_identity: Optional[str] = None,
    ) -> Optional[User]:
        """Sync a specific user from AD to local database
        
        Business logic: Creates or updates user record from AD data
        Used for automatic user creation on first login
        Runs AD lookup in thread pool to avoid blocking async operations
        """
        try:
            # Run AD lookup in thread pool to avoid blocking async event loop
            loop = asyncio.get_event_loop()
            user_data = await loop.run_in_executor(
                self.executor,
                self._get_ad_user_data,
                username,
            )

            if not user_data and self.config.DIRECT_USER_BIND:
                try:
                    if bind_identity:
                        user_data = self._minimal_ad_user_dict(username, bind_identity)
                    else:
                        cands = self._direct_bind_identity_candidates(username, None)
                        user_data = self._minimal_ad_user_dict(username, cands[0])
                except Exception as e:
                    logger.error(
                        "Could not build minimal AD profile for %s (direct bind): %s",
                        username,
                        str(e),
                    )
                    return None

            if not user_data:
                return None
            
            # Check if user exists in local database
            existing_user = db.query(User).filter(
                (User.username == user_data['username']) | 
                (User.email == user_data['email'])
            ).first()
            
            # Get default 'user' role
            default_role = db.query(Role).filter(Role.name == "user").first()
            if not default_role:
                logger.error("Default 'user' role not found in database")
                raise Exception("Default 'user' role not found in database. Please ensure roles are initialized.")
            
            if existing_user:
                # Update existing user
                existing_user.first_name = user_data['first_name'] or existing_user.first_name
                existing_user.last_name = user_data['last_name'] or existing_user.last_name
                existing_user.email = user_data['email'] or existing_user.email
                existing_user.username = user_data['username'] or existing_user.username
                existing_user.phone_number = user_data.get('phone_number') or existing_user.phone_number
                existing_user.user_type = UserType.INTERNAL
                existing_user.ad_sync_date = datetime.now(timezone.utc)
                existing_user.active = True
                existing_user.updated_at = datetime.now(timezone.utc)
                
                # Ensure user has a role (assign default if missing)
                if not existing_user.role_id:
                    existing_user.role_id = default_role.id
                    logger.info(f"Assigned default 'user' role to existing user: {existing_user.email}")
                
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
                    phone_number=user_data.get('phone_number'),
                    user_type=UserType.INTERNAL,
                    ad_dn=user_data.get('dn'),
                    ad_sync_date=datetime.now(timezone.utc),
                    active=True,
                    password=None,  # No local password for AD users
                    role_id=default_role.id  # Assign default 'user' role
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
            if not self.service_bind_configured():
                logger.warning("AD user lookup skipped: service bind credentials not configured")
                return None
            conn = self._get_ldap_connection()
            conn.simple_bind_s(self.config.BIND_USER, self.config.BIND_PASSWORD)
            
            search_filter = self.config.USER_SEARCH_FILTER.format(username=username)
            result = conn.search_s(
                self.config.USER_DN,
                ldap.SCOPE_SUBTREE,
                search_filter,
                self.config.USER_ATTRIBUTES
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
                            self._update_user_from_ad(existing_user, user_data, db)
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
            if not self.service_bind_configured():
                logger.warning("AD bulk sync skipped: service bind credentials not configured")
                return []
            conn = self._get_ldap_connection()
            conn.simple_bind_s(self.config.BIND_USER, self.config.BIND_PASSWORD)
            
            # Search for all active user accounts
            search_filter = "(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
            result = conn.search_s(
                self.config.USER_DN,
                ldap.SCOPE_SUBTREE,
                search_filter,
                self.config.USER_ATTRIBUTES
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
    
    def _update_user_from_ad(self, user: User, ad_data: Dict[str, Any], db: Session):
        """Update existing user with AD data"""
        user.first_name = ad_data.get('first_name') or user.first_name
        user.last_name = ad_data.get('last_name') or user.last_name
        user.email = ad_data.get('email') or user.email
        user.username = ad_data.get('username') or user.username
        user.phone_number = ad_data.get('phone_number') or user.phone_number
        user.user_type = UserType.INTERNAL
        user.ad_dn = ad_data.get('dn')
        user.ad_sync_date = datetime.now(timezone.utc)
        user.active = True
        user.updated_at = datetime.now(timezone.utc)
        
        # Ensure user has a role (assign default 'user' role if missing)
        if not user.role_id:
            default_role = db.query(Role).filter(Role.name == "user").first()
            if default_role:
                user.role_id = default_role.id
                logger.info(f"Assigned default 'user' role to user: {user.email}")
            else:
                logger.warning(f"Default 'user' role not found - user {user.email} will not have a role")
    
    def _create_user_from_ad(self, ad_data: Dict[str, Any], db: Session):
        """Create new user from AD data"""
        # Get default 'user' role
        default_role = db.query(Role).filter(Role.name == "user").first()
        if not default_role:
            logger.error("Default 'user' role not found in database")
            raise Exception("Default 'user' role not found in database. Please ensure roles are initialized.")
        
        new_user = User(
            username=ad_data.get('username'),
            email=ad_data.get('email'),
            first_name=ad_data.get('first_name') or '',
            last_name=ad_data.get('last_name') or '',
            phone_number=ad_data.get('phone_number'),
            user_type=UserType.INTERNAL,
            ad_dn=ad_data.get('dn'),
            ad_sync_date=datetime.now(timezone.utc),
            active=True,
            password=None,
            role_id=default_role.id  # Assign default 'user' role
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

            if not self.service_bind_configured():
                try:
                    conn.simple_bind_s("", "")
                except ldap.SERVER_DOWN as e:
                    return {
                        "status": "unhealthy",
                        "error": str(e),
                        "server": self.config.SERVER,
                        "port": self.config.PORT,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                except ldap.LDAPError:
                    pass
                end_time = datetime.now(timezone.utc)
                return {
                    "status": "limited",
                    "message": (
                        "No service bind configured; directory search and bulk sync are unavailable. "
                        "Direct user bind (AD_DIRECT_USER_BIND) may still work."
                    ),
                    "response_time_seconds": (end_time - start_time).total_seconds(),
                    "server": self.config.SERVER,
                    "port": self.config.PORT,
                    "ssl": self.config.USE_SSL,
                    "timestamp": end_time.isoformat(),
                }

            conn.simple_bind_s(self.config.BIND_USER, self.config.BIND_PASSWORD)

            conn.search_s(
                self.config.USER_DN,
                ldap.SCOPE_BASE,
                "(objectClass=*)",
                ["dn"],
            )

            end_time = datetime.now(timezone.utc)
            response_time = (end_time - start_time).total_seconds()

            return {
                "status": "healthy",
                "response_time_seconds": response_time,
                "server": self.config.SERVER,
                "port": self.config.PORT,
                "ssl": self.config.USE_SSL,
                "timestamp": end_time.isoformat(),
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "server": self.config.SERVER,
                "port": self.config.PORT,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        finally:
            if conn:
                try:
                    conn.unbind_s()
                except:
                    pass