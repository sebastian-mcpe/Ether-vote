// api/index.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const axios = require("axios");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

// Load the ABI of Voting contract
const votingJson = require("../artifacts/contracts/Voting.sol/Voting.json");
const abi = votingJson.abi;

const app = express();
app.use(cors());
app.use(express.json());

// Load or initialize user database (socialId -> wallet {address, privateKey})
const usersFile = path.resolve(__dirname, "../users.json");
let users = {};
if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
}

function saveUsers() {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Swagger setup
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Meta-Transaction Voting API",
    version: "1.0.0",
    description: "API docs for gasless voting on MegaETH testnet",
  },
  servers: [{ url: "http://localhost:3000", description: "Local server" }],
};

const options = {
  swaggerDefinition,
  apis: ["./api/index.js"],
};

const swaggerSpec = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Read-only provider for contract interactions
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const votingContract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  abi,
  provider
);

// ================= User Management =================

/**
 * @swagger
 * /users/register:
 *   post:
 *     summary: Register a user by social ID, generate a wallet, and fund it
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               socialId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 socialId:
 *                   type: string
 *                 address:
 *                   type: string
 *                 privateKey:
 *                   type: string
 *                 fundTxHash:
 *                   type: string
 */
app.post("/users/register", async (req, res) => {
  try {
    const { 
      socialId, 
      name, 
      province, 
      authMethod, // 'metamask' or 'generated'
      metamaskAddress 
    } = req.body;
    
    if (!socialId) return res.status(400).json({ error: "Missing socialId" });
    if (!name) return res.status(400).json({ error: "Missing name" });
    if (!province) return res.status(400).json({ error: "Missing province" });
    if (!authMethod) return res.status(400).json({ error: "Missing authMethod" });
    
    // Validate Dominican ID format: 000-0000000-0
    const dominicanIdRegex = /^\d{3}-\d{7}-\d{1}$/;
    if (!dominicanIdRegex.test(socialId)) {
      return res.status(400).json({ error: "Invalid Dominican ID format. Use: 000-0000000-0" });
    }
    
    if (users[socialId]) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Check if MetaMask address is already registered by another user
    if (authMethod === 'metamask' && metamaskAddress) {
      const existingUser = Object.entries(users).find(([id, userData]) => 
        userData.authMethod === 'metamask' && 
        userData.address && 
        userData.address.toLowerCase() === metamaskAddress.toLowerCase()
      );
      
      if (existingUser) {
        return res.status(400).json({ 
          error: "This MetaMask wallet is already registered to another user" 
        });
      }
    }

    let address, privateKey = null, fundTxHash = null;

    if (authMethod === 'metamask') {
      if (!metamaskAddress) {
        return res.status(400).json({ error: "Missing MetaMask address" });
      }
      address = metamaskAddress;
    } else if (authMethod === 'generated') {
      // Generate a new wallet
      const wallet = ethers.Wallet.createRandom();
      privateKey = wallet.privateKey;
      address = wallet.address;

      // Fund wallet with small amount for gas
      const relayerWallet = new ethers.Wallet(process.env.RELAYER_PK, provider);
      const fundTx = await relayerWallet.sendTransaction({
        to: address,
        value: ethers.parseEther("0.0000001"),
      });
      await fundTx.wait();
      fundTxHash = fundTx.hash;
    } else {
      return res.status(400).json({ error: "Invalid authMethod. Use 'metamask' or 'generated'" });
    }

    // Store user mapping with extended data
    users[socialId] = { 
      address, 
      privateKey, 
      name, 
      province, 
      authMethod,
      registeredAt: new Date().toISOString()
    };
    saveUsers();

    const response = { 
      socialId, 
      address, 
      name, 
      province, 
      authMethod,
      registeredAt: users[socialId].registeredAt
    };
    
    if (privateKey) response.privateKey = privateKey;
    if (fundTxHash) response.fundTxHash = fundTxHash;

    res.json(response);
  } catch (error) {
    console.error("User register error:", error.message || error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /users/{socialId}:
 *   get:
 *     summary: Get wallet info by social ID
 *     parameters:
 *       - in: path
 *         name: socialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 socialId:
 *                   type: string
 *                 address:
 *                   type: string
 */
app.get("/users/:socialId", (req, res) => {
  const { socialId } = req.params;
  const user = users[socialId];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ socialId, address: user.address });
});

/**
 * @swagger
 * /elections/{electionId}/has-voted/{socialId}:
 *   get:
 *     summary: Check if a user has voted in an election
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: socialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Voting status
 */
app.get("/elections/:electionId/has-voted/:socialId", async (req, res) => {
  try {
    const { electionId, socialId } = req.params;
    const user = users[socialId];
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check blockchain for voting status using the contract's hasVoted function
    try {
      const hasVoted = await votingContract.hasVoted(electionId, user.address);
      res.json({ hasVoted: hasVoted });
    } catch (contractError) {
      console.log("Contract call failed:", contractError.message);
      res.json({ hasVoted: false });
    }
  } catch (error) {
    console.error("Has voted check error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ================= Users =================

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all registered users (for login validation)
 *     responses:
 *       200:
 *         description: List of all registered users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   socialId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   address:
 *                     type: string
 *                   province:
 *                     type: string
 *                   authMethod:
 *                     type: string
 */
app.get("/users", (req, res) => {
  try {
    res.json(users);
  } catch (error) {
    console.error("Get users error:", error.message);
    res.status(500).json({ error: "Failed to retrieve users" });
  }
});

// ================= System Health =================

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get system health status
 *     responses:
 *       200:
 *         description: System health information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 services:
 *                   type: object
 */
app.get("/health", async (req, res) => {
  try {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: "online",
          message: "API server running"
        },
        database: {
          status: fs.existsSync(usersFile) ? "online" : "warning",
          message: fs.existsSync(usersFile) ? "Users database accessible" : "Users file not found",
          userCount: Object.keys(users).length
        },
        blockchain: {
          status: "checking",
          message: "Checking blockchain connection..."
        }
      }
    };

    // Test blockchain connection
    try {
      const blockNumber = await provider.getBlockNumber();
      health.services.blockchain = {
        status: "online",
        message: `Connected to block ${blockNumber}`,
        currentBlock: blockNumber
      };
    } catch (blockchainError) {
      health.services.blockchain = {
        status: "error",
        message: "Blockchain connection failed",
        error: blockchainError.message
      };
      health.status = "degraded";
    }

    res.json(health);
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({ 
      status: "error", 
      timestamp: new Date().toISOString(),
      error: error.message 
    });
  }
});

// ================= Election Management =================

/**
 * @swagger
 * /elections:
 *   get:
 *     summary: List all elections (IDs & names)
 *     responses:
 *       200:
 *         description: Array of elections
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   electionId:
 *                     type: integer
 *                   name:
 *                     type: string
 */
app.get("/elections", async (req, res) => {
  try {
    const list = [];
    const nextIdBN = await votingContract.nextElectionId();
    const nextId = Number(nextIdBN);
    for (let i = 1; i < nextId; i++) {
      const [name, _] = await votingContract.getElection(i);
      list.push({ electionId: i, name });
    }
    res.json(list);
  } catch (error) {
    console.error("List elections error:", error.message || error);
    res.status(500).json({ error: error.message });
  }
});

// ================= Election Management =================

/**
 * @swagger
 * /elections/create:
 *   post:
 *     summary: Create a new election (with start/end dates)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - candidates
 *               - startTime
 *               - endTime
 *             properties:
 *               name:
 *                 type: string
 *                 description: Display name of the election
 *               candidates:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of candidate names
 *               startTime:
 *                 type: integer
 *                 description: UNIX timestamp (in seconds) when voting opens
 *               endTime:
 *                 type: integer
 *                 description: UNIX timestamp (in seconds) when voting closes
 *     responses:
 *       200:
 *         description: Election created (tx hash + block)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 txHash:
 *                   type: string
 *                 blockNumber:
 *                   type: integer
 *       400:
 *         description: Bad request (e.g., missing fields or endTime ≤ startTime)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
app.post("/elections/create", async (req, res) => {
  try {
    const { name, candidates, startTime, endTime } = req.body;
    if (!name || !Array.isArray(candidates) || !startTime || !endTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (endTime <= startTime) {
      return res.status(400).json({ error: "endTime must be > startTime" });
    }

    const signer = new ethers.Wallet(process.env.RELAYER_PK, provider);
    const contractWithSigner = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      abi,
      signer
    );

    const tx = await contractWithSigner.createElection(
      name,
      candidates,
      startTime,
      endTime,
      {
        gasLimit: 500_000,
        maxFeePerGas: ethers.parseUnits("5", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      }
    );
    const receipt = await tx.wait();
    res.json({
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error) {
    console.error("Create election error:", error.message || error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /elections/{id}:
 *   get:
 *     summary: Get election details by ID (including start/end times and disabled flag)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Election ID
 *     responses:
 *       200:
 *         description: Election details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 electionId:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 candidates:
 *                   type: array
 *                   items:
 *                     type: string
 *                 startTime:
 *                   type: integer
 *                   description: UNIX timestamp (seconds)
 *                 endTime:
 *                   type: integer
 *                   description: UNIX timestamp (seconds)
 *                 disabled:
 *                   type: boolean
 *                   description: True if voting is disabled
 *       404:
 *         description: Election not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
app.get("/elections/:id", async (req, res) => {
  try {
    const electionId = parseInt(req.params.id, 10);
    const nextIdBN = await votingContract.nextElectionId();
    const nextId = Number(nextIdBN);
    if (electionId < 1 || electionId >= nextId) {
      return res.status(404).json({ error: "Election not found" });
    }
    let [name, candidates, startTime, endTime, disabled] =
      await votingContract.getElection(electionId);
    startTime = Number(startTime);
    endTime = Number(endTime);
    // console.log("Election details:", { electionId, name, candidates, startTime, endTime, disabled });
    res.json({ electionId, name, candidates, startTime, endTime, disabled });
  } catch (error) {
    console.error("Get election error:", error.message || error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /elections/{id}/disable:
 *   put:
 *     summary: Disable voting for an election
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Election ID
 *     responses:
 *       200:
 *         description: Election disabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 txHash:
 *                   type: string
 *                 blockNumber:
 *                   type: integer
 *       404:
 *         description: Election not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
app.put("/elections/:id/disable", async (req, res) => {
  try {
    const electionId = parseInt(req.params.id, 10);
    const nextIdBN = await votingContract.nextElectionId();
    const nextId = Number(nextIdBN);
    if (electionId < 1 || electionId >= nextId) {
      return res.status(404).json({ error: "Election not found" });
    }

    const signer = new ethers.Wallet(process.env.RELAYER_PK, provider);
    const contractWithSigner = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      abi,
      signer
    );

    const tx = await contractWithSigner.disableElection(electionId, {
      gasLimit: 100_000,
      maxFeePerGas: ethers.parseUnits("5", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
    });
    const receipt = await tx.wait();
    res.json({
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error) {
    console.error("Disable election error:", error.message || error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /elections/{id}/enable:
 *   put:
 *     summary: Re-enable voting for a disabled election
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Election ID
 *     responses:
 *       200:
 *         description: Election enabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 txHash:
 *                   type: string
 *                 blockNumber:
 *                   type: integer
 *       404:
 *         description: Election not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
app.put("/elections/:id/enable", async (req, res) => {
  try {
    const electionId = parseInt(req.params.id, 10);
    const nextIdBN = await votingContract.nextElectionId();
    const nextId = Number(nextIdBN);
    if (electionId < 1 || electionId >= nextId) {
      return res.status(404).json({ error: "Election not found" });
    }

    const signer = new ethers.Wallet(process.env.RELAYER_PK, provider);
    const contractWithSigner = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      abi,
      signer
    );

    const tx = await contractWithSigner.enableElection(electionId, {
      gasLimit: 100_000,
      maxFeePerGas: ethers.parseUnits("5", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
    });
    const receipt = await tx.wait();
    res.json({
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error) {
    console.error("Enable election error:", error.message || error);
    res.status(500).json({ error: error.message });
  }
});

// GET /elections/:id/results (no change needed for time/disabled—it’s read-only)

/**
 * @swagger
 * /elections/{id}/edit-name:
 *   put:
 *     summary: Change an existing election’s name
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Name updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 txHash:
 *                   type: string
 *                 blockNumber:
 *                   type: integer
 */
app.put("/elections/:id/edit-name", async (req, res) => {
  try {
    const electionId = parseInt(req.params.id, 10);
    const nextIdBN = await votingContract.nextElectionId();
    const nextId = Number(nextIdBN);
    if (electionId < 1 || electionId >= nextId) {
      return res.status(404).json({ error: "Election not found" });
    }
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Missing new name" });

    const signer = new ethers.Wallet(process.env.RELAYER_PK, provider);
    const contractWithSigner = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      abi,
      signer
    );

    const tx = await contractWithSigner.updateElectionName(electionId, name, {
      gasLimit: 100_000,
      maxFeePerGas: ethers.parseUnits("5", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
    });
    const receipt = await tx.wait();
    res.json({
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error) {
    console.error("Edit name error:", error.message || error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /elections/{id}/add-candidate:
 *   put:
 *     summary: Add a candidate to an existing election
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               candidate:
 *                 type: string
 *     responses:
 *       200:
 *         description: Candidate added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 txHash:
 *                   type: string
 *                 blockNumber:
 *                   type: integer
 */
app.put("/elections/:id/add-candidate", async (req, res) => {
  try {
    const electionId = parseInt(req.params.id, 10);
    const nextIdBN = await votingContract.nextElectionId();
    const nextId = Number(nextIdBN);
    if (electionId < 1 || electionId >= nextId) {
      return res.status(404).json({ error: "Election not found" });
    }
    const { candidate } = req.body;
    if (!candidate)
      return res.status(400).json({ error: "Missing candidate name" });

    const signer = new ethers.Wallet(process.env.RELAYER_PK, provider);
    const contractWithSigner = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      abi,
      signer
    );

    const tx = await contractWithSigner.addCandidate(electionId, candidate, {
      gasLimit: 100_000,
      maxFeePerGas: ethers.parseUnits("5", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
    });
    const receipt = await tx.wait();
    res.json({
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error) {
    console.error("Add candidate error:", error.message || error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /elections/{id}/results:
 *   get:
 *     summary: View current vote counts for an election
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Results by candidate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 */
app.get("/elections/:id/results", async (req, res) => {
  try {
    const electionId = parseInt(req.params.id, 10);
    const nextIdBN = await votingContract.nextElectionId();
    const nextId = Number(nextIdBN);
    if (electionId < 1 || electionId >= nextId) {
      return res.status(404).json({ error: "Election not found" });
    }

    const candidates = await votingContract.getCandidates(electionId);
    const results = {};
    for (let i = 0; i < candidates.length; i++) {
      const name = candidates[i];
      const countBN = await votingContract.getVoteCount(electionId, name);
      results[name] = Number(countBN);
    }
    res.json(results);
  } catch (error) {
    console.error("Get results error:", error.message || error);
    res.status(500).json({ error: error.message });
  }
});

// ================= Voting =================

/**
 * @swagger
 * /vote:
 *   post:
 *     summary: Vote in an election via social ID (meta-transaction)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               socialId:
 *                 type: string
 *               electionId:
 *                 type: integer
 *               candidate:
 *                 type: string
 *               signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vote submitted (txHash + block)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 txHash:
 *                   type: string
 *                 blockNumber:
 *                   type: integer
 */
app.post("/vote", async (req, res) => {
  try {
    console.log("Vote request received:", req.body);
    const { socialId, electionId, selectedCandidate, signature } = req.body;
    if (!socialId || !electionId || !selectedCandidate || !signature) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const user = users[socialId];
    if (!user) return res.status(400).json({ error: "User not registered" });

    const voterAddress = user.address;

    // Build message hash exactly as contract expects
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "string", "address", "address"],
      [electionId, selectedCandidate, voterAddress, contractAddress]
    );

    // Verify signature was signed by this user
    // Use getBytes() to match how the contract verifies (32-byte data, not string)
    const recovered = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
    console.log("Recovered address:", recovered);
    console.log("Voter address:", voterAddress);
    if (recovered.toLowerCase() !== voterAddress.toLowerCase()) {
      return res.status(400).json({ error: "Invalid signature for this user" });
    }

    // Forward to relayer
    const relayerUrl = "http://localhost:3001/meta-vote";
    const response = await axios.post(
      relayerUrl,
      {
        electionId,
        selectedCandidate,
        voter: voterAddress,
        signature,
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    const data = response.data; // axios already parses JSON, no need for .json()
    res.json(data);
  } catch (error) {
    console.error("Vote error:", error.message || error);
    res.status(500).json({ error: error.message });
  }
});

// ================= System Health Check =================

/**
 * @swagger
 * /health:
 *   get:
 *     summary: System health check
 *     responses:
 *       200:
 *         description: System status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 blockchain:
 *                   type: object
 *                 relayer:
 *                   type: object
 *                 users:
 *                   type: object
 */
app.get("/health", async (req, res) => {
  try {
    // Check blockchain connection
    const blockNumber = await provider.getBlockNumber();
    const contractCode = await provider.getCode(process.env.CONTRACT_ADDRESS);
    
    // Check users
    const userCount = Object.keys(users).length;
    
    // Check relayer
    let relayerStatus = "unknown";
    try {
      const relayerResponse = await axios.get("http://localhost:3001", { timeout: 2000 });
      relayerStatus = "running";
    } catch (error) {
      relayerStatus = "unreachable";
    }
    
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      blockchain: {
        network: "MegaETH Testnet",
        blockNumber: blockNumber,
        contractDeployed: contractCode !== "0x",
        contractAddress: process.env.CONTRACT_ADDRESS
      },
      relayer: {
        status: relayerStatus,
        port: 3001
      },
      users: {
        registered: userCount,
        storage: "local"
      },
      api: {
        version: "2.0.0",
        port: 3000
      }
    });
  } catch (error) {
    console.error("Health check error:", error.message);
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ================= Blockchain Analytics =================

/**
 * @swagger
 * /analytics/blockchain-timeline:
 *   get:
 *     summary: Get real blockchain voting timeline data
 *     responses:
 *       200:
 *         description: Blockchain voting timeline
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasRealData:
 *                   type: boolean
 *                 timelineData:
 *                   type: array
 *                 totalVotes:
 *                   type: integer
 *                 rawEvents:
 *                   type: array
 */
app.get("/analytics/blockchain-timeline", async (req, res) => {
  try {
    const { fetchRealBlockchainData } = require("../blockchain-data-fetcher");
    const result = await fetchRealBlockchainData();
    
    res.json({
      hasRealData: result.votes.length > 0,
      timelineData: result.votes,
      totalVotes: result.summary.totalVotes,
      totalElections: result.summary.totalElections,
      oldestElection: result.summary.oldestElection,
      rawEvents: result.votes
    });
  } catch (error) {
    console.error("Blockchain analytics error:", error.message);
    res.status(500).json({ 
      error: error.message,
      hasRealData: false,
      timelineData: [],
      totalVotes: 0
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🗳 API server running on http://localhost:${PORT}`);
});

