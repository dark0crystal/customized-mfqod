"use client"
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import UserInfo from './UserInfo';
import UserReports from './UserReports';
import LoadingSpinner from '@/components/ui/LoadingSpinner';


export default  function Dashboard(){
    const [isLoading, setIsLoading] = useState(true);
    const t = useTranslations('dashboard.sideNavbar');
    
    useEffect(() => {
        // Simulate initial loading
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 500);
        
        return () => clearTimeout(timer);
    }, []);
    
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