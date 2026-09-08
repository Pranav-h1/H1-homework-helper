// Quotes Factory — the full quote vault. Every quote's wording is preserved exactly as
// provided; ids are stable so favorites/sharing never break across edits to this list.
// To add more quotes later, just append objects with a new unique id.

export const CATEGORY_LABELS = {
  ideas: "Ideas & Creativity",
  starting: "Starting",
  thinking: "Thinking",
  building: "Building",
  action: "Action & Execution",
  learning: "Learning",
  growth: "Growth",
  impact: "Impact",
  leadership: "Leadership",
  future: "Future & Vision",
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function make(category, texts, startIndex) {
  return texts.map((text, i) => ({
    id: `q${String(startIndex + i).padStart(3, "0")}`,
    text,
    category,
  }));
}

const IDEAS = [
  "Every idea begins with a moment of curiosity.",
  "Creativity sees beyond the obvious.",
  "A new perspective can create a new possibility.",
  "Ideas grow when imagination meets purpose.",
  "Think of possibilities before limitations.",
  "Creativity turns ordinary moments into opportunities.",
  "Your best idea might begin with a strange question.",
  "Imagine first. Improve next.",
  "Great ideas often hide behind simple observations.",
  "Creativity begins when you stop accepting the obvious.",
  "A different question can reveal a different future.",
  "Imagination gives possibility a shape.",
  "Every new idea expands what is possible.",
  "Think freely. Build purposefully.",
  "Creativity is the courage to see another way.",
  "An original thought can become an extraordinary creation.",
  "Ideas become stronger when curiosity challenges them.",
  "The imagination has no finish line.",
  "Look at familiar things with unfamiliar eyes.",
  "The spark of creation begins with ‘What if?’",
];

const STARTING = [
  "Every journey begins before the destination is clear.",
  "Beginning is a skill worth learning.",
  "Start with a question, then search for the answer.",
  "You only need enough courage for the first step.",
  "A beginning doesn’t need to be impressive. It needs to happen.",
  "Start where you are. Build from there.",
  "The first version is simply the beginning of the next.",
  "Momentum begins with movement.",
  "A rough beginning can lead to a remarkable result.",
  "Don’t wait for the map to take the first step.",
  "Starting creates possibilities that planning alone cannot.",
  "Begin with what you know. Discover the rest.",
  "Every builder once had nothing but an idea.",
  "The beginning is where potential becomes visible.",
  "Start small enough to begin and think big enough to continue.",
  "The hardest part of creating is often deciding to begin.",
  "Your first step creates the road ahead.",
  "Start imperfectly. Learn deliberately.",
  "Nothing becomes real until someone begins.",
  "Every great creation has a first attempt.",
];

const THINKING = [
  "Think deeper than the first answer.",
  "Smart thinking begins with better questions.",
  "Look twice. Think differently.",
  "Challenge your assumptions before challenging the world.",
  "The strongest thinkers stay open to being wrong.",
  "Think beyond the problem to the possibility.",
  "A flexible mind can find unexpected paths.",
  "Good ideas come from seeing connections others miss.",
  "Think critically. Create creatively.",
  "Question the limits before accepting them.",
  "Your perspective can be your greatest creative tool.",
  "Think from the user’s point of view.",
  "Different thinking creates different outcomes.",
  "Don’t settle for the first solution.",
  "Better thinking leads to better building.",
  "Think about why before deciding how.",
  "The best solutions often require a change in perspective.",
  "Think clearly. Act intentionally.",
  "Challenge ideas, not curiosity.",
  "A powerful mind keeps exploring.",
];

const BUILDING = [
  "Build ideas strong enough to face reality.",
  "Creation turns possibility into something people can experience.",
  "Build, observe, improve.",
  "Make the idea tangible.",
  "A prototype is a question you can test.",
  "Build to learn, not just to prove.",
  "Every version teaches you what the next should become.",
  "Builders learn by making.",
  "Turn concepts into experiences.",
  "The real world is the ultimate testing ground.",
  "Make something. Test something. Learn something.",
  "Build with the user in mind.",
  "A prototype transforms imagination into evidence.",
  "Build less perfectly and learn more quickly.",
  "The strongest creations evolve.",
  "Building is thinking with your hands.",
  "Turn your blueprint into your first version.",
  "Creation begins when ideas become tangible.",
  "Build something worth improving.",
  "Every version is a conversation with reality.",
];

const ACTION = [
  "Execution gives ideas their chance to matter.",
  "Move from thinking about it to doing something about it.",
  "Action creates information.",
  "Progress prefers movement.",
  "Do the next useful thing.",
  "Turn intention into action.",
  "Plans become powerful when they meet action.",
  "Make progress visible.",
  "One action can unlock another.",
  "Action is where learning accelerates.",
  "Don’t confuse preparation with progress.",
  "Make the first move.",
  "Turn possibility into practice.",
  "Do something today that your future idea needs.",
  "Execution transforms potential into progress.",
  "A moving project can teach you more than a perfect plan.",
  "Take the next step, then discover the one after it.",
  "Action creates momentum. Momentum creates opportunity.",
  "Make your ideas earn their next step.",
  "Progress happens when ideas leave your head.",
];

const LEARNING = [
  "Every experience can become a lesson.",
  "Learn the principle, not just the process.",
  "Knowledge becomes powerful when you apply it.",
  "Learn by questioning. Grow by experimenting.",
  "The best entrepreneurs are relentless learners.",
  "Learning is an advantage that compounds.",
  "Every challenge can expand your skill set.",
  "Learn something. Apply it. Improve it.",
  "Curiosity keeps your skills moving forward.",
  "The smartest builder is always still learning.",
  "Experience turns knowledge into judgment.",
  "Learning gives ideas stronger foundations.",
  "Never stop upgrading your thinking.",
  "Every experiment is a lesson with results.",
  "Learn from people, patterns, and problems.",
  "Knowledge opens doors. Curiosity finds new ones.",
  "Keep learning beyond what you already know.",
  "The ability to learn is an entrepreneurial advantage.",
  "Every question is a chance to learn something useful.",
  "Learn deeply. Apply boldly.",
];

const GROWTH = [
  "Growth is built one improvement at a time.",
  "Better is a direction, not a destination.",
  "Small improvements can create enormous momentum.",
  "Growth begins when feedback becomes fuel.",
  "Improve what works. Replace what doesn’t.",
  "Every iteration is an opportunity to grow.",
  "Progress compounds.",
  "Keep improving the process behind the result.",
  "Growth belongs to those willing to adapt.",
  "The next level begins with the next lesson.",
  "Improve the idea without losing the purpose.",
  "Progress is proof that learning is happening.",
  "Small changes can unlock big possibilities.",
  "Build momentum through continuous improvement.",
  "Growth is what happens when curiosity meets consistency.",
  "Keep the vision. Improve the version.",
  "Every better version starts with an honest look at the current one.",
  "Progress loves patience.",
  "Keep moving, keep learning, keep improving.",
  "Your next version can be better than your last.",
];

const IMPACT = [
  "Build for a reason bigger than the product.",
  "Value begins with understanding people.",
  "Impact is measured by the difference you create.",
  "Make useful things beautifully useful.",
  "A meaningful solution starts with meaningful understanding.",
  "Build something people are genuinely glad exists.",
  "Good ideas create value. Great ideas create lasting value.",
  "Solve real needs with thoughtful solutions.",
  "Impact begins with empathy.",
  "Create value where it matters most.",
  "The best solutions fit into real lives.",
  "Build for people, improve for people.",
  "Purpose gives innovation direction.",
  "Make every creation answer a real need.",
  "Great products begin with great understanding.",
  "Useful ideas have a way of traveling.",
  "Create something that earns its place in someone’s life.",
  "The goal is not simply to create, but to contribute.",
  "Solve thoughtfully. Build responsibly.",
  "Real impact starts with real people.",
];

const LEADERSHIP = [
  "Leadership turns possibility into shared purpose.",
  "A leader creates direction without limiting imagination.",
  "Listen widely. Decide wisely.",
  "Great leadership begins with curiosity.",
  "Lead with purpose and leave room for ideas.",
  "Strong leaders build strong thinkers.",
  "Leadership is creating conditions for others to succeed.",
  "A leader doesn’t need every answer.",
  "Bring people together around meaningful problems.",
  "The best leaders make learning contagious.",
  "Lead by creating clarity.",
  "Leadership grows through responsibility.",
  "A shared vision can turn individuals into a team.",
  "Good leadership listens. Great leadership learns.",
  "Lead with confidence, learn with humility.",
  "The strongest teams are built on trust and purpose.",
  "Leadership is influence guided by responsibility.",
  "Make people feel capable of contributing.",
  "A leader sees potential in people and possibilities in problems.",
  "Lead forward, not merely from the front.",
];

const FUTURE = [
  "The future begins as an idea someone is willing to pursue.",
  "Tomorrow is shaped by today’s imagination.",
  "Vision gives possibility a destination.",
  "Imagine the future, then work backward.",
  "The future is built by people who refuse to stop exploring.",
  "Tomorrow’s opportunities are hidden inside today’s questions.",
  "Create for the world that is coming.",
  "A better future needs better ideas.",
  "The future rewards adaptable minds.",
  "See beyond today without forgetting today’s problems.",
  "Future thinking begins with present action.",
  "Build with tomorrow in mind.",
  "The future belongs to people who keep experimenting.",
  "Imagine farther than the current limits.",
  "Your ideas can become part of someone else’s tomorrow.",
  "Don’t inherit the future. Help design it.",
  "The next chapter belongs to those willing to write it.",
  "Tomorrow has room for ideas that don’t exist today.",
  "The future is an invitation to create.",
  "Don’t just imagine what comes next. Help make it happen.",
];

export const QUOTES = [
  ...make("ideas", IDEAS, 1),
  ...make("starting", STARTING, 21),
  ...make("thinking", THINKING, 41),
  ...make("building", BUILDING, 61),
  ...make("action", ACTION, 81),
  ...make("learning", LEARNING, 101),
  ...make("growth", GROWTH, 121),
  ...make("impact", IMPACT, 141),
  ...make("leadership", LEADERSHIP, 161),
  ...make("future", FUTURE, 181),
];

// A small hand-picked highlight set surfaced as "H1 Favorites" — a real curated view, not a
// separate quote list, so every quote here is still the exact same object from QUOTES above.
export const H1_FAVORITE_IDS = new Set([
  "q020", // The spark of creation begins with 'What if?'
  "q037", // Your first step creates the road ahead.
  "q100", // Progress happens when ideas leave your head.
  "q139", // Keep moving, keep learning, keep improving.
  "q196", // Don't inherit the future. Help design it.
  "q181", // The future begins as an idea someone is willing to pursue.
  "q005", // Think of possibilities before limitations.
  "q101", // Every experience can become a lesson.
  "q161", // Leadership turns possibility into shared purpose.
  "q200", // Don't just imagine what comes next. Help make it happen.
]);

export function isShortAndPowerful(text) {
  return text.length <= 32;
}
