// Python errors, explained for a beginner.
//
// Deterministic on purpose: it reads the real error type and message and says what they mean,
// so it works with the AI offline and can't make something up. The real traceback is always
// shown alongside it — hiding the actual error would teach a student nothing about reading
// errors themselves. "Ask H1" is there for anything this doesn't cover.

function q(text) {
  return `"${text}"`;
}

// Each rule: match the error type (and optionally the message), then build an explanation.
// `m` is the regex match against the message, `e` the summarised error.
const RULES = [
  {
    type: "LoadError",
    explain: () => ({
      title: "Python couldn't load",
      what: "H1 downloads Python the first time you use it, and that download didn't finish. Your code didn't get to run.",
      why: "Usually there's no internet connection right now, or the network is blocking the download.",
      fix: "Check your connection, then press Run again — H1 will retry. Once Python has loaded once, your browser keeps a copy.",
    }),
  },
  {
    type: "WorkerError",
    explain: () => ({
      title: "Python stopped unexpectedly",
      what: "The part of H1 that runs Python crashed, so your program didn't finish. This isn't a mistake in your code.",
      why: "Something went wrong inside the browser — it can happen if the device runs low on memory.",
      fix: "Press Run again. H1 has already restarted Python for you.",
    }),
  },
  {
    type: "Timeout",
    explain: () => ({
      title: "Your program never finished",
      what: "The code kept running for longer than 10 seconds, so H1 stopped it.",
      why: "Almost always a loop whose condition never becomes false — a while loop where nothing inside it changes the value being tested.",
      fix: "Look at your loop's condition, then check that something inside the loop moves it towards being false (for example `count += 1`). If the program waits for input, add the lines it needs in the Input box.",
    }),
  },
  {
    type: "EOFError",
    explain: () => ({
      title: "Your program asked for more input than it was given",
      what: "input() was called, but there were no lines left in the Input box to give it.",
      why: "In H1, input() reads the lines you type in the Input box, one line per call. Your code called input() more times than there are lines.",
      fix: "Open the Input box and add one line for every input() your program asks for, in order.",
    }),
  },
  {
    type: "SyntaxError",
    match: /expected ':'/,
    explain: (e) => ({
      title: "A colon is missing",
      what: `Python expected a colon ( : ) on line ${e.line || "?"} and didn't find one.`,
      why: "Lines that start a block — if, elif, else, for, while, def, class, try, except — must end with a colon.",
      fix: `Add a colon at the end of line ${e.line || "the line shown"}${e.codeLine ? `, so it reads ${q(e.codeLine.replace(/\s*$/, "") + ":")}` : ""}.`,
    }),
  },
  {
    type: "SyntaxError",
    match: /Missing parentheses in call to '(\w+)'/,
    explain: (e, m) => ({
      title: `${m[1]} needs brackets`,
      what: `${m[1]} is being used without brackets on line ${e.line || "?"}.`,
      why: `In Python 3, ${m[1]} is a function, so what you want it to use has to go inside ( ).`,
      fix: `Write ${m[1]}(...) — for example print("Hello") instead of print "Hello".`,
    }),
  },
  {
    type: "SyntaxError",
    match: /unterminated string literal|EOL while scanning string literal|unterminated triple-quoted string/,
    explain: (e) => ({
      title: "A quote was never closed",
      what: `Text on line ${e.line || "?"} starts with a quote mark but doesn't end with one.`,
      why: "A string has to open and close with the same kind of quote: 'like this' or \"like this\".",
      fix: "Find the start of the text and add the matching closing quote. If the text itself contains an apostrophe, wrap it in double quotes instead.",
    }),
  },
  {
    type: "SyntaxError",
    match: /'(\(|\[|\{)' was never closed/,
    explain: (e, m) => ({
      title: `A ${m[1]} was never closed`,
      what: `There's an opening ${m[1]} on line ${e.line || "?"} without a matching closing bracket.`,
      why: "Every ( [ { needs its partner ) ] }. Python keeps reading to find it, which is why the error sometimes points a line or two later.",
      fix: `Count the brackets on that line and add the missing ${{ "(": ")", "[": "]", "{": "}" }[m[1]]}.`,
    }),
  },
  {
    type: "SyntaxError",
    match: /unmatched '(\)|\]|\})'/,
    explain: (e, m) => ({
      title: `An extra ${m[1]}`,
      what: `There's a closing ${m[1]} on line ${e.line || "?"} with no opening bracket to match.`,
      why: "Brackets come in pairs. One too many closing brackets means one is left with nothing to close.",
      fix: "Remove the extra closing bracket, or add the opening one that's missing earlier on the line.",
    }),
  },
  {
    type: "SyntaxError",
    match: /cannot assign to|can't assign to/,
    explain: (e) => ({
      title: "Something is on the wrong side of =",
      what: `Line ${e.line || "?"} tries to store a value in something that can't hold one.`,
      why: "A single = means \"store the right side in the name on the left\". The left side has to be a variable name. To compare two things, use == instead.",
      fix: "If you meant to compare, change = to ==. If you meant to store a value, put the variable name on the left: total = a + b.",
    }),
  },
  {
    type: "SyntaxError",
    match: /Perhaps you forgot a comma/,
    explain: (e) => ({
      title: "Probably a missing comma",
      what: `Two values on line ${e.line || "?"} are next to each other with nothing between them.`,
      why: "Items in a list, or arguments to a function, have to be separated by commas.",
      fix: "Add a comma between the items: [1, 2, 3] or print(\"a\", \"b\").",
    }),
  },
  {
    type: "SyntaxError",
    explain: (e) => ({
      title: "Python couldn't understand this line",
      what: `Something on line ${e.line || "?"} isn't valid Python, so the program didn't start at all.`,
      why: "Syntax errors are about how the code is written, not what it does — a missing bracket, quote or colon, or a misspelled keyword. Python checks all of this before running anything.",
      fix: "Read the line carefully, and the line above it (the real mistake is often one line earlier). Check for missing brackets, quotes, colons and commas.",
    }),
  },
  {
    type: "IndentationError",
    match: /expected an indented block/,
    explain: (e) => ({
      title: "This block is empty",
      what: `The line before line ${e.line || "?"} ends with a colon, but the next line isn't indented under it.`,
      why: "After if, for, while, def and the like, Python expects the code that belongs to them to be indented (usually 4 spaces).",
      fix: `Indent line ${e.line || "the next line"} by 4 spaces. If the block really should do nothing for now, write pass there.`,
    }),
  },
  {
    type: "IndentationError",
    match: /unexpected indent/,
    explain: (e) => ({
      title: "This line is indented when it shouldn't be",
      what: `Line ${e.line || "?"} starts further to the right than Python expected.`,
      why: "Indentation in Python means \"this belongs to the block above\". A line indented without a block to belong to is an error.",
      fix: `Move line ${e.line || "that line"} back so it lines up with the code around it.`,
    }),
  },
  {
    type: "IndentationError",
    match: /unindent does not match/,
    explain: (e) => ({
      title: "The indentation doesn't line up",
      what: `Line ${e.line || "?"} is indented by an amount that doesn't match any block above it.`,
      why: "When you finish a block, you have to come back to exactly the same indentation as an earlier line.",
      fix: "Line this line up exactly with the line it belongs with. Use 4 spaces per level, consistently.",
    }),
  },
  {
    type: "TabError",
    explain: (e) => ({
      title: "Tabs and spaces are mixed",
      what: `Line ${e.line || "?"} mixes tab characters and spaces for indentation.`,
      why: "They can look identical on screen but Python counts them differently.",
      fix: "Re-indent the block using only spaces. In H1's editor, Tab always inserts spaces, so deleting and re-typing the indentation fixes it.",
    }),
  },
  {
    type: "NameError",
    match: /name '(\w+)' is not defined/,
    explain: (e, m) => {
      const name = m[1];
      const keywordCase = { Print: "print", Input: "input", True: null, true: "True", false: "False", none: "None", Len: "len", Range: "range" };
      const hint = keywordCase[name] ? ` Python is case-sensitive — did you mean ${keywordCase[name]}?` : "";
      return {
        title: `Python doesn't know what ${name} is`,
        what: `On line ${e.line || "?"}, the name ${name} is used, but nothing called ${name} exists yet.${hint}`,
        why: `A name has to be created (e.g. ${name} = ...) or defined (def ${name}(...)) before it's used. Common causes: a typo, different capital letters, using it before the line that creates it, or text that was meant to be in quotes.`,
        fix: `Check the spelling and capitals of ${name}. If it's a variable, make sure it's given a value on an earlier line. If it's meant to be text, put it in quotes: "${name}".`,
      };
    },
  },
  {
    type: "UnboundLocalError",
    explain: (e) => ({
      title: "A variable is used before it's set inside a function",
      what: `On line ${e.line || "?"}, a function uses a variable before giving it a value.`,
      why: "Assigning to a name anywhere inside a function makes it local to that function — so reading it before that assignment fails, even if a variable with the same name exists outside.",
      fix: "Pass the value in as a parameter and return the new value, or give the variable a starting value at the top of the function.",
    }),
  },
  {
    type: "TypeError",
    match: /can only concatenate str \(not "(\w+)"\) to str/,
    explain: (e, m) => ({
      title: `Text and ${m[1] === "int" ? "a number" : m[1]} can't be joined with +`,
      what: `Line ${e.line || "?"} uses + to join text with a ${m[1]}.`,
      why: "+ joins two pieces of text, or adds two numbers — but it won't guess what you want when you mix them.",
      fix: `Turn the ${m[1]} into text with str(...), e.g. "Age: " + str(age). Or use an f-string: f"Age: {age}".`,
    }),
  },
  {
    type: "TypeError",
    match: /unsupported operand type\(s\) for ([^:]+): '(\w+)' and '(\w+)'/,
    explain: (e, m) => ({
      title: `${m[1].trim()} doesn't work between ${m[2]} and ${m[3]}`,
      what: `Line ${e.line || "?"} tries ${m[1].trim()} with a ${m[2]} and a ${m[3]}.`,
      why: m[2] === "str" || m[3] === "str"
        ? "One of the values is text. input() always gives you text, even when someone types a number."
        : "Those two types can't be combined with that operator.",
      fix: m[2] === "str" || m[3] === "str"
        ? "Convert the text to a number first: int(value) for whole numbers, float(value) for decimals."
        : "Check what each value actually is — print(type(x)) shows you — and convert one of them.",
    }),
  },
  {
    type: "TypeError",
    match: /'(\w+)' object is not callable/,
    explain: (e, m) => ({
      title: `A ${m[1]} was used like a function`,
      what: `Line ${e.line || "?"} puts ( ) after something that's a ${m[1]}, not a function.`,
      why: `This often happens when a variable reuses a built-in name — e.g. writing list = [1, 2] and later calling list(...), or sum = 0 and later sum(...).`,
      fix: "Rename your variable so it doesn't share its name with the function you're trying to call.",
    }),
  },
  {
    type: "TypeError",
    match: /missing (\d+) required positional argument/,
    explain: (e, m) => ({
      title: "A function was called with too few values",
      what: `Line ${e.line || "?"} calls a function without giving it ${m[1]} of the values it needs.`,
      why: "When a function is defined with parameters, each call has to supply a value for every one that doesn't have a default.",
      fix: "Look at the def line to see how many parameters it expects, and pass that many values in the call.",
    }),
  },
  {
    type: "TypeError",
    match: /takes (\d+) positional arguments? but (\d+) (?:were|was) given/,
    explain: (e, m) => ({
      title: "A function was called with too many values",
      what: `Line ${e.line || "?"} passes ${m[2]} values to a function that only takes ${m[1]}.`,
      why: "The number of values in the call has to match the number of parameters in the def line.",
      fix: "Either remove the extra values from the call, or add parameters to the function definition.",
    }),
  },
  {
    type: "TypeError",
    match: /'NoneType' object is not (subscriptable|iterable)/,
    explain: (e) => ({
      title: "Something came back as None",
      what: `On line ${e.line || "?"}, a value you're using turned out to be None — nothing.`,
      why: "Functions that don't reach a return statement give back None. Methods like list.sort() and list.append() also change the list in place and return None.",
      fix: "Make sure your function returns its result. And don't store the result of .sort() or .append() — call them on their own line.",
    }),
  },
  {
    type: "TypeError",
    match: /'(\w+)' object is not iterable/,
    explain: (e, m) => ({
      title: `You can't loop over a ${m[1]}`,
      what: `Line ${e.line || "?"} tries to loop over (or unpack) a ${m[1]}.`,
      why: m[1] === "int" ? "A number isn't a collection of things. To repeat something n times, loop over range(n)." : "Only collections — lists, strings, dictionaries, ranges — can be looped over.",
      fix: m[1] === "int" ? "Use for i in range(n): instead of for i in n:." : "Loop over a list, string or range instead.",
    }),
  },
  {
    type: "TypeError",
    explain: (e) => ({
      title: "A value was the wrong type for what you did with it",
      what: `Line ${e.line || "?"} used a value of one type where a different type was needed.`,
      why: "Python won't silently convert between text, numbers and lists — mixing them raises this error.",
      fix: "Use print(type(value)) to see what each value really is, then convert with int(), float(), str() or list() as needed.",
    }),
  },
  {
    type: "ValueError",
    match: /invalid literal for int\(\) with base 10: '([^']*)'/,
    explain: (e, m) => ({
      title: `${q(m[1])} can't be turned into a whole number`,
      what: `Line ${e.line || "?"} calls int() on ${q(m[1])}, which isn't a whole number.`,
      why: m[1].includes(".") ? "int() only accepts whole numbers. Text with a decimal point needs float() first." : "int() only works on text that's made entirely of digits.",
      fix: m[1].includes(".") ? "Use float(...) instead, or int(float(...)) if you need a whole number." : "Check what's actually being converted. If it comes from input(), make sure the Input box has a number on that line.",
    }),
  },
  {
    type: "ValueError",
    match: /could not convert string to float: '([^']*)'/,
    explain: (e, m) => ({
      title: `${q(m[1])} isn't a number`,
      what: `Line ${e.line || "?"} calls float() on ${q(m[1])}.`,
      why: "float() needs text that looks like a number, such as \"3.5\" or \"12\".",
      fix: "Check the value being converted — if it comes from input(), put a number on that line of the Input box.",
    }),
  },
  {
    type: "ValueError",
    explain: (e) => ({
      title: "A value was the right type but not an acceptable one",
      what: `Line ${e.line || "?"} gave a function a value it couldn't use.`,
      why: "The type was fine (for example, it was text) but its content wasn't valid for that operation.",
      fix: "Print the value just before this line to see exactly what it is.",
    }),
  },
  {
    type: "ZeroDivisionError",
    explain: (e) => ({
      title: "Dividing by zero",
      what: `Line ${e.line || "?"} divides by a value that is 0.`,
      why: "Division by zero has no answer, so Python refuses. Often the value is 0 because a list was empty or a counter never went up.",
      fix: "Check the number you divide by before dividing: if count > 0: average = total / count.",
    }),
  },
  {
    type: "IndexError",
    match: /(list|string|tuple) index out of range/,
    explain: (e, m) => ({
      title: `That position doesn't exist in the ${m[1]}`,
      what: `Line ${e.line || "?"} asks for a position past the end of a ${m[1]}.`,
      why: `Positions start at 0, so a ${m[1]} of length 3 has positions 0, 1 and 2 — asking for [3] is one too far.`,
      fix: `The last item is at [len(x) - 1], or simply [-1]. When looping, use for item in x: or range(len(x)).`,
    }),
  },
  {
    type: "KeyError",
    match: /^KeyError: (.+)$/,
    explain: (e, m) => ({
      title: `The dictionary has no key ${m[1]}`,
      what: `Line ${e.line || "?"} looks up ${m[1]} in a dictionary that doesn't contain it.`,
      why: "Keys have to match exactly — including capital letters, spaces, and whether it's text or a number.",
      fix: `Check the spelling of the key. To look something up safely, use d.get(${m[1]}) (gives None if missing), or check first with if ${m[1]} in d:.`,
    }),
  },
  {
    type: "AttributeError",
    match: /'(\w+)' object has no attribute '(\w+)'/,
    explain: (e, m) => {
      const hints = {
        "str.append": "Strings can't be changed in place. Build a new string with +, or use a list and ''.join() at the end.",
        "NoneType": "The value is None — usually because a function didn't return anything, or you stored the result of .sort() or .append().",
        "list.push": "Python lists use .append(), not .push().",
        "dict.append": "Dictionaries don't have .append(). Add a key with d[key] = value.",
        "int.append": "A number isn't a list. Did you mean to create a list first, e.g. items = []?",
      };
      const key = hints[`${m[1]}.${m[2]}`] ? `${m[1]}.${m[2]}` : m[1] === "NoneType" ? "NoneType" : null;
      return {
        title: `A ${m[1]} doesn't have .${m[2]}`,
        what: `Line ${e.line || "?"} uses .${m[2]} on a value that's a ${m[1]}.`,
        why: key ? hints[key] : `Each type has its own set of methods, and ${m[1]} doesn't include ${m[2]}. Often the value isn't the type you expected.`,
        fix: key ? "See above — then run it again." : `Check the spelling of .${m[2]}, and print(type(value)) to confirm what the value really is.`,
      };
    },
  },
  {
    type: "ModuleNotFoundError",
    match: /No module named '([\w.]+)'/,
    explain: (e, m) => ({
      title: `Module ${m[1]} isn't available`,
      what: `Line ${e.line || "?"} imports ${m[1]}, which H1's Python doesn't have.`,
      why: "H1 runs Python in your browser with the standard library — math, random, datetime, json, statistics and so on — but it can't install extra packages from the internet.",
      fix: `Check the spelling of ${m[1]}. If it's a third-party package, this exercise can be done with the standard library instead.`,
    }),
  },
  {
    type: "ImportError",
    explain: (e) => ({
      title: "That import didn't work",
      what: `Line ${e.line || "?"} imports a name that the module doesn't contain.`,
      why: "Either the name is misspelled, or it lives in a different module.",
      fix: "Check the spelling, or import the whole module and use module.name.",
    }),
  },
  {
    type: "RecursionError",
    explain: () => ({
      title: "A function kept calling itself forever",
      what: "A function called itself so many times that Python stopped it.",
      why: "A recursive function needs a base case — a condition where it stops calling itself and returns a value directly.",
      fix: "Add an if at the top of the function that returns without recursing, and make sure every call moves closer to that case.",
    }),
  },
  {
    type: "FileNotFoundError",
    match: /No such file or directory: '([^']+)'/,
    explain: (e, m) => ({
      title: `There's no file called ${m[1]}`,
      what: `Line ${e.line || "?"} opens ${q(m[1])} for reading, but it doesn't exist.`,
      why: "Opening with \"r\" (the default) reads an existing file. In H1, each run starts with an empty folder unless the lesson provides files.",
      fix: "Create the file first — open it with \"w\" and write to it — or check the filename's spelling.",
    }),
  },
  {
    type: "AssertionError",
    explain: (e) => ({
      title: "An assert check failed",
      what: `The assert on line ${e.line || "?"} found its condition was False.`,
      why: "assert stops the program when something you expected to be true isn't.",
      fix: "Print the values involved just before the assert to see why the condition is False.",
    }),
  },
  {
    type: "OverflowError",
    explain: (e) => ({
      title: "A number got too big",
      what: `A calculation on line ${e.line || "?"} produced a number too large to represent.`,
      why: "Decimal (float) numbers have a maximum size. Usually a sign that a value is growing in a loop without limit.",
      fix: "Check the calculation, and whether a loop is multiplying something far more times than you intended.",
    }),
  },
];

export function explainPythonError(err) {
  if (!err) return null;
  const type = err.type || ((err.message || "").match(/^([A-Za-z_]\w*)/) || [])[1] || "Error";
  const message = err.message || "";
  for (const rule of RULES) {
    if (rule.type !== type) continue;
    if (rule.match) {
      const m = message.match(rule.match);
      if (!m) continue;
      return { type, ...rule.explain(err, m) };
    }
    return { type, ...rule.explain(err, null) };
  }
  return {
    type,
    title: `${type}`,
    what: `Python stopped${err.line ? ` on line ${err.line}` : ""} with ${/^[AEIOU]/.test(type) ? "an" : "a"} ${type}.`,
    why: "This one isn't in H1's built-in explanations yet. The real error message below says exactly what Python objected to.",
    fix: "Read the last line of the error, check the line it points to, and ask H1 to explain it if it's still unclear.",
  };
}
