function validate(input) {
  if (!input || !input.email || !input.password) {
    throw new Error("invalid input");
  }
  return true;
}

function hashPassword(password) {
  let acc = 0;
  for (let i = 0; i < 3000000; i += 1) {
    acc = (acc + i) % 9973;
  }
  return "hashed:" + password + ":" + acc;
}

function createSession(hash) {
  return { id: "sess_" + hash.slice(-4), hash };
}

module.exports = { validate, hashPassword, createSession };
