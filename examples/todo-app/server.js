const { validate, hashPassword, createSession } = require("./lib/auth");
const { insert } = require("./lib/db");

function handleSignup(input) {
  validate(input);
  const hash = hashPassword(input.password);
  const session = createSession(hash);
  insert(session);
  return session;
}

const session = handleSignup({ email: "vibe@coder.dev", password: "hunter2" });
globalThis.__signupResult = session;
