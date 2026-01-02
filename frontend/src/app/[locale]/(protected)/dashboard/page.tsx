"use client"
import { useState, useEffect } from 'react';
import UserInfo from './UserInfo';
import UserReports from './UserReports';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { tokenManager } from '@/utils/tokenManager';
import { usePermissions } from '@/PermissionsContext';
import OnboardingTour, { TourStep } from '@/components/OnboardingTour';
import { HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Helper to mask token for security
const maskToken = (token: string | null): string => {
    if (!token) return 'null';
    if (token.length <= 20) return token;
    return `${token.substring(0, 10)}...${token.substring(token.length - 10)}`;
};

export default  function Dashboard(){
    const [isLoading, setIsLoading] = useState(true);
    const [isTourOpen, setIsTourOpen] = useState(false);
    const { permissions, userRole, roleId, isAuthenticated, isLoading: permissionsLoading } = usePermissions();
    const t = useTranslations('dashboard.onboardingTour');
    
    // Define tour steps
    const tourSteps: TourStep[] = [
        {
            id: 'welcome',
            title: t('steps.welcome.title'),
            description: t('steps.welcome.description'),
            position: 'center',
        },
        {
            id: 'userInfo',
            target: '[data-tour="user-info"]',
            title: t('steps.userInfo.title'),
            description: t('steps.userInfo.description'),
            position: 'bottom',
        },
        {
            id: 'userReports',
            target: '[data-tour="user-reports"]',
            title: t('steps.userReports.title'),
            description: t('steps.userReports.description'),
            position: 'top',
        },
        {
            id: 'navigation',
            target: '[data-tour="sidebar-navigation"]',
            title: t('steps.navigation.title'),
            description: t('steps.navigation.description'),
            position: 'right',
        },
        {
            id: 'quickActions',
            title: t('steps.quickActions.title'),
            description: t('steps.quickActions.description'),
            position: 'center',
        },
    ];
    
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

    // Check if tour should auto-start (first visit)
    useEffect(() => {
        if (!isLoading && typeof window !== 'undefined') {
            const tourCompleted = localStorage.getItem('dashboard_tour_completed');
            if (!tourCompleted) {
                // Auto-start tour on first visit (optional - can be removed if not desired)
                // setIsTourOpen(true);
            }
        }
    }, [isLoading]);
    
    if (isLoading) {
        return <LoadingSpinner size="md" className="h-64" />;
    }
    
    return(
        <>
            <div className="space-y-3 sm:space-y-4 lg:space-y-6 px-2 sm:px-4 lg:px-6">
                <div data-tour="user-info">
                    <UserInfo/>
                </div>
                <div data-tour="user-reports">
                    <UserReports/>
                </div>
            </div>

            {/* Floating Action Button for Tour */}
            <button
                onClick={() => setIsTourOpen(true)}
                className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 p-3 sm:p-4 rounded-full shadow-lg transition-all duration-200 transform hover:scale-110 hover:shadow-xl active:scale-95"
                style={{ 
                    backgroundColor: '#3277AE',
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2a5f94';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#3277AE';
                }}
                aria-label={t("startTour")}
                title={t("startTour")}
            >
                <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>

            {/* Onboarding Tour */}
            <OnboardingTour
                isOpen={isTourOpen}
                onClose={() => setIsTourOpen(false)}
                steps={tourSteps}
                translationKey="dashboard.onboardingTour"
            />
        </>
    )
}