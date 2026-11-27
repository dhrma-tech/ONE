// 27 achievements. Definitions live in code; unlocks are rows in achievement_unlocks.
export interface AchStats {
  pushDays: number;
  block1Days: number;
  overallStreak: number;
  bestStreak: number;
  reviews: number;
  unitsCracked: number;
  rapid: number | null;
  puzzlesSolved: number;
  meditationStreak: number;
  meditationSessions: number;
  workouts: number;
  weightGain: number | null;
  proteinWeek: boolean;
  postsPublished: number;
  realConversations: number;
  connections: number;
  recordings: number;
  booksFinished: number;
  gradeA: boolean;
  level: number;
}

export interface Achievement {
  code: string;
  title: string;
  desc: string;
  icon: "trophy" | "flame" | "code" | "chess" | "body" | "persona" | "book" | "star" | "bolt";
  test: (s: AchStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { code: "first_push", title: "Hello, world", desc: "First GitHub push logged.", icon: "code", test: (s) => s.pushDays >= 1 },
  { code: "first_block1", title: "Snake charmer", desc: "First Python Block 1 done.", icon: "code", test: (s) => s.block1Days >= 1 },
  { code: "block1_7", title: "Seven sessions", desc: "Block 1 done on 7 days.", icon: "code", test: (s) => s.block1Days >= 7 },
  { code: "block1_30", title: "Pythonista", desc: "Block 1 done on 30 days.", icon: "code", test: (s) => s.block1Days >= 30 },
  { code: "streak_7", title: "One week", desc: "7-day overall streak.", icon: "flame", test: (s) => s.bestStreak >= 7 },
  { code: "streak_30", title: "Thirty", desc: "30-day overall streak.", icon: "flame", test: (s) => s.bestStreak >= 30 },
  { code: "streak_100", title: "Centurion", desc: "100-day overall streak.", icon: "flame", test: (s) => s.bestStreak >= 100 },
  { code: "first_review", title: "Debrief", desc: "First nightly review submitted.", icon: "star", test: (s) => s.reviews >= 1 },
  { code: "reviews_30", title: "Logbook", desc: "30 nightly reviews.", icon: "star", test: (s) => s.reviews >= 30 },
  { code: "first_unit_cracked", title: "Cracked", desc: "First college unit cracked.", icon: "book", test: (s) => s.unitsCracked >= 1 },
  { code: "units_10", title: "Unit breaker", desc: "10 units cracked.", icon: "book", test: (s) => s.unitsCracked >= 10 },
  { code: "chess_1000_rapid", title: "Four digits", desc: "Chess.com rapid 1000+.", icon: "chess", test: (s) => (s.rapid ?? 0) >= 1000 },
  { code: "puzzles_100", title: "Puzzle box", desc: "100 chess events logged.", icon: "chess", test: (s) => s.puzzlesSolved >= 100 },
  { code: "meditation_7", title: "Still water", desc: "Meditated 7 days in a row.", icon: "star", test: (s) => s.meditationStreak >= 7 },
  { code: "meditation_30_sessions", title: "Monk mode", desc: "30 meditation sessions.", icon: "star", test: (s) => s.meditationSessions >= 30 },
  { code: "workouts_10", title: "Ten sessions", desc: "10 workouts logged.", icon: "body", test: (s) => s.workouts >= 10 },
  { code: "workouts_36", title: "Twelve weeks", desc: "36 workouts logged.", icon: "body", test: (s) => s.workouts >= 36 },
  { code: "gained_2kg", title: "Mass +2", desc: "Gained 2 kg from baseline.", icon: "body", test: (s) => (s.weightGain ?? 0) >= 2 },
  { code: "gained_5kg", title: "Mass +5", desc: "Gained 5 kg from baseline.", icon: "body", test: (s) => (s.weightGain ?? 0) >= 5 },
  { code: "protein_week", title: "Fed machine", desc: "Protein target 7 days in a week.", icon: "body", test: (s) => s.proteinWeek },
  { code: "first_post", title: "Hello, internet", desc: "First post published.", icon: "persona", test: (s) => s.postsPublished >= 1 },
  { code: "posts_10", title: "Signal", desc: "10 posts published.", icon: "persona", test: (s) => s.postsPublished >= 10 },
  { code: "conversations_10", title: "Talker", desc: "10 real conversations.", icon: "persona", test: (s) => s.realConversations >= 10 },
  { code: "connections_50", title: "Network", desc: "50 connections accepted.", icon: "persona", test: (s) => s.connections >= 50 },
  { code: "first_recording", title: "On air", desc: "First speaking recording.", icon: "persona", test: (s) => s.recordings >= 1 },
  { code: "books_3", title: "Bookworm", desc: "3 books finished.", icon: "book", test: (s) => s.booksFinished >= 3 },
  { code: "grade_a", title: "Straight A", desc: "A weekly grade of A.", icon: "trophy", test: (s) => s.gradeA },
  { code: "level_10", title: "Double digits", desc: "Reached level 10.", icon: "bolt", test: (s) => s.level >= 10 },
];

export const newlyUnlocked = (s: AchStats, unlocked: Set<string>): Achievement[] =>
  ACHIEVEMENTS.filter((a) => !unlocked.has(a.code) && a.test(s));
