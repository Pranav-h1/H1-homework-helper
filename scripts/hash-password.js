#!/usr/bin/env node
// Turns a password into the hash H1 stores, so a deployment can be given
// H1_MASTER_PASSWORD_HASH instead of a plaintext password in its environment.
//
//   node scripts/hash-password.js
//
// It asks for the password without echoing it, and prints only the hash. The password itself is
// never written to a file, a log, or your shell history — which is why it isn't taken as a
// command-line argument.
const readline = require("readline");
const { hashPassword } = require("../server/auth/passwords");
const { PASSWORD_HARD_LIMIT } = require("../server/auth/validation");

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    const rl = readline.createInterface({ input, output, terminal: true });
    // Swallow the echo so the password doesn't appear on screen.
    const onData = (char) => {
      const s = String(char);
      if (s === "\n" || s === "\r" || s === "") return;
      output.write("\x1b[2K\x1b[200D" + question + "*".repeat(rl.line.length));
    };
    input.on("data", onData);
    rl.question(question, (answer) => {
      input.off("data", onData);
      rl.close();
      output.write("\n");
      resolve(answer);
    });
    rl.on("SIGINT", () => {
      rl.close();
      reject(new Error("cancelled"));
    });
  });
}

async function main() {
  if (!process.stdin.isTTY) {
    console.error("Run this in a terminal — it asks for the password interactively so it isn't left in your shell history.");
    process.exit(1);
  }
  const password = await askHidden("Password: ");
  if (!password) {
    console.error("No password given.");
    process.exit(1);
  }
  if (password.length > PASSWORD_HARD_LIMIT) {
    console.error("That's longer than H1 accepts.");
    process.exit(1);
  }
  const again = await askHidden("Again:    ");
  if (again !== password) {
    console.error("They don't match.");
    process.exit(1);
  }
  const hash = await hashPassword(password);
  console.log("\nSet this in your server's environment:\n");
  console.log(`H1_MASTER_PASSWORD_HASH=${hash}\n`);
  console.log("Keep it out of the repository. Anyone who has it can run offline guesses against it,");
  console.log("though scrypt makes that slow and expensive.");
}

main().catch((err) => {
  console.error(err.message === "cancelled" ? "Cancelled." : `Failed: ${err.message}`);
  process.exit(1);
});
