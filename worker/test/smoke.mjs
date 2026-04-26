import assert from "node:assert/strict";
import worker from "../src/index.js";

class MockKV {
  constructor() {
    this.values = new Map();
  }

  async get(key, type) {
    const value = this.values.get(key);
    if (value == null) return null;
    return type === "json" ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async list({ prefix, cursor }) {
    assert.equal(cursor, undefined);
    return {
      keys: [...this.values.keys()]
        .filter((name) => name.startsWith(prefix))
        .map((name) => ({ name })),
      list_complete: true,
    };
  }
}

const origin = "https://ileivoivm.github.io";
const env = { CHANGE_TALLY: new MockKV() };

function postTally(body, ip = "203.0.113.10") {
  return worker.fetch(new Request("https://change-tally.example/tally", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
      Origin: origin,
    },
    body: JSON.stringify(body),
  }), env);
}

function getCounts(city = "ntpc") {
  return worker.fetch(new Request(`https://change-tally.example/counts?city=${city}`, {
    headers: { Origin: origin },
  }), env);
}

const first = await postTally({
  city: "ntpc",
  district: "板橋區",
  village: "留侯里",
  event: "share",
});
assert.equal(first.status, 200);
assert.equal(first.headers.get("Access-Control-Allow-Origin"), origin);

const firstJson = await first.json();
assert.equal(firstJson.key, "ntpc-板橋區-留侯里");
assert.equal(firstJson.counted, true);
assert.equal(firstJson.count.shares, 1);
assert.equal(firstJson.count.views, 0);

const locked = await postTally({
  city: "ntpc",
  district: "板橋區",
  village: "留侯里",
  event: "share",
});
assert.equal(locked.status, 200);

const lockedJson = await locked.json();
assert.equal(lockedJson.counted, false);
assert.equal(lockedJson.reason, "rate_limited");
assert.equal(lockedJson.count.shares, 1);

const secondVillage = await postTally({
  city: "ntpc",
  district: "板橋區",
  village: "新民里",
  event: "view",
});
assert.equal(secondVillage.status, 200);

const secondVillageJson = await secondVillage.json();
assert.equal(secondVillageJson.count.views, 1);

const counts = await getCounts();
assert.equal(counts.status, 200);

const countsJson = await counts.json();
assert.deepEqual(Object.keys(countsJson.counts).sort(), [
  "ntpc-板橋區-新民里",
  "ntpc-板橋區-留侯里",
]);
assert.equal(countsJson.counts["ntpc-板橋區-留侯里"].shares, 1);
assert.equal(countsJson.counts["ntpc-板橋區-新民里"].views, 1);

const invalid = await postTally({
  city: "ntpc",
  district: "板橋區",
  village: "留侯里",
  event: "click",
}, "203.0.113.11");
assert.equal(invalid.status, 400);

console.log("worker smoke test passed");
