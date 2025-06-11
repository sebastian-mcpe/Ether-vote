// Blockchain data fetcher for real voting timeline data
const { ethers } = require("ethers");

// Load contract ABI and configuration
const votingJson = require("./artifacts/contracts/Voting.sol/Voting.json");
const abi = votingJson.abi;

// Read environment variables
require("dotenv").config({ path: "./.env" });

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL;

// Create provider and contract instance
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

async function fetchRealBlockchainData() {
  try {
    console.log("Fetching real blockchain data...");
    console.log("Contract Address:", CONTRACT_ADDRESS);
    
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    console.log("Current block number:", currentBlock);
    
    // Define chunk size (max 50000 to be safe)
    const CHUNK_SIZE = 50000;
    
    // Get all past Vote events from the blockchain in chunks
    const voteFilter = contract.filters.VotedMeta();
    let allVoteEvents = [];
    
    for (let fromBlock = 0; fromBlock <= currentBlock; fromBlock += CHUNK_SIZE) {
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
      console.log(`Querying vote events from block ${fromBlock} to ${toBlock}`);
      
      try {
        const chunkEvents = await contract.queryFilter(voteFilter, fromBlock, toBlock);
        allVoteEvents = allVoteEvents.concat(chunkEvents);
        console.log(`Found ${chunkEvents.length} vote events in this chunk`);
      } catch (error) {
        console.log(`Error in chunk ${fromBlock}-${toBlock}:`, error.message);
      }
    }
    
    console.log(`Total found ${allVoteEvents.length} vote events`);
    
    // Get election creation events in chunks
    const electionFilter = contract.filters.ElectionCreated();
    let allElectionEvents = [];
    
    for (let fromBlock = 0; fromBlock <= currentBlock; fromBlock += CHUNK_SIZE) {
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
      console.log(`Querying election events from block ${fromBlock} to ${toBlock}`);
      
      try {
        const chunkEvents = await contract.queryFilter(electionFilter, fromBlock, toBlock);
        allElectionEvents = allElectionEvents.concat(chunkEvents);
        console.log(`Found ${chunkEvents.length} election events in this chunk`);
      } catch (error) {
        console.log(`Error in chunk ${fromBlock}-${toBlock}:`, error.message);
      }
    }    
    console.log(`Total found ${allElectionEvents.length} election events`);
    
    // Process vote events to extract timing data
    const votesWithTimestamp = [];
    
    for (const event of allVoteEvents) {
      const block = await provider.getBlock(event.blockNumber);
      const timestamp = block.timestamp;
      const date = new Date(timestamp * 1000);
      
      votesWithTimestamp.push({
        electionId: event.args.electionId.toString(),
        voter: event.args.voter,
        candidate: event.args.candidate,
        timestamp: timestamp,
        date: date,
        hour: date.getHours(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      });
    }
    
    // Process election events
    const electionsWithTimestamp = [];
    
    for (const event of allElectionEvents) {
      const block = await provider.getBlock(event.blockNumber);
      const timestamp = block.timestamp;
      
      electionsWithTimestamp.push({
        electionId: event.args.electionId.toString(),
        name: event.args.name,
        startTime: event.args.startTime.toString(),
        endTime: event.args.endTime.toString(),
        createdAt: timestamp,
        blockNumber: event.blockNumber
      });
    }
    
    return {
      votes: votesWithTimestamp,
      elections: electionsWithTimestamp,
      summary: {
        totalVotes: votesWithTimestamp.length,
        totalElections: electionsWithTimestamp.length,
        oldestElection: electionsWithTimestamp.length > 0 ? 
          electionsWithTimestamp.reduce((oldest, current) => 
            parseInt(oldest.endTime) < parseInt(current.endTime) ? oldest : current
          ) : null
      }
    };
    
  } catch (error) {
    console.error("Error fetching blockchain data:", error);
    return {
      votes: [],
      elections: [],
      summary: {
        totalVotes: 0,
        totalElections: 0,
        oldestElection: null
      }
    };
  }
}

// Run the function if called directly
if (require.main === module) {
  fetchRealBlockchainData().then(data => {
    console.log("\n=== BLOCKCHAIN DATA SUMMARY ===");
    console.log(JSON.stringify(data, null, 2));
  });
}

module.exports = { fetchRealBlockchainData };
