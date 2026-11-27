// Daily quote rotation. Real quotes carry their correct source; everything attributed to "ONE" is original.
// Never invent a quote and attribute it to a real person.
export interface Quote {
  text: string;
  by: string;
  source?: string;
}

export const QUOTES: Quote[] = [
  { text: "Waste no more time arguing about what a good man should be. Be one.", by: "Marcus Aurelius", source: "Meditations" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", by: "Marcus Aurelius", source: "Meditations" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", by: "Seneca", source: "On the Shortness of Life" },
  { text: "First say to yourself what you would be; and then do what you have to do.", by: "Epictetus", source: "Discourses" },
  { text: "Well done is better than well said.", by: "Benjamin Franklin", source: "Poor Richard's Almanack" },
  { text: "Simplicity is prerequisite for reliability.", by: "Edsger W. Dijkstra" },
  { text: "Talk is cheap. Show me the code.", by: "Linus Torvalds" },
  { text: "Make it work, make it right, make it fast.", by: "Kent Beck" },
  { text: "Discipline equals freedom.", by: "Jocko Willink" },
  { text: "Who's gonna carry the boats?", by: "David Goggins" },
  { text: "I don't have dreams, I have goals.", by: "Harvey Specter", source: "Suits" },
  { text: "Do not go gentle into that good night.", by: "Dylan Thomas" },
  { text: "Amaze! Amaze! Amaze!", by: "Rocky", source: "Project Hail Mary" },
  { text: "Fist my bump.", by: "Rocky", source: "Project Hail Mary" },
  { text: "The best time to plant a tree was twenty years ago. The second best time is now.", by: "Proverb" },
  { text: "Write badly. Make it work. Ask for review. Rewrite it yourself.", by: "ONE", source: "house rule" },
  { text: "Block 1 first. Everything else is a side quest.", by: "ONE", source: "house rule" },
  { text: "Tomorrow is not a time. Pick one.", by: "ONE" },
  { text: "Never miss twice.", by: "ONE", source: "house rule" },
  { text: "Twenty minutes counts. Zero does not.", by: "ONE" },
  { text: "The feed is optional. The reps are not.", by: "ONE" },
  { text: "Nobody is coming. Open the editor.", by: "ONE" },
  { text: "You don't rise to the plan. You fall to the habit.", by: "ONE" },
  { text: "Stuck is a stage, not a verdict.", by: "ONE" },
  { text: "Small daily pushes beat heroic weekends.", by: "ONE" },
  { text: "Be the person the commit history says you are.", by: "ONE" },
  { text: "Discomfort is the entry fee. Pay it early.", by: "ONE" },
  { text: "Protein before excuses.", by: "ONE" },
  { text: "Sleep is part of the training plan.", by: "ONE" },
  { text: "Say it in English, say it slower, say it once.", by: "ONE" },
  { text: "Clear ending, lower voice, then silence.", by: "ONE" },
  { text: "Ask about their work. Never about a job.", by: "ONE" },
  { text: "Confidence is evidence you collected on purpose.", by: "ONE" },
  { text: "Ship something today. Even if it's small.", by: "ONE" },
  { text: "If it isn't written down, it didn't happen.", by: "ONE" },
  { text: "Focus is a muscle. This is the gym.", by: "ONE" },
  { text: "The phone can wait in the other room.", by: "ONE" },
  { text: "Hard problems first. Easy wins later.", by: "ONE" },
  { text: "Read the error message. All of it.", by: "ONE" },
  { text: "Twenty-five minutes before asking. Then ask why, not fix.", by: "ONE", source: "stuck protocol" },
  { text: "The plan is a draft. The reps are final.", by: "ONE" },
  { text: "Good posture is a decision you make every hour.", by: "ONE" },
  { text: "Train like the lift is the easy part. It is.", by: "ONE" },
  { text: "One more set of reps beats one more video.", by: "ONE" },
  { text: "Calm is a skill. Practice it daily.", by: "ONE" },
  { text: "You don't need motivation. You need a start time.", by: "ONE" },
  { text: "Bad day? Minimum viable day. Block 1. Done.", by: "ONE" },
  { text: "Make the next action so small you can't refuse it.", by: "ONE" },
  { text: "Learn the fundamentals until they are boring.", by: "ONE" },
  { text: "Every concept: one thing shipped, one thing shared.", by: "ONE", source: "house rule" },
  { text: "The internet won't know you exist unless you post.", by: "ONE" },
  { text: "Earn the episode. Then enjoy it.", by: "ONE" },
  { text: "Quiet days build loud results.", by: "ONE" },
  { text: "Respect the boring work. It pays rent.", by: "ONE" },
  { text: "Lights out on time is a rep too.", by: "ONE" },
  { text: "Rephrase and keep going. No restarts.", by: "ONE", source: "speaking rule" },
  { text: "Your future self is reading this log. Make it a good read.", by: "ONE" },
  { text: "Consistency compounds. Intensity evaporates.", by: "ONE" },
  { text: "Gravity wins sometimes. Not twice.", by: "ONE" },
  { text: "Logged. Now go sleep, Cooper.", by: "ONE" },
];

/** Same quote all day, rotating daily. */
export function quoteOfDay(iso: string): Quote {
  const n = Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000);
  return QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
