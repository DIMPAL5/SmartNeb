/**
 * GamificationService
 * Manages pediatric gamification profiles, stars, balloon inflations, streaks,
 * and milestone badge achievements ("Breathe With Bunny").
 */

const { PrismaClient } = require("@prisma/client");

const DEFAULT_ACHIEVEMENTS = [
  {
    code: "FIRST_TREATMENT",
    title: "First Breath",
    description: "Completed your first nebulizer session with Bunny!",
    badgeIcon: "star",
  },
  {
    code: "STREAK_3_DAY",
    title: "3-Day Hero",
    description: "Completed your breathing sessions 3 days in a row!",
    badgeIcon: "award",
  },
  {
    code: "STREAK_7_DAY",
    title: "Super Breather",
    description: "A full week of breathing treatments completed on schedule!",
    badgeIcon: "shield-check",
  },
  {
    code: "TREATMENT_CHAMPION",
    title: "Treatment Champion",
    description: "Reached 50 breathing stars! True pediatric champion!",
    badgeIcon: "trophy",
  },
];

class GamificationService {
  constructor(prismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Seed default achievements if they don't exist
   */
  async ensureAchievements() {
    for (const ach of DEFAULT_ACHIEVEMENTS) {
      await this.prisma.achievement.upsert({
        where: { code: ach.code },
        update: {},
        create: ach,
      });
    }
  }

  /**
   * Get or initialize patient gamification profile
   */
  async getProfile(patientId) {
    if (!patientId) throw new Error("patientId is required");
    await this.ensureAchievements();

    let profile = await this.prisma.gamificationProfile.findUnique({
      where: { patientId },
    });

    if (!profile) {
      profile = await this.prisma.gamificationProfile.create({
        data: {
          patientId,
          character: "bunny",
          starsCount: 0,
          currentStreak: 0,
          bestStreak: 0,
          balloonsInflated: 0,
        },
      });
    }

    // Get earned achievements
    const unlocked = await this.prisma.treatmentAchievement.findMany({
      where: { patientId },
      include: { achievement: true },
    });

    const allAchievements = await this.prisma.achievement.findMany();

    const badges = allAchievements.map((a) => {
      const match = unlocked.find((u) => u.achievementId === a.id);
      return {
        id: a.id,
        code: a.code,
        title: a.title,
        description: a.description,
        badgeIcon: a.badgeIcon,
        unlocked: !!match,
        unlockedAt: match ? match.unlockedAt : null,
      };
    });

    return {
      profile,
      badges,
    };
  }

  /**
   * Update character choice (e.g. 'bunny', 'bear', 'elephant')
   */
  async updateCharacter(patientId, character) {
    const validCharacters = ["bunny", "bear", "elephant"];
    const char = validCharacters.includes(character.toLowerCase())
      ? character.toLowerCase()
      : "bunny";

    return await this.prisma.gamificationProfile.upsert({
      where: { patientId },
      update: { character: char },
      create: { patientId, character: char },
    });
  }

  /**
   * Record session completion and reward stars & streaks
   */
  async recordSessionCompletion({ patientId, durationSeconds = 600, adherenceRatio = 1.0 }) {
    if (!patientId) throw new Error("patientId is required");
    await this.ensureAchievements();

    const { profile } = await this.getProfile(patientId);

    // Calculate stars: 5 stars for full completion + bonus 2 stars for high adherence
    const earnedStars = adherenceRatio >= 0.8 ? 5 : 3;
    const now = new Date();

    // Calculate streak
    let newCurrentStreak = profile.currentStreak;
    if (profile.lastSessionDate) {
      const lastDate = new Date(profile.lastSessionDate);
      const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
      if (diffDays === 1) {
        newCurrentStreak += 1;
      } else if (diffDays > 1) {
        newCurrentStreak = 1;
      }
    } else {
      newCurrentStreak = 1;
    }

    const newBestStreak = Math.max(profile.bestStreak, newCurrentStreak);
    const updatedStars = profile.starsCount + earnedStars;
    const updatedBalloons = profile.balloonsInflated + 1;

    const updatedProfile = await this.prisma.gamificationProfile.update({
      where: { patientId },
      data: {
        starsCount: updatedStars,
        currentStreak: newCurrentStreak,
        bestStreak: newBestStreak,
        balloonsInflated: updatedBalloons,
        lastSessionDate: now,
      },
    });

    // Check Badge Unlocks
    const newlyUnlocked = [];

    const unlockBadge = async (code) => {
      const ach = await this.prisma.achievement.findUnique({ where: { code } });
      if (ach) {
        try {
          const unlocked = await this.prisma.treatmentAchievement.create({
            data: { patientId, achievementId: ach.id },
            include: { achievement: true },
          });
          newlyUnlocked.push(unlocked.achievement);
        } catch (e) {
          // already unlocked
        }
      }
    };

    // First Treatment
    if (updatedBalloons >= 1) await unlockBadge("FIRST_TREATMENT");
    // 3-Day streak
    if (newCurrentStreak >= 3) await unlockBadge("STREAK_3_DAY");
    // 7-Day streak
    if (newCurrentStreak >= 7) await unlockBadge("STREAK_7_DAY");
    // Treatment champion
    if (updatedStars >= 50 || newCurrentStreak >= 14) await unlockBadge("TREATMENT_CHAMPION");

    return {
      starsEarned: earnedStars,
      totalStars: updatedStars,
      currentStreak: newCurrentStreak,
      balloonsInflated: updatedBalloons,
      newlyUnlockedBadges: newlyUnlocked,
      character: updatedProfile.character,
    };
  }
}

module.exports = GamificationService;
