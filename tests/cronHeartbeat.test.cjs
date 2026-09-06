const assert = require("node:assert/strict");
const test = require("node:test");
const { isRetryableCronError } = require("../scripts/lib/cronHeartbeat.cjs");

test("retry when Next is still booting", () => {
  assert.equal(isRetryableCronError({ code: "ECONNREFUSED" }), true);
  assert.equal(
    isRetryableCronError({ message: "fetch failed", cause: { code: "UND_ERR_SOCKET" } }),
    true,
  );
  assert.equal(isRetryableCronError({ message: "other side closed" }), true);
});

test("do not retry application errors", () => {
  assert.equal(isRetryableCronError({ message: "HTTP 401" }), false);
  assert.equal(isRetryableCronError(new Error("Najpierw zapisz ankietę")), false);
});
