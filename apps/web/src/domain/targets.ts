// Every numeric target in one place. Stored in settings.targets; all editable in Settings › Targets.
export interface Targets {
  block1_min: number;
  exam_study_min: number;
  calories: number;
  protein_low: number;
  protein_high: number;
  water_ml: number | null; // deliberately unset until Dharma enters it
  meditation_min: number;
  flashcards_new_per_day: number;
  flashcards_reviews_done: number;
  english_min: number;
  outreach_per_day: number;
  companies_per_day: number;
  connections_per_week: number;
  conversations_per_week: number;
  posts_linkedin_week: number;
  posts_x_week: number;
  articles_per_2_weeks: number;
  gym_days: number[]; // 0=Sun..6=Sat
  gym_time: string;
  gym_sessions_week: number;
  focus_block_min: number;
  lights_out: string; // "00:15" = 12:15 AM counts for the grade
  review_time: string;
  weekly_review_time: string;
  books_per_month: number;
}

export const DEFAULT_TARGETS: Targets = {
  block1_min: 90,
  exam_study_min: 120,
  calories: 2600,
  protein_low: 90,
  protein_high: 100,
  water_ml: null,
  meditation_min: 10,
  flashcards_new_per_day: 5,
  flashcards_reviews_done: 10,
  english_min: 10,
  outreach_per_day: 10,
  companies_per_day: 3,
  connections_per_week: 70,
  conversations_per_week: 2,
  posts_linkedin_week: 2,
  posts_x_week: 3,
  articles_per_2_weeks: 1,
  gym_days: [1, 3, 5],
  gym_time: "06:30",
  gym_sessions_week: 3,
  focus_block_min: 25,
  lights_out: "00:15",
  review_time: "23:30",
  weekly_review_time: "08:00",
  books_per_month: 1,
};

export const withDefaults = (t: Partial<Targets> | null | undefined): Targets => ({ ...DEFAULT_TARGETS, ...(t ?? {}) });

export const TARGET_LABELS: Record<keyof Targets, string> = {
  block1_min: "Python Block 1 minimum (min)",
  exam_study_min: "Exam-mode study minimum (min)",
  calories: "Calories per day (kcal)",
  protein_low: "Protein low (g)",
  protein_high: "Protein high (g)",
  water_ml: "Water per day (ml)",
  meditation_min: "Meditation per day (min)",
  flashcards_new_per_day: "New flashcards per day (max)",
  flashcards_reviews_done: "Flashcard reviews for 'done'",
  english_min: "English speaking per day (min)",
  outreach_per_day: "Connection requests per day",
  companies_per_day: "Companies read per day",
  connections_per_week: "Connection requests per week",
  conversations_per_week: "Real conversations per week",
  posts_linkedin_week: "LinkedIn posts per week",
  posts_x_week: "X posts per week",
  articles_per_2_weeks: "Articles per 2 weeks",
  gym_days: "Gym days",
  gym_time: "Gym time",
  gym_sessions_week: "Gym sessions per week",
  focus_block_min: "Phone-free focus block (min)",
  lights_out: "Lights out by",
  review_time: "Nightly review time",
  weekly_review_time: "Sunday review time",
  books_per_month: "Books per month",
};
