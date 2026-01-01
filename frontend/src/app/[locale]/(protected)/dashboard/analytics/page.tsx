"use client"

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Download, 
  TrendingUp, 
  Package, 
  Users, 
  CheckCircle,
  BarChart3 
} from 'lucide-react';
import { 
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { format, subDays } from 'date-fns';
import jsPDF from 'jspdf';
import { analyticsApi } from '@/utils/api';
import { tokenManager } from '@/utils/tokenManager';
import { useTranslations, useLocale } from 'next-intl';
import html2canvas from 'html2canvas';

// Types for analytics data (matching backend response)
interface AnalyticsSummary {
  total_items: number;
  lost_items: number; // Items not yet returned (unreturned items)
  found_items: number; // All reported/found items (same as total_items)
  returned_items: number; // Items with approved claims
  return_rate: number;
}

interface ItemsByDate {
  date: string;
  lost: number; // Unreturned items
  found: number; // Reported items
  returned: number; // Returned items
}

interface ItemsByCategory {
  category: string; // Item type name
  count: number;
  [key: string]: string | number;
}

interface ReturnStats {
  period: string;
  returned: number;
  total: number;
  rate: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  items_by_date: ItemsByDate[];
  items_by_category: ItemsByCategory[];
  return_stats: ReturnStats[];
}

interface ItemType {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar?: string;
  description_en?: string;
  category?: string;
  is_active: boolean;
}

// Fetch analytics data from API
const fetchAnalyticsData = async (startDate: Date, endDate: Date): Promise<AnalyticsData | null> => {
  try {
    const accessToken = tokenManager.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await analyticsApi.getSummary(accessToken, {
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd')
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.data;
  } catch (error) {
    console.error('Failed to fetch analytics data:', error);
    return null;
  }
};

// Fetch item types for category localization
const fetchItemTypes = async (): Promise<ItemType[]> => {
  try {
    const accessToken = tokenManager.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/item-types/`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch item types:', error);
    return [];
  }
};

// Color palette for charts
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function AnalyticsPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(false);
  const t = useTranslations('dashboard.analytics');
  const tNavbar = useTranslations('navbar');
  const locale = useLocale();

  // Helper function to translate period labels
  const getPeriodTranslation = (period: string): string => {
    const periodMap: Record<string, string> = {
      'This Week': t('thisWeek'),
      'This Month': t('thisMonth'),
      'Last Month': t('lastMonth')
    };
    return periodMap[period] || period;
  };

  // Load analytics data and item types
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch both analytics data and item types in parallel
        const [analyticsData, itemTypesData] = await Promise.all([
          fetchAnalyticsData(new Date(startDate), new Date(endDate)),
          fetchItemTypes()
        ]);
        
        setAnalyticsData(analyticsData);
        setItemTypes(itemTypesData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [startDate, endDate]);

  // Helper function to get localized text for PDF
  const getPDFText = (key: string): string => {
    // Use the translation function to get localized text
    try {
      return t(key as keyof typeof t) || key;
    } catch {
      return key;
    }
  };

  // Helper function to get localized category name
  const getLocalizedCategoryName = (categoryName: string): string => {
    // Find the item type that matches the category name
    const itemType = itemTypes.find(item => 
      item.name_en === categoryName || item.name_ar === categoryName
    );
    
    if (itemType) {
      // Return the appropriate localized name
      if (locale === 'ar' && itemType.name_ar) {
        return itemType.name_ar;
      }
      if (locale === 'en' && itemType.name_en) {
        return itemType.name_en;
      }
      // Fallback to available name
      return itemType.name_ar || itemType.name_en || categoryName;
    }
    
    // If no matching item type found, return the original category name
    return categoryName;
  };

  // Export to PDF using HTML to Canvas approach for better Arabic support
  const exportToPDF = async () => {
    if (!analyticsData) return;

    try {
      // Create a temporary HTML element with the analytics data
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.padding = '20px';
      tempDiv.style.fontFamily = locale === 'ar' ? 'Arial, sans-serif' : 'Arial, sans-serif';
      tempDiv.style.direction = locale === 'ar' ? 'rtl' : 'ltr';
      
      // Get brand name
      const brandName = tNavbar('brand-duplicate') || 'MFQOD';
      
      // Build HTML content
      const htmlContent = `
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Lalezar&display=swap');
        </style>
        <!-- Brand Logo Section -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 30px; padding-bottom: 25px; border-bottom: 2px solid #3277AE;">
          <!-- Brand Name -->
          <div style="display: inline-flex; align-items: center;">
            <div style="font-size: 32px; font-weight: 400; font-family: 'Lalezar', 'Arial', sans-serif; color: #000000; line-height: 1; white-space: nowrap;">
              ${brandName}
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 24px; margin-bottom: 10px; color: #333;">${getPDFText('pdfTitle')}</h1>
          <p style="font-size: 14px; color: #666;">${getPDFText('period')}: ${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="font-size: 18px; margin-bottom: 15px; color: #333;">${getPDFText('summaryStatistics')}</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #fafaf9; color: #333;">
                <th style="padding: 12px; text-align: ${locale === 'ar' ? 'right' : 'left'}; border: 1px solid #ddd;">${getPDFText('metric')}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">${getPDFText('value')}</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background-color: #f8f9fa;">
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'};">${getPDFText('totalItems') || 'Total Items'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${analyticsData.summary.total_items}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'};">${getPDFText('reportedItems') || 'Reported Items'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${analyticsData.summary.found_items}</td>
              </tr>
              <tr style="background-color: #f8f9fa;">
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'};">${getPDFText('unreturnedItems') || 'Unreturned Items'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${analyticsData.summary.lost_items}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'};">${getPDFText('returnedItems') || 'Returned Items'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${analyticsData.summary.returned_items}</td>
              </tr>
              <tr style="background-color: #f8f9fa;">
                <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'};">${getPDFText('returnRate') || 'Return Rate'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${analyticsData.summary.return_rate.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="font-size: 18px; margin-bottom: 15px; color: #333;">${getPDFText('itemsByCategory') || 'Items by Category'}</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #fafaf9; color: #333;">
                <th style="padding: 12px; text-align: ${locale === 'ar' ? 'right' : 'left'}; border: 1px solid #ddd;">${getPDFText('itemType') || 'Item Type'}</th>
                <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">${getPDFText('count') || 'Count'}</th>
              </tr>
            </thead>
            <tbody>
              ${analyticsData.items_by_category.map((item, index) => `
                <tr style="background-color: ${index % 2 === 0 ? '#f8f9fa' : 'white'};">
                  <td style="padding: 10px; border: 1px solid #ddd; text-align: ${locale === 'ar' ? 'right' : 'left'};">${getLocalizedCategoryName(item.category)}</td>
                  <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
          ${getPDFText('generatedOn')} ${format(new Date(), 'dd/MM/yyyy HH:mm')}
        </div>
      `;
      
      // Ensure Lalezar font is loaded
      if (!document.querySelector('link[href*="Lalezar"]')) {
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Lalezar&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for font to load
      }
      
      tempDiv.innerHTML = htmlContent;
      document.body.appendChild(tempDiv);
      
      // Wait for fonts to be ready
      await document.fonts.ready;
      
      // Convert HTML to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      // Remove temporary element
      document.body.removeChild(tempDiv);
      
      // Create PDF from canvas
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Save the PDF
      const filename = `analytics-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      pdf.save(filename);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('noDataAvailable')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-600 mt-1">{t('subtitle')}</p>
        </div>
        
        <div className="flex flex-col items-end space-y-2">
        <button
          onClick={exportToPDF}
          className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1380a3e6' }}
        >
          <Download size={20} className="text-white" />
          <span>{t('exportPDF')}</span>
        </button>
          {locale === 'ar' ? (
            <p className="text-xs text-gray-500 text-right max-w-xs">
              ملاحظة: يتم تصدير PDF باللغة العربية مع دعم كامل للنصوص
            </p>
          ) : (
            <p className="text-xs text-gray-500 text-right max-w-xs">
              Note: PDF is exported with full Arabic text support
            </p>
          )}
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-start gap-3">
          <Calendar size={20} className="text-blue-600 flex-shrink-0 mt-1" />
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            {/* From Date - Top */}
            <div className="flex items-center gap-2 w-full">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap min-w-[60px]">{t('from')}:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-w-0"
              />
            </div>
            {/* To Date - Bottom */}
            <div className="flex items-center gap-2 w-full">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap min-w-[60px]">{t('to')}:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-w-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">{t('totalItems')}</p>
              <p className="text-2xl font-bold text-blue-700">{analyticsData.summary.total_items}</p>
            </div>
            <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">{t('reportedItems') || 'Reported Items'}</p>
              <p className="text-2xl font-bold text-green-700">{analyticsData.summary.found_items}</p>
            </div>
            <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-50 to-red-100 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">{t('unreturnedItems') || 'Unreturned Items'}</p>
              <p className="text-2xl font-bold text-red-700">{analyticsData.summary.lost_items}</p>
            </div>
            <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">{t('returnedItems')}</p>
              <p className="text-2xl font-bold text-purple-700">{analyticsData.summary.returned_items}</p>
            </div>
            <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600">{t('returnRate')}</p>
              <p className="text-2xl font-bold text-indigo-700">{analyticsData.summary.return_rate.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-indigo-200 rounded-full flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section - Only Items by Category remains */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Items by Category */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('itemsByCategory') || 'Items by Item Type'}</h3>
          <div className="flex flex-col lg:flex-row items-center">
            {/* Pie Chart */}
            <div className="w-full lg:w-1/2">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.items_by_category}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={false}
                    outerRadius={70}
                    innerRadius={20}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analyticsData.items_by_category.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="w-full lg:w-1/2 lg:pl-8">
              <div className="space-y-3">
                {analyticsData.items_by_category.map((item, index) => {
                  const percentage = ((item.count / analyticsData.summary.total_items) * 100).toFixed(1);
                  return (
                    <div key={index} className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <span className="text-sm font-medium text-gray-700">{getLocalizedCategoryName(item.category)}</span>
                      <span className="text-sm text-gray-500">({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Return Performance Summary */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('returnStatistics')}</h3>
        <div className="space-y-4">
          {analyticsData.return_stats.map((stat, index) => {
            const rate = stat.rate;
            return (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{getPeriodTranslation(stat.period)}</p>
                  <p className="text-sm text-gray-600">{stat.returned} {t('of')} {stat.total} {t('itemsReturned')}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{rate.toFixed(1)}%</p>
                  <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${rate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}