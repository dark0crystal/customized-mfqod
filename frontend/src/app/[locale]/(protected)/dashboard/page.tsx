"use client"
import { useState, useEffect } from 'react';
import UserInfo from './UserInfo';
import UserReports from './UserReports';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import OnboardingTour, { TourStep } from '@/components/OnboardingTour';
import { HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default  function Dashboard(){
    const [isLoading, setIsLoading] = useState(true);
    const [isTourOpen, setIsTourOpen] = useState(false);
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
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 500);

        return () => clearTimeout(timer);
    }, []);

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