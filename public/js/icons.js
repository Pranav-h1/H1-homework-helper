// H1's small icon set.
//
// One drawing style everywhere: a 24px grid, 2px strokes, round caps and joins — the same as
// the sidebar and the dock. Emoji still appear where they carry meaning (a subject's flag, a
// student's own note), but not as interface furniture, where their mix of colours and styles
// made every card look slightly different from its neighbour.
const PATHS = {
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/>',
  repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  "trending-down": '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 2h6"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  brain: '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04z"/>',
  sparkles: '<path d="M12 3l1.8 4.6L18.5 9.5l-4.7 1.9L12 16l-1.8-4.6L5.5 9.5l4.7-1.9z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  star: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
  trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3a3 3 0 0 1-3 4"/><path d="M7 5H4a3 3 0 0 0 3 4"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  cards: '<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
  clipboard: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 3v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V3"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  graduation: '<path d="M2 8.5 12 4l10 4.5-10 4.5z"/><path d="M6 10.6V16c0 1.3 2.7 2.5 6 2.5s6-1.2 6-2.5v-5.4"/><line x1="22" y1="8.5" x2="22" y2="14"/>',
  calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8" y2="11"/><line x1="12" y1="11" x2="12" y2="11"/><line x1="16" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="8" y2="15"/><line x1="12" y1="15" x2="12" y2="15"/><line x1="16" y1="15" x2="16" y2="18"/><line x1="8" y1="18" x2="12" y2="18"/>',
  flask: '<path d="M9 2v6.2L3.6 17.4A2 2 0 0 0 5.3 20.5h13.4a2 2 0 0 0 1.7-3.1L15 8.2V2"/><line x1="8" y1="2" x2="16" y2="2"/><line x1="7" y1="14" x2="17" y2="14"/>',
  "book-open": '<path d="M12 6.5C10.5 5 8.5 4.3 6 4.3H3v14h3c2.5 0 4.5.7 6 2.2"/><path d="M12 6.5c1.5-1.5 3.5-2.2 6-2.2h3v14h-3c-2.5 0-4.5.7-6 2.2z"/><line x1="12" y1="6.5" x2="12" y2="20.5"/>',
  laptop: '<rect x="3" y="4" width="18" height="12" rx="2"/><line x1="1.5" y1="20" x2="22.5" y2="20"/>',
  moon: '<path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/>',
  monitor: '<rect x="2" y="3.5" width="20" height="13" rx="2"/><line x1="8" y1="20.5" x2="16" y2="20.5"/><line x1="12" y1="16.5" x2="12" y2="20.5"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><line x1="10.5" y1="18.5" x2="13.5" y2="18.5"/>',
  cloud: '<path d="M17.5 19H7a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.5 1.55A3.75 3.75 0 0 1 17.5 19z"/>',
  wrench: '<path d="M14.3 6.3a4.5 4.5 0 0 0 5.9 5.9l-8.2 8.2a2.6 2.6 0 0 1-3.7-3.7z"/><path d="M14.3 6.3 17 3.6a4.5 4.5 0 0 1 3.2 7.4"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20z"/>',
  flag: '<path d="M4 21V4h11l-1.4 3.5L15 11H4"/><line x1="4" y1="4" x2="4" y2="21"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  edit: '<path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6l-3.5.9.9-3.5z"/>',
  puzzle: '<path d="M10 3.5a2 2 0 1 1 4 0V5h3.5a1.5 1.5 0 0 1 1.5 1.5V10h1.5a2 2 0 1 1 0 4H19v3.5a1.5 1.5 0 0 1-1.5 1.5H14v-1.5a2 2 0 1 0-4 0V19H6.5A1.5 1.5 0 0 1 5 17.5V14H3.5a2 2 0 1 1 0-4H5V6.5A1.5 1.5 0 0 1 6.5 5H10z"/>',
  package: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/>',
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  chart: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3" height="6" rx="1"/><rect x="11" y="7" width="3" height="10" rx="1"/><rect x="16" y="13" width="3" height="4" rx="1"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .9 1.6h5.2c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5"/><path d="M9.5 21v-6h5v6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
};

export function icon(name, size = 16, className = "") {
  const body = PATHS[name];
  if (!body) return "";
  return `<svg class="h1-icon${className ? " " + className : ""}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

// The emoji H1 used to put at the front of labels, and the icon that replaces each one. Labels
// can keep being written the old way — this turns them into the consistent style on the way out.
const EMOJI_TO_ICON = [
  ["💬", "chat"],
  ["🔁", "repeat"],
  ["📉", "trending-down"],
  ["📅", "calendar"],
  ["🗒️", "note"],
  ["🗒", "note"],
  ["🐍", "code"],
  ["⏱️", "timer"],
  ["⏱", "timer"],
  ["🧭", "compass"],
  ["🎯", "target"],
  ["🧠", "brain"],
  ["✨", "sparkles"],
  ["📚", "book"],
  ["📘", "book"],
  ["📁", "folder"],
  ["⭐", "star"],
  ["🏆", "trophy"],
  ["🎓", "graduation"],
  ["🧮", "calculator"],
  ["🔬", "flask"],
  ["📖", "book-open"],
  ["💻", "laptop"],
  ["🌙", "moon"],
  ["☀️", "sun"],
  ["🖥️", "monitor"],
  ["📱", "phone"],
  ["☁️", "cloud"],
  ["🧰", "wrench"],
  ["📸", "camera"],
  ["🌐", "globe"],
  ["🚩", "flag"],
  ["📄", "file"],
  ["📝", "edit"],
  ["🧩", "puzzle"],
  ["📦", "package"],
  ["🔤", "type"],
  ["🤖", "sparkles"],
  ["🌌", "sparkles"],
  ["💎", "star"],
  ["🔍", "search"],
  ["⚡", "zap"],
  ["🏠", "home"],
  ["⚙️", "gear"],
  ["⚙", "gear"],
  ["🔔", "bell"],
  ["🗂️", "cards"],
  ["🗂", "cards"],
  ["✅", "check"],
  ["🗓️", "calendar"],
  ["🗓", "calendar"],
  ["📆", "calendar"],
  ["📈", "chart"],
  ["📊", "chart"],
  ["👾", "zap"],
  ["✍️", "edit"],
  ["✍", "edit"],
  ["🏁", "flag"],
  ["🛠️", "wrench"],
  ["🛠", "wrench"],
  ["🌓", "moon"],
  ["🌗", "moon"],
  ["🎯", "target"],
  ["🚪", "inbox"],
  ["🔁", "repeat"],
];

// Splits "💬 Continue studying" into an icon and the words.
export function labelWithIcon(text, size = 13) {
  const value = String(text || "");
  for (const [emoji, name] of EMOJI_TO_ICON) {
    if (value.startsWith(emoji)) {
      return { icon: icon(name, size), text: value.slice(emoji.length).trim() };
    }
  }
  return { icon: "", text: value };
}

// A single emoji on its own — the way the command palette labels a row — resolved to the icon
// that replaces it. Falls back to the character itself, so an entry with no mapping still shows
// something rather than nothing.
export function emojiIcon(value, size = 16) {
  const ch = String(value || "").trim();
  for (const [emoji, name] of EMOJI_TO_ICON) {
    if (ch === emoji) return icon(name, size);
  }
  return "";
}
