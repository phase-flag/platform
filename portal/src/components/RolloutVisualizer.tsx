import { useState, useMemo } from 'react';

function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

function getUserBucket(userId: string, flagKey: string): number {
  const hash = djb2Hash(`${flagKey}:${userId}`);
  return hash % 100;
}

interface User {
  id: string;
  name: string;
  bucket: number;
}

export default function RolloutVisualizer() {
  const [percentage, setPercentage] = useState(25);
  const [flagKey, setFlagKey] = useState('new_checkout');

  const users: User[] = useMemo(() => {
    const names = [
      'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank',
      'Ivy', 'Jack', 'Kate', 'Leo', 'Mia', 'Noah', 'Olivia', 'Pete',
      'Quinn', 'Rosa', 'Sam', 'Tina', 'Uma', 'Vic', 'Wendy', 'Xander',
      'Yara', 'Zane', 'Alex', 'Beth', 'Carl', 'Dina', 'Erik', 'Fay',
      'Gus', 'Hal', 'Iris', 'Jay', 'Kim', 'Lars', 'Maya', 'Nate',
      'Ola', 'Pat', 'Rae', 'Sid', 'Tara', 'Uri', 'Val', 'Wes', 'Xia', 'Yuri',
    ];
    return names.map((name) => {
      const id = `user_${name.toLowerCase()}`;
      return { id, name, bucket: getUserBucket(id, flagKey) };
    });
  }, [flagKey]);

  const bucketDistribution = useMemo(() => {
    const buckets = new Array(10).fill(0);
    users.forEach((u) => {
      buckets[Math.floor(u.bucket / 10)]++;
    });
    return buckets;
  }, [users]);

  const included = users.filter((u) => u.bucket < percentage);
  const excluded = users.filter((u) => u.bucket >= percentage);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[#E8F0F2] mb-2">
          Flag Key
        </label>
        <input
          type="text"
          value={flagKey}
          onChange={(e) => setFlagKey(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-[#1C2D38] text-[#E8F0F2] border border-[rgba(99,102,241,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-pf-primary/50 focus:border-pf-primary placeholder-[#8FA3AD]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[#E8F0F2]">
            Rollout Percentage
          </label>
          <span className="text-2xl font-heading font-light text-pf-primary">
            {percentage}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={percentage}
          onChange={(e) => setPercentage(Number(e.target.value))}
          className="w-full h-2 bg-[#1C2D38] rounded-lg appearance-none cursor-pointer accent-pf-primary"
        />
        <div className="flex justify-between text-xs text-[#8FA3AD] mt-1">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Rollout bar */}
      <div className="bg-[#162029] rounded-xl p-4">
        <h4 className="text-sm font-medium text-[#E8F0F2] mb-3">Rollout Distribution</h4>
        <div className="h-8 rounded-lg overflow-hidden flex bg-[#1C2D38]">
          <div
            className="bg-pf-primary transition-all duration-500 flex items-center justify-center text-white text-xs font-medium"
            style={{ width: `${percentage}%` }}
          >
            {percentage > 10 && `${included.length} users`}
          </div>
          <div className="flex-1 flex items-center justify-center text-[#8FA3AD] text-xs">
            {percentage < 90 && `${excluded.length} users`}
          </div>
        </div>
      </div>

      {/* Bucket histogram */}
      <div className="bg-[#162029] rounded-xl p-4">
        <h4 className="text-sm font-medium text-[#E8F0F2] mb-3">DJB2 Hash Bucket Distribution</h4>
        <div className="flex items-end gap-1 h-24">
          {bucketDistribution.map((count, i) => {
            const rangeStart = i * 10;
            const rangeEnd = rangeStart + 9;
            const isIncluded = rangeEnd < percentage;
            const isPartial = rangeStart < percentage && rangeEnd >= percentage;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-[#8FA3AD]">{count}</span>
                <div
                  className={`w-full rounded-t transition-colors ${
                    isIncluded
                      ? 'bg-pf-primary'
                      : isPartial
                        ? 'bg-pf-primary/40'
                        : 'bg-[#1C2D38]'
                  }`}
                  style={{ height: `${Math.max(count * 12, 4)}px` }}
                />
                <span className="text-[10px] text-[#8FA3AD]">{rangeStart}-{rangeEnd}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* User grid */}
      <div className="bg-[#162029] rounded-xl p-4">
        <h4 className="text-sm font-medium text-[#E8F0F2] mb-3">
          User Assignments ({included.length} included, {excluded.length} excluded)
        </h4>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {users.map((user) => {
            const isIn = user.bucket < percentage;
            return (
              <div
                key={user.id}
                className={`flex flex-col items-center p-1.5 rounded-lg text-[10px] transition-all ${
                  isIn
                    ? 'bg-pf-primary/10 text-pf-primary border border-pf-primary/30'
                    : 'bg-[#1C2D38] text-[#8FA3AD] border border-[rgba(99,102,241,0.15)]'
                }`}
                title={`${user.name}: bucket ${user.bucket}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-0.5 ${
                  isIn ? 'bg-pf-primary text-white' : 'bg-[#0F1A20] text-[#8FA3AD]'
                }`}>
                  {user.name[0]}
                </div>
                <span className="truncate w-full text-center">{user.name}</span>
                <span className="opacity-60">#{user.bucket}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
