

import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import LeadDash from "./LeadDash";
import ImportLeadsSection from "./ImportLeadsSection";
import { getLeads } from "../../api/leadAPI";
import { getAuthHeaders } from "../../utils/authAPI";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chart.js/auto';

// Register components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const STATUS_COLORS = {
  pending: '#3b82f6',
  converted: '#10b981',
  completed: '#8b5cf6',
  rejected: '#ef4444',
  spam: '#fbbf24',
};

const monthLabels = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const LeadsDashboard = ({ refreshKey }) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [chartData, setChartData] = useState({
    labels: monthLabels,
    datasets: [],
  });

  // Fetch leads and prepare chart data by status per month
  useEffect(() => {
    const fetchLeadsData = async () => {
      try {
        // Fetch data for chart and total count using authenticated API
        const data = await getLeads({ page: 1, limit: 1000 });

        // Aggregate: { month: {status: count} }
        const byMonthStatus = {};
        (data.data || []).forEach(lead => {
          let dateObj;
          if (lead.created_at && lead.created_at.$date) {
            dateObj = new Date(lead.created_at.$date);
          } else if (lead.created) {
            dateObj = new Date(lead.created);
          } else if (lead.timestamp) {
            dateObj = new Date(lead.timestamp);
          } else {
            dateObj = new Date();
          }
          const month = monthLabels[dateObj.getMonth()];
          const status = (lead.status || 'pending').toLowerCase();

          if (!byMonthStatus[month]) byMonthStatus[month] = {};
          byMonthStatus[month][status] = (byMonthStatus[month][status] || 0) + 1;
        });

        const monthsInData = monthLabels.filter(m => byMonthStatus[m]);
        // All statuses found in data
        const allStatuses = [
          ...new Set(
            Object.values(byMonthStatus).flatMap(obj => Object.keys(obj))
          ),
        ];

        // Create one dataset per status for the line chart
        const datasets = allStatuses.map(status => ({
          label: status.charAt(0).toUpperCase() + status.slice(1),
          data: monthsInData.map(m => byMonthStatus[m][status] || 0),
          borderColor: STATUS_COLORS[status] || '#43a6c6',
          backgroundColor: STATUS_COLORS[status] || '#43a6c6',
          borderWidth: 3,
          pointBackgroundColor: STATUS_COLORS[status] || '#43a6c6',
          pointBorderColor: '#fff',
          pointRadius: 7,
          pointHoverRadius: 10,
          fill: false,
          tension: 0.2,
        }));

        setChartData({
          labels: monthsInData,
          datasets,
        });
      } catch (err) {
        console.error('Error fetching leads:', err);
        // fallback sample data
        setChartData({
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [
            {
              label: 'Pending',
              data: [80, 100, 120, 40, 30, 30],
              borderColor: STATUS_COLORS.pending,
              backgroundColor: STATUS_COLORS.pending,
              borderWidth: 3,
              pointBackgroundColor: STATUS_COLORS.pending,
              pointBorderColor: '#fff',
              pointRadius: 7,
              pointHoverRadius: 10,
              fill: false,
              tension: 0.2,
            },
            {
              label: 'Converted',
              data: [20, 30, 55, 120, 180, 200],
              borderColor: STATUS_COLORS.converted,
              backgroundColor: STATUS_COLORS.converted,
              borderWidth: 3,
              pointBackgroundColor: STATUS_COLORS.converted,
              pointBorderColor: '#fff',
              pointRadius: 7,
              pointHoverRadius: 10,
              fill: false,
              tension: 0.2,
            },
          ],
        });
      }
    };
    fetchLeadsData();
  }, [refreshKey]);

  // Chart options with animations
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#1f2937',
          font: {
            size: 14,
          },
        },
      },
      title: {
        display: true,
        text: 'Leads Over Time',
        color: '#1f2937',
        font: {
          size: 18,
          weight: 'bold',
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#1f2937',
        },
        grid: {
          display: true,
          color: '#e5e7eb',
        },
      },
      y: {
        ticks: {
          color: '#1f2937',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.12)',
        },
      },
    },
    animation: {
      duration: 1800,
      easing: 'easeInOutQuart',
    },
    maintainAspectRatio: false,
  };

  // ...everything else in your component stays the same, just replace your Leads Graph Card
  return (
    <div className="bg-gray-100 p-4 sm:p-6 lg:p-8 min-h-screen">
        <LeadDash onImportClick={() => setShowImportModal(true)} />
        
        {/* Import Leads Modal */}
        <ImportLeadsSection 
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onLeadAdded={() => {
            // Refresh the dashboard when leads are added
            setShowImportModal(false);
            // You can add additional refresh logic here if needed
          }}
        />
    </div>
  );
};

export default LeadsDashboard;