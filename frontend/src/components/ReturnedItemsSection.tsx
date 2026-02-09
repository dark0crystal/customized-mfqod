"use client";

import { useState, useEffect } from 'react';
import { CheckCircle, TrendingUp, Users, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ReturnedItemsSection() {
  const [returnedCount, setReturnedCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const t = useTranslations("returnedItems");

  // Simulate counting animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      // Animate counting from 0 to target number
      const targetCount = 1247; // This would come from API
      const duration = 2000; // 2 seconds
      const increment = targetCount / (duration / 16); // 60fps
      
      let currentCount = 0;
      const countInterval = setInterval(() => {
        currentCount += increment;
        if (currentCount >= targetCount) {
          currentCount = targetCount;
          clearInterval(countInterval);
        }
        setReturnedCount(Math.floor(currentCount));
      }, 16);

      return () => clearInterval(countInterval);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const stats = [
    {
      icon: CheckCircle,
      label: t("returnedToday") || "تم إرجاعها اليوم",
      value: "23",
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      icon: TrendingUp,
      label: t("thisWeek") || "هذا الأسبوع",
      value: "156",
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      icon: Users,
      label: t("happyUsers") || "مستخدم سعيد",
      value: "98%",
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      icon: Clock,
      label: t("avgTime") || "متوسط الوقت",
      value: "2.3",
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    }
  ];

  return (
    <div className="w-full py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto">
        {/* Main Counter Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6" style={{ backgroundColor: '#3277AE' }}>
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t("title") || "العناصر المُرجعة"}
          </h2>
          
          <div className="relative inline-block">
            <div className={`text-6xl sm:text-7xl font-bold transition-all duration-1000 ${isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} style={{ color: '#3277AE' }}>
              {returnedCount.toLocaleString()}
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          
          <p className="text-xl text-gray-600 mt-4">
            {t("subtitle") || "عنصر تم إرجاعه بنجاح"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div
                key={index}
                className={`bg-white rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 ${isVisible ? 'animate-fadeInUp' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className="text-center">
                  <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                    <IconComponent className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  
                  <div className={`text-2xl sm:text-3xl font-bold ${stat.color} mb-2`}>
                    {stat.value}
                  </div>
                  
                  <div className="text-sm text-gray-600 font-medium">
                    {stat.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Bar Section */}
        <div className="mt-12 bg-white rounded-2xl p-6 sm:p-8 shadow-lg">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t("monthlyProgress") || "التقدم الشهري"}
            </h3>
            <p className="text-gray-600">
              {t("progressDescription") || "نسبة العناصر المُرجعة هذا الشهر"}
            </p>
          </div>
          
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div 
                className="h-4 rounded-full transition-all duration-2000 ease-out"
                style={{ 
                  backgroundColor: '#3277AE',
                  width: isVisible ? '87%' : '0%'
                }}
              ></div>
            </div>
            
            <div className="flex justify-between text-sm text-gray-600">
              <span>0</span>
              <span className="font-bold" style={{ color: '#3277AE' }}>87%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-12">
          <div className="inline-flex items-center space-x-2 text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              {t("liveUpdate") || "تحديث مباشر"}
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
