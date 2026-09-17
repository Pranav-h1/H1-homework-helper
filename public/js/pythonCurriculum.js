// H1's Python course: six levels, thirty-seven lessons, written by hand.
//
// Every lesson is: an explanation, an example you can run, a challenge, hints that open one at
// a time, a solution, and a short quiz. The challenge is marked by running the student's real
// code on real CPython (pyWorker.js) — never by asking a model whether it looks right.
//
// A check is one of:
//   { label, body }            — a Python expression that must be truthy
//   { label, call, expect }    — a test case: `call` is evaluated and compared with `expect`,
//                                and the student sees both values when it fails
// Either kind can add `stdin: "..."` to run the program again with that input first, which is
// how a decision or loop gets tested on several values instead of one.
//
// Inside a check these are available alongside the student's own variables and functions:
//   output — everything printed, as one string     lines — output split into lines
//   __h1_src — the student's source code (for "did they use a loop", "not typed as a literal")

export const PY_LEVELS = [
  { id: 1, title: "Absolute beginner", blurb: "Your first programs: printing, variables, text, numbers and input." },
  { id: 2, title: "Core basics", blurb: "Making decisions and repeating things." },
  { id: 3, title: "Data", blurb: "Lists, tuples, dictionaries and sets — holding many values." },
  { id: 4, title: "Functions", blurb: "Naming a piece of work so you can reuse it." },
  { id: 5, title: "Intermediate", blurb: "Modules, errors, files and writing less code to do more." },
  { id: 6, title: "Projects", blurb: "Small, complete programs that put everything together." },
];

export const PY_LESSONS = [
  // ===========================================================================
  // LEVEL 1
  // ===========================================================================
  {
    id: "py-1",
    level: 1,
    title: "What is Python? Your first print()",
    goal: "Write and run your first Python program.",
    concept:
      "**Python** is a programming language: a precise way of telling a computer what to do. It's used for websites, data science, games, AI and automating boring jobs — and it reads more like English than most languages.\n\n" +
      "A Python program is a list of instructions that run from top to bottom. The first one almost everyone learns is `print()`, which shows something in the output:\n\n" +
      "```python\nprint(\"Hello!\")\n```\n\n" +
      "Text goes inside **quotes**. Each `print()` puts its output on a new line.",
    example: `print("Hello!")
print("Python runs these lines from top to bottom.")`,
    task: "Print exactly these two lines:\n\n`Hello, Python!`\n`I am learning to code.`",
    starter: `# Write your two print() lines below
`,
    checks: [
      { label: "The first line is exactly: Hello, Python!", body: "len(lines) > 0 and lines[0] == 'Hello, Python!'", hint: "Check the capital letters, the comma and the exclamation mark." },
      { label: "The second line is exactly: I am learning to code.", body: "len(lines) > 1 and lines[1] == 'I am learning to code.'", hint: "Use a second print() for the second line, and don't forget the full stop." },
      { label: "Nothing else was printed", body: "len(lines) == 2", hint: "Only two lines should appear in the output." },
    ],
    hints: [
      "print() shows whatever is inside its brackets.",
      "Text has to be inside quotes: print(\"Hello, Python!\")",
      "Write a second print() on the next line for the second sentence.",
    ],
    solution: `print("Hello, Python!")
print("I am learning to code.")`,
    quiz: [
      { q: "What does print() do?", options: ["Shows a value in the output", "Saves your code to a file", "Asks the user a question", "Sends the page to a printer"], answer: 0, why: "print() displays whatever you put in the brackets." },
      { q: "Which line is correct?", options: ["print(Hello)", "print(\"Hello\")", "Print(\"Hello\")", "print \"Hello\""], answer: 1, why: "Text needs quotes, print is lowercase, and it needs brackets." },
    ],
  },
  {
    id: "py-2",
    level: 1,
    title: "Comments",
    goal: "Leave notes in your code that Python ignores.",
    concept:
      "Anything after a `#` on a line is a **comment**. Python skips it completely.\n\n" +
      "```python\n# Work out the total price\ntotal = 3 * 20  # three tickets\n```\n\n" +
      "Comments are for people — your future self, or a classmate reading your code. They explain *why* something is done.\n\n" +
      "A handy trick: putting `#` in front of a line **switches it off** without deleting it.",
    example: `# This line is a comment, so nothing happens
print("This runs")
# print("This does not run")`,
    task:
      "The program below gives bad advice on step 3.\n\n" +
      "1. **Don't delete** step 3 — turn it into a comment so it doesn't run.\n" +
      "2. Add a comment on the very first line explaining what the program does.",
    starter: `print("Step 1: boil water")
print("Step 2: add tea")
print("Step 3: drink it immediately")
print("Step 4: let it cool first")
`,
    checks: [
      { label: "Steps 1, 2 and 4 are printed", body: "lines == ['Step 1: boil water', 'Step 2: add tea', 'Step 4: let it cool first']", hint: "Only step 3 should be missing from the output." },
      { label: "Step 3 is still in the code, as a comment", body: "'Step 3' in __h1_src", hint: "Put # at the start of the step 3 line instead of deleting it." },
      { label: "The first line is a comment", body: "__h1_src.strip().startswith('#')", hint: "Start the very first line with # and a short description." },
    ],
    hints: [
      "A # at the start of a line makes Python skip that whole line.",
      "Put # in front of print(\"Step 3: ...\").",
      "Add a new first line such as: # Instructions for making tea",
    ],
    solution: `# Instructions for making a cup of tea
print("Step 1: boil water")
print("Step 2: add tea")
# print("Step 3: drink it immediately")
print("Step 4: let it cool first")`,
    quiz: [
      { q: "What happens to a line that starts with #?", options: ["Python runs it twice", "Python ignores it", "It causes an error", "It prints in bold"], answer: 1, why: "Everything after # is a comment and is skipped." },
    ],
  },
  {
    id: "py-3",
    level: 1,
    title: "Variables",
    goal: "Give a value a name and change it.",
    concept:
      "A **variable** is a name that holds a value. You create one with `=`:\n\n" +
      "```python\nname = \"Asha\"\nage = 15\nprint(name, age)\n```\n\n" +
      "`=` means *store the value on the right in the name on the left* — it isn't \"equals\" as in maths. That's why this is valid:\n\n" +
      "```python\nage = age + 1   # take age, add 1, store it back\n```\n\n" +
      "Names can use letters, numbers and `_`, but can't start with a number or contain spaces.",
    example: `city = "Chennai"
year = 2026
print(city, year)
year = year + 1
print(year)`,
    task: "Create a variable `name` holding your name and `age` holding a whole number. Print them on one line with `print(name, age)`. Then add 1 to `age` with `age = age + 1` and print `age` again.",
    starter: `name = ""
age = 0
`,
    checks: [
      { label: "name holds some text", body: "isinstance(name, str) and len(name.strip()) > 0", hint: "Put your name in quotes: name = \"Asha\"" },
      { label: "age is a whole number", body: "isinstance(age, int) and not isinstance(age, bool)", hint: "Numbers don't go in quotes: age = 15" },
      { label: "The first line shows name and age", body: "len(lines) > 0 and lines[0] == f'{name} {age - 1}'", hint: "print(name, age) — before you add 1." },
      { label: "age went up by one and was printed", body: "len(lines) > 1 and lines[1] == str(age) and ('age=age+1' in __h1_src.replace(' ', '') or 'age+=1' in __h1_src.replace(' ', ''))", hint: "age = age + 1, then print(age)." },
    ],
    hints: [
      "Replace the empty quotes with your name, and 0 with your age.",
      "Add print(name, age) on the next line.",
      "Then write age = age + 1 and print(age).",
    ],
    solution: `name = "Asha"
age = 15
print(name, age)
age = age + 1
print(age)`,
    quiz: [
      { q: "After x = 5 then x = x + 2, what is x?", options: ["5", "2", "7", "x + 2"], answer: 2, why: "Python works out x + 2 (which is 7) and stores it back in x." },
      { q: "Which is a valid variable name?", options: ["2score", "my score", "my_score", "score!"], answer: 2, why: "Names can't start with a number or contain spaces or symbols like !." },
    ],
  },
  {
    id: "py-4",
    level: 1,
    title: "Strings",
    goal: "Work with text.",
    concept:
      "Text in Python is called a **string**. Strings have useful tools built in:\n\n" +
      "```python\nword = \"python\"\nprint(word.upper())   # PYTHON\nprint(len(word))      # 6\n```\n\n" +
      "The cleanest way to put values inside text is an **f-string** — an `f` before the quote, and values in `{ }`:\n\n" +
      "```python\nname = \"Ravi\"\nprint(f\"Hi {name}, your name has {len(name)} letters\")\n```",
    example: `word = "python"
print(word.upper())
print(len(word))
print(f"{word} starts with {word[0]}")`,
    task: "With `word = \"python\"` already set, print three lines:\n\n1. the word in capitals\n2. how many letters it has\n3. using an **f-string**: `python has 6 letters`",
    starter: `word = "python"
`,
    checks: [
      { label: "Line 1 is PYTHON", body: "len(lines) > 0 and lines[0] == 'PYTHON'", hint: "word.upper() gives the capital-letter version." },
      { label: "Line 2 is 6", body: "len(lines) > 1 and lines[1] == '6'", hint: "len(word) counts the letters." },
      { label: "Line 3 is: python has 6 letters", body: "len(lines) > 2 and lines[2] == 'python has 6 letters'", hint: "f\"{word} has {len(word)} letters\"" },
      { label: "An f-string was used", body: "'f\"' in __h1_src or \"f'\" in __h1_src", hint: "Put f straight before the opening quote." },
    ],
    hints: [
      "print(word.upper()) prints the capitals version.",
      "len(word) gives the number of characters.",
      "An f-string looks like f\"{word} has ...\" — the values go inside { }.",
    ],
    solution: `word = "python"
print(word.upper())
print(len(word))
print(f"{word} has {len(word)} letters")`,
    quiz: [
      { q: "What does len(\"hello\") give?", options: ["\"hello\"", "4", "5", "HELLO"], answer: 2, why: "len counts the characters: h-e-l-l-o is 5." },
      { q: "What does f\"{2 + 3}\" produce?", options: ["\"{2 + 3}\"", "\"5\"", "\"2 + 3\"", "An error"], answer: 1, why: "Inside { } in an f-string, Python works out the value." },
    ],
  },
  {
    id: "py-5",
    level: 1,
    title: "Integers and floats",
    goal: "Calculate with whole and decimal numbers.",
    concept:
      "Python has two main kinds of number:\n\n" +
      "- **int** — whole numbers: `3`, `-12`, `2026`\n" +
      "- **float** — decimals: `3.5`, `0.25`, `9.0`\n\n" +
      "`/` always gives a float, even if it divides evenly: `8 / 2` is `4.0`.\n\n" +
      "Two operators students find really useful:\n\n" +
      "- `//` — whole-number division: `17 // 5` is `3`\n" +
      "- `%` — the remainder: `17 % 5` is `2`",
    example: `print(8 / 2)
print(17 // 5)
print(17 % 5)
print(type(3), type(3.0))`,
    task:
      "A book costs `49.5` and you buy `3`.\n\n" +
      "1. Store the cost in `total`.\n" +
      "2. 17 sweets are shared between 5 friends: store how many each gets in `each` (use `//`) and how many are left in `left_over` (use `%`).\n" +
      "3. Print `total`, `each` and `left_over` on separate lines.",
    starter: `price = 49.5
quantity = 3
`,
    checks: [
      { label: "total is 148.5", body: "total == 148.5", hint: "Multiply price by quantity." },
      { label: "each is 3", body: "each == 3 and isinstance(each, int)", hint: "17 // 5 gives the whole number of sweets each." },
      { label: "left_over is 2", body: "left_over == 2", hint: "17 % 5 gives the remainder." },
      { label: "The three values were printed", body: "lines[-3:] == ['148.5', '3', '2']", hint: "Print total, then each, then left_over." },
      { label: "// and % were used", body: "'//' in __h1_src and '%' in __h1_src", hint: "Calculate them — don't type 3 and 2 directly." },
    ],
    hints: [
      "total = price * quantity",
      "each = 17 // 5 and left_over = 17 % 5",
      "Then print(total), print(each), print(left_over).",
    ],
    solution: `price = 49.5
quantity = 3
total = price * quantity
each = 17 // 5
left_over = 17 % 5
print(total)
print(each)
print(left_over)`,
    quiz: [
      { q: "What is 20 // 6?", options: ["3.33", "3", "2", "4"], answer: 1, why: "// drops everything after the decimal point: 20 ÷ 6 is 3.33…, so 3." },
      { q: "What is 20 % 6?", options: ["2", "3", "0", "14"], answer: 0, why: "6 goes into 20 three times (18), leaving 2." },
    ],
  },
  {
    id: "py-6",
    level: 1,
    title: "Booleans",
    goal: "Store yes/no answers as True and False.",
    concept:
      "A **boolean** has only two possible values: `True` or `False` (capital first letter).\n\n" +
      "You usually get one by **comparing**:\n\n" +
      "```python\nage = 15\nprint(age >= 13)    # True\nprint(age >= 18)    # False\n```\n\n" +
      "Booleans are what decisions are built on — every `if` statement asks a True/False question.",
    example: `age = 15
is_teen = age >= 13 and age <= 19
print(is_teen)
print(age == 18)`,
    task: "With `age = 15`, create `is_teen` (True when age is 13 to 19) and `can_vote` (True when age is 18 or more). **Work them out with comparisons** — don't type True or False. Print both.",
    starter: `age = 15
`,
    checks: [
      { label: "is_teen is True", body: "is_teen is True", hint: "age >= 13 and age <= 19" },
      { label: "can_vote is False", body: "can_vote is False", hint: "age >= 18" },
      { label: "Both were printed", body: "lines[-2:] == ['True', 'False']", hint: "print(is_teen) then print(can_vote)." },
      { label: "They were calculated, not typed", body: "'is_teen=True' not in __h1_src.replace(' ', '') and 'can_vote=False' not in __h1_src.replace(' ', '') and '>=' in __h1_src", hint: "Use comparisons like age >= 13 so it would still be right for a different age." },
    ],
    hints: [
      "A comparison like age >= 18 already gives True or False.",
      "is_teen needs two comparisons joined with and.",
      "is_teen = age >= 13 and age <= 19",
    ],
    solution: `age = 15
is_teen = age >= 13 and age <= 19
can_vote = age >= 18
print(is_teen)
print(can_vote)`,
    quiz: [
      { q: "What does 7 > 10 give?", options: ["True", "False", "7", "An error"], answer: 1, why: "7 is not greater than 10, so the comparison is False." },
    ],
  },
  {
    id: "py-7",
    level: 1,
    title: "input()",
    goal: "Ask the person running the program for information.",
    concept:
      "`input()` waits for someone to type an answer and gives it back as a **string**:\n\n" +
      "```python\nname = input(\"What is your name? \")\nprint(\"Hi\", name)\n```\n\n" +
      "Even if someone types `15`, `input()` gives you the text `\"15\"`. To do maths with it, convert it:\n\n" +
      "```python\nage = int(input(\"How old are you? \"))\n```\n\n" +
      "In H1, the answers come from the **Input** box under the editor — one line per `input()`.",
    example: `name = input("What is your name? ")
age = int(input("How old are you? "))
print(f"{name} will be {age + 1} next year")`,
    stdin: "Asha\n15",
    task: "Ask for a name and then an age. Print exactly: `Hi Asha! Next year you will be 16.` — using whatever name and age were typed. (The Input box already contains `Asha` and `15`.)",
    starter: `# Ask for the name, then the age
`,
    checks: [
      { label: "Works for Asha, 15", body: "'Hi Asha! Next year you will be 16.' in output", hint: "Remember to convert the age with int() before adding 1." },
      { label: "Works for someone else too", stdin: "Ravi\n40", body: "'Hi Ravi! Next year you will be 41.' in output", hint: "Use the values from input() — don't type Asha or 16 into the print." },
      { label: "input() was used twice", body: "__h1_src.count('input(') >= 2", hint: "One input() for the name and one for the age." },
      { label: "The age was converted with int()", body: "'int(' in __h1_src", hint: "int(input(...)) turns the typed text into a number." },
    ],
    hints: [
      "name = input(\"Name? \") stores what was typed.",
      "age = int(input(\"Age? \")) gets a number you can add to.",
      "print(f\"Hi {name}! Next year you will be {age + 1}.\")",
    ],
    solution: `name = input("What is your name? ")
age = int(input("How old are you? "))
print(f"Hi {name}! Next year you will be {age + 1}.")`,
    quiz: [
      { q: "What type does input() always give back?", options: ["int", "float", "str (text)", "It depends what was typed"], answer: 2, why: "input() always returns text, even when digits are typed." },
      { q: "Why does int(input()) matter?", options: ["It makes input faster", "It lets you do maths with the answer", "It hides the answer", "It isn't needed"], answer: 1, why: "\"15\" + 1 is an error, but int(\"15\") + 1 is 16." },
    ],
  },
  {
    id: "py-8",
    level: 1,
    title: "Operators",
    goal: "Use the full set of maths and update operators.",
    concept:
      "The arithmetic operators:\n\n" +
      "| Operator | Means | Example |\n|---|---|---|\n| `+` | add | `4 + 2` → 6 |\n| `-` | subtract | `4 - 2` → 2 |\n| `*` | multiply | `4 * 2` → 8 |\n| `/` | divide | `4 / 2` → 2.0 |\n| `**` | power | `4 ** 2` → 16 |\n\n" +
      "**Shortcut operators** update a variable in place: `score += 5` is the same as `score = score + 5`. There's also `-=`, `*=` and `/=`.\n\n" +
      "Python follows the usual order of operations — brackets first, then powers, then `* /`, then `+ -`.",
    example: `score = 10
score += 5
score *= 2
print(score)
print(2 + 3 * 4, (2 + 3) * 4)`,
    task:
      "A rectangle is 7 wide and 4 tall.\n\n" +
      "1. `area` = width × height\n2. `perimeter` = 2 × (width + height)\n3. Start `score` at 10 and add 5 using `+=`\n4. `squared` = 9 to the power 2 using `**`\n\nPrint all four, one per line.",
    starter: `width = 7
height = 4
`,
    checks: [
      { label: "area is 28", body: "area == 28", hint: "width * height" },
      { label: "perimeter is 22", body: "perimeter == 22", hint: "2 * (width + height) — the brackets matter." },
      { label: "score is 15, using +=", body: "score == 15 and '+=' in __h1_src", hint: "score = 10, then score += 5" },
      { label: "squared is 81, using **", body: "squared == 81 and '**' in __h1_src", hint: "9 ** 2" },
      { label: "All four were printed", body: "lines[-4:] == ['28', '22', '15', '81']", hint: "Print area, perimeter, score, squared in that order." },
    ],
    hints: [
      "area = width * height",
      "Without brackets, 2 * width + height is wrong — use 2 * (width + height).",
      "score = 10 on one line, then score += 5 on the next.",
    ],
    solution: `width = 7
height = 4
area = width * height
perimeter = 2 * (width + height)
score = 10
score += 5
squared = 9 ** 2
print(area)
print(perimeter)
print(score)
print(squared)`,
    quiz: [
      { q: "What does 2 + 3 * 4 give?", options: ["20", "14", "24", "9"], answer: 1, why: "Multiplication happens first: 3 * 4 = 12, then 2 + 12 = 14." },
      { q: "x = 6, then x -= 2. What is x?", options: ["2", "8", "4", "-2"], answer: 2, why: "x -= 2 means x = x - 2." },
    ],
  },

  // ===========================================================================
  // LEVEL 2
  // ===========================================================================
  {
    id: "py-9",
    level: 2,
    title: "if, elif and else",
    goal: "Make the program choose what to do.",
    concept:
      "```python\ntemperature = 25\n\nif temperature >= 30:\n    print(\"Hot\")\nelif temperature >= 20:\n    print(\"Warm\")\nelse:\n    print(\"Cold\")\n```\n\n" +
      "Python checks each condition **from the top** and runs only the **first** one that's True. `else` catches everything left over.\n\n" +
      "Two rules Python is strict about:\n\n" +
      "- a **colon** at the end of the `if` / `elif` / `else` line\n" +
      "- the lines underneath are **indented** (4 spaces). Indentation is how Python knows what belongs to the `if`.",
    example: `mark = 72
if mark >= 80:
    print("Excellent")
elif mark >= 50:
    print("Pass")
else:
    print("Try again")`,
    stdin: "31",
    task: "Read a temperature with `int(input())`. Print `Hot` if it's 30 or more, `Warm` if it's 20 to 29, and `Cold` below 20.\n\nH1 will test it with several temperatures, including the boundaries.",
    starter: `temperature = int(input("Temperature: "))
`,
    checks: [
      { label: "31 → Hot", stdin: "31", body: "lines[-1].strip() == 'Hot'", hint: "The first condition should be temperature >= 30." },
      { label: "30 → Hot (the boundary)", stdin: "30", body: "lines[-1].strip() == 'Hot'", hint: "Use >= not > so that exactly 30 counts as Hot." },
      { label: "25 → Warm", stdin: "25", body: "lines[-1].strip() == 'Warm'", hint: "elif temperature >= 20:" },
      { label: "20 → Warm (the boundary)", stdin: "20", body: "lines[-1].strip() == 'Warm'", hint: "20 itself should be Warm." },
      { label: "19 → Cold", stdin: "19", body: "lines[-1].strip() == 'Cold'", hint: "Everything else goes in else:" },
      { label: "Only one word is printed each time", stdin: "25", body: "sum(1 for l in lines if l.strip() in ('Hot', 'Warm', 'Cold')) == 1", hint: "Use elif and else — three separate ifs could print more than one word." },
    ],
    hints: [
      "Start with if temperature >= 30: and indent print(\"Hot\") underneath.",
      "Next, elif temperature >= 20: for Warm.",
      "Finish with else: for Cold.",
    ],
    solution: `temperature = int(input("Temperature: "))
if temperature >= 30:
    print("Hot")
elif temperature >= 20:
    print("Warm")
else:
    print("Cold")`,
    quiz: [
      { q: "If the first if is True, what happens to the elif and else?", options: ["They run too", "They are skipped", "Only else runs", "Python checks them anyway and runs any that are True"], answer: 1, why: "Only the first True branch runs; the rest are skipped." },
    ],
  },
  {
    id: "py-10",
    level: 2,
    title: "Comparison operators",
    goal: "Compare two values in every way Python allows.",
    concept:
      "| Operator | Means |\n|---|---|\n| `==` | equal to |\n| `!=` | not equal to |\n| `>` | greater than |\n| `<` | less than |\n| `>=` | greater than or equal |\n| `<=` | less than or equal |\n\n" +
      "**One `=` stores, two `==` compare.** Mixing them up is the most common beginner mistake.\n\n" +
      "Comparisons work on text too: `\"apple\" == \"apple\"` is True, but `\"Apple\" == \"apple\"` is False — capital letters matter.",
    example: `a = 7
b = 3
print(a == b, a != b, a > b, a <= b)`,
    stdin: "7\n7",
    task: "Read two whole numbers `a` and `b`. Print four lines: `a == b`, `a != b`, `a > b`, `a <= b`.",
    starter: `a = int(input())
b = int(input())
`,
    checks: [
      { label: "7 and 7 → True, False, False, True", stdin: "7\n7", body: "lines[-4:] == ['True', 'False', 'False', 'True']", hint: "Print each comparison on its own line, in the order given." },
      { label: "9 and 3 → False, True, True, False", stdin: "9\n3", body: "lines[-4:] == ['False', 'True', 'True', 'False']", hint: "Check you compared a to b, not b to a." },
      { label: "2 and 5 → False, True, False, True", stdin: "2\n5", body: "lines[-4:] == ['False', 'True', 'False', 'True']", hint: "a <= b is True when a is smaller." },
    ],
    hints: [
      "print(a == b) prints True or False.",
      "Do the same for !=, > and <=.",
    ],
    solution: `a = int(input())
b = int(input())
print(a == b)
print(a != b)
print(a > b)
print(a <= b)`,
    quiz: [
      { q: "Which line compares x with 5?", options: ["x = 5", "x == 5", "x := 5", "x === 5"], answer: 1, why: "== compares. A single = stores a value." },
      { q: "What is \"Cat\" == \"cat\"?", options: ["True", "False"], answer: 1, why: "Capital letters count, so they're different strings." },
    ],
  },
  {
    id: "py-11",
    level: 2,
    title: "and, or, not",
    goal: "Combine conditions.",
    concept:
      "- `and` — True only when **both** sides are True\n" +
      "- `or` — True when **at least one** side is True\n" +
      "- `not` — flips True to False and back\n\n" +
      "```python\nage = 15\nhas_ticket = True\nif age >= 12 and has_ticket:\n    print(\"Welcome\")\n```\n\n" +
      "When mixing `and` and `or`, use brackets to make the meaning obvious: `(a and b) or c`.",
    example: `age = 70
ticket = "no"
print(age >= 12 and ticket == "yes")
print(age >= 65 or ticket == "yes")
print(not ticket == "yes")`,
    stdin: "15\nyes",
    task:
      "A museum lets you in if **you're 12 or older and have a ticket**, or if **you're 65 or older** (seniors go free).\n\n" +
      "Read the age, then `yes` or `no` for the ticket. Print `Welcome` or `Sorry`.",
    starter: `age = int(input("Age: "))
ticket = input("Ticket? ")
`,
    checks: [
      { label: "15 with a ticket → Welcome", stdin: "15\nyes", body: "lines[-1].strip() == 'Welcome'", hint: "age >= 12 and ticket == \"yes\"" },
      { label: "15 without a ticket → Sorry", stdin: "15\nno", body: "lines[-1].strip() == 'Sorry'", hint: "Both parts need to be true for the first rule." },
      { label: "10 with a ticket → Sorry", stdin: "10\nyes", body: "lines[-1].strip() == 'Sorry'", hint: "Under 12 isn't allowed, even with a ticket." },
      { label: "70 without a ticket → Welcome", stdin: "70\nno", body: "lines[-1].strip() == 'Welcome'", hint: "Add or age >= 65." },
      { label: "Uses and and or", body: "' and ' in __h1_src and ' or ' in __h1_src", hint: "Combine the two rules with or." },
    ],
    hints: [
      "The first rule: age >= 12 and ticket == \"yes\"",
      "The second rule: age >= 65",
      "if (age >= 12 and ticket == \"yes\") or age >= 65:",
    ],
    solution: `age = int(input("Age: "))
ticket = input("Ticket? ")
if (age >= 12 and ticket == "yes") or age >= 65:
    print("Welcome")
else:
    print("Sorry")`,
    quiz: [
      { q: "True and False gives…", options: ["True", "False"], answer: 1, why: "and needs both sides to be True." },
      { q: "True or False gives…", options: ["True", "False"], answer: 0, why: "or needs only one side to be True." },
    ],
  },
  {
    id: "py-12",
    level: 2,
    title: "while loops",
    goal: "Repeat something while a condition stays true.",
    concept:
      "```python\ncount = 3\nwhile count > 0:\n    print(count)\n    count -= 1\nprint(\"Done\")\n```\n\n" +
      "The loop checks the condition, runs the indented block, then checks again — until the condition is False.\n\n" +
      "**Something inside the loop must change the condition.** Forget `count -= 1` and it runs forever. H1 stops runaway programs after 10 seconds, but it's better to read the condition twice.",
    example: `n = 1
while n <= 5:
    print(n)
    n += 1`,
    stdin: "5",
    task: "Read a number `n`. Count down from `n` to 1, one number per line, then print `Liftoff!`.",
    starter: `n = int(input("Start from: "))
`,
    checks: [
      { label: "5 → 5, 4, 3, 2, 1, Liftoff!", stdin: "5", body: "lines[-6:] == ['5', '4', '3', '2', '1', 'Liftoff!']", hint: "Print n, then take 1 off it, while n > 0." },
      { label: "3 → 3, 2, 1, Liftoff!", stdin: "3", body: "lines[-4:] == ['3', '2', '1', 'Liftoff!'] and '4' not in lines", hint: "Start from whatever number was typed." },
      { label: "A while loop was used", body: "'while ' in __h1_src", hint: "This lesson is about while loops." },
    ],
    hints: [
      "while n > 0: keeps going until n reaches 0.",
      "Inside the loop: print(n) then n -= 1",
      "print(\"Liftoff!\") goes after the loop, not indented.",
    ],
    solution: `n = int(input("Start from: "))
while n > 0:
    print(n)
    n -= 1
print("Liftoff!")`,
    quiz: [
      { q: "What's wrong with: x = 1 / while x < 5: / print(x)", options: ["Nothing", "x never changes, so it loops forever", "while needs brackets", "print can't go in a loop"], answer: 1, why: "Nothing inside the loop changes x, so x < 5 is always True." },
    ],
  },
  {
    id: "py-13",
    level: 2,
    title: "for loops and range()",
    goal: "Repeat something a set number of times.",
    concept:
      "A `for` loop goes through a sequence one item at a time:\n\n" +
      "```python\nfor i in range(1, 4):\n    print(i)      # 1, 2, 3\n```\n\n" +
      "`range(start, stop)` counts from `start` up to **but not including** `stop`. So `range(1, 11)` is 1 to 10.\n\n" +
      "- `range(5)` → 0, 1, 2, 3, 4\n- `range(2, 10, 2)` → 2, 4, 6, 8 (the third number is the step)\n\n" +
      "Use `for` when you know how many times; `while` when you don't.",
    example: `for i in range(1, 6):
    print(i, "squared is", i * i)`,
    stdin: "5",
    task: "Read a number `n` and print its times table from 1 to 10, formatted exactly like `5 x 3 = 15`.",
    starter: `n = int(input("Times table for: "))
`,
    checks: [
      { label: "5 → ten lines, 5 x 1 = 5 to 5 x 10 = 50", stdin: "5", body: "lines[-10:] == [f'5 x {i} = {5 * i}' for i in range(1, 11)]", hint: "Loop over range(1, 11) and use an f-string." },
      { label: "7 → ends with 7 x 10 = 70", stdin: "7", body: "lines[-10:] == [f'7 x {i} = {7 * i}' for i in range(1, 11)]", hint: "Use n, not a fixed number." },
      { label: "A for loop with range() was used", body: "'for ' in __h1_src and 'range(' in __h1_src", hint: "for i in range(1, 11):" },
    ],
    hints: [
      "for i in range(1, 11): gives i from 1 to 10.",
      "The answer on each line is n * i.",
      "print(f\"{n} x {i} = {n * i}\")",
    ],
    solution: `n = int(input("Times table for: "))
for i in range(1, 11):
    print(f"{n} x {i} = {n * i}")`,
    quiz: [
      { q: "What does range(3) produce?", options: ["1, 2, 3", "0, 1, 2", "0, 1, 2, 3", "3"], answer: 1, why: "It starts at 0 and stops before 3." },
      { q: "Which gives 10, 20, 30?", options: ["range(10, 30)", "range(10, 31, 10)", "range(3, 10)", "range(10, 30, 10)"], answer: 1, why: "Start 10, step 10, and stop must be past 30." },
    ],
  },

  // ===========================================================================
  // LEVEL 3
  // ===========================================================================
  {
    id: "py-14",
    level: 3,
    title: "Lists",
    goal: "Keep many values in order, and change them.",
    concept:
      "A **list** holds values in order, inside square brackets:\n\n" +
      "```python\nshopping = [\"milk\", \"bread\"]\nshopping.append(\"eggs\")      # add to the end\nshopping.insert(0, \"apples\")  # add at a position\nshopping.remove(\"bread\")      # remove by value\nprint(len(shopping))           # how many\n```\n\n" +
      "Lists can hold anything — numbers, text, even other lists — and they can change after you create them.",
    example: `scores = [72, 45, 90]
scores.append(61)
print(scores)
print(len(scores), max(scores))`,
    task: "Starting from `shopping = [\"milk\", \"bread\"]`:\n\n1. add `\"eggs\"` to the end\n2. add `\"apples\"` to the **front**\n3. remove `\"bread\"`\n4. print the list, then print how many items it has",
    starter: `shopping = ["milk", "bread"]
`,
    checks: [
      { label: "The list is apples, milk, eggs", body: "shopping == ['apples', 'milk', 'eggs']", hint: "Use append, insert(0, ...) and remove." },
      { label: "The list was printed", body: "\"['apples', 'milk', 'eggs']\" in lines", hint: "print(shopping)" },
      { label: "The length was printed", body: "len(lines) > 0 and lines[-1] == '3'", hint: "print(len(shopping)) last." },
      { label: "append, insert and remove were used", body: "'.append(' in __h1_src and '.insert(' in __h1_src and '.remove(' in __h1_src", hint: "Change the list with its methods rather than rewriting it." },
    ],
    hints: [
      "shopping.append(\"eggs\")",
      "shopping.insert(0, \"apples\") puts it at position 0 — the front.",
      "shopping.remove(\"bread\"), then print(shopping) and print(len(shopping)).",
    ],
    solution: `shopping = ["milk", "bread"]
shopping.append("eggs")
shopping.insert(0, "apples")
shopping.remove("bread")
print(shopping)
print(len(shopping))`,
    quiz: [
      { q: "What does [1, 2].append(3) do?", options: ["Makes [3, 1, 2]", "Makes [1, 2, 3]", "Makes [4, 5]", "Causes an error"], answer: 1, why: "append adds to the end." },
    ],
  },
  {
    id: "py-15",
    level: 3,
    title: "Indexing and slicing",
    goal: "Pick out one item, or a range of items.",
    concept:
      "Each position has an **index**, starting at **0**:\n\n" +
      "```python\nletters = [\"a\", \"b\", \"c\", \"d\"]\nletters[0]    # \"a\"\nletters[-1]   # \"d\"  (negative counts from the end)\n```\n\n" +
      "A **slice** takes a range: `[start:stop]`, stopping *before* `stop`:\n\n" +
      "```python\nletters[1:3]  # [\"b\", \"c\"]\nletters[:2]   # [\"a\", \"b\"]\nletters[::-1] # reversed\n```\n\n" +
      "Strings work exactly the same way: `\"Python\"[0]` is `\"P\"`.",
    example: `word = "Programming"
print(word[0], word[-1])
print(word[:3], word[3:7])
print(word[::-1])`,
    task:
      "Using `letters = [\"a\", \"b\", \"c\", \"d\", \"e\", \"f\"]` and `word = \"Programming\"`, create:\n\n" +
      "- `first` — the first letter in the list\n- `last` — the last one, **using a negative index**\n- `middle` — the list `[\"c\", \"d\"]`, **using a slice**\n- `start` — the first 3 characters of `word`\n- `backwards` — `word` reversed",
    starter: `letters = ["a", "b", "c", "d", "e", "f"]
word = "Programming"
`,
    checks: [
      { label: "first is \"a\"", body: "first == 'a'", hint: "letters[0]" },
      { label: "last is \"f\", using a negative index", body: "last == 'f' and '[-1]' in __h1_src", hint: "letters[-1] always gets the last item." },
      { label: "middle is [\"c\", \"d\"], using a slice", body: "middle == ['c', 'd'] and ':' in __h1_src.split('middle', 1)[1].split(chr(10), 1)[0]", hint: "letters[2:4] — the slice stops before index 4." },
      { label: "start is \"Pro\"", body: "start == 'Pro'", hint: "word[:3]" },
      { label: "backwards is \"gnimmargorP\"", body: "backwards == 'gnimmargorP'", hint: "word[::-1] steps backwards through the whole string." },
    ],
    hints: [
      "Counting starts at 0, so the first item is [0].",
      "A slice [2:4] gives items at positions 2 and 3.",
      "[::-1] means: whole thing, stepping by -1.",
    ],
    solution: `letters = ["a", "b", "c", "d", "e", "f"]
word = "Programming"
first = letters[0]
last = letters[-1]
middle = letters[2:4]
start = word[:3]
backwards = word[::-1]`,
    quiz: [
      { q: "For nums = [10, 20, 30, 40], what is nums[1:3]?", options: ["[10, 20, 30]", "[20, 30]", "[20, 30, 40]", "[10, 20]"], answer: 1, why: "Start at index 1, stop before index 3." },
    ],
  },
  {
    id: "py-16",
    level: 3,
    title: "Tuples",
    goal: "Group values that belong together and shouldn't change.",
    concept:
      "A **tuple** is like a list, but written with round brackets, and it **can't be changed** after it's made:\n\n" +
      "```python\npoint = (3, 4)\nx, y = point      # unpacking: x is 3, y is 4\n```\n\n" +
      "Use a tuple for things that naturally come as a fixed group — a coordinate, a date, an RGB colour. Trying `point[0] = 5` raises an error, which protects the data.",
    example: `birthday = (14, "March", 2010)
day, month, year = birthday
print(month, day)
print(len(birthday))`,
    task:
      "With `point = (3, 4)`:\n\n1. **unpack** it into `x` and `y` in one line\n2. calculate `distance` from (0, 0): the square root of x² + y², i.e. `(x ** 2 + y ** 2) ** 0.5`\n3. create a tuple `colours` holding `\"red\"`, `\"green\"`, `\"blue\"`",
    starter: `point = (3, 4)
`,
    checks: [
      { label: "x is 3 and y is 4", body: "x == 3 and y == 4", hint: "x, y = point" },
      { label: "Unpacked in one line", body: "__import__('re').search(r'\\w+\\s*,\\s*\\w+\\s*=\\s*point', __h1_src) is not None", hint: "Write x, y = point rather than two separate lines." },
      { label: "distance is 5.0", body: "distance == 5", hint: "(x ** 2 + y ** 2) ** 0.5" },
      { label: "colours is a tuple of three colours", body: "isinstance(colours, tuple) and colours == ('red', 'green', 'blue')", hint: "Round brackets: (\"red\", \"green\", \"blue\")" },
    ],
    hints: [
      "Unpacking: x, y = point",
      "distance = (x ** 2 + y ** 2) ** 0.5",
      "colours = (\"red\", \"green\", \"blue\")",
    ],
    solution: `point = (3, 4)
x, y = point
distance = (x ** 2 + y ** 2) ** 0.5
colours = ("red", "green", "blue")`,
    quiz: [
      { q: "What's the main difference between a list and a tuple?", options: ["Tuples can't hold text", "Tuples can't be changed after they're made", "Lists can't be looped over", "There is no difference"], answer: 1, why: "Tuples are immutable — fixed once created." },
    ],
  },
  {
    id: "py-17",
    level: 3,
    title: "Dictionaries",
    goal: "Look values up by name instead of by position.",
    concept:
      "A **dictionary** stores **key: value** pairs in curly brackets:\n\n" +
      "```python\nages = {\"Asha\": 15, \"Ravi\": 16}\nprint(ages[\"Asha\"])   # 15\nages[\"Meera\"] = 14     # add a new pair\nages[\"Ravi\"] = 17      # change a value\n```\n\n" +
      "Loop over the pairs with `.items()`:\n\n" +
      "```python\nfor name, age in ages.items():\n    print(name, age)\n```\n\n" +
      "Almost all real-world data — every API, every JSON file — is shaped like dictionaries.",
    example: `capitals = {"India": "New Delhi", "Japan": "Tokyo"}
capitals["France"] = "Paris"
for country, city in capitals.items():
    print(f"{city} is the capital of {country}")`,
    task:
      "Starting from `ages = {\"Asha\": 15, \"Ravi\": 16}`:\n\n1. add `\"Meera\"` aged 14\n2. change Ravi's age to 17\n3. loop over it and print each person as `Asha: 15`\n4. store the sum of all the ages in `total`",
    starter: `ages = {"Asha": 15, "Ravi": 16}
`,
    checks: [
      { label: "The dictionary is right", body: "ages == {'Asha': 15, 'Ravi': 17, 'Meera': 14}", hint: "ages[\"Meera\"] = 14 and ages[\"Ravi\"] = 17" },
      { label: "Each person was printed as Name: age", body: "'Asha: 15' in lines and 'Ravi: 17' in lines and 'Meera: 14' in lines", hint: "for name, age in ages.items(): print(f\"{name}: {age}\")" },
      { label: "total is 46", body: "total == 46", hint: "sum(ages.values())" },
      { label: "A loop was used", body: "'for ' in __h1_src", hint: "Print them with a for loop over ages.items()." },
    ],
    hints: [
      "Adding and changing both use ages[key] = value.",
      "for name, age in ages.items(): gives you both parts.",
      "total = sum(ages.values())",
    ],
    solution: `ages = {"Asha": 15, "Ravi": 16}
ages["Meera"] = 14
ages["Ravi"] = 17
for name, age in ages.items():
    print(f"{name}: {age}")
total = sum(ages.values())`,
    quiz: [
      { q: "How do you get Asha's age from ages?", options: ["ages[0]", "ages(\"Asha\")", "ages[\"Asha\"]", "ages.Asha"], answer: 2, why: "Dictionaries are looked up by key in square brackets." },
    ],
  },
  {
    id: "py-18",
    level: 3,
    title: "Sets",
    goal: "Work with unique values and compare groups.",
    concept:
      "A **set** holds values with **no duplicates** and no particular order:\n\n" +
      "```python\nunique = set([\"a\", \"b\", \"a\"])   # {\"a\", \"b\"}\n```\n\n" +
      "Sets are brilliant for comparing groups:\n\n" +
      "- `a & b` — in **both** (intersection)\n- `a | b` — in **either** (union)\n- `a - b` — in `a` but **not** `b` (difference)",
    example: `maths_club = {"Asha", "Ravi", "Meera"}
art_club = {"Ravi", "Karan"}
print(maths_club & art_club)
print(len(maths_club | art_club))`,
    task:
      "With the two classes below, create:\n\n- `both` — students in both classes\n- `either` — students in at least one class\n- `only_a` — students only in `class_a`\n- `unique_count` — how many **different** values are in `[\"x\", \"y\", \"x\", \"z\", \"y\"]`",
    starter: `class_a = {"Asha", "Ravi", "Meera"}
class_b = {"Ravi", "Karan", "Meera"}
`,
    checks: [
      { label: "both is Ravi and Meera", body: "both == {'Ravi', 'Meera'}", hint: "class_a & class_b" },
      { label: "either has all four students", body: "either == {'Asha', 'Ravi', 'Meera', 'Karan'}", hint: "class_a | class_b" },
      { label: "only_a is just Asha", body: "only_a == {'Asha'}", hint: "class_a - class_b" },
      { label: "unique_count is 3", body: "unique_count == 3", hint: "len(set([...]))" },
    ],
    hints: [
      "& gives what's in both sets.",
      "| gives everything from both; - takes one set away from another.",
      "Turning a list into a set removes the duplicates: len(set(my_list)).",
    ],
    solution: `class_a = {"Asha", "Ravi", "Meera"}
class_b = {"Ravi", "Karan", "Meera"}
both = class_a & class_b
either = class_a | class_b
only_a = class_a - class_b
unique_count = len(set(["x", "y", "x", "z", "y"]))`,
    quiz: [
      { q: "What is len({1, 1, 2, 2, 3})?", options: ["5", "3", "2", "1"], answer: 1, why: "A set keeps each value once: {1, 2, 3}." },
    ],
  },

  // ===========================================================================
  // LEVEL 4
  // ===========================================================================
  {
    id: "py-19",
    level: 4,
    title: "Defining functions",
    goal: "Package up code under a name and run it whenever you like.",
    concept:
      "A **function** is a named block of code. Define it once with `def`, then **call** it as often as you like:\n\n" +
      "```python\ndef greet(name):\n    print(f\"Hello, {name}!\")\n\ngreet(\"Asha\")\ngreet(\"Ravi\")\n```\n\n" +
      "Nothing inside a function runs until it's called. The indented lines are its **body**.",
    example: `def cheer(team):
    print(f"Go {team}!")
    print("----")

cheer("Blue House")
cheer("Red House")`,
    task: "Define a function `greet(name)` that prints `Hello, <name>!`. Then call it for `\"Asha\"` and for `\"Ravi\"`.",
    starter: `# define greet here

# then call it twice
`,
    checks: [
      { label: "greet is a function", body: "callable(greet)", hint: "def greet(name):" },
      { label: "It printed Hello, Asha!", body: "'Hello, Asha!' in lines", hint: "Call greet(\"Asha\")." },
      { label: "It printed Hello, Ravi!", body: "'Hello, Ravi!' in lines", hint: "Call greet(\"Ravi\")." },
      { label: "The greeting comes from the function", body: "__h1_src.count('greet(') >= 3 and __h1_src.count('print(') <= 1", hint: "Put the print() inside greet, and call greet twice — don't print the greetings directly." },
    ],
    hints: [
      "def greet(name): then an indented print on the next line.",
      "The print uses an f-string: print(f\"Hello, {name}!\")",
      "Outside the function (not indented): greet(\"Asha\") and greet(\"Ravi\").",
    ],
    solution: `def greet(name):
    print(f"Hello, {name}!")

greet("Asha")
greet("Ravi")`,
    quiz: [
      { q: "When does the code inside a def run?", options: ["As soon as Python reads it", "Only when the function is called", "Never", "At the end of the program"], answer: 1, why: "Defining a function just stores it; calling it runs it." },
    ],
  },
  {
    id: "py-20",
    level: 4,
    title: "Parameters and arguments",
    goal: "Give functions inputs, including optional ones.",
    concept:
      "**Parameters** are the names in the `def` line; **arguments** are the values you pass in when calling.\n\n" +
      "A parameter can have a **default**, which makes it optional:\n\n" +
      "```python\ndef make_badge(name, role=\"Student\"):\n    return f\"{name} ({role})\"\n\nmake_badge(\"Asha\")                 # Asha (Student)\nmake_badge(\"Mr Rao\", \"Teacher\")     # Mr Rao (Teacher)\n```\n\n" +
      "You can also pass arguments **by name** in any order: `make_badge(role=\"Captain\", name=\"Ravi\")`.",
    example: `def power(base, exponent=2):
    return base ** exponent

print(power(5))
print(power(2, 10))
print(power(exponent=3, base=2))`,
    task: "Write `make_badge(name, role=\"Student\")` that **returns** the text `Name (Role)`, e.g. `Asha (Student)`.",
    starter: `def make_badge(name, role="Student"):
    pass
`,
    checks: [
      { label: "make_badge(\"Asha\")", call: "make_badge('Asha')", expect: "'Asha (Student)'", hint: "When no role is given, the default \"Student\" is used." },
      { label: "make_badge(\"Mr Rao\", \"Teacher\")", call: "make_badge('Mr Rao', 'Teacher')", expect: "'Mr Rao (Teacher)'", hint: "The second argument replaces the default." },
      { label: "make_badge(role=\"Captain\", name=\"Ravi\")", call: "make_badge(role='Captain', name='Ravi')", expect: "'Ravi (Captain)'", hint: "Named arguments can come in any order — your function doesn't need to change." },
    ],
    hints: [
      "Replace pass with a return statement.",
      "return f\"{name} ({role})\"",
    ],
    solution: `def make_badge(name, role="Student"):
    return f"{name} ({role})"`,
    quiz: [
      { q: "In def area(width, height=1), which parameter is optional?", options: ["width", "height", "both", "neither"], answer: 1, why: "height has a default value, so you can leave it out." },
    ],
  },
  {
    id: "py-21",
    level: 4,
    title: "return",
    goal: "Get a result back out of a function.",
    concept:
      "`return` hands a value back to whoever called the function:\n\n" +
      "```python\ndef average(numbers):\n    return sum(numbers) / len(numbers)\n\nresult = average([4, 8, 6])   # result is 6.0\n```\n\n" +
      "**Printing is not returning.** A function that only prints shows something on screen but gives back `None` — you can't store or reuse the answer. A function that returns lets the caller decide what to do with it.",
    example: `def double(n):
    return n * 2

x = double(4)
print(x + 1)`,
    task:
      "Write two functions that **return** their answer:\n\n" +
      "- `average(numbers)` — the mean of a list\n" +
      "- `grade(score)` — `\"A\"` for 80 or more, `\"B\"` for 60–79, `\"C\"` below 60",
    starter: `def average(numbers):
    pass

def grade(score):
    pass
`,
    checks: [
      { label: "average([4, 8, 6])", call: "average([4, 8, 6])", expect: "6.0", hint: "sum(numbers) / len(numbers)" },
      { label: "average([10])", call: "average([10])", expect: "10.0", hint: "It should work for any list." },
      { label: "grade(80)", call: "grade(80)", expect: "'A'", hint: "80 exactly is an A — use >= 80." },
      { label: "grade(79)", call: "grade(79)", expect: "'B'", hint: "elif score >= 60" },
      { label: "grade(60)", call: "grade(60)", expect: "'B'", hint: "60 exactly is a B." },
      { label: "grade(59)", call: "grade(59)", expect: "'C'", hint: "Everything below 60 is a C." },
    ],
    hints: [
      "average: return sum(numbers) / len(numbers)",
      "grade: if score >= 80: return \"A\"",
      "Then elif score >= 60: return \"B\", else: return \"C\"",
    ],
    solution: `def average(numbers):
    return sum(numbers) / len(numbers)

def grade(score):
    if score >= 80:
        return "A"
    elif score >= 60:
        return "B"
    else:
        return "C"`,
    quiz: [
      { q: "What does a function return if it has no return statement?", options: ["0", "An empty string", "None", "An error"], answer: 2, why: "Without return, Python gives back None." },
    ],
  },
  {
    id: "py-22",
    level: 4,
    title: "Scope",
    goal: "Understand where a variable exists — and fix a classic bug.",
    concept:
      "Variables created **inside** a function are **local**: they exist only while that function runs.\n\n" +
      "Here's a classic mistake:\n\n" +
      "```python\ncount = 0\ndef add_point():\n    count = count + 1    # UnboundLocalError!\n```\n\n" +
      "Assigning to `count` inside the function makes `count` local there — so reading it on the same line fails.\n\n" +
      "The clean fix isn't `global`. It's to pass the value **in** and **return** the new value:\n\n" +
      "```python\ndef add_point(count):\n    return count + 1\n\ncount = add_point(count)\n```",
    example: `def shout(text):
    loud = text.upper()   # loud only exists in here
    return loud

print(shout("hi"))`,
    task: "The starter code crashes. Rewrite `add_point` so it takes the current count as a parameter and **returns** the new count. Call it twice so `count` ends up as 2, then print `count`. Don't use `global`.",
    starter: `count = 0

def add_point():
    count = count + 1

add_point()
add_point()
print(count)
`,
    checks: [
      { label: "add_point(5)", call: "add_point(5)", expect: "6", hint: "def add_point(count): return count + 1" },
      { label: "count ends up as 2", body: "count == 2", hint: "count = add_point(count) — twice." },
      { label: "2 is printed", body: "len(lines) > 0 and lines[-1] == '2'", hint: "print(count) at the end." },
      { label: "No global variables inside functions", body: "'global' not in __h1_src", hint: "Pass the value in and return it, instead of using global." },
    ],
    hints: [
      "Change def add_point(): to def add_point(count):",
      "Inside: return count + 1",
      "When calling it, store the result: count = add_point(count)",
    ],
    solution: `count = 0

def add_point(count):
    return count + 1

count = add_point(count)
count = add_point(count)
print(count)`,
    quiz: [
      { q: "A variable created inside a function is…", options: ["available everywhere", "local to that function", "deleted immediately", "always a global"], answer: 1, why: "It exists only inside the function while it runs." },
    ],
  },
  {
    id: "py-23",
    level: 4,
    title: "Reusable code",
    goal: "Build bigger functions out of smaller ones.",
    concept:
      "Good programs are made of **small functions that each do one thing**, which bigger functions then use.\n\n" +
      "```python\ndef is_even(n):\n    return n % 2 == 0\n\ndef count_evens(numbers):\n    return len([n for n in numbers if is_even(n)])\n```\n\n" +
      "If you ever need to change what \"even\" means, there's exactly one place to change it. That's the whole point of reusable code.",
    example: `def is_vowel(letter):
    return letter.lower() in "aeiou"

def count_vowels(word):
    total = 0
    for letter in word:
        if is_vowel(letter):
            total += 1
    return total

print(count_vowels("Programming"))`,
    task:
      "Write three functions, each using the one before:\n\n" +
      "- `is_even(n)` — returns `True` or `False`\n" +
      "- `count_evens(numbers)` — how many numbers in the list are even, **using `is_even`**\n" +
      "- `describe(numbers)` — returns text like `2 of 3 are even`, **using `count_evens`**",
    starter: `def is_even(n):
    pass

def count_evens(numbers):
    pass

def describe(numbers):
    pass
`,
    checks: [
      { label: "is_even(4)", call: "is_even(4)", expect: "True", hint: "n % 2 == 0" },
      { label: "is_even(7)", call: "is_even(7)", expect: "False", hint: "It should return a real True/False." },
      { label: "count_evens([1, 2, 3, 4])", call: "count_evens([1, 2, 3, 4])", expect: "2", hint: "Loop over the numbers and count the ones where is_even is True." },
      { label: "describe([2, 4, 5])", call: "describe([2, 4, 5])", expect: "'2 of 3 are even'", hint: "f\"{count_evens(numbers)} of {len(numbers)} are even\"" },
      { label: "The functions build on each other", body: "__h1_src.count('is_even(') >= 2 and __h1_src.count('count_evens(') >= 2", hint: "count_evens should call is_even, and describe should call count_evens." },
    ],
    hints: [
      "is_even: return n % 2 == 0",
      "count_evens: loop through numbers, add 1 to a counter when is_even(n) is True, return the counter.",
      "describe: return f\"{count_evens(numbers)} of {len(numbers)} are even\"",
    ],
    solution: `def is_even(n):
    return n % 2 == 0

def count_evens(numbers):
    total = 0
    for n in numbers:
        if is_even(n):
            total += 1
    return total

def describe(numbers):
    return f"{count_evens(numbers)} of {len(numbers)} are even"`,
    quiz: [
      { q: "Why split code into small functions?", options: ["Python requires it", "Each piece can be reused, tested and changed in one place", "It runs faster", "It uses less memory"], answer: 1, why: "Small functions are easier to reuse, test and fix." },
    ],
  },

  // ===========================================================================
  // LEVEL 5
  // ===========================================================================
  {
    id: "py-24",
    level: 5,
    title: "Modules and imports",
    goal: "Use code other people have already written.",
    concept:
      "Python comes with a huge **standard library** of modules. You bring one in with `import`:\n\n" +
      "```python\nimport math\nprint(math.sqrt(144))     # 12.0\nprint(math.pi)\n\nfrom random import randint\nprint(randint(1, 6))      # a dice roll\n```\n\n" +
      "`import math` means you write `math.sqrt`. `from random import randint` lets you write just `randint`.\n\nUseful ones to know: `math`, `random`, `datetime`, `statistics`, `json`.",
    example: `import math
import statistics
from random import choice

print(math.ceil(4.2), math.floor(4.8))
print(statistics.mean([70, 80, 90]))
print(choice(["heads", "tails"]))`,
    task:
      "1. `import math` and store the area of a circle with radius 5 in `circle_area` (π × r²), **rounded to 2 decimal places**\n" +
      "2. store `math.sqrt(144)` in `root`\n" +
      "3. `from random import randint` and store a dice roll (1–6) in `roll`",
    starter: `# imports go at the top
`,
    checks: [
      { label: "circle_area is 78.54", body: "circle_area == 78.54", hint: "round(math.pi * 5 ** 2, 2)" },
      { label: "root is 12.0", body: "root == 12", hint: "math.sqrt(144)" },
      { label: "roll is a whole number from 1 to 6", body: "isinstance(roll, int) and 1 <= roll <= 6", hint: "randint(1, 6) includes both ends." },
      { label: "math was imported", body: "'import math' in __h1_src", hint: "Put import math on the first line." },
      { label: "randint was imported from random", body: "'from random import' in __h1_src and 'randint' in __h1_src", hint: "from random import randint" },
    ],
    hints: [
      "import math, then math.pi and math.sqrt are available.",
      "circle_area = round(math.pi * 5 ** 2, 2)",
      "from random import randint, then roll = randint(1, 6)",
    ],
    solution: `import math
from random import randint

circle_area = round(math.pi * 5 ** 2, 2)
root = math.sqrt(144)
roll = randint(1, 6)`,
    quiz: [
      { q: "After from math import sqrt, how do you call it?", options: ["math.sqrt(9)", "sqrt(9)", "import.sqrt(9)", "math(sqrt, 9)"], answer: 1, why: "from ... import brings the name in directly." },
    ],
  },
  {
    id: "py-25",
    level: 5,
    title: "Exceptions: try and except",
    goal: "Handle errors instead of crashing.",
    concept:
      "Some errors can't be avoided — someone types `forty` when you asked for a number. Instead of crashing, you can **catch** the error:\n\n" +
      "```python\ntry:\n    age = int(\"forty\")\nexcept ValueError:\n    print(\"That wasn't a number\")\n```\n\n" +
      "Python runs the `try` block; if a `ValueError` happens, it jumps to `except` instead of stopping.\n\n" +
      "Catch **specific** errors (`ValueError`, `ZeroDivisionError`) rather than everything — otherwise real bugs get hidden.",
    example: `for text in ["12", "twelve"]:
    try:
        print(int(text) * 2)
    except ValueError:
        print(f"Can't turn {text!r} into a number")`,
    task:
      "Write two functions that **never crash**:\n\n" +
      "- `safe_divide(a, b)` — returns `a / b`, or `None` if `b` is 0\n" +
      "- `to_number(text)` — returns `int(text)`, or `None` if it isn't a whole number\n\nUse `try` / `except` in both.",
    starter: `def safe_divide(a, b):
    pass

def to_number(text):
    pass
`,
    checks: [
      { label: "safe_divide(10, 2)", call: "safe_divide(10, 2)", expect: "5.0", hint: "return a / b inside the try." },
      { label: "safe_divide(1, 0)", call: "safe_divide(1, 0)", expect: "None", hint: "except ZeroDivisionError: return None" },
      { label: "to_number(\"42\")", call: "to_number('42')", expect: "42", hint: "return int(text) inside the try." },
      { label: "to_number(\"forty\")", call: "to_number('forty')", expect: "None", hint: "except ValueError: return None" },
      { label: "try/except was used", body: "__h1_src.count('try:') >= 2 and __h1_src.count('except') >= 2", hint: "Each function needs its own try and except." },
    ],
    hints: [
      "try: return a / b",
      "except ZeroDivisionError: return None",
      "to_number is the same shape, catching ValueError.",
    ],
    solution: `def safe_divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return None

def to_number(text):
    try:
        return int(text)
    except ValueError:
        return None`,
    quiz: [
      { q: "Which error does int(\"hello\") raise?", options: ["TypeError", "ValueError", "NameError", "ZeroDivisionError"], answer: 1, why: "The type (text) is fine but the value can't be converted." },
    ],
  },
  {
    id: "py-26",
    level: 5,
    title: "Reading and writing files",
    goal: "Save data to a file and read it back.",
    concept:
      "Open a file with `open(name, mode)` inside a `with` block, which closes it automatically:\n\n" +
      "```python\n# \"w\" = write (replaces what's in the file)\nwith open(\"notes.txt\", \"w\") as f:\n    f.write(\"Hello\")\n\n# no mode given = \"r\", read\nwith open(\"notes.txt\") as f:\n    text = f.read()\n```\n\n" +
      "Loop over a file to go line by line. `.strip()` removes the newline at the end of each line.\n\n" +
      "In H1 these are **real files** in a private folder that's fresh for every run.",
    example: `with open("diary.txt", "w") as f:
    f.write("Monday: started Python\\n")
    f.write("Tuesday: learned loops\\n")

with open("diary.txt") as f:
    for line in f:
        print(line.strip())`,
    files: { "scores.txt": "Asha,15\nRavi,12\nMeera,18\n" },
    task:
      "A file `scores.txt` already exists, with one `name,score` per line.\n\n" +
      "1. read it and add up the scores into `total`\n" +
      "2. write `Total: 45` (using the real total) to a new file `report.txt`\n" +
      "3. read `report.txt` back and print what's in it",
    starter: `total = 0
`,
    checks: [
      { label: "total is 45", body: "total == 45", hint: "For each line, split on the comma and add int(score) to total." },
      { label: "report.txt contains Total: 45", body: "open('report.txt').read().strip() == 'Total: 45'", hint: "with open(\"report.txt\", \"w\") as f: f.write(f\"Total: {total}\")" },
      { label: "The report was read back and printed", body: "'Total: 45' in lines", hint: "Open report.txt again (for reading) and print its contents." },
      { label: "with open was used", body: "'with open(' in __h1_src", hint: "Use with open(...) as f: so the file is closed for you." },
    ],
    hints: [
      "for line in f: gives each line. line.strip().split(\",\") gives [name, score].",
      "total += int(score)",
      "Write with mode \"w\", then open the file again without a mode to read it.",
    ],
    solution: `total = 0
with open("scores.txt") as f:
    for line in f:
        name, score = line.strip().split(",")
        total += int(score)

with open("report.txt", "w") as f:
    f.write(f"Total: {total}")

with open("report.txt") as f:
    print(f.read())`,
    quiz: [
      { q: "What does opening a file with \"w\" do to what's already in it?", options: ["Adds to the end", "Replaces it", "Reads it", "Nothing"], answer: 1, why: "\"w\" starts the file fresh. Use \"a\" to add to the end instead." },
    ],
  },
  {
    id: "py-27",
    level: 5,
    title: "List comprehensions",
    goal: "Build a new list in a single line.",
    concept:
      "A **list comprehension** makes a list from a loop, in one line:\n\n" +
      "```python\n# [1, 4, 9, 16, 25]\nsquares = [n * n for n in range(1, 6)]\n\n# with a filter: [0, 2, 4, 6, 8]\nevens = [n for n in range(10) if n % 2 == 0]\n```\n\n" +
      "Read it as: *give me `n * n`, for each `n` in the range*. It does exactly what a `for` loop with `append` does — just shorter.",
    example: `names = ["asha", "ravi", "meera"]
print([name.title() for name in names])
print([len(name) for name in names if len(name) > 4])`,
    task:
      "Using `numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]` and `names = [\"asha\", \"ravi\", \"meera\"]`, write **list comprehensions** for:\n\n" +
      "- `squares` — each number squared\n- `evens` — only the even numbers\n- `capitalised` — each name with a capital first letter",
    starter: `numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
names = ["asha", "ravi", "meera"]
`,
    checks: [
      { label: "squares is right", body: "squares == [n * n for n in range(1, 11)]", hint: "[n * n for n in numbers]" },
      { label: "evens is right", body: "evens == [2, 4, 6, 8, 10]", hint: "[n for n in numbers if n % 2 == 0]" },
      { label: "capitalised is right", body: "capitalised == ['Asha', 'Ravi', 'Meera']", hint: "[name.title() for name in names]" },
      { label: "Comprehensions were used", body: "len(__import__('re').findall(r'\\[[^\\]]+ for [^\\]]+ in [^\\]]+\\]', __h1_src)) >= 3", hint: "Write each one as [... for ... in ...]." },
    ],
    hints: [
      "[expression for item in list]",
      "Add a filter at the end: [n for n in numbers if n % 2 == 0]",
      "name.title() capitalises the first letter.",
    ],
    solution: `numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
names = ["asha", "ravi", "meera"]
squares = [n * n for n in numbers]
evens = [n for n in numbers if n % 2 == 0]
capitalised = [name.title() for name in names]`,
    quiz: [
      { q: "What is [x + 1 for x in [1, 2, 3]]?", options: ["[1, 2, 3]", "[2, 3, 4]", "[1, 2, 3, 1]", "6"], answer: 1, why: "1 is added to each item." },
    ],
  },
  {
    id: "py-28",
    level: 5,
    title: "Useful built-in functions",
    goal: "Let Python do the common work for you.",
    concept:
      "Built-ins you'll use constantly:\n\n" +
      "- `len`, `sum`, `min`, `max` — measure and total\n" +
      "- `sorted(items, reverse=True)` — a sorted copy\n" +
      "- `enumerate(items, 1)` — loop with a counter\n" +
      "- `zip(a, b)` — walk two lists side by side\n" +
      "- `round(x, 2)`, `abs(x)` — tidy numbers\n\n" +
      "```python\nfor place, name in enumerate([\"Asha\", \"Ravi\"], 1):\n    print(place, name)\n```",
    example: `names = ["Asha", "Ravi"]
marks = [88, 72]
for name, mark in zip(names, marks):
    print(name, mark)
print(sorted([3, 1, 2], reverse=True))`,
    task:
      "With the lists below:\n\n" +
      "- `highest` — the top mark\n- `ranked` — the marks from highest to lowest\n- `pairs` — a list of `(name, mark)` pairs, using `zip`\n- print each name numbered from 1, like `1. Asha`, **using `enumerate`**",
    starter: `names = ["Asha", "Ravi", "Meera", "Karan"]
marks = [72, 45, 90, 61]
`,
    checks: [
      { label: "highest is 90", body: "highest == 90 and 'max(' in __h1_src", hint: "max(marks)" },
      { label: "ranked is highest to lowest", body: "ranked == [90, 72, 61, 45]", hint: "sorted(marks, reverse=True)" },
      { label: "pairs matches names to marks", body: "pairs == [('Asha', 72), ('Ravi', 45), ('Meera', 90), ('Karan', 61)]", hint: "list(zip(names, marks))" },
      { label: "Names are numbered from 1", body: "['1. Asha', '2. Ravi', '3. Meera', '4. Karan'] == [l for l in lines if l[:1].isdigit()]", hint: "for i, name in enumerate(names, 1): print(f\"{i}. {name}\")" },
      { label: "enumerate and zip were used", body: "'enumerate(' in __h1_src and 'zip(' in __h1_src", hint: "Let the built-ins do the counting and pairing." },
    ],
    hints: [
      "highest = max(marks)",
      "pairs = list(zip(names, marks)) — zip on its own isn't a list yet.",
      "enumerate(names, 1) starts counting at 1.",
    ],
    solution: `names = ["Asha", "Ravi", "Meera", "Karan"]
marks = [72, 45, 90, 61]
highest = max(marks)
ranked = sorted(marks, reverse=True)
pairs = list(zip(names, marks))
for i, name in enumerate(names, 1):
    print(f"{i}. {name}")`,
    quiz: [
      { q: "What does sorted([3, 1, 2]) return?", options: ["[3, 1, 2]", "[1, 2, 3]", "None", "[3, 2, 1]"], answer: 1, why: "sorted returns a new list in ascending order." },
    ],
  },

  // ===========================================================================
  // LEVEL 6 — PROJECTS
  // ===========================================================================
  {
    id: "py-29",
    level: 6,
    title: "Project: Calculator",
    goal: "A calculator that handles mistakes gracefully.",
    concept:
      "Real programs need to cope with bad input. A calculator has to handle an unknown operator, and dividing by zero, **without crashing**.\n\n" +
      "The plan: one function that takes two numbers and an operator, decides what to do, and **returns** either the answer or a helpful message. Keeping the logic in a function means it can be tested — and later wired up to `input()`.",
    example: `def describe(op):
    names = {"+": "add", "-": "subtract", "*": "multiply", "/": "divide"}
    return names.get(op, "unknown")

print(describe("*"), describe("^"))`,
    task:
      "Write `calculate(a, op, b)`:\n\n" +
      "- `+`, `-`, `*`, `/` return the answer\n" +
      "- dividing by zero returns `\"Can't divide by zero\"`\n" +
      "- any other operator returns `\"Unknown operator\"`",
    starter: `def calculate(a, op, b):
    pass

# Try it:
print(calculate(6, "*", 7))
`,
    checks: [
      { label: "calculate(6, \"+\", 4)", call: "calculate(6, '+', 4)", expect: "10", hint: "if op == \"+\": return a + b" },
      { label: "calculate(6, \"-\", 4)", call: "calculate(6, '-', 4)", expect: "2", hint: "Subtraction." },
      { label: "calculate(6, \"*\", 7)", call: "calculate(6, '*', 7)", expect: "42", hint: "Multiplication." },
      { label: "calculate(9, \"/\", 2)", call: "calculate(9, '/', 2)", expect: "4.5", hint: "Division." },
      { label: "calculate(9, \"/\", 0)", call: "calculate(9, '/', 0)", expect: "\"Can't divide by zero\"", hint: "Check b == 0 before dividing." },
      { label: "calculate(2, \"^\", 3)", call: "calculate(2, '^', 3)", expect: "'Unknown operator'", hint: "Finish with an else that returns the message." },
    ],
    hints: [
      "Use if / elif for each operator.",
      "For division: if b == 0: return \"Can't divide by zero\"",
      "The final else returns \"Unknown operator\".",
    ],
    solution: `def calculate(a, op, b):
    if op == "+":
        return a + b
    elif op == "-":
        return a - b
    elif op == "*":
        return a * b
    elif op == "/":
        if b == 0:
            return "Can't divide by zero"
        return a / b
    else:
        return "Unknown operator"

print(calculate(6, "*", 7))`,
    quiz: [
      { q: "Why return a message instead of letting 9 / 0 crash?", options: ["It's faster", "So the program keeps working and the user knows what went wrong", "Python needs it", "It doesn't matter"], answer: 1, why: "Handling the problem keeps the program running." },
    ],
  },
  {
    id: "py-30",
    level: 6,
    title: "Project: Number guessing game",
    goal: "The logic behind a classic game.",
    concept:
      "A guessing game picks a secret number and tells the player *higher* or *lower* until they get it.\n\n" +
      "The trick to building (and testing) games is to **separate the rules from the randomness**. The rules — is a guess too low, too high, or right? — go in functions that take the secret as a parameter. Then `random` only picks the secret, and everything else can be checked exactly.",
    example: `from random import randint
secret = randint(1, 20)
print("I'm thinking of a number from 1 to 20")`,
    task:
      "Write:\n\n" +
      "- `check_guess(secret, guess)` → `\"Too low\"`, `\"Too high\"` or `\"Correct!\"`\n" +
      "- `play(secret, guesses)` → how many guesses it took to get it right (counting the correct one), or `-1` if none of them were right",
    starter: `def check_guess(secret, guess):
    pass

def play(secret, guesses):
    pass
`,
    checks: [
      { label: "check_guess(42, 30)", call: "check_guess(42, 30)", expect: "'Too low'", hint: "guess < secret" },
      { label: "check_guess(42, 50)", call: "check_guess(42, 50)", expect: "'Too high'", hint: "guess > secret" },
      { label: "check_guess(42, 42)", call: "check_guess(42, 42)", expect: "'Correct!'", hint: "Equal means correct." },
      { label: "play(7, [3, 9, 7, 1])", call: "play(7, [3, 9, 7, 1])", expect: "3", hint: "Stop counting at the correct guess." },
      { label: "play(7, [7])", call: "play(7, [7])", expect: "1", hint: "Getting it first time is 1 guess." },
      { label: "play(7, [1, 2])", call: "play(7, [1, 2])", expect: "-1", hint: "If you run out of guesses, return -1." },
    ],
    hints: [
      "check_guess: compare guess with secret using if / elif / else.",
      "play: loop with enumerate(guesses, 1) so you have the guess number.",
      "Return the number as soon as check_guess says Correct!, and return -1 after the loop.",
    ],
    solution: `def check_guess(secret, guess):
    if guess < secret:
        return "Too low"
    elif guess > secret:
        return "Too high"
    return "Correct!"

def play(secret, guesses):
    for number, guess in enumerate(guesses, 1):
        if check_guess(secret, guess) == "Correct!":
            return number
    return -1`,
    quiz: [
      { q: "Why pass secret into check_guess instead of picking it randomly inside?", options: ["It's shorter", "So the rules can be tested with a known number", "random doesn't work in functions", "No reason"], answer: 1, why: "Keeping randomness out of the rules makes them testable." },
    ],
  },
  {
    id: "py-31",
    level: 6,
    title: "Project: Quiz game",
    goal: "Mark answers fairly and report a score.",
    concept:
      "A quiz is a list of questions and answers — a perfect fit for a **list of tuples** or a **dictionary**.\n\n" +
      "Marking fairly means ignoring things that don't matter: `\"Paris\"`, `\" paris \"` and `\"PARIS\"` are all the same answer. `.strip()` removes spaces round the edges and `.lower()` ignores capitals.",
    example: `answer = "  PaRiS "
print(answer.strip().lower() == "paris")`,
    task:
      "Write:\n\n" +
      "- `score_quiz(questions, answers)` — `questions` is a list of `(question, correct_answer)` tuples; `answers` is the player's answers in order. Return how many are right, **ignoring capitals and extra spaces**.\n" +
      "- `percentage(score, total)` — the score as a whole-number percentage (use `round`)",
    starter: `QUESTIONS = [
    ("Capital of France?", "Paris"),
    ("2 + 2?", "4"),
    ("Largest planet?", "Jupiter"),
]

def score_quiz(questions, answers):
    pass

def percentage(score, total):
    pass
`,
    checks: [
      { label: "All right", call: "score_quiz(QUESTIONS, ['Paris', '4', 'Jupiter'])", expect: "3", hint: "Compare each answer with the correct one." },
      { label: "Ignores capitals and spaces", call: "score_quiz(QUESTIONS, ['  paris ', '4', 'JUPITER'])", expect: "3", hint: "Compare answer.strip().lower() with correct.lower()." },
      { label: "Counts wrong answers as wrong", call: "score_quiz(QUESTIONS, ['London', '4', 'Mars'])", expect: "1", hint: "Only add to the score when they match." },
      { label: "percentage(2, 3)", call: "percentage(2, 3)", expect: "67", hint: "round(score / total * 100)" },
      { label: "percentage(3, 3)", call: "percentage(3, 3)", expect: "100", hint: "Make sure it's a whole number." },
    ],
    hints: [
      "zip(questions, answers) pairs each question with the player's answer.",
      "Each question is a tuple: question, correct = item",
      "percentage: return round(score / total * 100)",
    ],
    solution: `QUESTIONS = [
    ("Capital of France?", "Paris"),
    ("2 + 2?", "4"),
    ("Largest planet?", "Jupiter"),
]

def score_quiz(questions, answers):
    score = 0
    for (question, correct), answer in zip(questions, answers):
        if answer.strip().lower() == correct.strip().lower():
            score += 1
    return score

def percentage(score, total):
    return round(score / total * 100)`,
    quiz: [
      { q: "What does \"  Hi \".strip() give?", options: ["\"  Hi \"", "\"Hi\"", "\"hi\"", "\"Hi \""], answer: 1, why: "strip removes spaces from both ends." },
    ],
  },
  {
    id: "py-32",
    level: 6,
    title: "Project: Password generator",
    goal: "Generate strong random passwords.",
    concept:
      "A strong password is long and random. Python's `random` module can pick characters, and the `string` module has ready-made character sets:\n\n" +
      "```python\nimport string\nstring.ascii_letters   # a-z and A-Z\nstring.digits          # 0-9\nstring.punctuation     # !\"#$%&'()*+,-./ and more\n```\n\n" +
      "`random.choice(text)` picks one character. Doing that in a loop — or with `\"\".join(...)` — builds the password. (For real security, Python's `secrets` module is even better, and works the same way.)",
    example: `import random
import string
print("".join(random.choice(string.digits) for _ in range(6)))`,
    task:
      "Write `make_password(length, use_symbols=False)` that returns a random password:\n\n" +
      "- exactly `length` characters long\n- made of letters and digits\n- also symbols from `string.punctuation` when `use_symbols` is True",
    starter: `import random
import string

def make_password(length, use_symbols=False):
    pass
`,
    checks: [
      { label: "It's the right length", body: "len(make_password(12)) == 12 and len(make_password(30)) == 30", hint: "Pick length characters." },
      { label: "Only letters and digits by default", body: "all(c.isalnum() and c.isascii() for c in make_password(200))", hint: "Start from string.ascii_letters + string.digits." },
      { label: "Includes symbols when asked", body: "any(c in __import__('string').punctuation for c in make_password(200, True))", hint: "Add string.punctuation to the allowed characters when use_symbols is True." },
      { label: "It's actually random", body: "len({make_password(16) for _ in range(5)}) == 5", hint: "Use random.choice (or secrets.choice) for every character." },
    ],
    hints: [
      "allowed = string.ascii_letters + string.digits",
      "if use_symbols: allowed += string.punctuation",
      "return \"\".join(random.choice(allowed) for _ in range(length))",
    ],
    solution: `import random
import string

def make_password(length, use_symbols=False):
    allowed = string.ascii_letters + string.digits
    if use_symbols:
        allowed += string.punctuation
    return "".join(random.choice(allowed) for _ in range(length))`,
    quiz: [
      { q: "What does \"\".join([\"a\", \"b\", \"c\"]) give?", options: ["[\"abc\"]", "\"a b c\"", "\"abc\"", "\"a,b,c\""], answer: 2, why: "join glues the pieces together with the text before .join — here, nothing." },
    ],
  },
  {
    id: "py-33",
    level: 6,
    title: "Project: Unit converter",
    goal: "Convert between units without a mountain of if statements.",
    concept:
      "A converter with an `if` for every pair of units gets huge fast. A neater approach: convert everything to **one base unit** first, then to the target.\n\n" +
      "For lengths, store how many metres each unit is:\n\n" +
      "```python\nMETRES = {\"km\": 1000, \"m\": 1, \"cm\": 0.01}\nmetres = value * METRES[from_unit]\nresult = metres / METRES[to_unit]\n```\n\n" +
      "Temperature doesn't scale like that, so it gets its own formula: `F = C × 9/5 + 32`.",
    example: `METRES = {"km": 1000, "m": 1, "cm": 0.01}
value = 2.5
print(value * METRES["km"] / METRES["cm"], "cm")`,
    task:
      "Write `convert(value, from_unit, to_unit)` that:\n\n" +
      "- converts between `km`, `m` and `cm`\n- converts between `c` and `f` (Celsius and Fahrenheit)\n- returns the answer **rounded to 2 decimal places**\n- returns `None` for any conversion it doesn't know",
    starter: `METRES = {"km": 1000, "m": 1, "cm": 0.01}

def convert(value, from_unit, to_unit):
    pass
`,
    checks: [
      { label: "convert(2.5, \"km\", \"m\")", call: "convert(2.5, 'km', 'm')", expect: "2500.0", hint: "value * METRES[from_unit] / METRES[to_unit]" },
      { label: "convert(150, \"cm\", \"m\")", call: "convert(150, 'cm', 'm')", expect: "1.5", hint: "The same formula works in every direction." },
      { label: "convert(100, \"c\", \"f\")", call: "convert(100, 'c', 'f')", expect: "212.0", hint: "value * 9 / 5 + 32" },
      { label: "convert(98.6, \"f\", \"c\")", call: "convert(98.6, 'f', 'c')", expect: "37.0", hint: "(value - 32) * 5 / 9, then round to 2 places." },
      { label: "convert(5, \"km\", \"kg\")", call: "convert(5, 'km', 'kg')", expect: "None", hint: "If the units aren't a pair you know, return None." },
    ],
    hints: [
      "if from_unit in METRES and to_unit in METRES: handle lengths.",
      "elif from_unit == \"c\" and to_unit == \"f\": and the reverse.",
      "Wrap each answer in round(..., 2), and return None at the end.",
    ],
    solution: `METRES = {"km": 1000, "m": 1, "cm": 0.01}

def convert(value, from_unit, to_unit):
    if from_unit in METRES and to_unit in METRES:
        return round(value * METRES[from_unit] / METRES[to_unit], 2)
    if from_unit == "c" and to_unit == "f":
        return round(value * 9 / 5 + 32, 2)
    if from_unit == "f" and to_unit == "c":
        return round((value - 32) * 5 / 9, 2)
    return None`,
    quiz: [
      { q: "Why convert to a base unit first?", options: ["It's more accurate", "It avoids writing a separate rule for every pair of units", "Python requires it", "It uses less memory"], answer: 1, why: "With a base unit, adding a new unit is one line, not many new rules." },
    ],
  },
  {
    id: "py-34",
    level: 6,
    title: "Project: Text adventure",
    goal: "A game world made of data.",
    concept:
      "A text adventure is mostly **data**: rooms, what they look like, and which way leads where. A dictionary of dictionaries describes the whole map:\n\n" +
      "```python\nROOMS = {\n    \"hall\": {\"description\": \"A long hall.\", \"exits\": {\"north\": \"library\"}},\n    \"library\": {\"description\": \"Dusty books.\", \"exits\": {\"south\": \"hall\"}},\n}\n```\n\n" +
      "Then the game logic is tiny: look up the current room, check whether the direction is one of its exits, and move. Adding a room never means changing the code.",
    example: `ROOMS = {"hall": {"description": "A long hall.", "exits": {"north": "library"}}}
print(ROOMS["hall"]["exits"].get("north"))
print(ROOMS["hall"]["exits"].get("west"))`,
    task:
      "Using the `ROOMS` map provided, write:\n\n" +
      "- `move(room, direction)` → the room you end up in; if there's no exit that way, stay in the same room\n" +
      "- `describe(room)` → text like `Hall: A long, echoing hall. Exits: east, north` (exits in **alphabetical order**)",
    starter: `ROOMS = {
    "hall": {"description": "A long, echoing hall.", "exits": {"north": "library", "east": "kitchen"}},
    "library": {"description": "Shelves of dusty books.", "exits": {"south": "hall"}},
    "kitchen": {"description": "It smells of fresh bread.", "exits": {"west": "hall", "down": "cellar"}},
    "cellar": {"description": "Dark and cold.", "exits": {"up": "kitchen"}},
}

def move(room, direction):
    pass

def describe(room):
    pass
`,
    checks: [
      { label: "move(\"hall\", \"north\")", call: "move('hall', 'north')", expect: "'library'", hint: "ROOMS[room][\"exits\"] is a dictionary of direction → room." },
      { label: "move(\"kitchen\", \"down\")", call: "move('kitchen', 'down')", expect: "'cellar'", hint: "Look the direction up in the current room's exits." },
      { label: "move(\"library\", \"west\") — no exit", call: "move('library', 'west')", expect: "'library'", hint: "Use .get(direction, room) so an unknown direction keeps you where you are." },
      { label: "describe(\"hall\")", call: "describe('hall')", expect: "'Hall: A long, echoing hall. Exits: east, north'", hint: "room.title(), the description, then the sorted exits joined with \", \"." },
      { label: "describe(\"cellar\")", call: "describe('cellar')", expect: "'Cellar: Dark and cold. Exits: up'", hint: "Make sure it works for a room with one exit." },
    ],
    hints: [
      "move: return ROOMS[room][\"exits\"].get(direction, room)",
      "The exits' names are the dictionary's keys: sorted(ROOMS[room][\"exits\"])",
      "describe: f\"{room.title()}: {description} Exits: {', '.join(exits)}\"",
    ],
    solution: `ROOMS = {
    "hall": {"description": "A long, echoing hall.", "exits": {"north": "library", "east": "kitchen"}},
    "library": {"description": "Shelves of dusty books.", "exits": {"south": "hall"}},
    "kitchen": {"description": "It smells of fresh bread.", "exits": {"west": "hall", "down": "cellar"}},
    "cellar": {"description": "Dark and cold.", "exits": {"up": "kitchen"}},
}

def move(room, direction):
    return ROOMS[room]["exits"].get(direction, room)

def describe(room):
    exits = ", ".join(sorted(ROOMS[room]["exits"]))
    return f"{room.title()}: {ROOMS[room]['description']} Exits: {exits}"`,
    quiz: [
      { q: "What does d.get(\"x\", 5) return when \"x\" isn't a key in d?", options: ["None", "An error", "5", "\"x\""], answer: 2, why: "get returns the second argument when the key is missing." },
    ],
  },
  {
    id: "py-35",
    level: 6,
    title: "Project: To-do list",
    goal: "Store tasks as data and change them safely.",
    concept:
      "Each task has more than one fact about it — its title and whether it's done — so each task is a **dictionary**, and the list of tasks is a **list of dictionaries**:\n\n" +
      "```python\ntasks = [\n    {\"title\": \"Maths homework\", \"done\": True},\n    {\"title\": \"Read chapter 4\", \"done\": False},\n]\n```\n\n" +
      "Functions that add or change tasks should **return** the list, so they can be chained and tested. Don't forget to guard against an index that doesn't exist.",
    example: `tasks = [{"title": "Read", "done": False}]
tasks[0]["done"] = True
print(sum(1 for t in tasks if t["done"]))`,
    task:
      "Write:\n\n" +
      "- `add_task(tasks, title)` — adds `{\"title\": title, \"done\": False}` and returns `tasks`\n" +
      "- `complete_task(tasks, index)` — marks that task done (ignoring an index that doesn't exist) and returns `tasks`\n" +
      "- `summary(tasks)` — returns text like `2 of 3 done`",
    starter: `def add_task(tasks, title):
    pass

def complete_task(tasks, index):
    pass

def summary(tasks):
    pass
`,
    checks: [
      { label: "add_task([], \"Read\")", call: "add_task([], 'Read')", expect: "[{'title': 'Read', 'done': False}]", hint: "tasks.append({...}) then return tasks." },
      { label: "Complete the first of two", call: "complete_task(add_task(add_task([], 'A'), 'B'), 0)", expect: "[{'title': 'A', 'done': True}, {'title': 'B', 'done': False}]", hint: "tasks[index][\"done\"] = True" },
      { label: "An index that doesn't exist is ignored", call: "complete_task(add_task([], 'A'), 5)", expect: "[{'title': 'A', 'done': False}]", hint: "Only change it if 0 <= index < len(tasks)." },
      { label: "summary of 2 done out of 3", call: "summary([{'title': 'a', 'done': True}, {'title': 'b', 'done': True}, {'title': 'c', 'done': False}])", expect: "'2 of 3 done'", hint: "Count the tasks where done is True." },
      { label: "summary of an empty list", call: "summary([])", expect: "'0 of 0 done'", hint: "Make sure it works with no tasks at all." },
    ],
    hints: [
      "add_task: tasks.append({\"title\": title, \"done\": False}) and return tasks",
      "complete_task: if 0 <= index < len(tasks): tasks[index][\"done\"] = True",
      "summary: done = sum(1 for t in tasks if t[\"done\"])",
    ],
    solution: `def add_task(tasks, title):
    tasks.append({"title": title, "done": False})
    return tasks

def complete_task(tasks, index):
    if 0 <= index < len(tasks):
        tasks[index]["done"] = True
    return tasks

def summary(tasks):
    done = sum(1 for t in tasks if t["done"])
    return f"{done} of {len(tasks)} done"`,
    quiz: [
      { q: "Why check 0 <= index < len(tasks) before changing a task?", options: ["It's faster", "To avoid an IndexError for a task that doesn't exist", "Python needs it", "To sort the list"], answer: 1, why: "An index outside the list would crash the program." },
    ],
  },
  {
    id: "py-36",
    level: 6,
    title: "Project: Study tracker",
    goal: "Log study sessions and summarise them.",
    concept:
      "A study tracker stores sessions — what you studied and for how long — and answers questions about them: *how long in total? how long per subject? what did I study most?*\n\n" +
      "Grouping by subject is a classic dictionary pattern:\n\n" +
      "```python\ntotals = {}\nfor session in log:\n    subject = session[\"subject\"]\n    totals[subject] = totals.get(subject, 0) + session[\"minutes\"]\n```",
    example: `log = [("Maths", 30), ("Science", 20), ("Maths", 15)]
totals = {}
for subject, minutes in log:
    totals[subject] = totals.get(subject, 0) + minutes
print(totals)`,
    task:
      "Sessions are dictionaries like `{\"subject\": \"Maths\", \"minutes\": 30}`. Write:\n\n" +
      "- `log_session(log, subject, minutes)` — adds a session and returns `log`\n" +
      "- `total_minutes(log)` — all minutes added up\n" +
      "- `minutes_by_subject(log)` — a dictionary of subject → total minutes\n" +
      "- `top_subject(log)` — the subject with the most minutes, or `None` for an empty log",
    starter: `def log_session(log, subject, minutes):
    pass

def total_minutes(log):
    pass

def minutes_by_subject(log):
    pass

def top_subject(log):
    pass

SAMPLE = [
    {"subject": "Maths", "minutes": 30},
    {"subject": "Science", "minutes": 20},
    {"subject": "Maths", "minutes": 15},
]
`,
    checks: [
      { label: "log_session adds a session", call: "log_session([], 'History', 25)", expect: "[{'subject': 'History', 'minutes': 25}]", hint: "log.append({\"subject\": subject, \"minutes\": minutes}) and return log." },
      { label: "total_minutes(SAMPLE)", call: "total_minutes(SAMPLE)", expect: "65", hint: "sum(s[\"minutes\"] for s in log)" },
      { label: "minutes_by_subject(SAMPLE)", call: "minutes_by_subject(SAMPLE)", expect: "{'Maths': 45, 'Science': 20}", hint: "totals[subject] = totals.get(subject, 0) + minutes" },
      { label: "top_subject(SAMPLE)", call: "top_subject(SAMPLE)", expect: "'Maths'", hint: "max(totals, key=totals.get) finds the key with the biggest value." },
      { label: "top_subject([])", call: "top_subject([])", expect: "None", hint: "Return None when there are no sessions." },
    ],
    hints: [
      "total_minutes: return sum(s[\"minutes\"] for s in log)",
      "minutes_by_subject: start with {} and use .get(subject, 0).",
      "top_subject: if not log: return None, then max(totals, key=totals.get).",
    ],
    solution: `def log_session(log, subject, minutes):
    log.append({"subject": subject, "minutes": minutes})
    return log

def total_minutes(log):
    return sum(s["minutes"] for s in log)

def minutes_by_subject(log):
    totals = {}
    for s in log:
        totals[s["subject"]] = totals.get(s["subject"], 0) + s["minutes"]
    return totals

def top_subject(log):
    if not log:
        return None
    totals = minutes_by_subject(log)
    return max(totals, key=totals.get)

SAMPLE = [
    {"subject": "Maths", "minutes": 30},
    {"subject": "Science", "minutes": 20},
    {"subject": "Maths", "minutes": 15},
]`,
    quiz: [
      { q: "What does totals.get(\"Art\", 0) return if \"Art\" isn't in totals?", options: ["None", "An error", "0", "\"Art\""], answer: 2, why: "The second argument is the default when the key is missing." },
    ],
  },
  {
    id: "py-37",
    level: 6,
    title: "Project: Rock, paper, scissors",
    goal: "Game rules as data, not a tangle of if statements.",
    concept:
      "Rock, paper, scissors has nine possible pairs. Writing an `if` for each is messy. Instead, store **what beats what**:\n\n" +
      "```python\nBEATS = {\"rock\": \"scissors\", \"paper\": \"rock\", \"scissors\": \"paper\"}\n```\n\n" +
      "Now one line decides a round: if `BEATS[player] == computer`, the player wins. This is the same idea as the unit converter: **when rules follow a pattern, put the pattern in data.**",
    example: `BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}
print(BEATS["paper"] == "rock")`,
    task:
      "Write:\n\n" +
      "- `winner(player, computer)` → `\"player\"`, `\"computer\"` or `\"draw\"`; return `\"invalid\"` if either choice isn't rock, paper or scissors. Ignore capitals.\n" +
      "- `play_round(player, computer)` → a message: `You win! rock beats scissors`, `Computer wins! paper beats rock`, `Draw!`, or `Invalid move`",
    starter: `BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}

def winner(player, computer):
    pass

def play_round(player, computer):
    pass
`,
    checks: [
      { label: "winner(\"rock\", \"scissors\")", call: "winner('rock', 'scissors')", expect: "'player'", hint: "BEATS[player] == computer means the player wins." },
      { label: "winner(\"rock\", \"paper\")", call: "winner('rock', 'paper')", expect: "'computer'", hint: "BEATS[computer] == player means the computer wins." },
      { label: "winner(\"Paper\", \"paper\")", call: "winner('Paper', 'paper')", expect: "'draw'", hint: "Lower-case both choices first." },
      { label: "winner(\"lizard\", \"rock\")", call: "winner('lizard', 'rock')", expect: "'invalid'", hint: "Check both choices are keys in BEATS." },
      { label: "play_round(\"scissors\", \"paper\")", call: "play_round('scissors', 'paper')", expect: "'You win! scissors beats paper'", hint: "Use winner() and build the message from it." },
      { label: "play_round(\"rock\", \"paper\")", call: "play_round('rock', 'paper')", expect: "'Computer wins! paper beats rock'", hint: "When the computer wins, its choice comes first." },
      { label: "play_round(\"rock\", \"rock\")", call: "play_round('rock', 'rock')", expect: "'Draw!'", hint: "A draw has no \"beats\" part." },
      { label: "play_round(\"banana\", \"rock\")", call: "play_round('banana', 'rock')", expect: "'Invalid move'", hint: "Handle the invalid case first." },
    ],
    hints: [
      "winner: player, computer = player.lower(), computer.lower(), then check both are in BEATS.",
      "If they're equal it's a draw; if BEATS[player] == computer the player wins; otherwise the computer does.",
      "play_round: result = winner(player, computer), then return the right message for each result.",
    ],
    solution: `BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}

def winner(player, computer):
    player, computer = player.lower(), computer.lower()
    if player not in BEATS or computer not in BEATS:
        return "invalid"
    if player == computer:
        return "draw"
    if BEATS[player] == computer:
        return "player"
    return "computer"

def play_round(player, computer):
    result = winner(player, computer)
    player, computer = player.lower(), computer.lower()
    if result == "invalid":
        return "Invalid move"
    if result == "draw":
        return "Draw!"
    if result == "player":
        return f"You win! {player} beats {computer}"
    return f"Computer wins! {computer} beats {player}"`,
    quiz: [
      { q: "With BEATS = {\"rock\": \"scissors\", ...}, how do you know rock beats scissors?", options: ["BEATS[\"scissors\"] == \"rock\"", "BEATS[\"rock\"] == \"scissors\"", "\"rock\" > \"scissors\"", "BEATS.rock"], answer: 1, why: "Each key maps to the choice it beats." },
    ],
  },
];

export function getPythonLesson(id) {
  return PY_LESSONS.find((l) => l.id === id) || null;
}
