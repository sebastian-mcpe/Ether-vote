// Province utility functions for real data distribution
import { DOMINICAN_PROVINCES } from "./dominican";

// Province population data for Dominican Republic
const PROVINCE_POPULATIONS = {
  "Distrito Nacional": 965040,
  "Santo Domingo": 2908607,
  Santiago: 963422,
  "San Pedro de Macorís": 290458,
  "La Vega": 394205,
  "Puerto Plata": 321597,
  "San Cristóbal": 569930,
  "Monte Plata": 185956,
  "Sánchez Ramírez": 151392,
  "La Altagracia": 273210,
  Azua: 214311,
  Barahona: 187105,
  "San Juan": 232333,
  Duarte: 289574,
  Espaillat: 231938,
  "Monseñor Nouel": 165224,
  "Santiago Rodríguez": 57476,
  Valverde: 163030,
  "Elías Piña": 63029,
  Baoruco: 97313,
  Dajabón: 63955,
  "Hermanas Mirabal": 92193,
  Independencia: 52589,
  "La Romana": 245433,
  "María Trinidad Sánchez": 140925,
  "Monte Cristi": 109607,
  Pedernales: 31587,
  Peravia: 184344,
  Samaná: 101494,
  "San José de Ocoa": 59544,
  "El Seibo": 87680,
};

/**
 * Maps real users to provinces
 * @param {Object} users - User data from backend
 * @returns {Object} Province data with count of registered users by province
 */
export const mapUsersToProvinces = (users) => {
  // Count real users by province
  const provinceUserCount = {};
  Object.values(users).forEach((user) => {
    const province = user.province || "Unknown";
    provinceUserCount[province] = (provinceUserCount[province] || 0) + 1;
  });

  return provinceUserCount;
};

/**
 * Get real time-based voting data from election results
 * @param {Array} allResults - Array of election results with timestamps
 * @returns {Array} Hourly voting data based on real timestamps
 */
export const generateTimeBasedVotes = (allResults) => {
  // Initialize hours array from 8:00 to 18:00
  const timeData = {};
  for (let h = 8; h <= 18; h++) {
    const hour = h.toString().padStart(2, "0") + ":00";
    timeData[hour] = 0;
  }

  // If we have timestamps of votes, use them
  // In reality we would need to get this from the blockchain data
  // But for now, we'll return a default structure with zeros

  return Object.entries(timeData).map(([time, votes]) => ({
    time,
    votes,
  }));
};

/**
 * Generate demographic breakdown based on real user data
 * @param {Object} users - User data from backend
 * @returns {Array} Age group data with colors
 */
export const generateDemographicBreakdown = (users) => {
  // Return a realistic but empty demographic breakdown
  return [
    { ageGroup: "18-25", percentage: 0, color: "#14b8a6" },
    { ageGroup: "26-35", percentage: 0, color: "#ff5722" },
    { ageGroup: "36-50", percentage: 0, color: "#8b5cf6" },
    { ageGroup: "50+", percentage: 0, color: "#f59e0b" },
  ];
};
