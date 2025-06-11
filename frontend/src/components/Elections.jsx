import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  Vote, 
  Clock, 
  Users, 
  CheckCircle,
  Calendar,
  MapPin,
  ArrowRight,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';
import { getElections, getResults, getElectionById } from '../api';

// Utility function to get total registered users
const getTotalRegisteredUsers = async () => {
  try {
    const response = await fetch('http://localhost:3000/users');
    const users = await response.json();
    return Object.keys(users).length;
  } catch (error) {
    console.error('Error fetching user count:', error);
    return 1; // Fallback to known user count (new contract)
  }
};

const Elections = ({ user }) => {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadElections();
  }, []);

  const loadElections = async () => {
    try {
      setLoading(true);
      
      // Get elections from API
      const electionsList = await getElections();
      
      // Get detailed data for each election
      const electionsWithDetails = await Promise.all(
        electionsList.map(async (election) => {
          try {
            const details = await getElectionById(election.electionId);
            const results = await getResults(election.electionId);
            
            const totalVotes = Object.values(results).reduce((sum, count) => sum + count, 0);            const candidates = details.candidates.map(candidateName => ({
              id: candidateName,
              name: candidateName,
              votes: results[candidateName] || 0
            }));
              // Determine election status based on time and disabled flag
            const currentTime = Date.now() / 1000; // Current time in seconds
            let status;
            if (details.disabled) {
              status = "disabled";
            } else if (currentTime < details.startTime) {
              status = "upcoming";
            } else if (currentTime > details.endTime) {
              status = "expired";
            } else {
              status = "active";
            }
            
            return {
              id: election.electionId,
              title: details.name,              description: "Vote for the next leader of the Dominican Republic",
              startDate: new Date(details.startTime * 1000).toISOString(),
              endDate: new Date(details.endTime * 1000).toISOString(), 
              startTime: details.startTime,
              endTime: details.endTime,
              status: status,
              totalVotes,
              totalVoters: await getTotalRegisteredUsers(),
              candidates,
              location: "Dominican Republic",
              type: "presidential"
            };
          } catch (error) {
            console.error(`Error loading details for election ${election.electionId}:`, error);
            return null;
          }
        })
      );
        setElections(electionsWithDetails.filter(Boolean));
      
    } catch (error) {
      console.error('Error loading elections:', error);
      toast.error('Failed to load elections');
    } finally {
      setLoading(false);
    }
  };
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-400/20';
      case 'upcoming':
        return 'text-blue-400 bg-blue-400/20';
      case 'expired':
        return 'text-orange-400 bg-orange-400/20';
      case 'disabled':
        return 'text-red-400 bg-red-400/20';
      default:
        return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <Vote className="w-4 h-4" />;
      case 'upcoming':
        return <Clock className="w-4 h-4" />;
      case 'expired':
        return <CheckCircle className="w-4 h-4" />;
      case 'disabled':
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const filteredElections = elections
    .filter(election => {
      const matchesSearch = election.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           election.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || election.status === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      // Sort order: active -> upcoming -> disabled -> expired
      const statusPriority = {
        'active': 1,
        'upcoming': 2,
        'disabled': 3,
        'expired': 4
      };
      
      const aPriority = statusPriority[a.status] || 5;
      const bPriority = statusPriority[b.status] || 5;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Within same status, sort by start time (newest first)
      return b.startTime - a.startTime;
    });

  const ElectionCard = ({ election }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card card-hover p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-xl font-bold text-white">{election.title}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(election.status)}`}>
              {getStatusIcon(election.status)}
              <span className="capitalize">{election.status}</span>
            </span>
          </div>
          <p className="text-gray-400 text-sm mb-3">{election.description}</p>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(election.startDate)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <MapPin className="w-4 h-4" />
              <span>{election.location}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Election Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-800/30 rounded-lg">
          <p className="text-2xl font-bold text-primary">{election.totalVotes}</p>
          <p className="text-gray-400 text-sm">Votes Cast</p>
        </div>
        <div className="text-center p-3 bg-gray-800/30 rounded-lg">
          <p className="text-2xl font-bold text-blue-400">{election.candidates.length}</p>
          <p className="text-gray-400 text-sm">Candidates</p>
        </div>
        <div className="text-center p-3 bg-gray-800/30 rounded-lg">
          <p className="text-2xl font-bold text-green-400">{election.totalVoters}</p>
          <p className="text-gray-400 text-sm">Registered</p>
        </div>
      </div>

      {/* Candidates Preview */}
      <div className="mb-6">
        <h4 className="font-medium text-white mb-3">Leading Candidates</h4>
        <div className="space-y-2">
          {election.candidates.slice(0, 2).map((candidate) => {
            const percentage = election.totalVotes > 0 ? (candidate.votes / election.totalVotes * 100) : 0;
            return (              <div key={candidate.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                <div>
                  <p className="font-medium text-white">{candidate.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{candidate.votes} votes</p>
                  <p className="text-gray-400 text-sm">{percentage.toFixed(1)}%</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Button */}
      <Link
        to={`/elections/${election.id}`}
        className="btn-primary w-full flex items-center justify-center space-x-2"
      >
        <span>{election.status === 'active' ? 'Vote Now' : 'View Details'}</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Elections</h1>
          <p className="text-gray-400 mt-1">
            Participate in secure, transparent blockchain voting
          </p>
        </div>
        <button
          onClick={loadElections}
          disabled={loading}
          className="btn-secondary flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search elections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field min-w-[120px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="disabled">Disabled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Elections Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-2/3 mb-4"></div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-16 bg-gray-700 rounded"></div>
                ))}
              </div>
              <div className="h-10 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredElections.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredElections.map((election, index) => (
            <div
              key={election.id}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <ElectionCard election={election} />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-12 text-center"
        >
          <Vote className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Elections Found</h3>
          <p className="text-gray-400 mb-6">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'There are no elections available at the moment.'}
          </p>
          {(searchTerm || filterStatus !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('all');
              }}
              className="btn-secondary"
            >
              Clear Filters
            </button>
          )}
        </motion.div>
      )}

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 bg-gradient-to-r from-primary/10 to-blue-500/10 border border-primary/20"
      >
        <div className="flex items-start space-x-4">
          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-white mb-1">Blockchain-Secured Voting</h3>
            <p className="text-gray-300 text-sm">
              Your votes are secured by blockchain technology, ensuring transparency, immutability, and verifiability. 
              Each vote is cryptographically signed and permanently recorded on the MegaETH testnet.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Elections;
