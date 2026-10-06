const { validate, hashPassword, createSession } = require("./lib/auth");
const { insert } = require("./lib/db");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleSignup(input) {
  validate(input);
  const hash = hashPassword(input.password);
  await sleep(60);
  const session = createSession(hash);
  insert(session);
  return session;
}

globalThis.__asyncSignup = handleSignup({
  email: "vibe@coder.dev",
  password: "hunter2",
});
