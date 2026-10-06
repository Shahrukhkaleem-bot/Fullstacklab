// TechNest shared logic: storage, accounts, cart, reviews and common UI (navbar, footer, toasts).
// Everything is kept in the browser's localStorage, so this is a front-end demo with no server.

const TN = (() => {
  const KEYS = { users: 'tn_users', session: 'tn_session', cart: 'tn_cart', reviews: 'tn_reviews', orders: 'tn_orders', promo: 'tn_promo' };
  const PROMOS = { FSWD10: 0.10, WELCOME5: 0.05 };
  const FREE_SHIPPING_FROM = 10000;
  const SHIPPING = { standard: 250, express: 500 };

  // ---------- helpers ----------
  const read = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => 'Rs ' + Math.round(n).toLocaleString('en-PK');
  const product = (id) => PRODUCTS.find((p) => p.id === Number(id));
  const param = (name) => new URLSearchParams(location.search).get(name);

  // ---------- accounts ----------
  async function hash(text) {
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // fallback for browsers without SubtleCrypto (not secure, demo only)
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return 'x' + h;
  }
  const users = () => read(KEYS.users, []);
  const currentUser = () => read(KEYS.session, null);

  async function signup({ name, email, password }) {
    email = email.trim().toLowerCase();
    if (users().some((u) => u.email === email)) throw new Error('An account with this email already exists. Try logging in.');
    const user = { name: name.trim(), email, pass: await hash(password), created: new Date().toISOString() };
    write(KEYS.users, [...users(), user]);
    write(KEYS.session, { name: user.name, email });
  }

  async function login(email, password) {
    email = email.trim().toLowerCase();
    const user = users().find((u) => u.email === email);
    if (!user || user.pass !== (await hash(password))) throw new Error('Incorrect email or password.');
    write(KEYS.session, { name: user.name, email });
  }

  function logout() {
    localStorage.removeItem(KEYS.session);
    location.href = 'index.html';
  }

  // send guests to the login page, then bring them back
  function requireLogin() {
    if (currentUser()) return true;
    const page = location.pathname.split('/').pop() || 'index.html';
    location.href = 'login.html?next=' + encodeURIComponent(page);
    return false;
  }

  // ---------- cart: [{ id, qty }] ----------
  const cart = () => read(KEYS.cart, []).filter((l) => product(l.id));
  const saveCart = (c) => { write(KEYS.cart, c); updateCartBadge(); };
  const cartCount = () => cart().reduce((s, l) => s + l.qty, 0);

  function addToCart(id, qty = 1) {
    const p = product(id);
    const c = cart();
    const line = c.find((l) => l.id === p.id);
    const current = line ? line.qty : 0;
    if (current >= p.stock) { toast(`Only ${p.stock} of ${p.name} in stock.`, 'warning'); return; }
    const newQty = Math.min(current + qty, p.stock);
    if (line) line.qty = newQty; else c.push({ id: p.id, qty: newQty });
    saveCart(c);
    toast(`<i class="bi bi-check-circle-fill"></i> <b>${esc(p.name)}</b> added to cart. <a href="cart.html" class="link-light fw-semibold">View cart</a>`, 'success');
  }

  function setQty(id, qty) {
    const p = product(id);
    const c = cart();
    const line = c.find((l) => l.id === p.id);
    if (!line) return;
    line.qty = Math.max(1, Math.min(Number(qty) || 1, p.stock));
    saveCart(c);
  }

  const removeFromCart = (id) => saveCart(cart().filter((l) => l.id !== Number(id)));
  const clearCart = () => { saveCart([]); sessionStorage.removeItem(KEYS.promo); };

  // ---------- promo codes & totals ----------
  const promo = () => sessionStorage.getItem(KEYS.promo);
  function applyPromo(code) {
    code = (code || '').trim().toUpperCase();
    if (!PROMOS[code]) return false;
    sessionStorage.setItem(KEYS.promo, code);
    return true;
  }
  const removePromo = () => sessionStorage.removeItem(KEYS.promo);

  function totals(shippingMethod = 'standard') {
    const lines = cart().map((l) => ({ ...l, product: product(l.id), total: product(l.id).price * l.qty }));
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const code = promo();
    const discount = code ? Math.round(subtotal * PROMOS[code]) : 0;
    const afterDiscount = subtotal - discount;
    let shipping = 0;
    if (subtotal > 0) {
      shipping = SHIPPING[shippingMethod] ?? SHIPPING.standard;
      if (shippingMethod === 'standard' && afterDiscount >= FREE_SHIPPING_FROM) shipping = 0;
    }
    return { lines, subtotal, code, discount, shipping, total: afterDiscount + shipping };
  }

  // ---------- reviews ----------
  function reviewsFor(id) {
    const extra = read(KEYS.reviews, {})[id] || [];
    return [...extra, ...product(id).reviews];
  }
  function addReview(id, review) {
    const all = read(KEYS.reviews, {});
    all[id] = [{ ...review, date: new Date().toISOString().slice(0, 10) }, ...(all[id] || [])];
    write(KEYS.reviews, all);
  }
  function avgRating(id) {
    const r = reviewsFor(id);
    return r.length ? r.reduce((s, x) => s + Number(x.rating), 0) / r.length : 0;
  }
  function stars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (rating >= i) html += '<i class="bi bi-star-fill"></i>';
      else if (rating >= i - 0.5) html += '<i class="bi bi-star-half"></i>';
      else html += '<i class="bi bi-star"></i>';
    }
    return `<span class="text-warning">${html}</span>`;
  }

  // ---------- orders ----------
  function placeOrder(details) {
    const t = totals(details.shippingMethod);
    const order = {
      id: 'TN-' + Date.now().toString().slice(-8),
      date: new Date().toISOString(),
      user: currentUser()?.email,
      items: t.lines.map((l) => ({ id: l.id, name: l.product.name, qty: l.qty, price: l.product.price })),
      subtotal: t.subtotal, discount: t.discount, shipping: t.shipping, total: t.total,
      shipTo: { name: details.name, phone: details.phone, address: details.address, city: details.city, postal: details.postal },
      payment: details.payment
    };
    write(KEYS.orders, [order, ...read(KEYS.orders, [])]);
    clearCart();
    return order;
  }
  const myOrders = () => read(KEYS.orders, []).filter((o) => o.user === currentUser()?.email);

  // ---------- shared UI ----------
  function productImage(p, size = 'display-1') {
    return `<div class="product-img d-flex align-items-center justify-content-center" style="background:linear-gradient(135deg,${p.colors[0]},${p.colors[1]})">
              <i class="bi ${p.icon} ${size} text-white"></i></div>`;
  }

  function updateCartBadge() {
    document.querySelectorAll('.cart-count').forEach((el) => {
      const n = cartCount();
      el.textContent = n;
      el.classList.toggle('d-none', n === 0);
    });
  }

  function renderNavbar(active) {
    const user = currentUser();
    const link = (href, label, key) =>
      `<li class="nav-item"><a class="nav-link ${active === key ? 'active fw-semibold' : ''}" href="${href}">${label}</a></li>`;
    const account = user
      ? `<div class="dropdown">
           <button class="btn btn-outline-light dropdown-toggle" data-bs-toggle="dropdown"><i class="bi bi-person-circle"></i> ${esc(user.name.split(' ')[0])}</button>
           <ul class="dropdown-menu dropdown-menu-end">
             <li><h6 class="dropdown-header">${esc(user.email)}</h6></li>
             <li><span class="dropdown-item-text small">Orders placed: <b>${myOrders().length}</b></span></li>
             <li><hr class="dropdown-divider"></li>
             <li><button class="dropdown-item text-danger" id="logoutBtn"><i class="bi bi-box-arrow-right"></i> Log out</button></li>
           </ul>
         </div>`
      : `<a href="login.html" class="btn btn-outline-light">Log in</a>
         <a href="signup.html" class="btn btn-warning fw-semibold">Sign up</a>`;

    document.getElementById('navbar').innerHTML = `
      <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top shadow-sm">
        <div class="container">
          <a class="navbar-brand fw-bold" href="index.html"><i class="bi bi-cpu text-warning"></i> Tech<span class="text-warning">Nest</span></a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="mainNav">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">
              ${link('index.html', 'Home', 'home')}
              ${link('index.html#shop', 'Shop', 'shop')}
              ${link('index.html#reviews', 'Reviews', 'reviews')}
              ${link('cart.html', 'Cart', 'cart')}
            </ul>
            <form class="d-flex me-lg-3 mb-2 mb-lg-0" role="search" action="index.html#shop" id="navSearch">
              <input class="form-control form-control-sm" type="search" name="q" placeholder="Search products" aria-label="Search" value="${esc(param('q') || '')}">
            </form>
            <div class="d-flex gap-2 align-items-center">
              <a href="cart.html" class="btn btn-light position-relative" aria-label="Cart">
                <i class="bi bi-cart3"></i>
                <span class="cart-count position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none">0</span>
              </a>
              ${account}
            </div>
          </div>
        </div>
      </nav>`;

    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('navSearch').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim();
      location.href = 'index.html' + (q ? '?q=' + encodeURIComponent(q) : '') + '#shop';
    });
    updateCartBadge();
  }

  function renderFooter() {
    const el = document.getElementById('footer');
    if (!el) return;
    el.innerHTML = `
      <footer class="bg-dark text-white-50 pt-5 pb-3 mt-5">
        <div class="container">
          <div class="row g-4">
            <div class="col-md-5">
              <h5 class="text-white"><i class="bi bi-cpu text-warning"></i> TechNest</h5>
              <p class="small">Gadgets and accessories for students and creators, delivered across Pakistan.</p>
              <p class="small mb-0"><i class="bi bi-info-circle"></i> FSWD Lab 3 demo store built with Bootstrap 5.3. No real orders or payments are processed.</p>
            </div>
            <div class="col-6 col-md-3">
              <h6 class="text-white">Shop</h6>
              <ul class="list-unstyled small">
                <li><a class="link-light link-opacity-50 link-opacity-100-hover text-decoration-none" href="index.html#shop">All products</a></li>
                <li><a class="link-light link-opacity-50 link-opacity-100-hover text-decoration-none" href="cart.html">Cart</a></li>
                <li><a class="link-light link-opacity-50 link-opacity-100-hover text-decoration-none" href="checkout.html">Checkout</a></li>
              </ul>
            </div>
            <div class="col-6 col-md-4">
              <h6 class="text-white">Promo codes</h6>
              <p class="small mb-1"><span class="badge text-bg-warning">FSWD10</span> 10% off</p>
              <p class="small"><span class="badge text-bg-warning">WELCOME5</span> 5% off</p>
            </div>
          </div>
          <hr class="border-secondary">
          <p class="small text-center mb-0">&copy; 2026 TechNest · Built by Shahrukh Kaleem · BSCS-V-B</p>
        </div>
      </footer>`;
  }

  function toast(html, type = 'dark') {
    let box = document.getElementById('toastBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastBox';
      box.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = `toast align-items-center text-bg-${type} border-0`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${html}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    box.appendChild(el);
    el.addEventListener('hidden.bs.toast', () => el.remove());
    bootstrap.Toast.getOrCreateInstance(el, { delay: 3000 }).show();
  }

  // keep the cart badge in sync if another tab changes the cart
  window.addEventListener('storage', (e) => { if (e.key === KEYS.cart) updateCartBadge(); });

  return {
    esc, money, product, param, currentUser, signup, login, logout, requireLogin,
    cart, cartCount, addToCart, setQty, removeFromCart, clearCart,
    promo, applyPromo, removePromo, totals, FREE_SHIPPING_FROM,
    reviewsFor, addReview, avgRating, stars, placeOrder, myOrders,
    productImage, renderNavbar, renderFooter, updateCartBadge, toast
  };
})();
