function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validate(input) {
  if (!input || !input.email) throw new Error("invalid input");
  return true;
}

function sign(name) {
  let acc = 0;
  for (let i = 0; i < 100000; i += 1) {
    acc = (acc + i) % 9973;
  }
  return name + ":" + acc;
}

function persist(token) {
  return { token };
}

async function flow(name, delay) {
  validate({ email: name });
  await sleep(delay);
  const token = sign(name);
  await sleep(3);
  persist(token);
  return name;
}

async function usesTimer() {
  await sleep(12);
  afterTimer();
}

function afterTimer() {
  return 1;
}

async function usesMicrotask() {
  await Promise.resolve();
  afterMicrotask();
}

function afterMicrotask() {
  return 1;
}

async function main() {
  await Promise.all([flow("A", 30), flow("B", 8)]);
  await usesTimer();
  await usesMicrotask();
}

globalThis.__concurrent = main();
