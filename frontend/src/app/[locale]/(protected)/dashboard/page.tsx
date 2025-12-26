"use client"
import { useState, useEffect } from 'react';
import UserInfo from './UserInfo';
import UserReports from './UserReports';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { tokenManager } from '@/utils/tokenManager';
import { usePermissions } from '@/PermissionsContext';

// Helper to mask token for security
const maskToken = (token: string | null): string => {
    if (!token) return 'null';
    if (token.length <= 20) return token;
    return `${token.substring(0, 10)}...${token.substring(token.length - 10)}`;
};

export default  function Dashboard(){
    const [isLoading, setIsLoading] = useState(true);
    const { permissions, userRole, roleId, isAuthenticated, isLoading: permissionsLoading } = usePermissions();
    
    useEffect(() => {
        // Log comprehensive user and token information when dashboard loads
        console.log('========================================');
        console.log('[DASHBOARD] Dashboard page loaded');
        console.log('========================================');
        
        // Get tokens
        const accessToken = tokenManager.getAccessToken();
        const refreshToken = tokenManager.getRefreshToken();
        const user = tokenManager.getUser();
        
        // Decode token to get payload
        let tokenPayload: any = null;
        if (accessToken) {
            try {
                const base64Url = accessToken.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                tokenPayload = JSON.parse(jsonPayload);
            } catch (e) {
                console.error('[DASHBOARD] Error decoding token:', e);
            }
        }
        
        // Log token information
        console.log('[DASHBOARD] Token Information:');
        console.log('  - Access Token:', maskToken(accessToken));
        console.log('  - Refresh Token:', maskToken(refreshToken));
        console.log('  - Token exists:', !!accessToken);
        console.log('  - Refresh token exists:', !!refreshToken);
        
        if (tokenPayload) {
            console.log('[DASHBOARD] Token Payload:');
            console.log('  - User ID:', tokenPayload.user_id || tokenPayload.sub);
            console.log('  - Email:', tokenPayload.email);
            console.log('  - Role:', tokenPayload.role);
            console.log('  - Role ID:', tokenPayload.role_id);
            console.log('  - Expires at:', tokenPayload.exp ? new Date(tokenPayload.exp * 1000).toISOString() : 'N/A');
            console.log('  - Issued at:', tokenPayload.iat ? new Date(tokenPayload.iat * 1000).toISOString() : 'N/A');
            console.log('  - Token expired:', tokenPayload.exp ? tokenPayload.exp * 1000 < Date.now() : 'Unknown');
        }
        
        // Log user information from cookies
        console.log('[DASHBOARD] User Information (from cookies):');
        if (user) {
            console.log('  - User ID:', user.id);
            console.log('  - Email:', user.email);
            console.log('  - Name:', `${user.first_name} ${user.last_name}`);
            console.log('  - Role:', user.role);
            console.log('  - Role ID:', user.role_id);
        } else {
            console.log('  - No user data in cookies');
        }
        
        // Log permissions information
        console.log('[DASHBOARD] Permissions Information:');
        console.log('  - Is authenticated:', isAuthenticated);
        console.log('  - Permissions loading:', permissionsLoading);
        console.log('  - User role:', userRole);
        console.log('  - Role ID:', roleId);
        console.log('  - Permissions count:', permissions.length);
        console.log('  - Permissions:', permissions);
        if (permissions.length > 0) {
            console.log('  - Permission names:', permissions.join(', '));
        } else {
            console.warn('  - WARNING: No permissions found!');
        }
        
        console.log('========================================');
        
        // Simulate initial loading
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 500);
        
        return () => clearTimeout(timer);
    }, [permissions, userRole, roleId, isAuthenticated, permissionsLoading]);
    
    if (isLoading) {
        return <LoadingSpinner size="md" className="h-64" />;
    }
    
    return(
        <div className="space-y-3 sm:space-y-4 lg:space-y-6 px-2 sm:px-4 lg:px-6">
            <UserInfo/>
            <UserReports/>
        </div>
    )
}