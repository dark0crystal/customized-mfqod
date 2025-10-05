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
import autoTable from 'jspdf-autotable';
import { analyticsApi } from '@/utils/api';
import { tokenManager } from '@/utils/tokenManager';
import { useTranslations } from 'next-intl';

// Types for analytics data (matching backend response)
interface AnalyticsSummary {
  total_items: number;
  lost_items: number;
  found_items: number;
  returned_items: number;
  return_rate: number;
}

interface ItemsByDate {
  date: string;
  lost: number;
  found: number;
  returned: number;
}

interface ItemsByCategory {
  category: string;
  count: number;
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

// Color palette for charts
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function AnalyticsPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useTranslations('dashboard.analytics');

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const data = await fetchAnalyticsData(new Date(startDate), new Date(endDate));
        setAnalyticsData(data);
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [startDate, endDate]);

  // Export to PDF - FIXED VERSION
  const exportToPDF = () => {
    if (!analyticsData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Title
    doc.setFontSize(20);
    doc.text('Lost & Found Analytics Report', pageWidth / 2, 20, { align: 'center' });
    
    // Date range
    doc.setFontSize(12);
    doc.text(`Period: ${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`, pageWidth / 2, 30, { align: 'center' });
    
    // Summary statistics
    doc.setFontSize(14);
    doc.text('Summary Statistics', 20, 50);
    
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Items', analyticsData.summary.total_items.toString()],
      ['Lost Items', analyticsData.summary.lost_items.toString()],
      ['Found Items', analyticsData.summary.found_items.toString()],
      ['Returned Items', analyticsData.summary.returned_items.toString()],
      ['Return Rate', `${analyticsData.summary.return_rate.toFixed(1)}%`],
    ];

    // Use autoTable with proper typing
    autoTable(doc, {
      head: [summaryData[0]],
      body: summaryData.slice(1),
      startY: 55,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Category breakdown
    let currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 100;
    doc.setFontSize(14);
    doc.text('Items by Category', 20, currentY);
    
    const categoryData = [
      ['Category', 'Count'],
      ...analyticsData.items_by_category.map(item => [item.category, item.count.toString()])
    ];

    autoTable(doc, {
      head: [categoryData[0]],
      body: categoryData.slice(1),
      startY: currentY + 5,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
    });

    // Return statistics
    currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 150;
    doc.setFontSize(14);
    doc.text('Return Statistics', 20, currentY);
    
    const returnData = [
      ['Period', 'Returned', 'Total', 'Rate'],
      ...analyticsData.return_stats.map(stat => [
        stat.period, 
        stat.returned.toString(), 
        stat.total.toString(),
        `${stat.rate.toFixed(1)}%`
      ])
    ];

    autoTable(doc, {
      head: [returnData[0]],
      body: returnData.slice(1),
      startY: currentY + 5,
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(10);
    doc.text(`Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Save the PDF
    doc.save(`analytics-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Track lost and found items performance</p>
        </div>
        
        <button
          onClick={exportToPDF}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download size={20} />
          <span>Export PDF</span>
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="flex items-center space-x-4">
          <Calendar size={20} className="text-gray-500" />
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.summary.total_items}</p>
            </div>
            <Package className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lost Items</p>
              <p className="text-2xl font-bold text-red-600">{analyticsData.summary.lost_items}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Found Items</p>
              <p className="text-2xl font-bold text-green-600">{analyticsData.summary.found_items}</p>
            </div>
            <Users className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Returned</p>
              <p className="text-2xl font-bold text-purple-600">{analyticsData.summary.returned_items}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Return Rate</p>
              <p className="text-2xl font-bold text-indigo-600">{analyticsData.summary.return_rate.toFixed(1)}%</p>
            </div>
            <BarChart3 className="h-8 w-8 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Charts Section - Only Items by Category remains */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Items by Category */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Items by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.items_by_category as any}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.category} ${(entry.percent * 100).toFixed(0)}%`}
                outerRadius={80}
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
      </div>

      {/* Return Performance Summary */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Return Performance</h3>
        <div className="space-y-4">
          {analyticsData.return_stats.map((stat, index) => {
            const rate = stat.rate;
            return (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{stat.period}</p>
                  <p className="text-sm text-gray-600">{stat.returned} of {stat.total} items returned</p>
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