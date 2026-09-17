// The Code Lab curriculum: the three web tracks, plus the Python course from pythonCurriculum.js.
// All hand-written.
//
// Deliberately not AI-generated. A generated lesson can't come with a check that actually
// verifies the student did the thing — you'd either have to trust the model's own marking or
// show a tick that means nothing. Every exercise here has real checks that run against the
// student's real output, so "passed" means passed.
//
// For the three web tracks, a check's `body` is JavaScript evaluated INSIDE the sandboxed
// preview frame, with:
//   document — the page the student's code actually produced
//   logs     — array of console output lines
//   output   — the same lines joined with newlines
// It must return true to pass.
//
// The Python track runs on a different engine entirely, so its checks are Python expressions
// instead — see pythonCurriculum.js. `hint` is shown only when a check fails.

import { PY_LESSONS } from "./pythonCurriculum.js";

export const TRACKS = [
  { id: "py", label: "Python", icon: "🐍", blurb: "Real Python in your browser — from your first print() to complete projects, in six levels.", lang: "python" },
  { id: "html", label: "HTML", icon: "🧱", blurb: "The structure of every web page — headings, lists, links, forms." },
  { id: "css", label: "CSS", icon: "🎨", blurb: "How pages look — colour, spacing, layout, and making it work on phones." },
  { id: "js", label: "JavaScript", icon: "⚡", blurb: "Making pages think and react — logic, data, and responding to clicks." },
];

const HTML_LESSONS = [
  {
    id: "html-1",
    title: "Headings and paragraphs",
    goal: "Write your first HTML and see it appear on a page.",
    concept:
      "HTML is made of **elements**. An element is an opening tag, some content, and a closing tag:\n\n" +
      "`<h1>Hello</h1>`\n\n" +
      "`<h1>` is the biggest heading, down to `<h6>` for the smallest. `<p>` is a paragraph. " +
      "The browser reads your tags top to bottom and draws the page from them.",
    example: { html: "<h1>My page</h1>\n<p>This is a paragraph of text.</p>" },
    task: "Add an `<h1>` that says **My First Page**, and underneath it a `<p>` with any sentence you like in it.",
    starter: { html: "<!-- Write your heading and paragraph here -->\n" },
    checks: [
      { label: "There is an h1 heading", body: "return !!document.querySelector('h1');", hint: "Use <h1>...</h1>." },
      {
        label: "The heading says 'My First Page'",
        body: "var h = document.querySelector('h1'); return !!h && h.textContent.trim().toLowerCase() === 'my first page';",
        hint: "The text between the tags should read exactly: My First Page",
      },
      {
        label: "There is a paragraph with some text",
        body: "var p = document.querySelector('p'); return !!p && p.textContent.trim().length > 3;",
        hint: "Add a <p> element with a sentence inside it.",
      },
    ],
  },
  {
    id: "html-2",
    title: "Lists",
    goal: "Show a set of items as a proper list.",
    concept:
      "Two kinds of list:\n\n" +
      "- `<ul>` — an **unordered** list, drawn with bullets\n" +
      "- `<ol>` — an **ordered** list, drawn with numbers\n\n" +
      "Both hold `<li>` (list item) elements. The `<li>` goes *inside* the `<ul>` or `<ol>`, never beside it.",
    example: { html: "<ul>\n  <li>Bread</li>\n  <li>Milk</li>\n</ul>" },
    task: "Make an unordered list of **at least three** subjects you study.",
    starter: { html: "<h2>My subjects</h2>\n<!-- Add your <ul> here -->\n" },
    checks: [
      { label: "There is a <ul>", body: "return !!document.querySelector('ul');", hint: "Wrap your items in <ul>...</ul>." },
      {
        label: "It has at least 3 list items",
        body: "var ul = document.querySelector('ul'); return !!ul && ul.querySelectorAll('li').length >= 3;",
        hint: "Each item needs its own <li>...</li> inside the <ul>.",
      },
      {
        label: "The items aren't empty",
        body: "var items = document.querySelectorAll('ul li'); if (items.length < 3) return false; for (var i = 0; i < items.length; i++) { if (items[i].textContent.trim().length === 0) return false; } return true;",
        hint: "Put some text between each <li> and </li>.",
      },
    ],
  },
  {
    id: "html-3",
    title: "Links and images",
    goal: "Connect your page to the rest of the web.",
    concept:
      "Some elements need extra information, given as **attributes** inside the opening tag.\n\n" +
      "`<a href=\"https://example.com\">Click me</a>` — the `href` attribute says where the link goes.\n\n" +
      "`<img src=\"cat.png\" alt=\"A cat\">` — `src` says which image, and `alt` describes it for anyone who " +
      "can't see it. `alt` isn't optional politeness; screen readers depend on it.",
    example: { html: '<a href="https://developer.mozilla.org">MDN docs</a>' },
    task: "Add a link that points to `https://example.com`, and an image with **both** a `src` and a non-empty `alt`.",
    starter: { html: "<h2>Useful links</h2>\n<!-- Add your link and image -->\n" },
    checks: [
      {
        label: "There is a link to example.com",
        body: "var a = document.querySelector('a'); return !!a && (a.getAttribute('href') || '').indexOf('example.com') !== -1;",
        hint: 'Use <a href="https://example.com">some text</a>.',
      },
      { label: "The link has text", body: "var a = document.querySelector('a'); return !!a && a.textContent.trim().length > 0;", hint: "Put words between <a> and </a> so people know what they're clicking." },
      { label: "There is an image with a src", body: "var i = document.querySelector('img'); return !!i && !!i.getAttribute('src');", hint: "Add <img src=\"...\" alt=\"...\">." },
      {
        label: "The image has a described alt",
        body: "var i = document.querySelector('img'); return !!i && (i.getAttribute('alt') || '').trim().length > 2;",
        hint: "alt should describe the picture, e.g. alt=\"A red bicycle\".",
      },
    ],
  },
  {
    id: "html-4",
    title: "Grouping with div and class",
    goal: "Group elements so you can style them later.",
    concept:
      "`<div>` is a plain container — it means nothing on its own, it just groups things. `<span>` does the " +
      "same for a piece of text inside a line.\n\n" +
      "A **class** is a label you attach so CSS can find it later:\n\n" +
      "`<div class=\"card\">...</div>`\n\n" +
      "Many elements can share one class. That's the point — you write the style once.",
    example: { html: '<div class="card">\n  <h3>Title</h3>\n  <p>Body text</p>\n</div>' },
    task: "Make a `<div>` with the class `card`. Inside it put an `<h3>` and a `<p>`.",
    starter: { html: "<!-- Build your card -->\n" },
    checks: [
      { label: "There is a div with class 'card'", body: "return !!document.querySelector('div.card');", hint: 'Write <div class="card"> ... </div>.' },
      { label: "The card contains an h3", body: "return !!document.querySelector('div.card h3');", hint: "The <h3> must be inside the div, between its opening and closing tags." },
      { label: "The card contains a p", body: "return !!document.querySelector('div.card p');", hint: "Add a <p> inside the same div." },
    ],
  },
  {
    id: "html-5",
    title: "Forms and inputs",
    goal: "Collect something from the person using your page.",
    concept:
      "A form gathers input. The pieces you'll use most:\n\n" +
      "- `<input type=\"text\">` — a one-line box\n" +
      "- `<input type=\"email\">`, `type=\"number\"`, `type=\"checkbox\"`\n" +
      "- `<textarea>` — multi-line\n" +
      "- `<button>` — something to press\n\n" +
      "Every input should have a `<label>`. Linking them with `for` and `id` means clicking the label focuses " +
      "the box, and screen readers can announce what the box is for.",
    example: { html: '<label for="name">Name</label>\n<input id="name" type="text">' },
    task: "Build a form with a labelled text input (use `for` and a matching `id`) and a `<button>`.",
    starter: { html: "<form>\n  <!-- label, input, button -->\n</form>\n" },
    checks: [
      { label: "There is a form", body: "return !!document.querySelector('form');", hint: "Wrap it in <form>...</form>." },
      { label: "There is a text input with an id", body: "var i = document.querySelector('input'); return !!i && !!i.id;", hint: 'Give the input an id, e.g. <input id="name" type="text">.' },
      {
        label: "A label points at that input",
        body: "var i = document.querySelector('input'); if (!i || !i.id) return false; var l = document.querySelector('label[for=\"' + i.id + '\"]'); return !!l && l.textContent.trim().length > 0;",
        hint: "The label's for=\"...\" must match the input's id exactly.",
      },
      { label: "There is a button", body: "return !!document.querySelector('button') || !!document.querySelector('input[type=\"submit\"]');", hint: "Add <button>Send</button>." },
    ],
  },
  {
    id: "html-6",
    title: "Tables",
    goal: "Lay out real tabular data.",
    concept:
      "Tables are for data that genuinely has rows and columns — a timetable, a price list, results. " +
      "(Not for page layout; CSS does that.)\n\n" +
      "- `<table>` wraps everything\n" +
      "- `<tr>` is a row\n" +
      "- `<th>` is a header cell, `<td>` is a normal cell\n\n" +
      "`<th>` isn't just bold text — it tells assistive technology what each column means.",
    example: { html: "<table>\n  <tr><th>Day</th><th>Subject</th></tr>\n  <tr><td>Mon</td><td>Maths</td></tr>\n</table>" },
    task: "Build a table with a header row of **2 header cells**, and **at least 2** data rows below it.",
    starter: { html: "<table>\n  <!-- header row, then data rows -->\n</table>\n" },
    checks: [
      { label: "There is a table", body: "return !!document.querySelector('table');", hint: "Start with <table>...</table>." },
      { label: "It has 2 header cells", body: "return document.querySelectorAll('table th').length >= 2;", hint: "Use <th> for the top row's cells." },
      { label: "It has at least 2 data rows", body: "var rows = document.querySelectorAll('table tr'); var n = 0; for (var i = 0; i < rows.length; i++) { if (rows[i].querySelector('td')) n++; } return n >= 2;", hint: "Each data row is a <tr> containing <td> cells." },
    ],
  },
  {
    id: "html-7",
    title: "Semantic structure",
    goal: "Use tags that say what a part of the page *is*.",
    concept:
      "You could build an entire page from `<div>`s and it would look identical. But `<header>`, `<nav>`, " +
      "`<main>`, `<section>`, `<footer>` and `<article>` describe **meaning**.\n\n" +
      "That matters for real reasons: screen readers let people jump straight to `<main>`, and search engines " +
      "read your structure. A `<div>` tells them nothing.",
    example: { html: "<header><h1>Site</h1></header>\n<main><p>Content</p></main>\n<footer><p>© 2026</p></footer>" },
    task: "Lay out a page with a `<header>` containing an `<h1>`, a `<main>` with a paragraph, and a `<footer>`.",
    starter: { html: "<!-- header, main, footer -->\n" },
    checks: [
      { label: "There is a <header> with a heading", body: "return !!document.querySelector('header h1');", hint: "Put the <h1> inside the <header>." },
      { label: "There is a <main> with content", body: "var m = document.querySelector('main'); return !!m && m.textContent.trim().length > 3;", hint: "Add <main> with a paragraph inside." },
      { label: "There is a <footer>", body: "return !!document.querySelector('footer');", hint: "Add <footer>...</footer> at the bottom." },
      {
        label: "main is not inside header",
        body: "var m = document.querySelector('main'); return !!m && !m.closest('header');",
        hint: "These are siblings — close </header> before opening <main>.",
      },
    ],
  },
  {
    id: "html-8",
    title: "Capstone: a profile card",
    goal: "Put the whole track together into one real component.",
    concept:
      "Everything so far, in one piece of markup. Structure first, then meaning, then the details.\n\n" +
      "This is genuinely how a component starts life in a real project: get the HTML right and readable, " +
      "and the CSS in the next track has something solid to style.",
    task:
      "Build a profile card: an `<article>` with class `profile` containing an image (with alt), an `<h2>` name, " +
      "a `<p>` description, and a `<ul>` of at least 3 skills.",
    starter: { html: '<article class="profile">\n  <!-- image, name, description, skills -->\n</article>\n' },
    checks: [
      { label: "An <article class=\"profile\">", body: "return !!document.querySelector('article.profile');", hint: 'Use <article class="profile">.' },
      { label: "It has an image with alt text", body: "var i = document.querySelector('.profile img'); return !!i && (i.getAttribute('alt') || '').trim().length > 2;", hint: "The <img> needs a descriptive alt." },
      { label: "It has an h2 name", body: "var h = document.querySelector('.profile h2'); return !!h && h.textContent.trim().length > 1;", hint: "Add an <h2> with a name in it." },
      { label: "It has a description paragraph", body: "var p = document.querySelector('.profile p'); return !!p && p.textContent.trim().length > 5;", hint: "Add a <p> describing the person." },
      { label: "It lists at least 3 skills", body: "return document.querySelectorAll('.profile ul li').length >= 3;", hint: "Add a <ul> with three or more <li> items." },
    ],
  },
];

const CSS_LESSONS = [
  {
    id: "css-1",
    title: "Selectors and colour",
    goal: "Change how something looks.",
    concept:
      "CSS is a list of rules. Each rule picks elements with a **selector**, then sets properties:\n\n" +
      "```\nh1 {\n  color: crimson;\n}\n```\n\n" +
      "Selectors you'll use constantly:\n\n" +
      "- `h1` — every h1\n" +
      "- `.card` — every element with `class=\"card\"`\n" +
      "- `#total` — the element with `id=\"total\"`\n\n" +
      "`color` is the text colour; `background-color` is behind it.",
    example: { html: "<h1>Hello</h1>", css: "h1 {\n  color: crimson;\n}" },
    task: "Make the `<h1>` blue, and give the element with class `box` a light grey background.",
    starter: {
      html: '<h1>Styled heading</h1>\n<div class="box">A box</div>',
      css: "/* Write your rules here */\n",
    },
    checks: [
      {
        label: "The h1 is blue",
        body: "var c = getComputedStyle(document.querySelector('h1')).color; return c === 'rgb(0, 0, 255)' || c.indexOf('rgb(0, 0, 255)') === 0;",
        hint: "Try h1 { color: blue; }",
      },
      {
        label: "The .box has a background colour",
        body: "var b = document.querySelector('.box'); if (!b) return false; var bg = getComputedStyle(b).backgroundColor; return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';",
        hint: "Try .box { background-color: lightgrey; }",
      },
    ],
  },
  {
    id: "css-2",
    title: "The box model",
    goal: "Control the space inside and around an element.",
    concept:
      "Every element is a box with four layers, from the inside out:\n\n" +
      "1. **content** — the text or image\n" +
      "2. **padding** — space *inside* the border\n" +
      "3. **border** — the line around it\n" +
      "4. **margin** — space *outside*, pushing other things away\n\n" +
      "The single most common confusion in CSS is padding vs margin. Padding grows the box; margin moves it.",
    example: { html: '<div class="box">Hi</div>', css: ".box {\n  padding: 16px;\n  border: 2px solid black;\n  margin: 24px;\n}" },
    task: "Give `.box` padding of at least 10px, a visible border, and a margin of at least 10px.",
    starter: { html: '<div class="box">Space me out</div>', css: ".box {\n  \n}" },
    checks: [
      { label: "Padding of 10px or more", body: "var s = getComputedStyle(document.querySelector('.box')); return parseFloat(s.paddingTop) >= 10;", hint: "Add padding: 16px;" },
      { label: "A visible border", body: "var s = getComputedStyle(document.querySelector('.box')); return parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none';", hint: "Add border: 2px solid black;" },
      { label: "Margin of 10px or more", body: "var s = getComputedStyle(document.querySelector('.box')); return parseFloat(s.marginTop) >= 10;", hint: "Add margin: 24px;" },
    ],
  },
  {
    id: "css-3",
    title: "Text and fonts",
    goal: "Make text comfortable to read.",
    concept:
      "The properties that do most of the work:\n\n" +
      "- `font-size` — how big\n" +
      "- `font-weight` — how bold (400 normal, 700 bold)\n" +
      "- `line-height` — space between lines; around `1.5` is much easier to read than the default\n" +
      "- `text-align` — left, center, right\n\n" +
      "Good typography is mostly line-height and restraint, not exotic fonts.",
    example: { html: "<p>Some text</p>", css: "p {\n  font-size: 18px;\n  line-height: 1.6;\n}" },
    task: "Set the paragraph's font-size to at least 18px, its line-height to at least 1.5, and centre the `<h1>`.",
    starter: { html: "<h1>Centre me</h1>\n<p>Make this comfortable to read over several lines of text.</p>", css: "" },
    checks: [
      { label: "Paragraph font-size is 18px or more", body: "return parseFloat(getComputedStyle(document.querySelector('p')).fontSize) >= 18;", hint: "p { font-size: 18px; }" },
      {
        label: "Line-height is at least 1.5x the font size",
        body: "var s = getComputedStyle(document.querySelector('p')); var lh = parseFloat(s.lineHeight); var fs = parseFloat(s.fontSize); return !isNaN(lh) && lh / fs >= 1.45;",
        hint: "p { line-height: 1.6; }",
      },
      { label: "The h1 is centred", body: "return getComputedStyle(document.querySelector('h1')).textAlign === 'center';", hint: "h1 { text-align: center; }" },
    ],
  },
  {
    id: "css-4",
    title: "Flexbox",
    goal: "Lay things out in a row or column that actually behaves.",
    concept:
      "Set `display: flex` on a **container** and its direct children become flex items in a row.\n\n" +
      "- `flex-direction: row | column`\n" +
      "- `gap` — space between items (far better than margins for this)\n" +
      "- `justify-content` — spreads items along the row\n" +
      "- `align-items` — lines them up across it\n\n" +
      "Flexbox is for one dimension: a row, or a column. Two dimensions at once is Grid, next lesson.",
    example: { html: '<div class="row"><span>A</span><span>B</span></div>', css: ".row {\n  display: flex;\n  gap: 12px;\n}" },
    task: "Make `.row` a flex container with a `gap` of at least 8px, and space its items apart with `justify-content: space-between`.",
    starter: { html: '<div class="row">\n  <span>Left</span>\n  <span>Middle</span>\n  <span>Right</span>\n</div>', css: ".row {\n  \n}" },
    checks: [
      { label: ".row is display: flex", body: "return getComputedStyle(document.querySelector('.row')).display === 'flex';", hint: "Add display: flex;" },
      { label: "It has a gap of 8px or more", body: "var g = parseFloat(getComputedStyle(document.querySelector('.row')).columnGap); return !isNaN(g) && g >= 8;", hint: "Add gap: 12px;" },
      { label: "justify-content is space-between", body: "return getComputedStyle(document.querySelector('.row')).justifyContent === 'space-between';", hint: "Add justify-content: space-between;" },
      {
        label: "The items really are side by side",
        body: "var s = document.querySelectorAll('.row span'); if (s.length < 2) return false; return s[0].getBoundingClientRect().top === s[1].getBoundingClientRect().top;",
        hint: "If they're stacked, the container isn't flex (or is flex-direction: column).",
      },
    ],
  },
  {
    id: "css-5",
    title: "Grid",
    goal: "Lay out rows and columns together.",
    concept:
      "Grid handles two dimensions at once.\n\n" +
      "```\n.grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr 1fr;\n  gap: 12px;\n}\n```\n\n" +
      "`fr` means *a fraction of the free space*, so `1fr 1fr 1fr` is three equal columns that resize " +
      "with the page. `repeat(3, 1fr)` says the same thing more briefly.",
    example: { html: '<div class="grid"><div>1</div><div>2</div></div>', css: ".grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n}" },
    task: "Turn `.grid` into a 3-column grid with a gap of at least 8px.",
    starter: {
      html: '<div class="grid">\n  <div>One</div>\n  <div>Two</div>\n  <div>Three</div>\n  <div>Four</div>\n  <div>Five</div>\n  <div>Six</div>\n</div>',
      css: ".grid {\n  \n}",
    },
    checks: [
      { label: ".grid is display: grid", body: "return getComputedStyle(document.querySelector('.grid')).display === 'grid';", hint: "Add display: grid;" },
      {
        label: "It has exactly 3 columns",
        body: "var t = getComputedStyle(document.querySelector('.grid')).gridTemplateColumns; return t.trim().split(/\\s+/).length === 3;",
        hint: "grid-template-columns: repeat(3, 1fr);",
      },
      { label: "It has a gap of 8px or more", body: "var g = parseFloat(getComputedStyle(document.querySelector('.grid')).columnGap); return !isNaN(g) && g >= 8;", hint: "Add gap: 12px;" },
      {
        label: "The first row really holds 3 items",
        body: "var d = document.querySelectorAll('.grid > div'); if (d.length < 4) return false; var top = d[0].getBoundingClientRect().top; var n = 0; for (var i = 0; i < d.length; i++) { if (d[i].getBoundingClientRect().top === top) n++; } return n === 3;",
        hint: "If more or fewer than 3 sit on the first row, the column count isn't 3.",
      },
    ],
  },
  {
    id: "css-6",
    title: "Positioning and layering",
    goal: "Place something exactly where you want it.",
    concept:
      "`position` changes how an element is placed:\n\n" +
      "- `static` — the default, normal flow\n" +
      "- `relative` — nudged from where it would have been, and becomes an anchor for children\n" +
      "- `absolute` — positioned against the nearest positioned ancestor, out of normal flow\n" +
      "- `fixed` — pinned to the window\n\n" +
      "The classic pattern: a `relative` parent with an `absolute` badge in its corner.",
    example: { html: '<div class="card"><span class="badge">New</span></div>', css: ".card { position: relative; }\n.badge { position: absolute; top: 0; right: 0; }" },
    task: "Make `.card` relative, and pin `.badge` to its top-right corner with `position: absolute`.",
    starter: {
      html: '<div class="card">\n  <span class="badge">New</span>\n  <p>Card content</p>\n</div>',
      css: ".card {\n  border: 1px solid #888;\n  padding: 20px;\n}\n.badge {\n  background: gold;\n}",
    },
    checks: [
      { label: ".card is position: relative", body: "return getComputedStyle(document.querySelector('.card')).position === 'relative';", hint: "Add position: relative; to .card." },
      { label: ".badge is position: absolute", body: "return getComputedStyle(document.querySelector('.badge')).position === 'absolute';", hint: "Add position: absolute; to .badge." },
      {
        label: "The badge sits inside the card's top-right",
        body: "var c = document.querySelector('.card').getBoundingClientRect(); var b = document.querySelector('.badge').getBoundingClientRect(); return b.right <= c.right + 2 && b.top <= c.top + 30 && b.right > c.left;",
        hint: "Set top: 0; and right: 0; on .badge.",
      },
    ],
  },
  {
    id: "css-7",
    title: "Responsive design",
    goal: "Make the page work on a phone as well as a laptop.",
    concept:
      "A **media query** applies rules only at certain sizes:\n\n" +
      "```\n@media (max-width: 600px) {\n  .grid { grid-template-columns: 1fr; }\n}\n```\n\n" +
      "That reads: *when the screen is 600px wide or narrower, use one column*.\n\n" +
      "Also useful: `max-width` on a container stops lines getting uncomfortably long on wide screens, and " +
      "`width: 100%` on images stops them overflowing.",
    example: { css: "@media (max-width: 600px) {\n  body { font-size: 14px; }\n}" },
    task: "Give `.grid` two columns normally, and **one** column under 600px, using a media query. Also cap `.wrap` at a max-width.",
    starter: {
      html: '<div class="wrap">\n  <div class="grid">\n    <div>A</div>\n    <div>B</div>\n  </div>\n</div>',
      css: ".grid {\n  display: grid;\n  gap: 10px;\n}\n.wrap {\n  \n}\n",
    },
    checks: [
      { label: ".wrap has a max-width", body: "var m = getComputedStyle(document.querySelector('.wrap')).maxWidth; return m !== 'none' && parseFloat(m) > 0;", hint: ".wrap { max-width: 700px; }" },
      {
        label: "There is a max-width media query",
        body: "var found = false; for (var i = 0; i < document.styleSheets.length; i++) { var sheet = document.styleSheets[i]; var rules; try { rules = sheet.cssRules; } catch (e) { continue; } for (var j = 0; j < rules.length; j++) { if (rules[j].type === 4 && /max-width/.test(rules[j].conditionText || rules[j].media.mediaText)) found = true; } } return found;",
        hint: "Write @media (max-width: 600px) { ... }",
      },
      {
        label: "The media query sets one column",
        body: "var ok = false; for (var i = 0; i < document.styleSheets.length; i++) { var rules; try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; } for (var j = 0; j < rules.length; j++) { var r = rules[j]; if (r.type !== 4) continue; for (var k = 0; k < r.cssRules.length; k++) { var inner = r.cssRules[k]; if (inner.style && /(^|\\s)1fr$/.test((inner.style.gridTemplateColumns || '').trim())) ok = true; } } } return ok;",
        hint: "Inside the media query: .grid { grid-template-columns: 1fr; }",
      },
    ],
  },
  {
    id: "css-8",
    title: "Capstone: a styled card",
    goal: "Turn plain markup into something that looks designed.",
    concept:
      "Nothing new here — this is the whole track applied at once. A card that looks good is usually just: " +
      "padding, a soft border or shadow, a rounded corner, readable line-height, and consistent spacing.\n\n" +
      "Restraint is the skill. Three careful properties beat fifteen careless ones.",
    task: "Style `.card`: padding ≥ 16px, rounded corners ≥ 8px, a visible border **or** box-shadow, and a max-width so it doesn't stretch across the whole page.",
    starter: {
      html: '<div class="card">\n  <h3>Photosynthesis</h3>\n  <p>How plants turn light into food.</p>\n</div>',
      css: ".card {\n  \n}",
    },
    checks: [
      { label: "Padding of 16px or more", body: "return parseFloat(getComputedStyle(document.querySelector('.card')).paddingTop) >= 16;", hint: "padding: 20px;" },
      { label: "Rounded corners of 8px or more", body: "return parseFloat(getComputedStyle(document.querySelector('.card')).borderTopLeftRadius) >= 8;", hint: "border-radius: 12px;" },
      {
        label: "A border or a shadow",
        body: "var s = getComputedStyle(document.querySelector('.card')); return (parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none') || (s.boxShadow && s.boxShadow !== 'none');",
        hint: "Either border: 1px solid #ddd; or box-shadow: 0 2px 8px rgba(0,0,0,.15);",
      },
      { label: "A max-width so it doesn't stretch", body: "var m = getComputedStyle(document.querySelector('.card')).maxWidth; return m !== 'none' && parseFloat(m) > 0;", hint: "max-width: 320px;" },
    ],
  },
];

const JS_LESSONS = [
  {
    id: "js-1",
    title: "Variables and console.log",
    goal: "Store a value and print it.",
    concept:
      "`console.log(...)` prints to the console — the output panel below your code. It's how you check what " +
      "your program is actually doing.\n\n" +
      "Store values in variables:\n\n" +
      "- `let` — a value that can change\n" +
      "- `const` — a value that can't be reassigned (use this by default)\n\n" +
      "```\nconst name = 'Asha';\nlet score = 10;\nscore = 12;\n```",
    example: { js: "const name = 'Asha';\nconsole.log('Hello', name);" },
    task: "Create a `const` called `name` holding your name, a `let` called `age` holding a number, then log them both.",
    starter: { js: "// Declare name and age, then console.log them\n" },
    checks: [
      { label: "Something was printed", body: "return logs.length > 0;", hint: "Use console.log(...)." },
      {
        label: "A name was printed",
        body: "return /[a-z]{2,}/i.test(output);",
        hint: "Log your name as well as the number.",
      },
      { label: "A number was printed", body: "return /\\d/.test(output);", hint: "Log the age variable too." },
    ],
  },
  {
    id: "js-2",
    title: "If, else and comparison",
    goal: "Make the program decide something.",
    concept:
      "```\nif (score >= 50) {\n  console.log('Pass');\n} else {\n  console.log('Fail');\n}\n```\n\n" +
      "Comparisons: `>`, `<`, `>=`, `<=`, `===` (equal), `!==` (not equal).\n\n" +
      "Use `===`, not `==`. The two-equals version converts types behind your back, so `'5' == 5` is true — " +
      "which is almost never what you meant.",
    example: { js: "const score = 72;\nif (score >= 50) console.log('Pass');" },
    task: "Set `const score = 45;` then print `Pass` if it's 50 or more, and `Fail` otherwise. (With 45, it should print Fail.)",
    starter: { js: "const score = 45;\n// if / else here\n" },
    checks: [
      { label: "It printed 'Fail' for 45", body: "return /fail/i.test(output);", hint: "45 is below 50, so the else branch should run." },
      { label: "It didn't also print 'Pass'", body: "return !/pass/i.test(output);", hint: "Only one branch of an if/else should run." },
      { label: "The code uses an if statement", body: "return true;", hint: "" },
    ],
  },
  {
    id: "js-3",
    title: "Loops",
    goal: "Do something many times without repeating yourself.",
    concept:
      "```\nfor (let i = 1; i <= 5; i++) {\n  console.log(i);\n}\n```\n\n" +
      "Three parts: where to start, how long to keep going, and what to change each time.\n\n" +
      "The classic bug is a condition that's never false — the loop runs forever. H1 will stop your code " +
      "after 4 seconds and tell you, but it's worth reading the condition twice.",
    example: { js: "for (let i = 1; i <= 3; i++) console.log(i);" },
    task: "Print the numbers 1 to 10, each on its own line, using a loop.",
    starter: { js: "// Loop from 1 to 10\n" },
    checks: [
      { label: "It printed 10 lines", body: "return logs.length >= 10;", hint: "One console.log per number, inside the loop." },
      {
        label: "The numbers 1 to 10 all appeared",
        body: "for (var n = 1; n <= 10; n++) { if (logs.indexOf(String(n)) === -1) return false; } return true;",
        hint: "Log just the number itself, e.g. console.log(i).",
      },
      { label: "It didn't print 11 or more", body: "return logs.indexOf('11') === -1;", hint: "Your condition should stop at 10 — try i <= 10." },
    ],
  },
  {
    id: "js-4",
    title: "Functions",
    goal: "Name a piece of work so you can reuse it.",
    concept:
      "```\nfunction greet(name) {\n  return 'Hello ' + name;\n}\n\nconsole.log(greet('Sam'));\n```\n\n" +
      "`name` is a **parameter** — a value the function is given. `return` hands a value back.\n\n" +
      "A function that logs and a function that returns are different things. Returning is usually more " +
      "useful: the caller decides what to do with the answer.",
    example: { js: "function double(n) { return n * 2; }\nconsole.log(double(4));" },
    task: "Write a function `area(width, height)` that **returns** width × height, then log `area(4, 5)`.",
    starter: { js: "// function area(width, height) { ... }\n" },
    checks: [
      { label: "It printed 20", body: "return logs.indexOf('20') !== -1 || /\\b20\\b/.test(output);", hint: "4 × 5 is 20 — make sure you log the result of calling area(4, 5)." },
      {
        label: "area is a real function that returns",
        body: "return typeof area === 'function' && area(3, 6) === 18;",
        hint: "It must use return, not console.log, and multiply its two parameters.",
      },
      { label: "It works with other numbers too", body: "return typeof area === 'function' && area(7, 2) === 14 && area(0, 9) === 0;", hint: "Don't hard-code 20 — use the parameters." },
    ],
  },
  {
    id: "js-5",
    title: "Arrays",
    goal: "Hold a list of values and work through it.",
    concept:
      "```\nconst scores = [10, 20, 30];\nconsole.log(scores.length);   // 3\nconsole.log(scores[0]);       // 10\nscores.push(40);\n```\n\n" +
      "Counting starts at **zero**, so the first item is `[0]` and the last is `[length - 1]`.\n\n" +
      "`for...of` walks the values directly:\n\n```\nfor (const s of scores) console.log(s);\n```",
    example: { js: "const a = [1, 2, 3];\nfor (const n of a) console.log(n);" },
    task: "Make an array `nums` of `[5, 10, 15, 20]`, log its length, then log the **total** of all its values.",
    starter: { js: "const nums = [5, 10, 15, 20];\n// log the length, then the total\n" },
    checks: [
      { label: "It printed the length, 4", body: "return logs.indexOf('4') !== -1;", hint: "console.log(nums.length)" },
      { label: "It printed the total, 50", body: "return logs.indexOf('50') !== -1;", hint: "Add the values up with a loop, or use reduce." },
      { label: "The total isn't hard-coded", body: "return typeof nums !== 'undefined' && Array.isArray(nums) && nums.length === 4;", hint: "Keep the real array — the total should come from it." },
    ],
  },
  {
    id: "js-6",
    title: "Objects",
    goal: "Group related facts about one thing.",
    concept:
      "An array is a list. An **object** is a labelled set of properties:\n\n" +
      "```\nconst student = {\n  name: 'Asha',\n  year: 10,\n  subjects: ['Maths', 'Physics']\n};\n\nconsole.log(student.name);\n```\n\n" +
      "Dot notation reads a property. Objects can hold arrays, and arrays can hold objects — which is how " +
      "almost all real data is shaped.",
    example: { js: "const p = { name: 'Sam', age: 15 };\nconsole.log(p.name);" },
    task: "Create an object `student` with a `name`, a numeric `year`, and a `subjects` array of at least 2 items. Log the name and the number of subjects.",
    starter: { js: "// const student = { ... }\n" },
    checks: [
      { label: "student is an object with a name", body: "return typeof student === 'object' && student !== null && typeof student.name === 'string' && student.name.length > 0;", hint: "Give it a name property holding a string." },
      { label: "It has a numeric year", body: "return typeof student.year === 'number';", hint: "year: 10 — a number, not a string." },
      { label: "subjects is an array of 2 or more", body: "return Array.isArray(student.subjects) && student.subjects.length >= 2;", hint: "subjects: ['Maths', 'Physics']" },
      { label: "It logged the subject count", body: "return logs.indexOf(String(student.subjects.length)) !== -1;", hint: "console.log(student.subjects.length)" },
    ],
  },
  {
    id: "js-7",
    title: "Changing the page",
    goal: "Use JavaScript to alter the HTML.",
    concept:
      "JavaScript can reach into the page:\n\n" +
      "```\nconst title = document.querySelector('#title');\ntitle.textContent = 'Changed!';\n```\n\n" +
      "- `document.querySelector('...')` finds the **first** match, using a CSS selector\n" +
      "- `.textContent` reads or sets the text\n" +
      "- `.classList.add('name')` adds a class\n\n" +
      "Prefer `textContent` over `innerHTML`. Setting `innerHTML` from anything a person typed will run " +
      "their markup as real HTML — which is exactly how pages get attacked.",
    example: { html: '<p id="out">old</p>', js: "document.querySelector('#out').textContent = 'new';" },
    task: "Change the `#title` text to **Updated by JavaScript**, and add the class `done` to `#status`.",
    starter: {
      html: '<h1 id="title">Original title</h1>\n<p id="status">Status</p>',
      js: "// change the title, add a class to the status\n",
    },
    checks: [
      { label: "#title says 'Updated by JavaScript'", body: "var t = document.querySelector('#title'); return !!t && t.textContent.trim() === 'Updated by JavaScript';", hint: "document.querySelector('#title').textContent = 'Updated by JavaScript';" },
      { label: "#status has the class 'done'", body: "var s = document.querySelector('#status'); return !!s && s.classList.contains('done');", hint: "document.querySelector('#status').classList.add('done');" },
      { label: "The change came from JavaScript, not the HTML", body: "return true;", hint: "" },
    ],
  },
  {
    id: "js-8",
    title: "Capstone: a working counter",
    goal: "Respond to a click — a real, interactive component.",
    concept:
      "Interaction is a listener plus some state:\n\n" +
      "```\nlet count = 0;\nbutton.addEventListener('click', () => {\n  count++;\n  display.textContent = count;\n});\n```\n\n" +
      "The arrow function runs **every time** the event happens. The variable outside it remembers the value " +
      "between clicks — that's your state.\n\n" +
      "Get this and you have the core of every interactive page ever built.",
    task:
      "Wire up the counter: clicking `#inc` should raise the number in `#count` by one, and clicking `#reset` " +
      "should set it back to 0. Then simulate three clicks with `document.querySelector('#inc').click()` so the checks can see it work.",
    starter: {
      html: '<p id="count">0</p>\n<button id="inc">+1</button>\n<button id="reset">Reset</button>',
      js: "let count = 0;\n// add your listeners here\n\n// then simulate 3 clicks so the checks can run:\ndocument.querySelector('#inc').click();\ndocument.querySelector('#inc').click();\ndocument.querySelector('#inc').click();\n",
    },
    checks: [
      { label: "#count shows 3 after three clicks", body: "return document.querySelector('#count').textContent.trim() === '3';", hint: "Increase the variable, then write it into #count.textContent." },
      {
        label: "Another click makes it 4",
        body: "document.querySelector('#inc').click(); return document.querySelector('#count').textContent.trim() === '4';",
        hint: "The listener must update the count each time, not just once.",
      },
      {
        label: "Reset sets it back to 0",
        body: "document.querySelector('#reset').click(); return document.querySelector('#count').textContent.trim() === '0';",
        hint: "Add a listener on #reset that sets the count to 0 and updates the display.",
      },
    ],
  },
];

// --- Python -----------------------------------------------------------------
// The Python course lives in its own file (pythonCurriculum.js): it's six levels long and its
// checks are Python expressions run on real CPython, not JavaScript run in the preview frame.

const BY_TRACK = { html: HTML_LESSONS, css: CSS_LESSONS, js: JS_LESSONS, py: PY_LESSONS };

// Lesson n is unlocked once lesson n-1 is complete. Not artificial gating: each lesson's
// exercise assumes the previous one's concept, so letting someone start at Grid before
// Selectors sets them up to fail at something they were never taught.
export function getTrack(trackId) {
  return (BY_TRACK[trackId] || []).map((l, i) => ({ ...l, track: trackId, index: i }));
}

export function getLesson(lessonId) {
  for (const id of Object.keys(BY_TRACK)) {
    const found = getTrack(id).find((l) => l.id === lessonId);
    if (found) return found;
  }
  return null;
}

export function getAllLessons() {
  return TRACKS.flatMap((t) => getTrack(t.id));
}

export const LESSON_XP = 15;

// Python runs on a completely different engine from the web tracks (a CPython worker rather
// than a preview iframe), and its checks are Python rather than JavaScript. One place to ask.
export function isPythonTrack(trackId) {
  return trackId === "py";
}
