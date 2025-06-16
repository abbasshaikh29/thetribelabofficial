"use client";

import React, { useState, useEffect } from "react";
import { Save, RotateCcw, Trophy } from "lucide-react";

interface Level {
  level: number;
  name: string;
  pointsRequired: number;
}

interface LevelManagementProps {
  communityId: string;
  onSave?: () => void;
}

const LevelManagement: React.FC<LevelManagementProps> = ({
  communityId,
  onSave,
}) => {
  const [levels, setLevels] = useState<Level[]>([]);
  const [originalLevels, setOriginalLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchLevels();
  }, [communityId]);

  const fetchLevels = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/gamification/levels?communityId=${communityId}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch levels");
      }

      const data = await response.json();
      setLevels(data.levels);
      setOriginalLevels(data.levels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleLevelNameChange = (index: number, name: string) => {
    const updatedLevels = [...levels];
    updatedLevels[index] = { ...updatedLevels[index], name };
    setLevels(updatedLevels);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch("/api/gamification/levels", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          communityId,
          levels,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save level configuration");
      }

      const data = await response.json();
      setLevels(data.levels);
      setOriginalLevels(data.levels);
      setSuccess(true);
      
      if (onSave) {
        onSave();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLevels([...originalLevels]);
    setError(null);
    setSuccess(false);
  };

  const hasChanges = JSON.stringify(levels) !== JSON.stringify(originalLevels);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 rounded w-1/3" style={{ backgroundColor: 'var(--bg-tertiary)' }}></div>
        {[...Array(9)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <div className="w-16 h-10 rounded" style={{ backgroundColor: 'var(--bg-tertiary)' }}></div>
            <div className="flex-1 h-10 rounded" style={{ backgroundColor: 'var(--bg-tertiary)' }}></div>
            <div className="w-24 h-10 rounded" style={{ backgroundColor: 'var(--bg-tertiary)' }}></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Level Management
        </h3>
      </div>

      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-accent)', border: '1px solid var(--border-color)' }}>
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
          <strong>Note:</strong> You can customize the names of each level, but the point requirements are fixed to ensure fairness across all communities.
        </p>
      </div>

      {error && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-accent)', border: '1px solid var(--brand-error)', borderColor: 'var(--brand-error)' }}>
          <p className="text-sm" style={{ color: 'var(--brand-error)' }}>{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-accent)', border: '1px solid var(--brand-success)', borderColor: 'var(--brand-success)' }}>
          <p className="text-sm" style={{ color: 'var(--brand-success)' }}>
            Level configuration saved successfully!
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-4 text-sm font-medium pb-2 border-b" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}>
          <div>Level</div>
          <div>Custom Name</div>
          <div>Points Required</div>
        </div>

        {levels.map((level, index) => (
          <div key={level.level} className="grid grid-cols-3 gap-4 items-center">
            <div className="flex items-center gap-2">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold
                  ${level.level <= 2 ? "bg-gray-500" : ""}
                  ${level.level > 2 && level.level <= 4 ? "bg-blue-500" : ""}
                  ${level.level > 4 && level.level <= 6 ? "bg-purple-500" : ""}
                  ${level.level > 6 && level.level <= 8 ? "bg-orange-500" : ""}
                  ${level.level === 9 ? "bg-gradient-to-r from-yellow-400 to-orange-500" : ""}
                `}
              >
                {level.level}
              </div>
            </div>

            <div>
              <input
                type="text"
                value={level.name}
                onChange={(e) => handleLevelNameChange(index, e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-transparent transition-colors"
                style={{
                  borderColor: 'var(--border-color)',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)'
                }}
                placeholder={`Level ${level.level} name`}
              />
            </div>

            <div className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              {level.pointsRequired.toLocaleString()} points
            </div>
          </div>
        ))}
      </div>

      {hasChanges && (
        <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--brand-primary)' }}
            onMouseOver={(e) => !saving && (e.currentTarget.style.opacity = '0.9')}
            onMouseOut={(e) => !saving && (e.currentTarget.style.opacity = '1')}
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>

          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--text-tertiary)' }}
            onMouseOver={(e) => !saving && (e.currentTarget.style.opacity = '0.9')}
            onMouseOut={(e) => !saving && (e.currentTarget.style.opacity = '1')}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export default LevelManagement;
