import ldap
import ssl
from ldap import LDAPError
from jose import jwt, JWTError
from datetime import datetime, timedelta
from config.ldap_config import LDAPConfig
from fastapi import HTTPException, status
from typing import Optional, Dict, Any, List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LDAPAuthService:
    def __init__(self):
        self.config = LDAPConfig()
        
    def _get_ldap_connection(self) -> ldap.ldapobject.LDAPObject:
        """
        Create and return LDAP connection
        """
        try:
            # Construct LDAP URI
            protocol = "ldaps" if self.config.USE_SSL else "ldap"
            ldap_uri = f"{protocol}://{self.config.SERVER}:{self.config.PORT}"
            
            # Initialize connection
            conn = ldap.initialize(ldap_uri)
            
            # Set LDAP options
            conn.set_option(ldap.OPT_REFERRALS, 0)
            conn.set_option(ldap.OPT_PROTOCOL_VERSION, 3)
            
            if self.config.USE_SSL:
                conn.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_NEVER)
            
            return conn
        except Exception as e:
            logger.error(f"Failed to create LDAP connection: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="LDAP connection failed"
            )
    
    def authenticate_user(self, username: str, password: str) -> Dict[str, Any]:
        """
        Authenticate user against Azure AD via LDAP
        """
        conn = None
        try:
            conn = self._get_ldap_connection()
            
            # First, bind with service account to search for user
            conn.simple_bind_s(self.config.BIND_USER, self.config.BIND_PASSWORD)
            
            # Search for user
            search_filter = self.config.USER_SEARCH_FILTER.format(username=username)
            result = conn.search_s(
                self.config.USER_DN,
                ldap.SCOPE_SUBTREE,
                search_filter,
                self.config.USER_ATTRIBUTES
            )
            
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )
            
            # Get user DN and attributes
            user_dn, user_attrs = result[0]
            
            # Try to bind with user credentials
            try:
                user_conn = self._get_ldap_connection()
                user_conn.simple_bind_s(user_dn, password)
                user_conn.unbind_s()
            except ldap.INVALID_CREDENTIALS:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
            
            # Process user attributes
            user_info = self._process_user_attributes(user_attrs)
            
            logger.info(f"User {username} authenticated successfully")
            return user_info
            
        except HTTPException:
            raise
        except LDAPError as e:
            logger.error(f"LDAP error during authentication: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service error"
            )
        except Exception as e:
            logger.error(f"Unexpected error during authentication: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication failed"
            )
        finally:
            if conn:
                try:
                    conn.unbind_s()
                except:
                    pass
    
    def _process_user_attributes(self, attrs: Dict) -> Dict[str, Any]:
        """
        Process LDAP attributes into user info dictionary
        """
        def get_attr_value(attr_name: str) -> Optional[str]:
            values = attrs.get(attr_name, [])
            if values and isinstance(values[0], bytes):
                return values[0].decode('utf-8')
            elif values:
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
        
        # Extract groups/roles from memberOf attribute
        member_of = get_attr_list('memberOf')
        groups = []
        roles = []
        
        for group_dn in member_of:
            # Extract group name from DN (e.g., CN=Admins,OU=Groups,DC=domain,DC=com -> Admins)
            if group_dn.startswith('CN='):
                group_name = group_dn.split(',')[0][3:]  # Remove "CN="
                groups.append(group_name)
                
                # Map Azure AD groups to application roles
                role_mapping = {
                    'Domain Admins': 'admin',
                    'Administrators': 'admin',
                    'Users': 'user',
                    'Managers': 'manager'
                }
                
                if group_name in role_mapping:
                    roles.append(role_mapping[group_name])
        
        return {
            'username': get_attr_value('sAMAccountName'),
            'email': get_attr_value('mail') or get_attr_value('userPrincipalName'),
            'display_name': get_attr_value('displayName'),
            'first_name': get_attr_value('givenName'),
            'last_name': get_attr_value('sn'),
            'groups': groups,
            'roles': roles
        }
    
    def search_users(self, search_term: str = "*") -> List[Dict[str, Any]]:
        """
        Search for users in LDAP directory
        """
        conn = None
        try:
            conn = self._get_ldap_connection()
            conn.simple_bind_s(self.config.BIND_USER, self.config.BIND_PASSWORD)
            
            # Build search filter
            if search_term == "*":
                search_filter = "(objectClass=user)"
            else:
                search_filter = f"(&(objectClass=user)(|(displayName=*{search_term}*)(sAMAccountName=*{search_term}*)(mail=*{search_term}*)))"
            
            result = conn.search_s(
                self.config.USER_DN,
                ldap.SCOPE_SUBTREE,
                search_filter,
                self.config.USER_ATTRIBUTES
            )
            
            users = []
            for user_dn, user_attrs in result:
                if user_attrs:  # Skip empty results
                    user_info = self._process_user_attributes(user_attrs)
                    users.append(user_info)
            
            return users
            
        except LDAPError as e:
            logger.error(f"LDAP search error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User search failed"
            )
        finally:
            if conn:
                try:
                    conn.unbind_s()
                except:
                    pass
    
    def get_user_groups(self, username: str) -> List[str]:
        """
        Get groups for a specific user
        """
        conn = None
        try:
            conn = self._get_ldap_connection()
            conn.simple_bind_s(self.config.BIND_USER, self.config.BIND_PASSWORD)
            
            search_filter = self.config.USER_SEARCH_FILTER.format(username=username)
            result = conn.search_s(
                self.config.USER_DN,
                ldap.SCOPE_SUBTREE,
                search_filter,
                ['memberOf']
            )
            
            if not result:
                return []
            
            user_dn, user_attrs = result[0]
            member_of = user_attrs.get('memberOf', [])
            
            groups = []
            for group_dn in member_of:
                if isinstance(group_dn, bytes):
                    group_dn = group_dn.decode('utf-8')
                
                if group_dn.startswith('CN='):
                    group_name = group_dn.split(',')[0][3:]
                    groups.append(group_name)
            
            return groups
            
        except LDAPError as e:
            logger.error(f"LDAP group search error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Group search failed"
            )
        finally:
            if conn:
                try:
                    conn.unbind_s()
                except:
                    pass
    
    def create_jwt_token(self, user_data: Dict[str, Any]) -> str:
        """
        Create JWT token for authenticated user
        """
        payload = {
            "sub": user_data.get("username"),
            "email": user_data.get("email"),
            "name": user_data.get("display_name"),
            "roles": user_data.get("roles", []),
            "groups": user_data.get("groups", []),
            "exp": datetime.utcnow() + timedelta(hours=8),
            "iat": datetime.utcnow(),
            "iss": "fastapi-ldap-app"
        }
        
        token = jwt.encode(payload, self.config.SECRET_KEY, algorithm="HS256")
        return token
    
    def verify_jwt_token(self, token: str) -> Dict[str, Any]:
        """
        Verify and decode JWT token
        """
        try:
            payload = jwt.decode(token, self.config.SECRET_KEY, algorithms=["HS256"])
            return payload
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"}
            )