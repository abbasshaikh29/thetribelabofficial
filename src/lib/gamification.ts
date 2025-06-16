import { dbconnect } from "@/lib/db";
import { User } from "@/models/User";
import { LevelConfig, DEFAULT_LEVELS } from "@/models/LevelConfig";
import mongoose from "mongoose";

export interface LevelInfo {
  level: number;
  name: string;
  pointsRequired: number;
  pointsToNext: number;
  progress: number; // 0-100 percentage to next level
}

export interface UserGamificationData {
  points: number;
  monthlyPoints: number;
  currentLevel: LevelInfo;
  nextLevel?: LevelInfo;
}

/**
 * Calculate user's current level based on points
 */
export function calculateLevel(points: number, levels = DEFAULT_LEVELS): LevelInfo {
  // Find the highest level the user qualifies for
  let currentLevel = levels[0];
  
  for (const level of levels) {
    if (points >= level.pointsRequired) {
      currentLevel = level;
    } else {
      break;
    }
  }

  // Calculate progress to next level
  const nextLevelIndex = levels.findIndex(l => l.level === currentLevel.level + 1);
  const nextLevel = nextLevelIndex !== -1 ? levels[nextLevelIndex] : null;
  
  let pointsToNext = 0;
  let progress = 100; // Default to 100% if at max level
  
  if (nextLevel) {
    pointsToNext = nextLevel.pointsRequired - points;
    const pointsInCurrentRange = points - currentLevel.pointsRequired;
    const totalPointsInRange = nextLevel.pointsRequired - currentLevel.pointsRequired;
    progress = Math.round((pointsInCurrentRange / totalPointsInRange) * 100);
  }

  return {
    level: currentLevel.level,
    name: currentLevel.name,
    pointsRequired: currentLevel.pointsRequired,
    pointsToNext,
    progress,
  };
}

/**
 * Get level configuration for a community
 */
export async function getLevelConfig(communityId: string) {
  await dbconnect();
  
  const config = await LevelConfig.findOne({ 
    communityId: new mongoose.Types.ObjectId(communityId) 
  });
  
  return config ? config.levels : DEFAULT_LEVELS;
}

/**
 * Award points to a user and update their level
 */
export async function awardPoints(userId: string, points: number, communityId?: string) {
  await dbconnect();
  
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Update points
  const newTotalPoints = (user.points || 0) + points;
  const newMonthlyPoints = (user.monthlyPoints || 0) + points;

  // Get level configuration
  const levels = communityId ? await getLevelConfig(communityId) : DEFAULT_LEVELS;
  
  // Calculate new level
  const levelInfo = calculateLevel(newTotalPoints, levels);

  // Update user
  await User.findByIdAndUpdate(userId, {
    points: newTotalPoints,
    monthlyPoints: newMonthlyPoints,
    level: levelInfo.level,
  });

  return {
    pointsAwarded: points,
    totalPoints: newTotalPoints,
    monthlyPoints: newMonthlyPoints,
    levelInfo,
    leveledUp: levelInfo.level > (user.level || 1),
  };
}

/**
 * Get user's gamification data
 */
export async function getUserGamificationData(userId: string, communityId?: string): Promise<UserGamificationData> {
  await dbconnect();
  
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const points = user.points || 0;
  const monthlyPoints = user.monthlyPoints || 0;
  
  // Get level configuration
  const levels = communityId ? await getLevelConfig(communityId) : DEFAULT_LEVELS;
  
  const currentLevel = calculateLevel(points, levels);
  const nextLevelIndex = levels.findIndex((l: any) => l.level === currentLevel.level + 1);
  const nextLevel = nextLevelIndex !== -1 ? calculateLevel(levels[nextLevelIndex].pointsRequired, levels) : undefined;

  return {
    points,
    monthlyPoints,
    currentLevel,
    nextLevel,
  };
}

/**
 * Reset monthly points for all users (to be run monthly)
 */
export async function resetMonthlyPoints() {
  await dbconnect();
  
  const now = new Date();
  await User.updateMany(
    {},
    {
      monthlyPoints: 0,
      lastPointsReset: now,
    }
  );
}

/**
 * Get leaderboard data
 */
export async function getLeaderboard(
  communityId: string,
  period: "7day" | "30day" | "alltime" = "30day",
  limit: number = 10
) {
  await dbconnect();
  
  const now = new Date();
  let matchStage: any = {};
  let sortField = "points";

  if (period === "7day") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    sortField = "weeklyPoints";
  } else if (period === "30day") {
    sortField = "monthlyPoints";
  }

  // Get level configuration for this community
  const levels = await getLevelConfig(communityId);

  const pipeline = [
    {
      $match: {
        community: new mongoose.Types.ObjectId(communityId),
        [sortField]: { $gt: 0 },
      },
    },
    {
      $sort: { [sortField]: -1 as const, createdAt: 1 as const },
    },
    {
      $limit: limit,
    },
    {
      $project: {
        _id: 1,
        username: 1,
        name: 1,
        profileImage: 1,
        points: 1,
        monthlyPoints: 1,
        level: 1,
      },
    },
  ];

  const users = await User.aggregate(pipeline);

  // Add level information and rank
  return users.map((user, index) => {
    const levelInfo = calculateLevel(user.points, levels);
    return {
      ...user,
      rank: index + 1,
      levelInfo,
      displayPoints: period === "alltime" ? user.points : user.monthlyPoints,
    };
  });
}
