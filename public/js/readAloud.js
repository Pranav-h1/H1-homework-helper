// Thin wrapper around the Web Speech API's SpeechSynthesis — used for "read aloud" on AI
// replies. Every call checks for real browser support first; nothing here pretends to speak
// when the API isn't available.
export function isSupported() {
  return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

let currentUtterance = null;

export function stopSpeaking() {
  if (isSupported()) window.speechSynthesis.cancel();
  currentUtterance = null;
}

// Toggles a single button between Play / Pause / Resume states for one block of text.
// Returns nothing — call again on the same button to advance the state machine.
export function toggleReadAloud(text, btn) {
  if (!isSupported()) {
    btn.textContent = "Read aloud not supported here";
    return;
  }
  const synth = window.speechSynthesis;

  if (synth.speaking && !synth.paused && btn.dataset.speaking === "1") {
    synth.pause();
    btn.textContent = "▶ Resume reading";
    return;
  }
  if (synth.paused && btn.dataset.speaking === "1") {
    synth.resume();
    btn.textContent = "⏸ Pause reading";
    return;
  }

  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;
  btn.dataset.speaking = "1";
  btn.textContent = "⏸ Pause reading";
  utterance.onend = () => {
    btn.dataset.speaking = "0";
    btn.textContent = "🔊 Read aloud";
  };
  utterance.onerror = () => {
    btn.dataset.speaking = "0";
    btn.textContent = "🔊 Read aloud";
  };
  synth.speak(utterance);
}
