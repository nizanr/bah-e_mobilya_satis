const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const PRODUCTS_FILE = path.join(ROOT, "data", "products.json");
const STORE_FILE = path.join(ROOT, "data", "store.json");
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function readProducts() {
  return JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
}

function readStore(file) {
  try {
    const store = JSON.parse(fs.readFileSync(file, "utf8"));
    return { users: store.users || [], orders: store.orders || [], products: store.products || readProducts() };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { users: [], orders: [], products: readProducts() };
  }
}

function writeStore(file, store) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw Object.assign(new Error("İstek çok büyük."), { status: 413 });
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw Object.assign(new Error("Geçersiz JSON."), { status: 400 });
  }
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function createApp({ dataFile = STORE_FILE, adminToken = process.env.ADMIN_TOKEN } = {}) {
  const store = readStore(dataFile);
  const sessions = new Map();

  async function handle(request, response) {
    const url = new URL(request.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    try {
      if (pathname === "/api/products" && request.method === "GET") {
        const category = url.searchParams.get("category");
        const query = (url.searchParams.get("q") || "").trim().toLocaleLowerCase("tr");
        const products = store.products.filter((product) => {
          const matchesCategory = !category || category === "Tümü" || product.category === category;
          const matchesQuery = !query || `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase("tr").includes(query);
          return matchesCategory && matchesQuery;
        });
        return sendJson(response, 200, products);
      }

      const productMatch = pathname.match(/^\/api\/products\/([a-z0-9-]+)$/);
      if (productMatch && request.method === "GET") {
        const product = store.products.find((item) => item.id === productMatch[1]);
        return product ? sendJson(response, 200, product) : sendJson(response, 404, { error: "Ürün bulunamadı." });
      }

      if (pathname === "/api/products" && request.method === "POST") {
        if (!adminToken || request.headers["x-admin-token"] !== adminToken) {
          return sendJson(response, 403, { error: "Ürün ekleme yetkiniz yok." });
        }
        const product = await readBody(request);
        if (!product.name || !product.category || !Number.isFinite(product.price) || product.price <= 0) {
          return sendJson(response, 400, { error: "Ürün adı, kategorisi ve geçerli bir fiyat gereklidir." });
        }
        const newProduct = {
          id: crypto.randomUUID(),
          name: String(product.name).trim(),
          category: String(product.category).trim(),
          price: product.price,
          description: String(product.description || "").trim(),
          color: "sage",
          model: "chair",
        };
        store.products.push(newProduct);
        writeStore(dataFile, store);
        return sendJson(response, 201, newProduct);
      }

      if (pathname === "/api/register" && request.method === "POST") {
        const body = await readBody(request);
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
          return sendJson(response, 400, { error: "Ad, geçerli e-posta ve en az 8 karakterli şifre gereklidir." });
        }
        if (store.users.some((user) => user.email === email)) return sendJson(response, 409, { error: "Bu e-posta zaten kayıtlı." });
        const salt = crypto.randomBytes(16).toString("hex");
        const user = {
          id: crypto.randomUUID(),
          name,
          email,
          salt,
          passwordHash: crypto.scryptSync(password, salt, 64).toString("hex"),
        };
        store.users.push(user);
        writeStore(dataFile, store);
        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, user.id);
        return sendJson(response, 201, { token, user: publicUser(user) });
      }

      if (pathname === "/api/login" && request.method === "POST") {
        const body = await readBody(request);
        const email = String(body.email || "").trim().toLowerCase();
        const user = store.users.find((item) => item.email === email);
        if (!user || typeof body.password !== "string") return sendJson(response, 401, { error: "E-posta veya şifre hatalı." });
        const hash = crypto.scryptSync(body.password, user.salt, 64);
        if (!crypto.timingSafeEqual(hash, Buffer.from(user.passwordHash, "hex"))) {
          return sendJson(response, 401, { error: "E-posta veya şifre hatalı." });
        }
        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, user.id);
        return sendJson(response, 200, { token, user: publicUser(user) });
      }

      if (pathname === "/api/orders" && request.method === "POST") {
        const token = request.headers["x-session-token"];
        const userId = sessions.get(token);
        if (!userId) return sendJson(response, 401, { error: "Sipariş vermek için giriş yapın." });
        const body = await readBody(request);
        if (!Array.isArray(body.items) || !body.items.length) return sendJson(response, 400, { error: "Sepetiniz boş." });
        const items = [];
        for (const item of body.items) {
          const product = store.products.find((entry) => entry.id === item.id);
          if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
            return sendJson(response, 400, { error: "Sepette geçersiz bir ürün var." });
          }
          items.push({ id: product.id, name: product.name, quantity: item.quantity, price: product.price });
        }
        const order = {
          id: crypto.randomUUID(),
          userId,
          items,
          total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
          createdAt: new Date().toISOString(),
        };
        store.orders.push(order);
        writeStore(dataFile, store);
        return sendJson(response, 201, { orderId: order.id, total: order.total });
      }

      if (pathname.startsWith("/api/")) return sendJson(response, 404, { error: "API adresi bulunamadı." });
      if (request.method !== "GET" && request.method !== "HEAD") return sendJson(response, 405, { error: "Bu istek desteklenmiyor." });

      const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
      const file = path.resolve(PUBLIC_DIR, relativePath);
      if (!file.startsWith(`${PUBLIC_DIR}${path.sep}`)) return sendJson(response, 400, { error: "Geçersiz dosya yolu." });
      fs.readFile(file, (error, content) => {
        if (error) return sendJson(response, 404, { error: "Sayfa bulunamadı." });
        response.writeHead(200, {
          "Content-Type": MIME_TYPES[path.extname(file)] || "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: blob:;",
        });
        response.end(request.method === "HEAD" ? undefined : content);
      });
    } catch (error) {
      sendJson(response, error.status || 500, { error: error.status ? error.message : "Sunucu hatası." });
    }
  }

  return { handle, store };
}

if (require.main === module) {
  const { handle } = createApp();
  const port = Number(process.env.PORT) || 3000;
  http.createServer(handle).listen(port, () => console.log(`Bahçe mağazası http://localhost:${port} adresinde çalışıyor.`));
}

module.exports = { createApp };
