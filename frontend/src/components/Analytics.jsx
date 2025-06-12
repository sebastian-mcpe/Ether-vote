import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart4,
  PieChart,
  TrendingUp,
  Users,
  MapPin,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Sparkles,
  Activity,
  Eye,
  Target,
  Clock,
  Award,
  Globe,
  Zap
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { DOMINICAN_PROVINCES } from '../utils/dominican';
import { getElections, getResults, getElectionById } from '../api';
import { mapUsersToProvinces, generateTimeBasedVotes, generateDemographicBreakdown } from '../utils/provinceUtils';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('all');
  const [selectedProvince, setSelectedProvince] = useState('all');
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState({
    votesByProvince: [],
    votesByTime: [],
    demographicBreakdown: [],
    participationRate: 0,
    totalVotes: 0,
    totalRegistered: 0
  });

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, selectedProvince]);

  const loadAnalytics = async () => {
    setLoading(true);

    try {
      // Get real election data and user data
      const elections = await getElections();

      // Get detailed election data
      const electionDetails = await Promise.all(
        elections.map(async (election) => {
          try {
            const response = await fetch(`http://localhost:3000/elections/${election.electionId}`);
            return await response.json();
          } catch (error) {
            console.error(`Error fetching details for election ${election.electionId}:`, error);
            return null;
          }
        })
      );

      const validElections = electionDetails.filter(e => e !== null);

      // Get real user data
      let users = {};
      let totalRegistered = 0;
      try {
        const usersResponse = await fetch('http://localhost:3000/users');
        users = await usersResponse.json();
        totalRegistered = Object.keys(users).length;
      } catch (error) {
        console.log('Could not fetch user data, using defaults');
      }

      // Calculate total votes and get real results from each election
      let totalVotes = 0;
      let allElectionResults = [];
      let votesByProvince = [];

      const provinceVotes = {};

      // Initialize all provinces with zero votes
      DOMINICAN_PROVINCES.forEach(province => {
        provinceVotes[province] = 0;
      });

      for (const election of validElections) {
        try {
          const results = await getResults(election.electionId);
          const electionVotes = Object.values(results).reduce((sum, count) => sum + count, 0);
          totalVotes += electionVotes;

          // Store actual results with election info
          if (electionVotes > 0) {
            allElectionResults.push({
              electionId: election.electionId,
              electionName: election.name,
              results: results,
              totalVotes: electionVotes
            });
          }

          // For demo purposes, distribute votes to provinces
          // In a real system, votes would be linked to user provinces
          // Normally this would come from blockchain data
        } catch (error) {
          console.log(`No results for election ${election.electionId}`);
        }
      }

      // Get province user counts
      const provinceUserCount = mapUsersToProvinces(users);

      // Create vote by province data based on real users and zero votes
      // (since we can't determine which province voted in which election)
      votesByProvince = Object.entries(provinceUserCount).map(([province, userCount]) => {
        return {
          province,
          votes: provinceVotes[province] || 0, // Use real vote counts if available
          registeredUsers: userCount,
          participationRate: userCount > 0 ?
            (((provinceVotes[province] || 0) / userCount) * 100).toFixed(1) : 0
        };
      });

      // Generate time-based vote data
      const votesByTime = generateTimeBasedVotes(allElectionResults);

      // Generate demographic breakdown with zeros (we don't have real demographic data)
      const demographicBreakdown = generateDemographicBreakdown(users);

      // Calculate participation rate
      const participationRate = totalRegistered > 0 ?
        ((totalVotes / totalRegistered) * 100).toFixed(1) : 0;

      setAnalyticsData({
        votesByProvince: votesByProvince.filter(item => item.registeredUsers > 0),
        votesByTime,
        demographicBreakdown,
        participationRate: parseFloat(participationRate),
        totalVotes,
        totalRegistered
      });

    } catch (error) {
      console.error('Error loading analytics:', error);

      // Fallback data with zeros
      setAnalyticsData({
        votesByProvince: [
          { province: 'San Pedro de Macorís', votes: 0, registeredUsers: 0, participationRate: 0 },
          { province: 'Monte Plata', votes: 0, registeredUsers: 0, participationRate: 0 },
          { province: 'Sánchez Ramírez', votes: 0, registeredUsers: 0, participationRate: 0 },
          { province: 'María Trinidad Sánchez', votes: 0, registeredUsers: 0, participationRate: 0 }
        ],
        votesByTime: [
          { time: '09:00', votes: 0 },
          { time: '12:00', votes: 0 },
          { time: '15:00', votes: 0 },
          { time: '18:00', votes: 0 }
        ],
        demographicBreakdown: [
          { ageGroup: '18-25', percentage: 0, color: '#14b8a6' },
          { ageGroup: '26-35', percentage: 0, color: '#ff5722' },
          { ageGroup: '36-50', percentage: 0, color: '#8b5cf6' },
          { ageGroup: '50+', percentage: 0, color: '#f59e0b' }
        ],
        participationRate: 0,
        totalVotes: 0,
        totalRegistered: 0
      });
    } finally {
      setLoading(false);
    }
  };

  // Chart configurations with light theme
  const provinceChartOption = {
    backgroundColor: 'transparent',
    title: {
      text: '',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      borderRadius: 12,
      padding: [12, 16],
      textStyle: {
        color: '#111827'
      },
      formatter: function (params) {
        const dataIndex = params[0].dataIndex;
        const data = analyticsData.votesByProvince[dataIndex];
        return `
          <strong>${params[0].axisValue}</strong><br/>
          Votos: <span style="color: #14b8a6">${params[0].value}</span><br/>
          Registrados: ${data?.registeredUsers || 0}<br/>
          Participación: ${data?.participationRate || 0}%
        `;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: analyticsData.votesByProvince.map(item =>
        selectedProvince === 'all' || selectedProvince === item.province ? item.province : ''
      ).filter(Boolean),
      axisLabel: {
        color: '#6b7280',
        rotate: 45,
        fontSize: 12
      },
      axisLine: {
        lineStyle: {
          color: '#d1d5db'
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#6b7280',
        fontSize: 12
      },
      axisLine: {
        lineStyle: {
          color: '#d1d5db'
        }
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        data: analyticsData.votesByProvince
          .filter(item => selectedProvince === 'all' || selectedProvince === item.province)
          .map((item, index) => ({
            value: item.votes,
            itemStyle: {
              color: `hsl(${170 + index * 25}, 70%, 55%)`
            }
          })),
        type: 'bar',
        barWidth: '60%',
        itemStyle: {
          borderRadius: [8, 8, 0, 0]
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
          }
        }
      }
    ]
  };

  const timeChartOption = {
    backgroundColor: 'transparent',
    title: {
      text: '',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      borderRadius: 12,
      padding: [12, 16],
      textStyle: {
        color: '#111827'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: analyticsData.votesByTime.map(item => item.time),
      axisLabel: {
        color: '#6b7280',
        fontSize: 12
      },
      axisLine: {
        lineStyle: {
          color: '#d1d5db'
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#6b7280',
        fontSize: 12
      },
      axisLine: {
        lineStyle: {
          color: '#d1d5db'
        }
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        data: analyticsData.votesByTime.map(item => item.votes),
        type: 'line',
        smooth: true,
        lineStyle: {
          color: '#14b8a6',
          width: 3
        },
        areaStyle: {
          color: 'rgba(20, 184, 166, 0.1)'
        },
        symbolSize: 8,
        itemStyle: {
          color: '#14b8a6'
        }
      }
    ]
  };

  const demographicChartOption = {
    backgroundColor: 'transparent',
    title: {
      text: '',
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      borderRadius: 12,
      padding: [12, 16],
      textStyle: {
        color: '#111827'
      },
      formatter: '{a} <br/>{b}: {c}%'
    },
    legend: {
      orient: 'horizontal',
      bottom: '5%',
      textStyle: {
        color: '#6b7280',
        fontSize: 12
      }
    },
    series: [
      {
        name: 'Demografía',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        data: analyticsData.demographicBreakdown.map(item => ({
          value: item.percentage,
          name: item.ageGroup,
          itemStyle: { color: item.color }
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
          }
        },
        label: {
          color: '#374151',
          fontSize: 12,
          fontWeight: 600
        }
      }
    ]
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 loading-spinner mx-auto"></div>
          <p className="text-gray-600 font-medium">Cargando analíticos...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Enhanced Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-50 via-white to-secondary-50 rounded-3xl"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-200/30 to-secondary-200/30 rounded-full -translate-y-8 translate-x-8"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-secondary-200/30 to-primary-200/30 rounded-full translate-y-4 -translate-x-4"></div>

        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center space-x-3"
              >
                <Sparkles className="w-7 h-7 text-primary-600" />
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-600 bg-clip-text text-transparent">
                  Analíticos
                </h1>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-gray-600 text-lg max-w-2xl"
              >
                Análisis detallado de participación electoral y tendencias de votación
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center space-x-4 mt-6 lg:mt-0"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={loadAnalytics}
                disabled={loading}
                className="flex items-center space-x-3 bg-gradient-to-r from-primary-500 to-secondary-600 hover:from-primary-600 hover:to-secondary-700 text-white px-6 py-3 rounded-2xl transition-all duration-300 shadow-soft hover:shadow-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                <span className="font-semibold">Actualizar</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center space-x-3 bg-white/80 backdrop-blur-sm border border-gray-200 hover:border-primary-300 text-gray-700 hover:text-primary-600 px-6 py-3 rounded-2xl transition-all duration-300 shadow-soft hover:shadow-medium"
              >
                <Download className="w-5 h-5" />
                <span className="font-semibold">Exportar</span>
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white rounded-3xl"></div>
        <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 p-8 shadow-soft">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                <Calendar className="w-4 h-4" />
                <span>Período de tiempo</span>
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 rounded-2xl px-4 py-4 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-300"
              >
                <option value="all">Todo el tiempo</option>
                <option value="today">Hoy</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                <MapPin className="w-4 h-4" />
                <span>Provincia</span>
              </label>
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 rounded-2xl px-4 py-4 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-300"
              >
                <option value="all">Todas las provincias</option>
                {DOMINICAN_PROVINCES.map(province => (
                  <option key={province} value={province}>{province}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-primary-100 rounded-3xl transform group-hover:scale-105 transition-transform duration-300"></div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl border border-primary-200/50 p-8 shadow-soft hover:shadow-medium transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center">
                <Target className="w-7 h-7 text-white" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{analyticsData.totalVotes}</p>
                <p className="text-sm text-gray-600">Votos Totales</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-3xl transform group-hover:scale-105 transition-transform duration-300"></div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl border border-emerald-200/50 p-8 shadow-soft hover:shadow-medium transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{analyticsData.totalRegistered}</p>
                <p className="text-sm text-gray-600">Registrados</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-amber-100 rounded-3xl transform group-hover:scale-105 transition-transform duration-300"></div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl border border-amber-200/50 p-8 shadow-soft hover:shadow-medium transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{analyticsData.participationRate}%</p>
                <p className="text-sm text-gray-600">Participación</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50 to-violet-100 rounded-3xl transform group-hover:scale-105 transition-transform duration-300"></div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl border border-violet-200/50 p-8 shadow-soft hover:shadow-medium transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center">
                <Globe className="w-7 h-7 text-white" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{analyticsData.votesByProvince.length}</p>
                <p className="text-sm text-gray-600">Provincias</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Enhanced Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Votes by Province Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-primary-100 rounded-3xl transform group-hover:scale-[1.01] transition-transform duration-300"></div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl border border-primary-200/50 p-8 shadow-soft hover:shadow-medium transition-all duration-300">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">Votos por Provincia</h3>
                <p className="text-gray-600">Distribución geográfica de la participación</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg">
                <BarChart4 className="w-7 h-7 text-white" />
              </div>
            </div>

            <ReactECharts
              option={provinceChartOption}
              style={{ height: '350px' }}
            />
          </div>
        </motion.div>

        {/* Demographic Breakdown Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.0 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50 to-violet-100 rounded-3xl transform group-hover:scale-[1.01] transition-transform duration-300"></div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl border border-violet-200/50 p-8 shadow-soft hover:shadow-medium transition-all duration-300">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">Breakdown Demográfico</h3>
                <p className="text-gray-600">Participación por grupos de edad</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
                <PieChart className="w-7 h-7 text-white" />
              </div>
            </div>

            <ReactECharts
              option={demographicChartOption}
              style={{ height: '350px' }}
            />
          </div>
        </motion.div>
      </div>

      {/* Time-based Voting Trends */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
        className="relative group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-3xl transform group-hover:scale-[1.01] transition-transform duration-300"></div>
        <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl border border-emerald-200/50 p-8 shadow-soft hover:shadow-medium transition-all duration-300">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">Tendencias de Votación</h3>
              <p className="text-gray-600">Actividad de votación a lo largo del tiempo</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Activity className="w-7 h-7 text-white" />
            </div>
          </div>

          <ReactECharts
            option={timeChartOption}
            style={{ height: '350px' }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Analytics;
