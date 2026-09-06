import { getDecks } from "./flashcardDecks.js";
import { showToast } from "./toast.js";

/* =========================================================
   Basic calculator
   ========================================================= */
function initCalculator() {
  const display = document.getElementById("calcDisplay");
  const pad = document.getElementById("calcPad");
  if (!pad) return;
  let current = "0";
  let previous = null;
  let operator = null;
  let justEvaluated = false;

  function render() {
    display.textContent = current;
  }

  function inputDigit(d) {
    if (justEvaluated) {
      current = d === "." ? "0." : d;
      justEvaluated = false;
    } else if (current === "0" && d !== ".") {
      current = d;
    } else if (d === "." && current.includes(".")) {
      return;
    } else {
      current += d;
    }
    render();
  }

  function applyOperator(op) {
    if (operator && !justEvaluated) evaluate();
    previous = parseFloat(current);
    operator = op;
    justEvaluated = true;
  }

  function evaluate() {
    if (operator == null || previous == null) return;
    const a = previous;
    const b = parseFloat(current);
    let result;
    if (operator === "+") result = a + b;
    else if (operator === "-") result = a - b;
    else if (operator === "×") result = a * b;
    else if (operator === "÷") result = b === 0 ? NaN : a / b;
    current = Number.isFinite(result) ? String(Math.round(result * 1e10) / 1e10) : "Error";
    operator = null;
    previous = null;
    justEvaluated = true;
    render();
  }

  pad.addEventListener("click", (e) => {
    const btn = e.target.closest(".calc-btn");
    if (!btn) return;
    const { digit, op, action } = btn.dataset;
    if (digit != null) {
      inputDigit(digit);
    } else if (op) {
      applyOperator(op);
    } else if (action === "equals") {
      evaluate();
    } else if (action === "clear") {
      current = "0";
      previous = null;
      operator = null;
      justEvaluated = false;
      render();
    } else if (action === "sign") {
      current = String(parseFloat(current) * -1);
      render();
    } else if (action === "percent") {
      current = String(parseFloat(current) / 100);
      render();
    } else if (action === "sqrt") {
      const n = parseFloat(current);
      current = n < 0 ? "Error" : String(Math.sqrt(n));
      justEvaluated = true;
      render();
    } else if (action === "square") {
      current = String(Math.pow(parseFloat(current), 2));
      justEvaluated = true;
      render();
    }
  });

  render();
}

/* =========================================================
   Fraction calculator
   ========================================================= */
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function initFractionCalc() {
  const n1 = document.getElementById("fracN1");
  const d1 = document.getElementById("fracD1");
  const n2 = document.getElementById("fracN2");
  const d2 = document.getElementById("fracD2");
  const op = document.getElementById("fracOp");
  const btn = document.getElementById("fracComputeBtn");
  const result = document.getElementById("fracResult");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const a = Number(n1.value), b = Number(d1.value), c = Number(n2.value), d = Number(d2.value);
    if (!b || !d) {
      result.textContent = "Denominator can't be zero.";
      return;
    }
    let rn, rd;
    switch (op.value) {
      case "+": rn = a * d + c * b; rd = b * d; break;
      case "-": rn = a * d - c * b; rd = b * d; break;
      case "×": rn = a * c; rd = b * d; break;
      case "÷": rn = a * d; rd = b * c; break;
      default: return;
    }
    if (!rd) {
      result.textContent = "Result is undefined (division by zero).";
      return;
    }
    const g = gcd(rn, rd);
    rn /= g;
    rd /= g;
    if (rd < 0) { rn = -rn; rd = -rd; }
    result.textContent = `${rn}/${rd}  (≈ ${(rn / rd).toFixed(4).replace(/\.?0+$/, "")})`;
  });
}

/* =========================================================
   Percentage calculator
   ========================================================= */
function initPercentCalc() {
  const xOfY = { x: document.getElementById("pctX"), y: document.getElementById("pctY"), btn: document.getElementById("pctXOfYBtn"), out: document.getElementById("pctXOfYResult") };
  const whatPct = { a: document.getElementById("pctA"), b: document.getElementById("pctB"), btn: document.getElementById("pctWhatBtn"), out: document.getElementById("pctWhatResult") };
  const change = { val: document.getElementById("pctVal"), pct: document.getElementById("pctChange"), btn: document.getElementById("pctChangeBtn"), out: document.getElementById("pctChangeResult") };
  if (!xOfY.btn) return;

  xOfY.btn.addEventListener("click", () => {
    const x = Number(xOfY.x.value), y = Number(xOfY.y.value);
    xOfY.out.textContent = `${x}% of ${y} = ${((x / 100) * y).toFixed(2).replace(/\.00$/, "")}`;
  });
  whatPct.btn.addEventListener("click", () => {
    const a = Number(whatPct.a.value), b = Number(whatPct.b.value);
    if (!b) { whatPct.out.textContent = "Enter a non-zero total."; return; }
    whatPct.out.textContent = `${a} is ${((a / b) * 100).toFixed(2).replace(/\.00$/, "")}% of ${b}`;
  });
  change.btn.addEventListener("click", () => {
    const v = Number(change.val.value), p = Number(change.pct.value);
    const increased = v * (1 + p / 100);
    const decreased = v * (1 - p / 100);
    change.out.textContent = `+${p}% → ${increased.toFixed(2)}   ·   −${p}% → ${decreased.toFixed(2)}`;
  });
}

/* =========================================================
   Unit converter
   ========================================================= */
const UNIT_GROUPS = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mile: 1609.34, yard: 0.9144, foot: 0.3048, inch: 0.0254 },
  mass: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, ton: 1000 },
  time: { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 },
};

function initUnitConverter() {
  const category = document.getElementById("unitCategory");
  const fromUnit = document.getElementById("unitFrom");
  const toUnit = document.getElementById("unitTo");
  const value = document.getElementById("unitValue");
  const result = document.getElementById("unitResult");
  if (!category) return;

  function populateUnits() {
    const isTemp = category.value === "temperature";
    const units = isTemp ? ["celsius", "fahrenheit", "kelvin"] : Object.keys(UNIT_GROUPS[category.value]);
    [fromUnit, toUnit].forEach((sel, i) => {
      sel.innerHTML = units.map((u) => `<option value="${u}">${u}</option>`).join("");
      sel.value = units[i === 0 ? 0 : Math.min(1, units.length - 1)];
    });
    convert();
  }

  function toCelsius(v, unit) {
    if (unit === "celsius") return v;
    if (unit === "fahrenheit") return ((v - 32) * 5) / 9;
    return v - 273.15;
  }
  function fromCelsius(c, unit) {
    if (unit === "celsius") return c;
    if (unit === "fahrenheit") return (c * 9) / 5 + 32;
    return c + 273.15;
  }

  function convert() {
    const v = Number(value.value);
    if (!Number.isFinite(v)) {
      result.textContent = "";
      return;
    }
    let out;
    if (category.value === "temperature") {
      out = fromCelsius(toCelsius(v, fromUnit.value), toUnit.value);
    } else {
      const table = UNIT_GROUPS[category.value];
      out = (v * table[fromUnit.value]) / table[toUnit.value];
    }
    result.textContent = `${v} ${fromUnit.value} = ${Number(out.toFixed(6))} ${toUnit.value}`;
  }

  category.addEventListener("change", populateUnits);
  [fromUnit, toUnit, value].forEach((el) => el.addEventListener("input", convert));
  populateUnits();
}

/* =========================================================
   Geometry helper
   ========================================================= */
function initGeometryHelper() {
  const shape = document.getElementById("geoShape");
  const fieldsWrap = document.getElementById("geoFields");
  const result = document.getElementById("geoResult");
  if (!shape) return;

  const SHAPES = {
    circle: { fields: [["r", "Radius"]], calc: ({ r }) => ({ Area: Math.PI * r * r, Circumference: 2 * Math.PI * r }) },
    rectangle: { fields: [["w", "Width"], ["h", "Height"]], calc: ({ w, h }) => ({ Area: w * h, Perimeter: 2 * (w + h) }) },
    square: { fields: [["s", "Side"]], calc: ({ s }) => ({ Area: s * s, Perimeter: 4 * s }) },
    triangle: { fields: [["b", "Base"], ["h", "Height"]], calc: ({ b, h }) => ({ Area: 0.5 * b * h }) },
    cylinder: { fields: [["r", "Radius"], ["h", "Height"]], calc: ({ r, h }) => ({ Volume: Math.PI * r * r * h, "Surface area": 2 * Math.PI * r * (r + h) }) },
    sphere: { fields: [["r", "Radius"]], calc: ({ r }) => ({ Volume: (4 / 3) * Math.PI * r ** 3, "Surface area": 4 * Math.PI * r * r }) },
  };

  function buildFields() {
    const def = SHAPES[shape.value];
    fieldsWrap.innerHTML = def.fields.map(([key, label]) => `<input class="tool-input" data-geo="${key}" type="number" placeholder="${label}" style="margin-bottom:8px" />`).join("");
    fieldsWrap.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", compute));
    result.textContent = "";
  }

  function compute() {
    const def = SHAPES[shape.value];
    const values = {};
    let valid = true;
    fieldsWrap.querySelectorAll("input").forEach((inp) => {
      const v = Number(inp.value);
      if (!inp.value || !Number.isFinite(v) || v < 0) valid = false;
      values[inp.dataset.geo] = v;
    });
    if (!valid) {
      result.textContent = "";
      return;
    }
    const out = def.calc(values);
    result.innerHTML = Object.entries(out)
      .map(([k, v]) => `${k}: ${Number(v.toFixed(4))}`)
      .join("<br>");
  }

  shape.addEventListener("change", buildFields);
  buildFields();
}

/* =========================================================
   Formula reference (static data)
   ========================================================= */
const FORMULAS = {
  Math: [
    ["Area of a circle", "A = πr²"],
    ["Circumference of a circle", "C = 2πr"],
    ["Area of a triangle", "A = ½ × base × height"],
    ["Pythagorean theorem", "a² + b² = c²"],
    ["Quadratic formula", "x = (−b ± √(b²−4ac)) / 2a"],
    ["Slope of a line", "m = (y₂−y₁) / (x₂−x₁)"],
    ["Simple interest", "I = P × R × T"],
  ],
  Physics: [
    ["Speed", "speed = distance / time"],
    ["Acceleration", "a = (v−u) / t"],
    ["Newton's second law", "F = m × a"],
    ["Ohm's law", "V = I × R"],
    ["Work done", "W = F × d"],
    ["Kinetic energy", "KE = ½mv²"],
  ],
  Chemistry: [
    ["Moles", "n = mass / molar mass"],
    ["Molarity", "M = moles of solute / litres of solution"],
    ["Ideal gas law", "PV = nRT"],
  ],
};

function initFormulaReference() {
  const container = document.getElementById("formulaReference");
  if (!container) return;
  container.innerHTML = "";
  Object.entries(FORMULAS).forEach(([subject, list]) => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `<h3></h3>`;
    card.querySelector("h3").textContent = subject;
    list.forEach(([name, formula]) => {
      const row = document.createElement("div");
      row.className = "weak-topic-row";
      row.innerHTML = `<span></span><strong></strong>`;
      row.querySelector("span").textContent = name;
      row.querySelector("strong").textContent = formula;
      card.appendChild(row);
    });
    container.appendChild(card);
  });
}

/* =========================================================
   Periodic table (static data)
   ========================================================= */
const ELEMENTS = [
  [1,"H","Hydrogen",1.008,"nonmetal",1,1],[2,"He","Helium",4.0026,"noble",1,18],
  [3,"Li","Lithium",6.94,"alkali",2,1],[4,"Be","Beryllium",9.0122,"alkaline",2,2],
  [5,"B","Boron",10.81,"metalloid",2,13],[6,"C","Carbon",12.011,"nonmetal",2,14],
  [7,"N","Nitrogen",14.007,"nonmetal",2,15],[8,"O","Oxygen",15.999,"nonmetal",2,16],
  [9,"F","Fluorine",18.998,"halogen",2,17],[10,"Ne","Neon",20.18,"noble",2,18],
  [11,"Na","Sodium",22.99,"alkali",3,1],[12,"Mg","Magnesium",24.305,"alkaline",3,2],
  [13,"Al","Aluminium",26.982,"posttransition",3,13],[14,"Si","Silicon",28.085,"metalloid",3,14],
  [15,"P","Phosphorus",30.974,"nonmetal",3,15],[16,"S","Sulfur",32.06,"nonmetal",3,16],
  [17,"Cl","Chlorine",35.45,"halogen",3,17],[18,"Ar","Argon",39.948,"noble",3,18],
  [19,"K","Potassium",39.098,"alkali",4,1],[20,"Ca","Calcium",40.078,"alkaline",4,2],
  [21,"Sc","Scandium",44.956,"transition",4,3],[22,"Ti","Titanium",47.867,"transition",4,4],
  [23,"V","Vanadium",50.942,"transition",4,5],[24,"Cr","Chromium",51.996,"transition",4,6],
  [25,"Mn","Manganese",54.938,"transition",4,7],[26,"Fe","Iron",55.845,"transition",4,8],
  [27,"Co","Cobalt",58.933,"transition",4,9],[28,"Ni","Nickel",58.693,"transition",4,10],
  [29,"Cu","Copper",63.546,"transition",4,11],[30,"Zn","Zinc",65.38,"transition",4,12],
  [31,"Ga","Gallium",69.723,"posttransition",4,13],[32,"Ge","Germanium",72.63,"metalloid",4,14],
  [33,"As","Arsenic",74.922,"metalloid",4,15],[34,"Se","Selenium",78.971,"nonmetal",4,16],
  [35,"Br","Bromine",79.904,"halogen",4,17],[36,"Kr","Krypton",83.798,"noble",4,18],
  [37,"Rb","Rubidium",85.468,"alkali",5,1],[38,"Sr","Strontium",87.62,"alkaline",5,2],
  [39,"Y","Yttrium",88.906,"transition",5,3],[40,"Zr","Zirconium",91.224,"transition",5,4],
  [41,"Nb","Niobium",92.906,"transition",5,5],[42,"Mo","Molybdenum",95.95,"transition",5,6],
  [43,"Tc","Technetium",98,"transition",5,7],[44,"Ru","Ruthenium",101.07,"transition",5,8],
  [45,"Rh","Rhodium",102.91,"transition",5,9],[46,"Pd","Palladium",106.42,"transition",5,10],
  [47,"Ag","Silver",107.87,"transition",5,11],[48,"Cd","Cadmium",112.41,"transition",5,12],
  [49,"In","Indium",114.82,"posttransition",5,13],[50,"Sn","Tin",118.71,"posttransition",5,14],
  [51,"Sb","Antimony",121.76,"metalloid",5,15],[52,"Te","Tellurium",127.6,"metalloid",5,16],
  [53,"I","Iodine",126.9,"halogen",5,17],[54,"Xe","Xenon",131.29,"noble",5,18],
  [55,"Cs","Caesium",132.91,"alkali",6,1],[56,"Ba","Barium",137.33,"alkaline",6,2],
  [57,"La","Lanthanum",138.91,"lanthanide",6,3],
  [58,"Ce","Cerium",140.12,"lanthanide",9,4],[59,"Pr","Praseodymium",140.91,"lanthanide",9,5],
  [60,"Nd","Neodymium",144.24,"lanthanide",9,6],[61,"Pm","Promethium",145,"lanthanide",9,7],
  [62,"Sm","Samarium",150.36,"lanthanide",9,8],[63,"Eu","Europium",151.96,"lanthanide",9,9],
  [64,"Gd","Gadolinium",157.25,"lanthanide",9,10],[65,"Tb","Terbium",158.93,"lanthanide",9,11],
  [66,"Dy","Dysprosium",162.5,"lanthanide",9,12],[67,"Ho","Holmium",164.93,"lanthanide",9,13],
  [68,"Er","Erbium",167.26,"lanthanide",9,14],[69,"Tm","Thulium",168.93,"lanthanide",9,15],
  [70,"Yb","Ytterbium",173.05,"lanthanide",9,16],[71,"Lu","Lutetium",174.97,"lanthanide",9,17],
  [72,"Hf","Hafnium",178.49,"transition",6,4],[73,"Ta","Tantalum",180.95,"transition",6,5],
  [74,"W","Tungsten",183.84,"transition",6,6],[75,"Re","Rhenium",186.21,"transition",6,7],
  [76,"Os","Osmium",190.23,"transition",6,8],[77,"Ir","Iridium",192.22,"transition",6,9],
  [78,"Pt","Platinum",195.08,"transition",6,10],[79,"Au","Gold",196.97,"transition",6,11],
  [80,"Hg","Mercury",200.59,"transition",6,12],[81,"Tl","Thallium",204.38,"posttransition",6,13],
  [82,"Pb","Lead",207.2,"posttransition",6,14],[83,"Bi","Bismuth",208.98,"posttransition",6,15],
  [84,"Po","Polonium",209,"metalloid",6,16],[85,"At","Astatine",210,"halogen",6,17],
  [86,"Rn","Radon",222,"noble",6,18],
  [87,"Fr","Francium",223,"alkali",7,1],[88,"Ra","Radium",226,"alkaline",7,2],
  [89,"Ac","Actinium",227,"actinide",7,3],
  [90,"Th","Thorium",232.04,"actinide",10,4],[91,"Pa","Protactinium",231.04,"actinide",10,5],
  [92,"U","Uranium",238.03,"actinide",10,6],[93,"Np","Neptunium",237,"actinide",10,7],
  [94,"Pu","Plutonium",244,"actinide",10,8],[95,"Am","Americium",243,"actinide",10,9],
  [96,"Cm","Curium",247,"actinide",10,10],[97,"Bk","Berkelium",247,"actinide",10,11],
  [98,"Cf","Californium",251,"actinide",10,12],[99,"Es","Einsteinium",252,"actinide",10,13],
  [100,"Fm","Fermium",257,"actinide",10,14],[101,"Md","Mendelevium",258,"actinide",10,15],
  [102,"No","Nobelium",259,"actinide",10,16],[103,"Lr","Lawrencium",262,"actinide",10,17],
  [104,"Rf","Rutherfordium",267,"transition",7,4],[105,"Db","Dubnium",268,"transition",7,5],
  [106,"Sg","Seaborgium",269,"transition",7,6],[107,"Bh","Bohrium",270,"transition",7,7],
  [108,"Hs","Hassium",269,"transition",7,8],[109,"Mt","Meitnerium",278,"transition",7,9],
  [110,"Ds","Darmstadtium",281,"transition",7,10],[111,"Rg","Roentgenium",282,"transition",7,11],
  [112,"Cn","Copernicium",285,"transition",7,12],[113,"Nh","Nihonium",286,"posttransition",7,13],
  [114,"Fl","Flerovium",289,"posttransition",7,14],[115,"Mc","Moscovium",290,"posttransition",7,15],
  [116,"Lv","Livermorium",293,"posttransition",7,16],[117,"Ts","Tennessine",294,"halogen",7,17],
  [118,"Og","Oganesson",294,"noble",7,18],
];

const CATEGORY_COLORS = {
  nonmetal: "#22c55e", noble: "#7c5cff", alkali: "#f97066", alkaline: "#f59e0b",
  metalloid: "#22d3ee", halogen: "#a78bfa", transition: "#60a5fa", posttransition: "#94a3b8",
  lanthanide: "#f472b6", actinide: "#fb923c",
};

function initPeriodicTable() {
  const grid = document.getElementById("periodicTableGrid");
  const detail = document.getElementById("periodicTableDetail");
  if (!grid) return;
  grid.innerHTML = "";
  ELEMENTS.forEach(([num, symbol, name, mass, category, row, col]) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "pt-element";
    cell.style.gridRow = row;
    cell.style.gridColumn = col;
    cell.style.borderColor = CATEGORY_COLORS[category] || "var(--border)";
    cell.innerHTML = `<span>${num}</span><span class="pt-element-symbol">${symbol}</span>`;
    cell.addEventListener("click", () => {
      detail.innerHTML = `<strong>${name} (${symbol})</strong><br>Atomic number: ${num} · Atomic mass: ${mass}<br>Category: ${category}`;
    });
    grid.appendChild(cell);
  });
  detail.textContent = "Click an element to see its details.";
}

/* =========================================================
   Random question generator (from your own flashcard decks)
   ========================================================= */
function initRandomQuestion() {
  const btn = document.getElementById("randomQuestionBtn");
  const card = document.getElementById("randomQuestionCard");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const allCards = [];
    getDecks().forEach((deck) => deck.cards.forEach((c) => allCards.push({ ...c, topic: deck.topic })));
    if (allCards.length === 0) {
      card.innerHTML = '<p class="view-sub">Study a flashcard deck first — random questions are pulled from your own decks.</p>';
      return;
    }
    const pick = allCards[Math.floor(Math.random() * allCards.length)];
    card.innerHTML = `
      <div class="practice-card">
        <div class="practice-question"></div>
        <button type="button" class="icon-btn-sm">Reveal answer</button>
        <div class="practice-answer" hidden></div>
      </div>`;
    card.querySelector(".practice-question").textContent = `[${pick.topic}] ${pick.front}`;
    const answerEl = card.querySelector(".practice-answer");
    answerEl.textContent = pick.back;
    card.querySelector("button").addEventListener("click", () => {
      answerEl.hidden = !answerEl.hidden;
    });
  });
}

/* =========================================================
   Timers: Pomodoro / Stopwatch / Countdown
   ========================================================= */
function initTimers() {
  const modeSelect = document.getElementById("timerModeSelect");
  const display = document.getElementById("timerDisplay");
  const startBtn = document.getElementById("timerStartBtn");
  const resetBtn = document.getElementById("timerResetBtn");
  const countdownInput = document.getElementById("timerCountdownMinutes");
  if (!modeSelect) return;

  let intervalId = null;
  let seconds = 0;
  let running = false;

  function format(s) {
    const sign = s < 0 ? "-" : "";
    s = Math.abs(s);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${sign}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function render() {
    display.textContent = format(seconds);
  }

  function stop() {
    clearInterval(intervalId);
    intervalId = null;
    running = false;
    startBtn.textContent = "Start";
  }

  function reset() {
    stop();
    const mode = modeSelect.value;
    seconds = mode === "pomodoro" ? 25 * 60 : mode === "countdown" ? Math.max(1, Number(countdownInput.value) || 5) * 60 : 0;
    render();
  }

  function tick() {
    const mode = modeSelect.value;
    if (mode === "stopwatch") {
      seconds += 1;
    } else {
      seconds -= 1;
      if (seconds <= 0) {
        seconds = 0;
        stop();
        showToast(mode === "pomodoro" ? "Pomodoro session complete!" : "Countdown finished!", "success");
      }
    }
    render();
  }

  startBtn.addEventListener("click", () => {
    if (running) {
      stop();
      return;
    }
    running = true;
    startBtn.textContent = "Pause";
    intervalId = setInterval(tick, 1000);
  });
  resetBtn.addEventListener("click", reset);
  modeSelect.addEventListener("change", reset);
  countdownInput.addEventListener("change", reset);

  reset();
}

export function initToolsHub() {
  initCalculator();
  initFractionCalc();
  initPercentCalc();
  initUnitConverter();
  initGeometryHelper();
  initFormulaReference();
  initPeriodicTable();
  initRandomQuestion();
  initTimers();
}
