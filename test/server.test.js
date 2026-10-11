const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { createApp } = require("../server");

async function startServer(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "garden-store-"));
  const app = createApp({ dataFile: path.join(directory, "store.json"), adminToken: "test-admin-token", ...options });
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("lists and filters products, including newly added catalog items", async (t) => {
  const baseUrl = await startServer(t);
  let response = await fetch(`${baseUrl}/api/products?category=Masa`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).map((product) => product.id), ["terra-masa", "mira-sehpa"]);

  response = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ name: "Yeni Masa", category: "Masa", price: 5500 }),
  });
  assert.equal(response.status, 201);
  const added = await response.json();
  response = await fetch(`${baseUrl}/api/products/${added.id}`);
  assert.equal((await response.json()).name, "Yeni Masa");
});

test("registers users, requires authentication, and creates price-verified orders", async (t) => {
  const baseUrl = await startServer(t);
  let response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ id: "ada-koltuk", quantity: 1 }] }),
  });
  assert.equal(response.status, 401);

  response = await fetch(`${baseUrl}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Deniz Yılmaz", email: "deniz@example.com", password: "garden123" }),
  });
  assert.equal(response.status, 201);
  const { token } = await response.json();

  response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": token },
    body: JSON.stringify({ items: [{ id: "ada-koltuk", quantity: 2 }] }),
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).total, 14980);
});
