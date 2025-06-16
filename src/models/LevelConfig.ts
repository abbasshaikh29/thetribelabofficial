import mongoose, { Schema, model, models } from "mongoose";

export interface ILevelConfig {
  _id?: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  levels: {
    level: number;
    name: string;
    pointsRequired: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const levelConfigSchema = new Schema<ILevelConfig>(
  {
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      unique: true, // One config per community
    },
    levels: [
      {
        level: { type: Number, required: true },
        name: { type: String, required: true },
        pointsRequired: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

// Note: communityId already has a unique index due to unique: true in schema definition
// No need for additional index creation

export const LevelConfig = models.LevelConfig || model<ILevelConfig>("LevelConfig", levelConfigSchema);

// Default level configuration
export const DEFAULT_LEVELS = [
  { level: 1, name: "Newbie", pointsRequired: 0 },
  { level: 2, name: "Contributor", pointsRequired: 5 },
  { level: 3, name: "Active Member", pointsRequired: 20 },
  { level: 4, name: "Engaged User", pointsRequired: 65 },
  { level: 5, name: "Community Helper", pointsRequired: 155 },
  { level: 6, name: "Expert", pointsRequired: 515 },
  { level: 7, name: "Mentor", pointsRequired: 2015 },
  { level: 8, name: "Leader", pointsRequired: 8015 },
  { level: 9, name: "Legend", pointsRequired: 33015 },
];
