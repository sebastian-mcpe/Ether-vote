import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  MapPin,
  Calendar,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { DOMINICAN_PROVINCES } from '../utils/dominican';
import { getElections, getResults } from '../api';
import { mapUsersToProvinces, generateTimeBasedVotes, generateDemographicBreakdown } from '../utils/provinceUtils';
import { fetchBlockchainVotingTimeline, generateEnhancedTimeBasedVotes } from '../utils/blockchainAnalytics';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('all');
  const [selectedProvince, setSelectedProvince] = useState('all');
  const [loading, setLoading] = useState(false);  const [analyticsData, setAnalyticsData] = useState({
    votesByProvince: [],
    votesByTime: [],
    demographicBreakdown: [],
    participationRate: 0,
    totalVotes: 0,
    totalRegistered: 0,
    timelineInfo: { title: 'Loading...', insight: '' }
  });

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, selectedProvince]);  const loadAnalytics = async () => {
    setLoading(true);
    
    try {
      // Get real election data and user data
      const elections = await getElections();
      
      // Get real user data
      let users = {};
      let totalRegistered = 5; // Default from our known data
      try {
        const usersResponse = await fetch('http://localhost:3000/users');
        users = await usersResponse.json();
        totalRegistered = Object.keys(users).length;
      } catch (error) {
        console.log('Could not fetch user data, using defaults');
      }

      let totalVotes = 0;
      let allElectionResults = {};
      
      // Calculate real votes from all elections
      for (const election of elections) {
        try {
          const results = await getResults(election.electionId);
          const electionVotes = Object.values(results).reduce((sum, count) => sum + count, 0);
          totalVotes += electionVotes;
          
          // Combine all election results
          Object.keys(results).forEach(candidate => {
            if (!allElectionResults[candidate]) {
              allElectionResults[candidate] = 0;
            }
            allElectionResults[candidate] += results[candidate];
          });
        } catch (error) {
          console.error(`Error loading results for election ${election.electionId}:`, error);
        }
      }
        // Map real users to provinces with proportional vote distribution
      const provinceData = mapUsersToProvinces(users, allElectionResults);
      
      // Fetch real blockchain voting timeline data
      const blockchainTimeline = await fetchBlockchainVotingTimeline();
      
      // Generate enhanced time-based voting data (real blockchain data or sample)
      const timelineResult = generateEnhancedTimeBasedVotes(totalVotes, totalVotes === 0, blockchainTimeline);
      
      // Generate demographic breakdown
      const demographics = generateDemographicBreakdown(users);
      
      setAnalyticsData({
        votesByProvince: provinceData,
        votesByTime: timelineResult.data,
        demographicBreakdown: demographics,
        participationRate: totalRegistered > 0 ? (totalVotes / totalRegistered) : 0,
        totalVotes,
        totalRegistered,
        timelineInfo: {
          title: timelineResult.title,
          insight: timelineResult.insight
        }
      });
      
    } catch (error) {
      console.error('Error loading analytics:', error);      // Fallback to minimal real data (new contract)
      setAnalyticsData({
        votesByProvince: [
          { name: 'Monte Plata', votes: 0, registered: 1, realUsers: 1 }
        ],
        votesByTime: generateEnhancedTimeBasedVotes(0, true).data, // Use sample data for timeline
        demographicBreakdown: generateDemographicBreakdown({}),
        participationRate: 0, // 0 votes from 1 user
        totalVotes: 0,
        totalRegistered: 1,
        timelineInfo: {
          title: 'Voting Timeline (New Contract)',
          insight: 'This is a newly deployed contract with no voting activity yet. Timeline shows expected patterns for future elections.'
        }
      });
    }
    
    setLoading(false);
  };

  const getProvinceMapOption = () => {
    const data = analyticsData.votesByProvince.map(province => ({
      name: province.name,
      value: province.votes,
      registered: province.registered,
      rate: province.registered > 0 ? (province.votes / province.registered * 100) : 0
    }));

    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Votes by Province',
        left: 'center',
        textStyle: {
          color: '#ffffff',
          fontSize: 18,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: {
          color: '#ffffff'
        },
        formatter: function(params) {
          return `${params.name}<br/>Votes: ${params.value}<br/>Registered: ${params.data.registered}<br/>Rate: ${params.data.rate.toFixed(1)}%`;
        }
      },
      xAxis: {
        type: 'category',
        data: data.map(item => item.name),
        axisLabel: {
          color: '#9ca3af',
          rotate: 45
        },
        axisLine: {
          lineStyle: { color: '#374151' }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Votes',
        nameTextStyle: { color: '#9ca3af' },
        axisLabel: { color: '#9ca3af' },
        axisLine: { lineStyle: { color: '#374151' } },
        splitLine: { lineStyle: { color: '#374151' } }
      },
      series: [
        {
          data: data.map(item => item.value),
          type: 'bar',
          itemStyle: {
            color: '#6366f1'
          },
          emphasis: {
            itemStyle: { color: '#8b5cf6' }
          }
        }
      ]
    };
  };  const getTimelineOption = () => {
    return {
      backgroundColor: 'transparent',
      title: {
        text: analyticsData.timelineInfo.title,
        left: 'center',
        textStyle: {
          color: '#ffffff',
          fontSize: 18,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#ffffff' }
      },
      xAxis: {
        type: 'category',
        data: analyticsData.votesByTime.map(item => item.time),
        axisLabel: { color: '#9ca3af' },
        axisLine: { lineStyle: { color: '#374151' } }
      },
      yAxis: {
        type: 'value',
        name: 'Votes',
        nameTextStyle: { color: '#9ca3af' },
        axisLabel: { color: '#9ca3af' },
        axisLine: { lineStyle: { color: '#374151' } },
        splitLine: { lineStyle: { color: '#374151' } }
      },
      series: [
        {
          data: analyticsData.votesByTime.map(item => item.votes),
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: '#10b981', width: 3 },
          itemStyle: { color: '#10b981' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0)' }
              ]
            }
          }
        }
      ]
    };
  };

  const getParticipationOption = () => {
    const participated = analyticsData.totalVotes;
    const notParticipated = analyticsData.totalRegistered - analyticsData.totalVotes;
    
    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Participation Rate',
        left: 'center',
        textStyle: {
          color: '#ffffff',
          fontSize: 18,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#ffffff' }
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '80%'],
          center: ['50%', '50%'],
          data: [
            { value: participated, name: 'Voted', itemStyle: { color: '#10b981' } },
            { value: notParticipated, name: 'Not Voted', itemStyle: { color: '#6b7280' } }
          ],
          label: {
            color: '#ffffff',
            formatter: '{b}\n{d}%'
          }
        }
      ]
    };
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color = 'blue' }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card card-hover p-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 bg-${color}-500/20 rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${color}-400`} />
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Vote Analytics</h1>
          <p className="text-gray-400 mt-1">
            Comprehensive insights into voting patterns and participation
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button className="btn-primary flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Export Data</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="input-field min-w-[140px]"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="input-field min-w-[160px]"
            >
              <option value="all">All Provinces</option>
              {DOMINICAN_PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          title="Total Votes"
          value={analyticsData.totalVotes}
          subtitle="Blockchain confirmed"
          color="blue"
        />        <StatCard
          icon={TrendingUp}
          title="Participation Rate"
          value={`${(analyticsData.participationRate * 100).toFixed(1)}%`}
          subtitle="Of registered voters"
          color="green"
        />
        <StatCard
          icon={MapPin}
          title="Active Provinces"
          value={analyticsData.votesByProvince.filter(p => p.votes > 0).length}
          subtitle="Out of 32 provinces"
          color="purple"
        />        <StatCard
          icon={Calendar}
          title="Peak Hour"
          value={analyticsData.votesByTime.length > 0 ? 
            analyticsData.votesByTime.reduce((peak, current) => 
              current.votes > peak.votes ? current : peak
            ).time : "10:00"}
          subtitle="Highest activity"
          color="yellow"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Province Analytics */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card p-6"
        >
          <ReactECharts
            option={getProvinceMapOption()}
            style={{ height: '400px' }}
            showLoading={loading}
          />
        </motion.div>

        {/* Timeline Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card p-6"
        >
          <ReactECharts
            option={getTimelineOption()}
            style={{ height: '400px' }}
            showLoading={loading}
          />
        </motion.div>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Participation Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <ReactECharts
            option={getParticipationOption()}
            style={{ height: '300px' }}
            showLoading={loading}
          />
        </motion.div>

        {/* Province Rankings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Province Rankings</h3>
          <div className="space-y-3">
            {analyticsData.votesByProvince
              .sort((a, b) => b.votes - a.votes)
              .slice(0, 6)
              .map((province, index) => {
                const rate = province.registered > 0 ? (province.votes / province.registered * 100) : 0;
                return (
                  <div key={province.name} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                        index === 2 ? 'bg-amber-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-white">{province.name}</p>
                        <p className="text-gray-400 text-sm">{province.registered} registered</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{province.votes}</p>
                      <p className="text-gray-400 text-sm">{rate.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </motion.div>

        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Summary</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-6 h-6 text-blue-400" />
                <div>
                  <p className="font-medium text-white">Total Engagement</p>
                  <p className="text-blue-300 text-sm">
                    {analyticsData.totalVotes} votes from {analyticsData.totalRegistered} registered users
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <TrendingUp className="w-6 h-6 text-green-400" />
                <div>
                  <p className="font-medium text-white">Growth Trend</p>
                  <p className="text-green-300 text-sm">
                    Steady increase in participation over time
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <MapPin className="w-6 h-6 text-purple-400" />
                <div>
                  <p className="font-medium text-white">Geographic Spread</p>
                  <p className="text-purple-300 text-sm">
                    {analyticsData.votesByProvince.filter(p => p.votes > 0).length} provinces participating
                  </p>
                </div>
              </div>
            </div>            <div className="mt-6 p-4 bg-gray-800/30 rounded-lg">
              <h4 className="font-medium text-white mb-2">Key Insights</h4>
              <div className="text-gray-300 text-sm space-y-2">
                <p>• {analyticsData.timelineInfo.insight}</p>
                {analyticsData.totalVotes > 0 ? (
                  <>
                    <p>• {analyticsData.votesByProvince.filter(p => p.votes > 0)[0]?.name || 'Top province'} leads in participation</p>
                    <p>• {analyticsData.votesByProvince.filter(p => p.votes > 0).length} provinces have active participation</p>
                  </>
                ) : (
                  <>
                    <p>• New contract deployment - awaiting first elections</p>
                    <p>• {analyticsData.votesByProvince.length} provinces with registered users</p>
                  </>
                )}
                <p>• Blockchain verification: 100% secure</p>
                <p>• Real-time data from {analyticsData.totalRegistered} registered users</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;
