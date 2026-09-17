// Coding challenges: short Python problems, each marked by real tests on real CPython.
//
// Checks use the same format as the course (see pythonCurriculum.js). Most challenges ask for a
// function, so the tests are `call`/`expect` test cases — when one fails, the student sees the
// value their function actually returned next to the one expected, which is most of debugging.

export const DIFFICULTIES = [
  { id: "beginner", label: "Beginner", xp: 10 },
  { id: "easy", label: "Easy", xp: 20 },
  { id: "medium", label: "Medium", xp: 35 },
  { id: "hard", label: "Hard", xp: 50 },
];

export function difficultyInfo(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[0];
}

// Failed attempts before the solution can be opened. Enough to make a real try, not so many
// that someone stuck gives up instead.
export const SOLUTION_UNLOCK_ATTEMPTS = 3;

export const CHALLENGES = [
  // ---------------------------------------------------------------------------
  // BEGINNER
  // ---------------------------------------------------------------------------
  {
    id: "ch-hello",
    difficulty: "beginner",
    title: "Hello, World!",
    topic: "print",
    prompt: "Every programmer's first program. Print exactly:\n\n`Hello, World!`",
    starter: "# Print the message\n",
    checks: [
      { label: "Prints exactly Hello, World!", body: "lines == ['Hello, World!']", hint: "Capital H, capital W, a comma and an exclamation mark — and nothing else printed." },
    ],
    hints: ["print() shows text in the output.", "Text goes in quotes inside the brackets.", "print(\"Hello, World!\")"],
    solution: `print("Hello, World!")`,
    explanation: "`print()` writes its argument to the output followed by a newline. The quotes make it a string, so Python prints the text exactly as written.",
  },
  {
    id: "ch-seconds",
    difficulty: "beginner",
    title: "Seconds in a day",
    topic: "arithmetic",
    prompt: "Work out how many seconds there are in a day and store it in `seconds`, then print it.\n\n**Calculate it** from hours, minutes and seconds — don't type the final number.",
    starter: "# seconds = ...\n",
    checks: [
      { label: "seconds is 86400", body: "seconds == 86400", hint: "24 hours × 60 minutes × 60 seconds." },
      { label: "It was calculated", body: "'86400' not in __h1_src and '*' in __h1_src", hint: "Write the multiplication out so Python does the maths." },
      { label: "It was printed", body: "'86400' in lines", hint: "print(seconds)" },
    ],
    hints: ["A day has 24 hours, an hour has 60 minutes, a minute has 60 seconds.", "Multiply them together with *.", "seconds = 24 * 60 * 60, then print(seconds)"],
    solution: `seconds = 24 * 60 * 60
print(seconds)`,
    explanation: "Writing `24 * 60 * 60` instead of `86400` makes the code explain itself — anyone reading it can see where the number comes from, and it's much harder to get wrong.",
  },
  {
    id: "ch-double",
    difficulty: "beginner",
    title: "Double it",
    topic: "functions",
    prompt: "Write a function `double(n)` that **returns** `n` multiplied by 2.",
    starter: "def double(n):\n    pass\n",
    checks: [
      { label: "double(4)", call: "double(4)", expect: "8" },
      { label: "double(0)", call: "double(0)", expect: "0" },
      { label: "double(-3)", call: "double(-3)", expect: "-6" },
      { label: "double(2.5)", call: "double(2.5)", expect: "5.0", hint: "It should work for decimals too." },
    ],
    hints: ["Replace pass with a return statement.", "The value to return is n times 2.", "return n * 2"],
    solution: `def double(n):
    return n * 2`,
    explanation: "`return` sends a value back to whoever called the function. Because `*` works for both whole numbers and decimals, one line handles every test.",
  },
  {
    id: "ch-last-letter",
    difficulty: "beginner",
    title: "Last character",
    topic: "strings",
    prompt: "Write `last_char(text)` that returns the last character of a string.",
    starter: "def last_char(text):\n    pass\n",
    checks: [
      { label: "last_char(\"python\")", call: "last_char('python')", expect: "'n'" },
      { label: "last_char(\"a\")", call: "last_char('a')", expect: "'a'" },
      { label: "last_char(\"Hello!\")", call: "last_char('Hello!')", expect: "'!'" },
    ],
    hints: ["Strings can be indexed like lists.", "Negative indexes count from the end.", "return text[-1]"],
    solution: `def last_char(text):
    return text[-1]`,
    explanation: "`text[-1]` is the last character whatever the length. The alternative, `text[len(text) - 1]`, works too but is easier to get wrong.",
  },
  {
    id: "ch-is-even",
    difficulty: "beginner",
    title: "Is it even?",
    topic: "booleans",
    prompt: "Write `is_even(n)` that returns `True` if `n` is even and `False` if it's odd.",
    starter: "def is_even(n):\n    pass\n",
    checks: [
      { label: "is_even(4)", call: "is_even(4)", expect: "True" },
      { label: "is_even(7)", call: "is_even(7)", expect: "False" },
      { label: "is_even(0)", call: "is_even(0)", expect: "True", hint: "Zero is even." },
      { label: "is_even(-2)", call: "is_even(-2)", expect: "True" },
    ],
    hints: ["% gives the remainder after dividing.", "An even number has remainder 0 when divided by 2.", "return n % 2 == 0"],
    solution: `def is_even(n):
    return n % 2 == 0`,
    explanation: "The comparison `n % 2 == 0` already *is* `True` or `False`, so there's no need for an `if` — return the comparison directly.",
  },
  {
    id: "ch-shout",
    difficulty: "beginner",
    title: "Shout it",
    topic: "strings",
    prompt: "Write `shout(text)` that returns the text in capitals with an exclamation mark on the end.\n\n`shout(\"hi\")` → `\"HI!\"`",
    starter: "def shout(text):\n    pass\n",
    checks: [
      { label: "shout(\"hi\")", call: "shout('hi')", expect: "'HI!'" },
      { label: "shout(\"Stop\")", call: "shout('Stop')", expect: "'STOP!'" },
      { label: "shout(\"\")", call: "shout('')", expect: "'!'", hint: "An empty string should still get its exclamation mark." },
    ],
    hints: ["Strings have an .upper() method.", "+ joins two strings together.", "return text.upper() + \"!\""],
    solution: `def shout(text):
    return text.upper() + "!"`,
    explanation: "`.upper()` returns a new capitalised string (strings never change in place), and `+` joins it to `\"!\"`.",
  },

  // ---------------------------------------------------------------------------
  // EASY
  // ---------------------------------------------------------------------------
  {
    id: "ch-fizzbuzz",
    difficulty: "easy",
    title: "FizzBuzz",
    topic: "conditions",
    prompt:
      "The classic. Write `fizzbuzz(n)` that returns:\n\n- `\"FizzBuzz\"` if `n` is divisible by both 3 and 5\n- `\"Fizz\"` if divisible by 3\n- `\"Buzz\"` if divisible by 5\n- otherwise, the number as a string (`\"7\"`)",
    starter: "def fizzbuzz(n):\n    pass\n",
    checks: [
      { label: "fizzbuzz(3)", call: "fizzbuzz(3)", expect: "'Fizz'" },
      { label: "fizzbuzz(5)", call: "fizzbuzz(5)", expect: "'Buzz'" },
      { label: "fizzbuzz(15)", call: "fizzbuzz(15)", expect: "'FizzBuzz'", hint: "Check for both 3 and 5 first — otherwise 15 stops at \"Fizz\"." },
      { label: "fizzbuzz(30)", call: "fizzbuzz(30)", expect: "'FizzBuzz'" },
      { label: "fizzbuzz(7)", call: "fizzbuzz(7)", expect: "'7'", hint: "Return str(n), not n." },
      { label: "fizzbuzz(1)", call: "fizzbuzz(1)", expect: "'1'" },
    ],
    hints: ["Divisible means n % something == 0.", "Order matters: test the \"both\" case before the single ones.", "if n % 15 == 0: return \"FizzBuzz\", then elif for 3 and 5, else return str(n)."],
    solution: `def fizzbuzz(n):
    if n % 15 == 0:
        return "FizzBuzz"
    elif n % 3 == 0:
        return "Fizz"
    elif n % 5 == 0:
        return "Buzz"
    return str(n)`,
    explanation: "The trap is order: 15 is divisible by 3, so if the `% 3` test comes first it returns `\"Fizz\"` and never reaches the combined case. Anything divisible by both 3 and 5 is divisible by 15, so that test goes first.",
  },
  {
    id: "ch-vowels",
    difficulty: "easy",
    title: "Count the vowels",
    topic: "loops",
    prompt: "Write `count_vowels(text)` that returns how many vowels (a, e, i, o, u) are in the text, **ignoring capitals**.",
    starter: "def count_vowels(text):\n    pass\n",
    checks: [
      { label: "count_vowels(\"Programming\")", call: "count_vowels('Programming')", expect: "3" },
      { label: "count_vowels(\"AEIOU\")", call: "count_vowels('AEIOU')", expect: "5", hint: "Capital vowels count too — lower-case the text first." },
      { label: "count_vowels(\"rhythm\")", call: "count_vowels('rhythm')", expect: "0" },
      { label: "count_vowels(\"\")", call: "count_vowels('')", expect: "0" },
    ],
    hints: ["Loop over each character of the text.", "letter in \"aeiou\" is True for a vowel.", "Lower-case with text.lower(), then count the letters that are in \"aeiou\"."],
    solution: `def count_vowels(text):
    count = 0
    for letter in text.lower():
        if letter in "aeiou":
            count += 1
    return count`,
    explanation: "Lower-casing once up front means one check handles both cases. A shorter version is `sum(1 for c in text.lower() if c in \"aeiou\")`.",
  },
  {
    id: "ch-largest",
    difficulty: "easy",
    title: "Largest without max()",
    topic: "loops",
    prompt: "Write `largest(numbers)` that returns the biggest number in a non-empty list — **without using `max()`** or sorting.",
    starter: "def largest(numbers):\n    pass\n",
    checks: [
      { label: "largest([3, 9, 2])", call: "largest([3, 9, 2])", expect: "9" },
      { label: "largest([-5, -2, -9])", call: "largest([-5, -2, -9])", expect: "-2", hint: "Starting your \"biggest so far\" at 0 breaks for all-negative lists — start from the first item." },
      { label: "largest([7])", call: "largest([7])", expect: "7" },
      { label: "Doesn't use max() or sorting", body: "'max(' not in __h1_src and 'sort' not in __h1_src", hint: "Keep track of the biggest value yourself as you loop." },
    ],
    hints: ["Keep a variable holding the biggest number seen so far.", "Start it at numbers[0], not 0.", "Loop through; whenever n > biggest, set biggest = n."],
    solution: `def largest(numbers):
    biggest = numbers[0]
    for n in numbers:
        if n > biggest:
            biggest = n
    return biggest`,
    explanation: "This \"best so far\" pattern is how `max()` works inside. Starting from `numbers[0]` rather than `0` is what makes it correct for lists of negative numbers.",
  },
  {
    id: "ch-reverse-words",
    difficulty: "easy",
    title: "Reverse the words",
    topic: "lists",
    prompt: "Write `reverse_words(sentence)` that returns the words in reverse order.\n\n`reverse_words(\"I love Python\")` → `\"Python love I\"`",
    starter: "def reverse_words(sentence):\n    pass\n",
    checks: [
      { label: "reverse_words(\"I love Python\")", call: "reverse_words('I love Python')", expect: "'Python love I'" },
      { label: "reverse_words(\"one\")", call: "reverse_words('one')", expect: "'one'" },
      { label: "reverse_words(\"a b c d\")", call: "reverse_words('a b c d')", expect: "'d c b a'" },
    ],
    hints: ["sentence.split() turns the sentence into a list of words.", "A list can be reversed with [::-1].", "\" \".join(...) turns a list of words back into a sentence."],
    solution: `def reverse_words(sentence):
    return " ".join(sentence.split()[::-1])`,
    explanation: "Split into a list, reverse the list, join it back with spaces. Reversing the *string* with `[::-1]` would reverse the letters too — the list step is what keeps each word intact.",
  },
  {
    id: "ch-digit-sum",
    difficulty: "easy",
    title: "Sum of digits",
    topic: "loops",
    prompt: "Write `digit_sum(n)` that adds up the digits of a non-negative whole number.\n\n`digit_sum(1234)` → `10`",
    starter: "def digit_sum(n):\n    pass\n",
    checks: [
      { label: "digit_sum(1234)", call: "digit_sum(1234)", expect: "10" },
      { label: "digit_sum(0)", call: "digit_sum(0)", expect: "0" },
      { label: "digit_sum(9999)", call: "digit_sum(9999)", expect: "36" },
      { label: "digit_sum(1000001)", call: "digit_sum(1000001)", expect: "2" },
    ],
    hints: ["str(n) lets you loop over the digits as characters.", "int(\"7\") turns a digit character back into a number.", "return sum(int(d) for d in str(n))"],
    solution: `def digit_sum(n):
    return sum(int(d) for d in str(n))`,
    explanation: "Turning the number into text makes each digit easy to reach. The purely mathematical way — `n % 10` for the last digit, `n // 10` to drop it, in a loop — is worth knowing too.",
  },
  {
    id: "ch-passes",
    difficulty: "easy",
    title: "Count the passes",
    topic: "functions",
    prompt: "Write `count_passes(marks, pass_mark=40)` that returns how many marks are **at or above** the pass mark. The pass mark is optional and defaults to 40.",
    starter: "def count_passes(marks, pass_mark=40):\n    pass\n",
    checks: [
      { label: "count_passes([35, 40, 72, 12])", call: "count_passes([35, 40, 72, 12])", expect: "2", hint: "40 itself is a pass — use >=." },
      { label: "count_passes([50, 60], 70)", call: "count_passes([50, 60], 70)", expect: "0" },
      { label: "count_passes([], 50)", call: "count_passes([], 50)", expect: "0" },
      { label: "count_passes([90, 80], pass_mark=80)", call: "count_passes([90, 80], pass_mark=80)", expect: "2" },
    ],
    hints: ["Loop through the marks and count.", "The condition is mark >= pass_mark.", "return len([m for m in marks if m >= pass_mark])"],
    solution: `def count_passes(marks, pass_mark=40):
    return len([m for m in marks if m >= pass_mark])`,
    explanation: "A default parameter makes the common case short (`count_passes(marks)`) while still allowing a different pass mark. The comprehension builds the list of passes and `len` counts them.",
  },

  // ---------------------------------------------------------------------------
  // MEDIUM
  // ---------------------------------------------------------------------------
  {
    id: "ch-palindrome",
    difficulty: "medium",
    title: "Palindromes",
    topic: "strings",
    prompt: "Write `is_palindrome(text)` that returns `True` if the text reads the same forwards and backwards, **ignoring capitals, spaces and punctuation**.\n\n`\"A man, a plan, a canal: Panama\"` is a palindrome.",
    starter: "def is_palindrome(text):\n    pass\n",
    checks: [
      { label: "is_palindrome(\"Racecar\")", call: "is_palindrome('Racecar')", expect: "True" },
      { label: "is_palindrome(\"A man, a plan, a canal: Panama\")", call: "is_palindrome('A man, a plan, a canal: Panama')", expect: "True", hint: "Keep only letters and digits (c.isalnum()) before comparing." },
      { label: "is_palindrome(\"hello\")", call: "is_palindrome('hello')", expect: "False" },
      { label: "is_palindrome(\"\")", call: "is_palindrome('')", expect: "True" },
      { label: "is_palindrome(\"No 'x' in Nixon\")", call: "is_palindrome(\"No 'x' in Nixon\")", expect: "True" },
    ],
    hints: ["Clean the text first: lower-case, and keep only letters and digits.", "\"\".join(c for c in text.lower() if c.isalnum())", "Then compare the cleaned text with its reverse, cleaned[::-1]."],
    solution: `def is_palindrome(text):
    cleaned = "".join(c for c in text.lower() if c.isalnum())
    return cleaned == cleaned[::-1]`,
    explanation: "Separating *cleaning* from *checking* keeps both simple. `isalnum()` keeps letters and digits and drops everything else, so no list of punctuation to maintain.",
  },
  {
    id: "ch-word-counts",
    difficulty: "medium",
    title: "Word frequency",
    topic: "dictionaries",
    prompt: "Write `word_counts(text)` that returns a dictionary of each word and how many times it appears. Words are compared **in lower case**, and the punctuation `. , ! ?` is ignored.",
    starter: "def word_counts(text):\n    pass\n",
    checks: [
      { label: "word_counts(\"the cat and the hat\")", call: "word_counts('the cat and the hat')", expect: "{'the': 2, 'cat': 1, 'and': 1, 'hat': 1}" },
      { label: "word_counts(\"Hi! hi.\")", call: "word_counts('Hi! hi.')", expect: "{'hi': 2}", hint: "Remove . , ! and ? and lower-case before splitting." },
      { label: "word_counts(\"\")", call: "word_counts('')", expect: "{}" },
    ],
    hints: ["Strip out the punctuation with .replace() for each mark.", "Split the lower-cased text into words.", "counts[word] = counts.get(word, 0) + 1"],
    solution: `def word_counts(text):
    for mark in ".,!?":
        text = text.replace(mark, "")
    counts = {}
    for word in text.lower().split():
        counts[word] = counts.get(word, 0) + 1
    return counts`,
    explanation: "`counts.get(word, 0)` is the key move: it returns 0 the first time a word is seen, so there's no separate \"is it new?\" branch. Python's `collections.Counter` does exactly this in one line.",
  },
  {
    id: "ch-anagram",
    difficulty: "medium",
    title: "Anagrams",
    topic: "strings",
    prompt: "Write `is_anagram(a, b)` that returns `True` if the two strings use exactly the same letters, **ignoring capitals and spaces**.\n\n`\"Dormitory\"` and `\"dirty room\"` are anagrams.",
    starter: "def is_anagram(a, b):\n    pass\n",
    checks: [
      { label: "is_anagram(\"listen\", \"silent\")", call: "is_anagram('listen', 'silent')", expect: "True" },
      { label: "is_anagram(\"Dormitory\", \"dirty room\")", call: "is_anagram('Dormitory', 'dirty room')", expect: "True" },
      { label: "is_anagram(\"abc\", \"abd\")", call: "is_anagram('abc', 'abd')", expect: "False" },
      { label: "is_anagram(\"aab\", \"abb\")", call: "is_anagram('aab', 'abb')", expect: "False", hint: "Same set of letters isn't enough — the counts have to match too. Compare sorted letters, not sets." },
    ],
    hints: ["Remove spaces and lower-case both strings.", "Two anagrams have the same letters once sorted.", "return sorted(clean(a)) == sorted(clean(b))"],
    solution: `def is_anagram(a, b):
    def clean(s):
        return s.replace(" ", "").lower()
    return sorted(clean(a)) == sorted(clean(b))`,
    explanation: "Sorting puts the letters of any two anagrams into the same order. Comparing `set()`s is a common mistake: it ignores how many of each letter there are, so `\"aab\"` and `\"abb\"` would wrongly match.",
  },
  {
    id: "ch-second-largest",
    difficulty: "medium",
    title: "Second largest",
    topic: "lists",
    prompt: "Write `second_largest(numbers)` that returns the second-largest **distinct** value, or `None` if there isn't one.\n\n`[4, 1, 9, 7]` → `7`, and `[5, 5, 5]` → `None`.",
    starter: "def second_largest(numbers):\n    pass\n",
    checks: [
      { label: "second_largest([4, 1, 9, 7])", call: "second_largest([4, 1, 9, 7])", expect: "7" },
      { label: "second_largest([2, 8, 8])", call: "second_largest([2, 8, 8])", expect: "2", hint: "Duplicates of the largest don't count — remove duplicates first." },
      { label: "second_largest([5, 5, 5])", call: "second_largest([5, 5, 5])", expect: "None" },
      { label: "second_largest([1])", call: "second_largest([1])", expect: "None" },
    ],
    hints: ["set(numbers) removes duplicates.", "If fewer than 2 distinct values remain, return None.", "Sort the distinct values and take the second from the end: [-2]."],
    solution: `def second_largest(numbers):
    distinct = sorted(set(numbers))
    if len(distinct) < 2:
        return None
    return distinct[-2]`,
    explanation: "Removing duplicates first turns a fiddly problem into a simple one. Sorting is O(n log n); a single pass tracking the top two values is O(n) — worth trying as a follow-up.",
  },
  {
    id: "ch-caesar",
    difficulty: "medium",
    title: "Caesar cipher",
    topic: "strings",
    prompt:
      "Write `caesar(text, shift)` that shifts every letter along the alphabet by `shift`, wrapping from z back to a. Keep capitals as capitals, and leave anything that isn't a letter unchanged.\n\n`caesar(\"xyz\", 3)` → `\"abc\"`",
    starter: "def caesar(text, shift):\n    pass\n",
    checks: [
      { label: "caesar(\"abc\", 1)", call: "caesar('abc', 1)", expect: "'bcd'" },
      { label: "caesar(\"xyz\", 3)", call: "caesar('xyz', 3)", expect: "'abc'", hint: "Wrap around with % 26." },
      { label: "caesar(\"Hello, World!\", 5)", call: "caesar('Hello, World!', 5)", expect: "'Mjqqt, Btwqi!'", hint: "Capitals stay capitals; punctuation and spaces don't move." },
      { label: "caesar(\"bcd\", -1)", call: "caesar('bcd', -1)", expect: "'abc'" },
    ],
    hints: ["ord(\"a\") gives a letter's number; chr() turns a number back into a letter.", "For a lower-case letter: position = ord(c) - ord(\"a\"), then (position + shift) % 26.", "Do the same with ord(\"A\") for capitals, and keep other characters as they are."],
    solution: `def caesar(text, shift):
    result = ""
    for c in text:
        if c.islower():
            result += chr((ord(c) - ord("a") + shift) % 26 + ord("a"))
        elif c.isupper():
            result += chr((ord(c) - ord("A") + shift) % 26 + ord("A"))
        else:
            result += c
    return result`,
    explanation: "Converting a letter to its 0–25 position makes the wrap-around a single `% 26`. Python's `%` always returns a non-negative result for a positive divisor, which is why negative shifts work with no extra code.",
  },
  {
    id: "ch-flatten",
    difficulty: "medium",
    title: "Flatten one level",
    topic: "lists",
    prompt: "Write `flatten(nested)` that takes a list of lists and joins them into one list — **one level only**.\n\n`[[1, 2], [3], []]` → `[1, 2, 3]`",
    starter: "def flatten(nested):\n    pass\n",
    checks: [
      { label: "flatten([[1, 2], [3], []])", call: "flatten([[1, 2], [3], []])", expect: "[1, 2, 3]" },
      { label: "flatten([[1, [2]], [3]])", call: "flatten([[1, [2]], [3]])", expect: "[1, [2], 3]", hint: "Only one level: a list inside an inner list stays a list." },
      { label: "flatten([])", call: "flatten([])", expect: "[]" },
      { label: "flatten([[\"a\"], [\"b\", \"c\"]])", call: "flatten([['a'], ['b', 'c']])", expect: "['a', 'b', 'c']" },
    ],
    hints: ["Start with an empty result list.", "For each inner list, add all of its items to the result.", "result.extend(inner) adds every item of inner."],
    solution: `def flatten(nested):
    result = []
    for inner in nested:
        result.extend(inner)
    return result`,
    explanation: "`extend` adds each item of a list, while `append` would add the list itself. The one-line version is a nested comprehension: `[x for inner in nested for x in inner]`.",
  },

  // ---------------------------------------------------------------------------
  // HARD
  // ---------------------------------------------------------------------------
  {
    id: "ch-primes",
    difficulty: "hard",
    title: "Primes up to n",
    topic: "algorithms",
    prompt: "Write `primes_up_to(n)` that returns a list of every prime number from 2 up to and including `n`.",
    starter: "def primes_up_to(n):\n    pass\n",
    checks: [
      { label: "primes_up_to(10)", call: "primes_up_to(10)", expect: "[2, 3, 5, 7]" },
      { label: "primes_up_to(1)", call: "primes_up_to(1)", expect: "[]", hint: "There are no primes below 2." },
      { label: "primes_up_to(2)", call: "primes_up_to(2)", expect: "[2]", hint: "Include n itself if it's prime." },
      { label: "primes_up_to(30)", call: "primes_up_to(30)", expect: "[2, 3, 5, 7, 11, 13, 17, 19, 23, 29]" },
      { label: "There are 168 primes up to 1000", call: "len(primes_up_to(1000))", expect: "168" },
    ],
    hints: ["A prime has no divisors except 1 and itself.", "You only need to test divisors up to the square root: d * d <= candidate.", "Or use the Sieve of Eratosthenes: mark every multiple of each prime as not prime."],
    solution: `def primes_up_to(n):
    if n < 2:
        return []
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    for i in range(2, int(n ** 0.5) + 1):
        if is_prime[i]:
            for multiple in range(i * i, n + 1, i):
                is_prime[multiple] = False
    return [i for i, prime in enumerate(is_prime) if prime]`,
    explanation: "The Sieve of Eratosthenes crosses out multiples instead of testing each number by division. Starting at `i * i` is safe because smaller multiples were already crossed out by smaller primes, and stopping at √n is enough for the same reason.",
  },
  {
    id: "ch-brackets",
    difficulty: "hard",
    title: "Balanced brackets",
    topic: "stacks",
    prompt: "Write `is_balanced(text)` that returns `True` if every `(`, `[` and `{` is closed by the matching bracket in the right order. Other characters are ignored.\n\n`\"([]{})\"` is balanced; `\"([)]\"` is not.",
    starter: "def is_balanced(text):\n    pass\n",
    checks: [
      { label: "is_balanced(\"([]{})\")", call: "is_balanced('([]{})')", expect: "True" },
      { label: "is_balanced(\"([)]\")", call: "is_balanced('([)]')", expect: "False", hint: "Counting brackets isn't enough — the order matters. Use a stack." },
      { label: "is_balanced(\"((\")", call: "is_balanced('((')", expect: "False", hint: "Anything still open at the end means unbalanced." },
      { label: "is_balanced(\"\")", call: "is_balanced('')", expect: "True" },
      { label: "is_balanced(\"print(x[0])\")", call: "is_balanced('print(x[0])')", expect: "True" },
      { label: "is_balanced(\")(\")", call: "is_balanced(')(')", expect: "False" },
    ],
    hints: ["Use a list as a stack: append opening brackets as you see them.", "At a closing bracket, the top of the stack must be its matching opener.", "PAIRS = {\")\": \"(\", \"]\": \"[\", \"}\": \"{\"} — and the stack must be empty at the end."],
    solution: `def is_balanced(text):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for c in text:
        if c in "([{":
            stack.append(c)
        elif c in pairs:
            if not stack or stack.pop() != pairs[c]:
                return False
    return not stack`,
    explanation: "A stack remembers what's still open, most recent on top — exactly the order brackets must close in. This same idea is how code editors and compilers match brackets.",
  },
  {
    id: "ch-rle",
    difficulty: "hard",
    title: "Run-length encoding",
    topic: "strings",
    prompt: "Write two functions:\n\n- `encode(text)` — `\"aaabccdddd\"` → `\"a3b1c2d4\"`\n- `decode(code)` — `\"a3b1\"` → `\"aaab\"`\n\nCounts can be more than one digit (`\"a12\"`).",
    starter: "def encode(text):\n    pass\n\ndef decode(code):\n    pass\n",
    checks: [
      { label: "encode(\"aaabccdddd\")", call: "encode('aaabccdddd')", expect: "'a3b1c2d4'" },
      { label: "encode(\"x\")", call: "encode('x')", expect: "'x1'" },
      { label: "encode(\"\")", call: "encode('')", expect: "''" },
      { label: "decode(\"a3b1\")", call: "decode('a3b1')", expect: "'aaab'" },
      { label: "decode(\"z12\")", call: "decode('z12')", expect: "'zzzzzzzzzzzz'", hint: "Read every digit after a letter, not just one." },
      { label: "decode(encode(...)) gives the original back", call: "decode(encode('aaaaaaaaaaaabbc'))", expect: "'aaaaaaaaaaaabbc'" },
    ],
    hints: ["encode: walk through the text counting how many times the current character repeats.", "decode: read a letter, then collect digits until the next letter.", "int(\"12\") turns the collected digits into a count; letter * count repeats it."],
    solution: `def encode(text):
    result = ""
    i = 0
    while i < len(text):
        j = i
        while j < len(text) and text[j] == text[i]:
            j += 1
        result += text[i] + str(j - i)
        i = j
    return result

def decode(code):
    result = ""
    i = 0
    while i < len(code):
        letter = code[i]
        i += 1
        digits = ""
        while i < len(code) and code[i].isdigit():
            digits += code[i]
            i += 1
        result += letter * int(digits)
    return result`,
    explanation: "Both functions use two positions: one marking where a run starts, one scanning forward to where it ends. Reading *all* the digits in `decode` is what handles counts of 10 or more.",
  },
  {
    id: "ch-roman",
    difficulty: "hard",
    title: "Roman numerals",
    topic: "algorithms",
    prompt: "Write `to_roman(n)` that converts a whole number from 1 to 3999 into Roman numerals.\n\n`4` → `\"IV\"`, `1994` → `\"MCMXCIV\"`",
    starter: "def to_roman(n):\n    pass\n",
    checks: [
      { label: "to_roman(1)", call: "to_roman(1)", expect: "'I'" },
      { label: "to_roman(4)", call: "to_roman(4)", expect: "'IV'" },
      { label: "to_roman(9)", call: "to_roman(9)", expect: "'IX'" },
      { label: "to_roman(14)", call: "to_roman(14)", expect: "'XIV'" },
      { label: "to_roman(40)", call: "to_roman(40)", expect: "'XL'" },
      { label: "to_roman(1994)", call: "to_roman(1994)", expect: "'MCMXCIV'" },
      { label: "to_roman(3999)", call: "to_roman(3999)", expect: "'MMMCMXCIX'" },
    ],
    hints: ["Work from the largest value down, subtracting as you go.", "Treat the awkward ones — 900, 400, 90, 40, 9, 4 — as symbols in their own right: CM, CD, XC, XL, IX, IV.", "A list of (value, symbol) pairs from 1000 down to 1, and a while loop for each."],
    solution: `def to_roman(n):
    values = [
        (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
        (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
        (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
    ]
    result = ""
    for value, symbol in values:
        while n >= value:
            result += symbol
            n -= value
    return result`,
    explanation: "Adding the two-letter numerals (CM, XL, IV…) to the table turns every special case into the same greedy step: take the largest value that still fits. That's a *greedy algorithm*, and it's correct here because of how Roman numerals are built.",
  },
  {
    id: "ch-merge",
    difficulty: "hard",
    title: "Merge two sorted lists",
    topic: "algorithms",
    prompt: "Write `merge_sorted(a, b)` that merges two already-sorted lists into one sorted list — **without `sorted()` or `.sort()`**. Walk through both lists at once.",
    starter: "def merge_sorted(a, b):\n    pass\n",
    checks: [
      { label: "merge_sorted([1, 4, 9], [2, 3, 10])", call: "merge_sorted([1, 4, 9], [2, 3, 10])", expect: "[1, 2, 3, 4, 9, 10]" },
      { label: "merge_sorted([], [1])", call: "merge_sorted([], [1])", expect: "[1]" },
      { label: "merge_sorted([5], [])", call: "merge_sorted([5], [])", expect: "[5]" },
      { label: "merge_sorted([1, 1], [1])", call: "merge_sorted([1, 1], [1])", expect: "[1, 1, 1]" },
      { label: "Doesn't use sorted() or .sort()", body: "__import__('re').search(r'(?<![\\w.])sorted\\s*\\(', __h1_src) is None and '.sort(' not in __h1_src", hint: "The point is to merge by walking both lists, the way merge sort does." },
    ],
    hints: ["Keep an index into each list, both starting at 0.", "Repeatedly take whichever current item is smaller, and move that list's index on.", "When one list runs out, add everything left in the other: result.extend(a[i:])."],
    solution: `def merge_sorted(a, b):
    result = []
    i = j = 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            result.append(a[i])
            i += 1
        else:
            result.append(b[j])
            j += 1
    result.extend(a[i:])
    result.extend(b[j:])
    return result`,
    explanation: "Because both lists are already sorted, the smallest remaining item is always at the front of one of them — so each step is one comparison, and the whole merge is O(len(a) + len(b)). This is the heart of merge sort.",
  },
  {
    id: "ch-binary-search",
    difficulty: "hard",
    title: "Binary search",
    topic: "algorithms",
    prompt: "Write `binary_search(items, target)` that returns the index of `target` in the **sorted** list `items`, or `-1` if it isn't there.\n\nIt must be a real binary search: halve the search range each step. (H1 counts how many items your function looks at.)",
    starter: "def binary_search(items, target):\n    pass\n",
    checks: [
      { label: "binary_search([1, 3, 5, 7, 9], 7)", call: "binary_search([1, 3, 5, 7, 9], 7)", expect: "3" },
      { label: "binary_search([1, 3, 5], 4)", call: "binary_search([1, 3, 5], 4)", expect: "-1" },
      { label: "binary_search([], 1)", call: "binary_search([], 1)", expect: "-1" },
      { label: "binary_search([2], 2)", call: "binary_search([2], 2)", expect: "0" },
      { label: "binary_search([1, 3, 5, 7, 9], 1)", call: "binary_search([1, 3, 5, 7, 9], 1)", expect: "0" },
      {
        label: "Looks at 40 items or fewer in a list of 500,000",
        body: "(lambda Counted: (lambda c: [binary_search(c, 777776) == 388888, 1 <= c.n <= 40])(Counted(range(0, 1000000, 2))))(type('Counted', (list,), {'n': 0, '__getitem__': lambda self, i: (setattr(self, 'n', self.n + 1), list.__getitem__(self, i))[1]})) == [True, True]",
        hint: "Index into the list with items[mid], and halve the range each time — checking every item (or using .index or in) looks at far too many.",
      },
    ],
    hints: ["Keep low and high indexes marking the part of the list that could still contain the target.", "Look at the middle item: mid = (low + high) // 2.", "If items[mid] is too small, move low to mid + 1; too big, move high to mid - 1. Stop when low > high."],
    solution: `def binary_search(items, target):
    low, high = 0, len(items) - 1
    while low <= high:
        mid = (low + high) // 2
        if items[mid] == target:
            return mid
        if items[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1`,
    explanation: "Each comparison throws away half of what's left, so a list of 500,000 needs at most about 19 looks (2¹⁹ ≈ 524,000). A linear search could need all 500,000. That gap — O(log n) against O(n) — is why sorted data is so valuable.",
  },
];

export function getChallenge(id) {
  return CHALLENGES.find((c) => c.id === id) || null;
}
