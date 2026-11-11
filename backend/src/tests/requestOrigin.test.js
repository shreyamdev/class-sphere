const test = require("node:test");
const assert = require("node:assert/strict");
const verifyRequestOrigin = require("../middleware/verifyRequestOrigin");

const invoke = ({ method = "POST", origin }) => {
  const req = {
    method,
    get(name) {
      return name.toLowerCase() === "origin" ? origin : undefined;
    },
  };
  const result = { statusCode: 200, body: null, nextCalled: false };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; },
  };
  verifyRequestOrigin(req, res, () => { result.nextCalled = true; });
  return result;
};

test("allows requests from the configured ClassSphere frontend", () => {
  const result = invoke({ origin: "https://class-sphere-one.vercel.app" });
  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);
});

test("blocks browser write requests from an unknown origin", () => {
  const result = invoke({ origin: "https://untrusted.example" });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
});

test("allows requests without Origin for Postman/server clients", () => {
  const result = invoke({ origin: undefined });
  assert.equal(result.nextCalled, true);
});

test("does not apply the write-origin check to GET requests", () => {
  const result = invoke({ method: "GET", origin: "https://untrusted.example" });
  assert.equal(result.nextCalled, true);
});
