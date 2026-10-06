function boom() {
  throw new Error("kaboom");
}

function catches() {
  try {
    boom();
  } catch (error) {
    globalThis.__caught = error.message;
  }
}

function boom2() {
  throw new Error("prop");
}

function top() {
  boom2();
}

catches();

try {
  top();
} catch (error) {
  globalThis.__prop = error.message;
}
