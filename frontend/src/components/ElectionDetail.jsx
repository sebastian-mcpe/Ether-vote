import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { 
  ArrowLeft,
  Vote,
  Users,
  Clock,
  Calendar,
  MapPin,
  Shield,
  CheckCircle,
  AlertCircle,
  XCircle,
  BarChart3,
  Wallet,
  ExternalLink
} from "lucide-react";
import ReactECharts from 'echarts-for-react';
import { getElectionById, getResults, submitVote, hasVoted } from "../api";
import { CONFIG } from "../config";

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

const ElectionDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const electionId = Number(id);

  const [election, setElection] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [showConfirmVote, setShowConfirmVote] = useState(false);
  useEffect(() => {
    loadElectionData();
  }, [electionId, user]);
  const loadElectionData = async () => {
    try {
      setLoading(true);
      
      // Get real election data from API
      const electionData = await getElectionById(electionId);
      const resultsData = await getResults(electionId);
        // Determine election status based on time and disabled flag
      const currentTime = Date.now() / 1000; // Current time in seconds
      let status;
      if (electionData.disabled) {
        status = "disabled";
      } else if (currentTime < electionData.startTime) {
        status = "upcoming";
      } else if (currentTime > electionData.endTime) {
        status = "expired";
      } else {
        status = "active";
      }

      // Format election data
      const formattedElection = {
        electionId: electionData.electionId,
        name: electionData.name,
        description: "Vote for the next leader of the Dominican Republic",
        startDate: new Date(electionData.startTime * 1000).toISOString(),        endDate: new Date(electionData.endTime * 1000).toISOString(),
        startTime: electionData.startTime,
        endTime: electionData.endTime,
        status: status,
        location: "Dominican Republic",
        type: "presidential",
        totalVoters: await getTotalRegisteredUsers(),
        candidates: electionData.candidates
      };
        setElection(formattedElection);
      setResults(resultsData);
        // Check if user has already voted using blockchain data (priority)
      if (user?.socialId) {
        try {
          const votingStatus = await hasVoted(electionId, user.socialId);
          setHasVoted(votingStatus.hasVoted);
            // Clear localStorage if blockchain says not voted (contract might have been redeployed)
          if (!votingStatus.hasVoted) {
            const votedKey = `voted-${user.socialId}-${electionId}`;
            localStorage.removeItem(votedKey);
          }
        } catch (error) {
          console.error('Error checking voting status:', error);
          // Use localStorage as fallback if blockchain check fails
          const votedKey = `voted-${user.socialId}-${electionId}`;
          const localVoted = localStorage.getItem(votedKey) === 'true';
          
          // If we have local storage indicating the user voted, trust it
          // since blockchain verification failed (network issues, etc.)
          if (localVoted) {
            setHasVoted(true);
            console.log('Using localStorage voting status due to blockchain verification failure');
          } else {
            // Only set to false if localStorage also says not voted
            setHasVoted(false);
          }
        }
      }
      
    } catch (error) {
      console.error('Error loading election:', error);
      toast.error('Failed to load election details');      // Fallback to mock data if API fails
      const mockElection = {
        electionId: 1,
        name: "Presidential Election 2024",
        description: "Vote for the next President of the Dominican Republic",
        startDate: "2024-01-15T09:00:00Z",
        endDate: "2024-01-15T18:00:00Z",
        status: "active",
        location: "Dominican Republic",
        type: "presidential",
        totalVoters: await getTotalRegisteredUsers(),
        candidates: ["Candidate A", "Candidate B"]
      };
      
      const mockResults = {
        "Candidate A": 2,
        "Candidate B": 1
      };

      setElection(mockElection);
      setResults(mockResults);
    } finally {
      setLoading(false);
    }
  };
  const handleVoteSubmit = (e) => {
    e.preventDefault();
    
    if (!selectedCandidate) {
      toast.error("Please select a candidate");
      return;
    }

    if (!user) {
      toast.error("Please register first");
      return;
    }

    setShowConfirmVote(true);
  };

  const handleVote = async () => {
    try {
      setVoting(true);
      setShowConfirmVote(false);
      
      let signature;
      let voterAddress;

      // Handle different authentication methods
      if (user.authMethod === 'metamask') {
        // Use MetaMask for signing
        if (!window.ethereum) {
          throw new Error("MetaMask not found");
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        voterAddress = await signer.getAddress();

        // Verify the signer address matches the user's registered address
        if (voterAddress.toLowerCase() !== user.address.toLowerCase()) {
          throw new Error("MetaMask account doesn't match registered address");
        }

        // Create message hash for signing
        const contractAddress = CONFIG.CONTRACT_ADDRESS;
        const messageHash = ethers.solidityPackedKeccak256(
          ["uint256", "string", "address", "address"],
          [electionId, selectedCandidate, voterAddress, contractAddress]
        );

        // Sign with MetaMask
        signature = await signer.signMessage(ethers.getBytes(messageHash));

      } else if (user.authMethod === 'generated') {
        // Use stored private key
        const stored = JSON.parse(localStorage.getItem(`user-${user.socialId}`));
        if (!stored || !stored.privateKey) {
          throw new Error("No private key found. Please re-register.");
        }

        const wallet = new ethers.Wallet(stored.privateKey);
        voterAddress = wallet.address;

        // Create message hash for signing
        const contractAddress = CONFIG.CONTRACT_ADDRESS;
        const messageHash = ethers.solidityPackedKeccak256(
          ["uint256", "string", "address", "address"],
          [electionId, selectedCandidate, voterAddress, contractAddress]
        );

        // Sign the message
        signature = await wallet.signMessage(ethers.getBytes(messageHash));
      } else {
        throw new Error("Unknown authentication method");
      }      // Submit vote
      const response = await submitVote({
        socialId: user.socialId,
        electionId: electionId,
        selectedCandidate: selectedCandidate,
        signature: signature,
      });

      console.log('Vote response:', response);

      if (response.error) {
        throw new Error(response.error);
      }      // Mark as voted locally (backup)
      const votedKey = `voted-${user.socialId}-${electionId}`;
      localStorage.setItem(votedKey, 'true');
      
      // Store transaction hash for later reference
      if (response.txHash) {
        localStorage.setItem(`txHash-${user.socialId}-${electionId}`, response.txHash);
      }
      
      // Update voting status immediately 
      setHasVoted(true);// Show success message with transaction hash
      const txHash = response.txHash || 'Transaction submitted';
      if (response.txHash) {
        // Create a custom toast with clickable explorer link
        toast.success(
          <div>
            Vote submitted successfully!<br/>
            <a 
              href={`https://www.megaexplorer.xyz/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#3b82f6', textDecoration: 'underline' }}
            >
              View on MegaETH Explorer: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
          </div>,
          { duration: 10000 } // Show for 10 seconds
        );
      } else {
        toast.success(`Vote submitted successfully! TX: ${txHash}`);
      }
      
      // Refresh results after a short delay
      setTimeout(async () => {
        await loadElectionData();
      }, 3000);
      
    } catch (error) {
      console.error('Voting error:', error);
      toast.error(error.message || "Vote submission failed");
    } finally {
      setVoting(false);
    }
  };

  const getVotePercentage = (candidate) => {
    if (!results) return 0;
    const totalVotes = Object.values(results).reduce((sum, count) => sum + count, 0);
    return totalVotes > 0 ? (results[candidate] / totalVotes * 100) : 0;
  };

  const getTotalVotes = () => {
    if (!results) return 0;
    return Object.values(results).reduce((sum, count) => sum + count, 0);
  };

  const getChartOption = () => {
    if (!results) return {};
    
    const data = Object.entries(results).map(([name, votes]) => ({
      value: votes,
      name: name
    }));

    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Live Results',
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
        formatter: '{a} <br/>{b}: {c} votes ({d}%)'
      },
      legend: {
        orient: 'horizontal',
        bottom: '5%',
        textStyle: {
          color: '#9ca3af'
        }
      },
      series: [
        {
          name: 'Votes',
          type: 'pie',
          radius: ['50%', '80%'],
          center: ['50%', '45%'],
          data: data,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          label: {
            color: '#ffffff',
            formatter: '{b}\n{d}%'
          },
          itemStyle: {
            color: (params) => {
              const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
              return colors[params.dataIndex % colors.length];
            }
          }
        }
      ]
    };
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card p-6 animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Election Not Found</h2>
        <p className="text-gray-400 mb-6">The election you're looking for doesn't exist.</p>
        <button onClick={() => navigate('/elections')} className="btn-primary">
          Back to Elections
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/elections')}
          className="btn-secondary p-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">{election.name}</h1>
          <p className="text-gray-400">Election #{election.electionId}</p>
        </div>
      </div>

      {/* Election Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4">Election Details</h2>
            <p className="text-gray-300 mb-6">{election.description}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-white font-medium">Start Date</p>
                  <p className="text-gray-400 text-sm">{formatDate(election.startDate)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-white font-medium">End Date</p>
                  <p className="text-gray-400 text-sm">{formatDate(election.endDate)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-white font-medium">Location</p>
                  <p className="text-gray-400 text-sm">{election.location}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-white font-medium">Registered Voters</p>
                  <p className="text-gray-400 text-sm">{election.totalVoters.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Voting Form */}
          {!hasVoted && election.status === 'active' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <Vote className="w-6 h-6" />
                <span>Cast Your Vote</span>
              </h2>
              
              <form onSubmit={handleVoteSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Select a candidate:
                  </label>
                  <div className="space-y-3">
                    {election.candidates.map((candidate) => (
                      <label
                        key={candidate}
                        className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedCandidate === candidate
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-600 hover:border-gray-500'
                        }`}
                      >
                        <input
                          type="radio"
                          name="candidate"
                          value={candidate}
                          checked={selectedCandidate === candidate}
                          onChange={(e) => setSelectedCandidate(e.target.value)}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                          selectedCandidate === candidate
                            ? 'border-primary bg-primary'
                            : 'border-gray-400'
                        }`}>
                          {selectedCandidate === candidate && (
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white">{candidate}</p>
                          <p className="text-gray-400 text-sm">
                            Current votes: {results?.[candidate] || 0} ({getVotePercentage(candidate).toFixed(1)}%)
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={voting || !selectedCandidate}
                  className="btn-primary w-full flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {voting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting Vote...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Submit Secure Vote</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}          {/* Vote Confirmation */}
          {hasVoted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card p-6 bg-green-500/10 border border-green-500/20"
            >
              <div className="flex items-center space-x-3 mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
                <h2 className="text-xl font-bold text-white">Vote Successfully Cast!</h2>
              </div>
              <p className="text-green-300 mb-3">
                Your vote has been securely recorded on the blockchain. Thank you for participating in this election.
              </p>
              {localStorage.getItem(`txHash-${user?.socialId}-${electionId}`) && (
                <a 
                  href={`https://www.megaexplorer.xyz/tx/${localStorage.getItem(`txHash-${user?.socialId}-${electionId}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 text-green-400 hover:text-green-300 underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View transaction on MegaETH Explorer</span>
                </a>
              )}
            </motion.div>
          )}

          {/* Expired Election Message */}
          {election.status === 'expired' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-6 bg-gray-500/10 border border-gray-500/20"
            >
              <div className="flex items-center space-x-3 mb-4">
                <Clock className="w-8 h-8 text-gray-400" />
                <h2 className="text-xl font-bold text-white">Election Has Ended</h2>
              </div>
              <p className="text-gray-300">
                This election ended on {new Date(election.endTime * 1000).toLocaleString()}. 
                Voting is no longer available, but you can view the final results below.
              </p>
            </motion.div>
          )}

          {/* Upcoming Election Message */}
          {election.status === 'upcoming' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-6 bg-blue-500/10 border border-blue-500/20"
            >
              <div className="flex items-center space-x-3 mb-4">
                <Calendar className="w-8 h-8 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Election Starts Soon</h2>
              </div>
              <p className="text-blue-300">
                This election will begin on {new Date(election.startTime * 1000).toLocaleString()}. 
                Please check back when voting opens.
              </p>
            </motion.div>
          )}

          {/* Disabled Election Message */}
          {election.status === 'disabled' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-6 bg-red-500/10 border border-red-500/20"
            >
              <div className="flex items-center space-x-3 mb-4">
                <XCircle className="w-8 h-8 text-red-400" />
                <h2 className="text-xl font-bold text-white">Election Disabled</h2>
              </div>
              <p className="text-red-300">
                This election has been temporarily disabled by administrators. 
                Voting is currently not available.
              </p>
            </motion.div>
          )}
        </div>

        {/* Results Sidebar */}
        <div className="space-y-6">
          {/* Live Results Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Live Results</h3>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            
            <div className="text-center mb-4">
              <p className="text-3xl font-bold text-primary">{getTotalVotes()}</p>
              <p className="text-gray-400 text-sm">Total Votes Cast</p>
            </div>

            {results && getTotalVotes() > 0 && (
              <ReactECharts
                option={getChartOption()}
                style={{ height: '250px' }}
              />
            )}
          </motion.div>

          {/* Detailed Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card p-6"
          >
            <h3 className="text-lg font-bold text-white mb-4">Detailed Results</h3>
            <div className="space-y-3">
              {election.candidates.map((candidate, index) => {
                const votes = results?.[candidate] || 0;
                const percentage = getVotePercentage(candidate);
                return (
                  <div key={candidate} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{candidate}</span>
                      <span className="text-gray-400">{votes} votes</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, delay: index * 0.2 }}
                        className="bg-gradient-to-r from-primary to-blue-500 h-2 rounded-full"
                      />
                    </div>
                    <div className="text-right">
                      <span className="text-primary font-medium">{percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Blockchain Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card p-6"
          >
            <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Blockchain Security</span>
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Network:</span>
                <span className="text-white">MegaETH Testnet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Contract:</span>
                <span className="text-white font-mono text-xs">
                  {CONFIG.CONTRACT_ADDRESS.slice(0, 8)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Security:</span>
                <span className="text-green-400">Verified</span>
              </div>
            </div>            <a
              href={`https://www.megaexplorer.xyz/address/${CONFIG.CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full mt-4 flex items-center justify-center space-x-2 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span>View on Explorer</span>
            </a>
          </motion.div>
        </div>
      </div>

      {/* Vote Confirmation Modal */}
      <AnimatePresence>
        {showConfirmVote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowConfirmVote(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="card p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-3 mb-4">
                <Vote className="w-8 h-8 text-primary" />
                <h3 className="text-xl font-bold text-white">Confirm Your Vote</h3>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-300 mb-2">You are about to vote for:</p>
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-primary font-semibold text-lg">{selectedCandidate}</p>
                </div>
              </div>
              
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-yellow-400 font-medium text-sm">Important Notice</h4>
                    <p className="text-gray-300 text-sm mt-1">
                      Your vote will be permanently recorded on the blockchain and cannot be changed.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmVote(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVote}
                  disabled={voting}
                  className="btn-primary flex-1 flex items-center justify-center space-x-2"
                >
                  {voting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Voting...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Confirm Vote</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ElectionDetail;
