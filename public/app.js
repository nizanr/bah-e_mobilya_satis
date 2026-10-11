const categories = ["Tümü", "Oturma Grubu", "Sandalye", "Masa", "Şezlong"];
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const productGrid = document.querySelector("#product-grid");
const categoryList = document.querySelector("#category-list");
const cartKey = "bahce-cart";
const sessionKey = "bahce-session";
let products = [];
let activeCategory = "Tümü";
let authMode = "login";
let cart = loadCart();
let toastTimer;
let currentProduct = null;
let photo = null;
let photoUrl = null;
let modelPosition = { x: 0.5, y: 0.68 };
let pointerPosition = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(cartKey) || "[]");
    return Array.isArray(saved) ? saved.filter((item) => item && typeof item.id === "string" && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99) : [];
  } catch {
    return [];
  }
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Bir hata oluştu.");
  return body;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2900);
}

function openOverlay(id) {
  const overlay = document.getElementById(id);
  overlay.hidden = false;
  document.body.classList.add("has-overlay");
  overlay.querySelector("button, input, select")?.focus();
}

function closeOverlay(id) {
  document.getElementById(id).hidden = true;
  if (![...document.querySelectorAll(".overlay")].some((overlay) => !overlay.hidden)) {
    document.body.classList.remove("has-overlay");
  }
}

function getProduct(id) {
  return products.find((product) => product.id === id);
}

function renderCategories() {
  categoryList.innerHTML = categories.map((category) => `<button type="button" class="category-chip${category === activeCategory ? " active" : ""}" data-category="${escapeHtml(category)}" aria-pressed="${category === activeCategory}">${escapeHtml(category)}</button>`).join("");
}

function productIllustration(product, prefix = "product") {
  const colors = {
    sand: ["#c3a681", "#9c7956", "#e0d1b9"],
    sage: ["#9cac8d", "#687e62", "#c4d0b8"],
    clay: ["#bb8b6b", "#87624d", "#d6b29a"],
    sky: ["#8ca8ae", "#5f7880", "#bdced0"],
    rose: ["#b88e7b", "#846559", "#d5b9a9"],
  };
  const [main, shade, cushion] = colors[product.color] || colors.sage;
  let shape = "";
  if (product.model === "table") {
    shape = `<ellipse cx="150" cy="118" rx="83" ry="28" fill="${main}"/><path d="M67 118l83 29 83-29-83-28z" fill="${cushion}"/><path d="M83 116l4 96h10l3-89m98-7l-3 96h-10l-3-89" fill="none" stroke="${shade}" stroke-width="8" stroke-linecap="round"/><path d="M91 123l59 20 58-20" fill="none" stroke="${main}" stroke-width="4"/>`;
  } else if (product.model === "lounger") {
    shape = `<path d="M68 167l38-84q7-14 24-8l38 14-17 45 67 28-7 20-88-35-25 42-17-8 21-43z" fill="${main}"/><path d="M108 90q5-11 16-7l35 13-15 38-49-20z" fill="${cushion}"/><path d="M101 171l-18 44m86-62l20 51m-85-35l-12 32" stroke="${shade}" stroke-width="7" stroke-linecap="round"/><path d="M75 164l121 40" stroke="${shade}" stroke-width="5"/>`;
  } else {
    const second = product.model === "set";
    shape = `<path d="M89 90q0-13 14-13h43q13 0 13 13v58H89z" fill="${cushion}" stroke="${shade}" stroke-width="8"/><path d="M78 137h107v35H78z" rx="8" fill="${main}"/><path d="M88 169v48m86-48v48m-87-64H66v-37q0-12 12-12h11m86 49h16v-38q0-11-12-11h-20" fill="none" stroke="${shade}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (second) shape += `<path d="M193 111q0-10 11-10h32q10 0 10 10v43h-53z" fill="${cushion}" stroke="${shade}" stroke-width="7"/><path d="M185 143h79v26h-79z" fill="${main}"/><path d="M195 167v43m62-43v43" fill="none" stroke="${shade}" stroke-width="7" stroke-linecap="round"/><path d="M133 194l45 17 34-13-44-17z" fill="${main}"/><path d="M143 196v29m54-31v28" stroke="${shade}" stroke-width="5"/>`;
  }
  return `<svg viewBox="0 0 300 260" role="img" aria-label="${escapeHtml(product.name)}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="150" cy="218" rx="108" ry="16" fill="#52604b" opacity=".09"/>${shape}<path d="M52 230h196" stroke="#859079" stroke-opacity=".2" stroke-width="1"/></svg>`;
}

function renderProducts() {
  const query = document.querySelector("#search-input").value.trim().toLocaleLowerCase("tr");
  const visible = products.filter((product) => {
    const matchesCategory = activeCategory === "Tümü" || product.category === activeCategory;
    const matchesQuery = !query || `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase("tr").includes(query);
    return matchesCategory && matchesQuery;
  });
  document.querySelector("#result-count").textContent = `${visible.length} ürün`;
  if (!visible.length) {
    productGrid.innerHTML = '<p class="empty-state">Aradığınız kriterlerde ürün bulunamadı. Farklı bir arama deneyin.</p>';
    return;
  }
  productGrid.innerHTML = visible.map((product) => `
    <article class="product-card">
      <div class="product-art art-${escapeHtml(product.color)}">
        <span class="product-tag">${escapeHtml(product.category)}</span>
        ${productIllustration(product)}
        <div class="product-actions">
          <button type="button" data-action="details" data-id="${escapeHtml(product.id)}">Detayları gör</button>
          <button type="button" data-action="preview" data-id="${escapeHtml(product.id)}">Bahçemde dene ✳</button>
        </div>
      </div>
      <div class="product-info"><div><p class="product-category">${escapeHtml(product.category)}</p><h3>${escapeHtml(product.name)}</h3></div><span class="product-price">${money.format(product.price)}</span></div>
    </article>`).join("");
}

function syncCart() {
  localStorage.setItem(cartKey, JSON.stringify(cart));
  document.querySelector("#cart-count").textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  const items = cart.map((item) => ({ ...item, product: getProduct(item.id) })).filter((item) => item.product);
  document.querySelector("#cart-items").innerHTML = items.length ? items.map(({ id, quantity, product }) => `
    <article class="cart-item">
      <div class="cart-thumb">${productIllustration(product)}</div>
      <div><p>${escapeHtml(product.category)}</p><h3>${escapeHtml(product.name)}</h3><p>${money.format(product.price)}</p>
        <div class="quantity-control"><button type="button" data-cart-action="decrease" data-id="${escapeHtml(id)}" aria-label="Adedi azalt">−</button><span>${quantity}</span><button type="button" data-cart-action="increase" data-id="${escapeHtml(id)}" aria-label="Adedi artır">+</button></div>
      </div><button class="remove-item" type="button" data-cart-action="remove" data-id="${escapeHtml(id)}" aria-label="Ürünü sepetten çıkar">×</button>
    </article>`).join("") : '<p class="cart-empty">Sepetiniz henüz boş.<br>Size iyi gelecek bir parça keşfedin.</p>';
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  document.querySelector("#cart-total").textContent = money.format(total);
  document.querySelector("#checkout-button").disabled = !items.length;
}

function addToCart(id) {
  const existing = cart.find((item) => item.id === id);
  if (existing?.quantity >= 99) {
    showToast("Bir üründen en fazla 99 adet ekleyebilirsiniz.");
    return;
  }
  if (existing) existing.quantity += 1;
  else cart.push({ id, quantity: 1 });
  syncCart();
  showToast(`${getProduct(id).name} sepetinize eklendi.`);
}

function openDetails(product) {
  document.querySelector("#detail-content").innerHTML = `
    <div class="detail-layout">
      <div class="detail-art art-${escapeHtml(product.color)}">${productIllustration(product)}</div>
      <div class="detail-copy"><p class="eyebrow">${escapeHtml(product.category)}</p><h2 id="detail-title">${escapeHtml(product.name)}</h2><p>${escapeHtml(product.description)}</p><p class="detail-price">${money.format(product.price)}</p>
        <div class="detail-actions"><button type="button" class="button button-dark" data-action="add" data-id="${escapeHtml(product.id)}">Sepete ekle <span aria-hidden="true">→</span></button><button type="button" class="button button-light" data-action="preview" data-id="${escapeHtml(product.id)}">Bahçemde dene ✳</button></div>
      </div>
    </div>`;
  openOverlay("detail-overlay");
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    const active = tab.dataset.authMode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelector("#name-field").hidden = mode !== "register";
  document.querySelector("#auth-title").textContent = mode === "register" ? "Aramıza hoş geldiniz." : "Merhaba, yeniden.";
  document.querySelector("#auth-submit").innerHTML = `${mode === "register" ? "Üye ol" : "Giriş yap"} <span aria-hidden="true">→</span>`;
  document.querySelector('#auth-form [name="password"]').autocomplete = mode === "register" ? "new-password" : "current-password";
  document.querySelector("#auth-error").textContent = "";
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || "null");
  } catch {
    return null;
  }
}

function openPreview(product = products[0]) {
  if (!product) return;
  currentProduct = product;
  document.querySelector("#ar-product").innerHTML = products.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === product.id ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
  document.querySelector("#scale-control").value = "100";
  document.querySelector("#rotation-control").value = "0";
  document.querySelector("#scale-value").value = "100%";
  document.querySelector("#rotation-value").value = "0°";
  modelPosition = { x: 0.5, y: 0.68 };
  openOverlay("ar-overlay");
  if (photo) drawPreview();
}

function drawBox(ctx, x, y, width, depth, height, color, sideColor, topColor) {
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + width / 2, y - height - depth / 2);
  ctx.lineTo(x + width, y - height);
  ctx.lineTo(x + width / 2, y - height + depth / 2);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + width / 2, y - height + depth / 2);
  ctx.lineTo(x + width / 2, y + depth / 2);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y - height + depth / 2);
  ctx.lineTo(x + width, y - height);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width / 2, y + depth / 2);
  ctx.closePath();
  ctx.fillStyle = sideColor;
  ctx.fill();
}

function drawLeg(ctx, x, y, height, color, width = 7) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y + 2);
  ctx.lineTo(x + width - 4, y - height);
  ctx.lineTo(x + 1, y - height);
  ctx.closePath();
  ctx.fill();
}

function drawChair(ctx, color, shade, cushion, width = 105) {
  const k = width / 105;
  ctx.save();
  ctx.scale(k, k);
  ctx.strokeStyle = shade;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-38, -24); ctx.lineTo(-40, -133); ctx.quadraticCurveTo(-39, -148, -25, -148);
  ctx.lineTo(25, -148); ctx.quadraticCurveTo(39, -148, 40, -133); ctx.lineTo(38, -24);
  ctx.stroke();
  ctx.fillStyle = cushion;
  ctx.beginPath();
  ctx.roundRect(-34, -137, 68, 96, 11);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-43, -55); ctx.lineTo(0, -42); ctx.lineTo(44, -55); ctx.lineTo(44, -34); ctx.lineTo(0, -20); ctx.lineTo(-43, -34);
  ctx.closePath(); ctx.fill();
  drawLeg(ctx, -34, -29, 48, shade, 7);
  drawLeg(ctx, 28, -29, 48, shade, 7);
  ctx.restore();
}

function drawTable(ctx, color, shade, width = 110) {
  const k = width / 110;
  ctx.save();
  ctx.scale(k, k);
  drawLeg(ctx, -36, 2, 57, shade, 8);
  drawLeg(ctx, 28, 2, 57, shade, 8);
  drawBox(ctx, -52, -52, 104, 48, 17, color, shade, "#d6bc98");
  ctx.restore();
}

function drawModel(ctx, product, width) {
  const shades = {
    sand: ["#c3a681", "#806746", "#e0d1b9"],
    sage: ["#9cac8d", "#566d53", "#c4d0b8"],
    clay: ["#bb8b6b", "#795740", "#d6b29a"],
    sky: ["#8ca8ae", "#526f78", "#bdced0"],
    rose: ["#b88e7b", "#77584b", "#d5b9a9"],
  };
  const [color, shade, cushion] = shades[product.color] || shades.sage;
  if (product.model === "table") {
    drawTable(ctx, color, shade, width);
  } else if (product.model === "lounger") {
    ctx.save();
    ctx.rotate(-0.13);
    ctx.fillStyle = shade;
    ctx.fillRect(-width * .38, -width * .2, width * .76, width * .07);
    ctx.fillStyle = cushion;
    ctx.beginPath();
    ctx.moveTo(-width * .32, -width * .15);
    ctx.lineTo(-width * .06, -width * 1.05);
    ctx.lineTo(width * .05, -width * 1.02);
    ctx.lineTo(width * .1, -width * .1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(-width * .32, -width * .23, width * .75, width * .18);
    ctx.fillStyle = shade;
    ctx.fillRect(-width * .23, -width * .1, width * .04, width * .45);
    ctx.fillRect(width * .3, -width * .1, width * .04, width * .45);
    ctx.restore();
  } else {
    drawChair(ctx, color, shade, cushion, width * .87);
    if (product.model === "set") {
      ctx.save();
      ctx.translate(width * .48, -width * .03);
      drawChair(ctx, color, shade, cushion, width * .62);
      ctx.restore();
      ctx.save();
      ctx.translate(width * .15, width * .1);
      drawTable(ctx, color, shade, width * .55);
      ctx.restore();
    }
  }
}

function drawPreview() {
  const canvas = document.querySelector("#ar-canvas");
  if (!photo || !currentProduct) return;
  const box = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(box.width * ratio));
  const height = Math.max(1, Math.round(box.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, box.width, box.height);
  ctx.drawImage(photo, 0, 0, box.width, box.height);
  ctx.save();
  ctx.translate(modelPosition.x * box.width, modelPosition.y * box.height);
  ctx.rotate(Number(document.querySelector("#rotation-control").value) * Math.PI / 180);
  ctx.scale(Number(document.querySelector("#scale-control").value) / 100, Number(document.querySelector("#scale-control").value) / 100);
  ctx.globalAlpha = .2;
  ctx.fillStyle = "#18251d";
  ctx.beginPath();
  ctx.ellipse(0, 5, box.width * .09, box.width * .025, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawModel(ctx, currentProduct, Math.min(box.width * .28, box.height * .48));
  ctx.restore();
}

function beginPhoto(file) {
  if (!file) return;
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    showToast("Lütfen JPG veya PNG biçiminde bir fotoğraf seçin.");
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showToast("Fotoğraf en fazla 15 MB olabilir.");
    return;
  }
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    photo = image;
    const canvas = document.querySelector("#ar-canvas");
    const naturalWidth = Math.min(image.naturalWidth, 1800);
    canvas.width = naturalWidth;
    canvas.height = Math.round(naturalWidth * image.naturalHeight / image.naturalWidth);
    canvas.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
    document.querySelector("#preview-empty").hidden = true;
    requestAnimationFrame(drawPreview);
  };
  image.onerror = () => showToast("Fotoğraf açılamadı. Başka bir dosya deneyin.");
  image.src = photoUrl;
}

function updateAccountButton() {
  let session;
  try {
    session = JSON.parse(localStorage.getItem(sessionKey) || "null");
  } catch {
    session = null;
  }
  document.querySelector("#account-button").textContent = session?.user?.name?.split(" ")[0] || "Giriş yap";
}

categoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderCategories();
  renderProducts();
});

document.querySelector("#search-input").addEventListener("input", renderProducts);

productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const product = getProduct(button.dataset.id);
  if (!product) return;
  if (button.dataset.action === "details") openDetails(product);
  if (button.dataset.action === "preview") openPreview(product);
  if (button.dataset.action === "add") addToCart(product.id);
});

document.querySelector("#detail-content").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const product = getProduct(button.dataset.id);
  if (!product) return;
  if (button.dataset.action === "add") {
    addToCart(product.id);
    closeOverlay("detail-overlay");
    openOverlay("cart-overlay");
  }
  if (button.dataset.action === "preview") {
    closeOverlay("detail-overlay");
    openPreview(product);
  }
});

document.querySelector("#cart-button").addEventListener("click", () => {
  syncCart();
  openOverlay("cart-overlay");
});

document.querySelector("#cart-items").addEventListener("click", (event) => {
  const button = event.target.closest("[data-cart-action]");
  if (!button) return;
  const item = cart.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.cartAction === "remove") cart = cart.filter((entry) => entry.id !== item.id);
  if (button.dataset.cartAction === "increase" && item.quantity < 99) item.quantity += 1;
  else if (button.dataset.cartAction === "increase") showToast("Bir üründen en fazla 99 adet ekleyebilirsiniz.");
  if (button.dataset.cartAction === "decrease") item.quantity -= 1;
  cart = cart.filter((entry) => entry.quantity > 0);
  syncCart();
});

document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closeOverlay(button.dataset.close)));
document.querySelectorAll(".overlay").forEach((overlay) => overlay.addEventListener("click", (event) => {
  if (event.target === overlay) closeOverlay(overlay.id);
}));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const open = [...document.querySelectorAll(".overlay")].find((overlay) => !overlay.hidden);
    if (open) closeOverlay(open.id);
  }
});

document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
document.querySelector("#account-button").addEventListener("click", () => {
  const session = readSession();
  if (session?.user) {
    showToast(`Merhaba ${session.user.name}!`);
    return;
  }
  setAuthMode("login");
  openOverlay("auth-overlay");
});

document.querySelector("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  try {
    const session = await request(`/api/${authMode === "register" ? "register" : "login"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    localStorage.setItem(sessionKey, JSON.stringify(session));
    updateAccountButton();
    closeOverlay("auth-overlay");
    event.currentTarget.reset();
    showToast(`Hoş geldiniz, ${session.user.name}!`);
  } catch (error) {
    document.querySelector("#auth-error").textContent = error.message;
  }
});

document.querySelector("#checkout-button").addEventListener("click", async () => {
  const session = readSession();
  if (!session?.token) {
    closeOverlay("cart-overlay");
    setAuthMode("login");
    openOverlay("auth-overlay");
    showToast("Siparişi tamamlamak için önce giriş yapın.");
    return;
  }
  try {
    const order = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": session.token },
      body: JSON.stringify({ items: cart }),
    });
    cart = [];
    syncCart();
    closeOverlay("cart-overlay");
    showToast(`Siparişiniz alındı · ${money.format(order.total)}`);
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("#garden-photo").addEventListener("change", (event) => beginPhoto(event.target.files[0]));
document.querySelector("#ar-product").addEventListener("change", (event) => {
  currentProduct = getProduct(event.target.value);
  drawPreview();
});
document.querySelector("#scale-control").addEventListener("input", (event) => {
  document.querySelector("#scale-value").value = `${event.target.value}%`;
  drawPreview();
});
document.querySelector("#rotation-control").addEventListener("input", (event) => {
  document.querySelector("#rotation-value").value = `${event.target.value}°`;
  drawPreview();
});

const canvas = document.querySelector("#ar-canvas");
canvas.addEventListener("pointerdown", (event) => {
  if (!photo) return;
  const box = canvas.getBoundingClientRect();
  pointerPosition = {
    id: event.pointerId,
    x: (event.clientX - box.left) / box.width,
    y: (event.clientY - box.top) / box.height,
    clientX: event.clientX,
    clientY: event.clientY,
  };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!pointerPosition || pointerPosition.id !== event.pointerId) return;
  const box = canvas.getBoundingClientRect();
  modelPosition.x = Math.max(.04, Math.min(.96, modelPosition.x + (event.clientX - pointerPosition.clientX) / box.width));
  modelPosition.y = Math.max(.05, Math.min(.96, modelPosition.y + (event.clientY - pointerPosition.clientY) / box.height));
  pointerPosition.clientX = event.clientX;
  pointerPosition.clientY = event.clientY;
  drawPreview();
});
canvas.addEventListener("pointerup", (event) => {
  if (!pointerPosition) return;
  pointerPosition = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener("pointercancel", () => { pointerPosition = null; });
window.addEventListener("resize", () => { if (photo) drawPreview(); });

document.querySelector("#hero-preview").addEventListener("click", () => openPreview());
document.querySelector("#promo-preview").addEventListener("click", () => openPreview());

async function initialize() {
  updateAccountButton();
  syncCart();
  renderCategories();
  try {
    products = await request("/api/products");
    renderProducts();
    syncCart();
  } catch (error) {
    document.querySelector("#result-count").textContent = "";
    productGrid.innerHTML = `<p class="empty-state">${escapeHtml(error.message)} Sayfayı yenileyip tekrar deneyin.</p>`;
  }
}

initialize();
