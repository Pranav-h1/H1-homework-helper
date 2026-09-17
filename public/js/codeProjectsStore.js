// Things the student builds: websites and Python programs.
//
// Same shape as every other H1 store: plain records in localStorage, space-tagged, never
// silently dropped. A website is three files (HTML, CSS, JS) because that's what a real page
// is. A Python program is one file plus the input it reads. Records from before Python
// projects existed have no `kind`, and are websites.
import { safeGetJson, safeSetJson } from "./storage.js";
import { currentSpaceTag, matchesCurrentSpace } from "./spacesStore.js";

const KEY = "h1-code-projects";
const MAX_PROJECTS = 100;
// Comfortably more than any hand-written page needs, and well short of the point where
// localStorage starts failing.
const MAX_FILE_CHARS = 60000;

function uid() {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readAll() {
  const list = safeGetJson(KEY, []);
  return Array.isArray(list) ? list : [];
}

function writeAll(list) {
  safeSetJson(KEY, list);
  return list;
}

function clamp(text) {
  return String(text == null ? "" : text).slice(0, MAX_FILE_CHARS);
}

export const TEMPLATES = [
  {
    id: "blank",
    name: "Blank page",
    blurb: "An empty page to start from.",
    html: "<h1>Hello</h1>\n<p>Start building.</p>\n",
    css: "body {\n  font-family: system-ui, sans-serif;\n  margin: 2rem;\n}\n",
    js: "",
  },
  {
    id: "profile",
    name: "About me page",
    blurb: "A personal page with a header, sections and a footer.",
    html:
      '<header>\n  <h1>Your Name</h1>\n  <p class="tagline">Student · Builder · Curious about everything</p>\n</header>\n\n' +
      '<main>\n  <section>\n    <h2>About</h2>\n    <p>Write a couple of sentences about yourself here.</p>\n  </section>\n\n' +
      '  <section>\n    <h2>Things I like</h2>\n    <ul>\n      <li>Something</li>\n      <li>Something else</li>\n      <li>One more</li>\n    </ul>\n  </section>\n</main>\n\n' +
      "<footer>\n  <p>Built with H1</p>\n</footer>\n",
    css:
      "body {\n  font-family: system-ui, sans-serif;\n  line-height: 1.6;\n  max-width: 680px;\n  margin: 0 auto;\n  padding: 2rem 1.25rem;\n  color: #1a1a1a;\n}\n\n" +
      "header {\n  border-bottom: 2px solid #eee;\n  padding-bottom: 1rem;\n  margin-bottom: 2rem;\n}\n\n" +
      "h1 {\n  margin: 0 0 .25rem;\n}\n\n.tagline {\n  color: #666;\n  margin: 0;\n}\n\n" +
      "section {\n  margin-bottom: 2rem;\n}\n\nfooter {\n  border-top: 1px solid #eee;\n  padding-top: 1rem;\n  color: #888;\n  font-size: .9rem;\n}\n",
    js: "",
  },
  {
    id: "cards",
    name: "Card grid",
    blurb: "A responsive grid of cards — the layout behind most real sites.",
    html:
      '<h1>My projects</h1>\n<div class="grid">\n' +
      '  <article class="card">\n    <h2>First</h2>\n    <p>A short description.</p>\n  </article>\n' +
      '  <article class="card">\n    <h2>Second</h2>\n    <p>A short description.</p>\n  </article>\n' +
      '  <article class="card">\n    <h2>Third</h2>\n    <p>A short description.</p>\n  </article>\n</div>\n',
    css:
      "body {\n  font-family: system-ui, sans-serif;\n  margin: 2rem;\n  color: #1a1a1a;\n}\n\n" +
      ".grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 1rem;\n}\n\n" +
      ".card {\n  border: 1px solid #e5e5e5;\n  border-radius: 12px;\n  padding: 1.25rem;\n  background: #fff;\n  box-shadow: 0 1px 3px rgba(0,0,0,.06);\n}\n\n" +
      ".card h2 {\n  margin-top: 0;\n  font-size: 1.1rem;\n}\n\n" +
      "@media (max-width: 700px) {\n  .grid {\n    grid-template-columns: 1fr;\n  }\n}\n",
    js: "",
  },
  {
    id: "interactive",
    name: "Interactive counter",
    blurb: "A page that responds to clicks — HTML, CSS and JavaScript together.",
    html:
      '<div class="app">\n  <h1>Counter</h1>\n  <p class="count" id="count">0</p>\n  <div class="buttons">\n' +
      '    <button id="down">−</button>\n    <button id="up">+</button>\n    <button id="reset" class="ghost">Reset</button>\n  </div>\n</div>\n',
    css:
      "body {\n  font-family: system-ui, sans-serif;\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n  margin: 0;\n  background: #0f172a;\n  color: #f8fafc;\n}\n\n" +
      ".app {\n  text-align: center;\n}\n\n" +
      ".count {\n  font-size: 4rem;\n  font-weight: 700;\n  margin: .5rem 0 1.5rem;\n}\n\n" +
      ".buttons {\n  display: flex;\n  gap: .5rem;\n  justify-content: center;\n}\n\n" +
      "button {\n  font-size: 1.1rem;\n  padding: .6rem 1.2rem;\n  border-radius: 8px;\n  border: none;\n  background: #38bdf8;\n  color: #0f172a;\n  cursor: pointer;\n}\n\n" +
      "button.ghost {\n  background: transparent;\n  color: #94a3b8;\n  border: 1px solid #334155;\n}\n",
    js:
      "let count = 0;\nconst display = document.querySelector('#count');\n\n" +
      "function render() {\n  display.textContent = count;\n}\n\n" +
      "document.querySelector('#up').addEventListener('click', () => {\n  count++;\n  render();\n});\n\n" +
      "document.querySelector('#down').addEventListener('click', () => {\n  count--;\n  render();\n});\n\n" +
      "document.querySelector('#reset').addEventListener('click', () => {\n  count = 0;\n  render();\n});\n",
  },
];

export const PY_TEMPLATES = [
  {
    id: "py-blank",
    name: "Blank program",
    blurb: "An empty Python file.",
    py: `# My program
print("Hello!")
`,
    stdin: "",
  },
  {
    id: "py-calculator",
    name: "Calculator",
    blurb: "Reads two numbers and an operator, and handles mistakes.",
    py: `def calculate(a, op, b):
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op == "*":
        return a * b
    if op == "/":
        if b == 0:
            return "Can't divide by zero"
        return a / b
    return "Unknown operator"

a = float(input("First number: "))
op = input("Operator (+ - * /): ")
b = float(input("Second number: "))
print("Answer:", calculate(a, op, b))
`,
    stdin: `12
*
4`,
  },
  {
    id: "py-guess",
    name: "Guessing game",
    blurb: "Guess the secret number, with higher/lower clues.",
    py: `import random

secret = random.randint(1, 20)
print("I'm thinking of a number from 1 to 20.")

for attempt in range(1, 6):
    guess = int(input("Your guess: "))
    if guess < secret:
        print("Higher!")
    elif guess > secret:
        print("Lower!")
    else:
        print(f"Got it in {attempt}!")
        break
else:
    print(f"Out of guesses — it was {secret}.")
`,
    stdin: `10
5
15
12
8`,
  },
  {
    id: "py-study",
    name: "Study tracker",
    blurb: "Log study sessions and see totals per subject.",
    py: `sessions = [
    ("Maths", 30),
    ("Science", 20),
    ("Maths", 15),
    ("English", 25),
]

totals = {}
for subject, minutes in sessions:
    totals[subject] = totals.get(subject, 0) + minutes

print("Study time by subject")
for subject, minutes in sorted(totals.items(), key=lambda item: item[1], reverse=True):
    bar = "#" * (minutes // 5)
    print(f"{subject:<10} {minutes:>3} min  {bar}")

print("Total:", sum(totals.values()), "minutes")
`,
    stdin: "",
  },
];

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || PY_TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}

export function projectKind(project) {
  return project && project.kind === "python" ? "python" : "web";
}

export class ProjectLimitError extends Error {
  constructor() {
    super(`You have ${MAX_PROJECTS} projects, which is the most H1 can keep. Delete one you don't need to make room.`);
    this.name = "ProjectLimitError";
  }
}

export function getProjects() {
  return readAll().filter((p) => matchesCurrentSpace(p.spaceId));
}

export function getProject(id) {
  return readAll().find((p) => p.id === id) || null;
}

// At the limit this throws rather than quietly dropping the oldest project to make room — an
// old project disappearing because a new one was made is exactly the kind of loss nobody
// notices until they need it.
export function createProject({ name, templateId = "blank", kind, py, stdin, source } = {}) {
  const tpl = getTemplate(templateId);
  const isPython = kind === "python" || (kind === undefined && typeof tpl.py === "string");
  const list = readAll();
  if (list.length >= MAX_PROJECTS) throw new ProjectLimitError();
  const base = {
    id: uid(),
    name: (name || tpl.name || (isPython ? "Untitled program" : "Untitled site")).trim().slice(0, 80),
    favorite: false,
    spaceId: currentSpaceTag(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const record = isPython
    ? { ...base, kind: "python", py: clamp(py !== undefined ? py : tpl.py || ""), stdin: clamp(stdin !== undefined ? stdin : tpl.stdin || ""), ...(source ? { source } : {}) }
    : { ...base, html: clamp(tpl.html), css: clamp(tpl.css), js: clamp(tpl.js) };
  list.unshift(record);
  writeAll(list);
  return record;
}

export function updateProject(id, patch) {
  const list = readAll();
  const p = list.find((x) => x.id === id);
  if (!p) return null;
  if (typeof patch.name === "string") p.name = patch.name.trim().slice(0, 80) || p.name;
  if (typeof patch.html === "string") p.html = clamp(patch.html);
  if (typeof patch.css === "string") p.css = clamp(patch.css);
  if (typeof patch.js === "string") p.js = clamp(patch.js);
  if (typeof patch.py === "string") p.py = clamp(patch.py);
  if (typeof patch.stdin === "string") p.stdin = clamp(patch.stdin);
  if (typeof patch.favorite === "boolean") p.favorite = patch.favorite;
  p.updatedAt = Date.now();
  writeAll(list);
  return p;
}

export function deleteProject(id) {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function duplicateProject(id) {
  const src = getProject(id);
  if (!src) return null;
  const list = readAll();
  if (list.length >= MAX_PROJECTS) throw new ProjectLimitError();
  const copy = { ...src, id: uid(), name: `${src.name} copy`.slice(0, 80), createdAt: Date.now(), updatedAt: Date.now() };
  list.unshift(copy);
  writeAll(list);
  return copy;
}

export function clearAllProjects() {
  writeAll([]);
}

// Assembles the three files into one standalone .html the student can save and open
// anywhere — the whole point of building a site is being able to take it away.
export function exportProjectHtml(project) {
  const title = project.name || "My page";
  const escaped = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaped}</title>
<style>
${project.css || ""}
</style>
</head>
<body>
${project.html || ""}
<script>
${project.js || ""}
</${"script"}>
</body>
</html>
`;
}

export function projectFileName(project, ext) {
  return `${(project.name || "project").replace(/[^a-z0-9\-_ ]/gi, "").trim() || "project"}.${ext}`;
}

export { MAX_FILE_CHARS, MAX_PROJECTS };
