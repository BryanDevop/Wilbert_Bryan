import { useDeferredValue, useEffect, useMemo, useState } from "react";

const ODOO_VERSION_URL = "/odoo/food_orders/health";
const CREATE_ORDER_URL = "/odoo/food_orders/create";
const DASHBOARD_URL = "/odoo/food_orders/dashboard";
const LOGIN_URL = "/odoo/food_orders/login";
const REGISTER_URL = "/odoo/food_orders/register";
const LOGOUT_URL = "/odoo/food_orders/logout";
const PRODUCT_LIST_URL = "/odoo/food_orders/products";
const SESSION_STORAGE_KEY = "saidy-session";
const CART_STORAGE_KEY = "saidy-cart";
const FAVORITES_STORAGE_KEY = "saidy-favorites";

const DEFAULT_FOOD_ITEMS = [
  { id: 1, name: "Pizza Margarita Signature", category: "Pizzas", price: 8.5, emoji: "🍕", rating: 4.9, prepTime: 18, tag: "Top ventas", description: "Mozzarella premium, salsa artesanal y albahaca fresca." },
  { id: 2, name: "Hamburguesa Clasica Prime", category: "Burgers", price: 6.25, emoji: "🍔", rating: 4.8, prepTime: 14, tag: "Combo ideal", description: "Carne angus, cheddar, vegetales frescos y salsa de la casa." },
  { id: 3, name: "Tacos de Pollo Crispy", category: "Tacos", price: 5.75, emoji: "🌮", rating: 4.7, prepTime: 11, tag: "Rapido", description: "Pollo crujiente, pico de gallo y crema de cilantro." },
  { id: 4, name: "Ensalada Cesar Green", category: "Saludable", price: 4.9, emoji: "🥗", rating: 4.6, prepTime: 8, tag: "Ligero", description: "Lechuga fresca, crutones, parmesano y aderezo clasico." },
  { id: 5, name: "Pasta Alfredo Cremosa", category: "Pastas", price: 7.2, emoji: "🍝", rating: 4.8, prepTime: 16, tag: "Chef choice", description: "Salsa cremosa, ajo salteado y parmesano importado." },
  { id: 6, name: "Limonada Natural Spark", category: "Bebidas", price: 2.25, emoji: "🥤", rating: 4.5, prepTime: 4, tag: "Refrescante", description: "Limon natural, hierbabuena y hielo triturado." },
  { id: 7, name: "Wrap Mediterraneo", category: "Saludable", price: 6.8, emoji: "🌯", rating: 4.7, prepTime: 10, tag: "Nuevo", description: "Pollo grill, hummus suave y vegetales crocantes." },
  { id: 8, name: "Brownie Volcan", category: "Postres", price: 3.4, emoji: "🍫", rating: 4.9, prepTime: 6, tag: "Postre", description: "Chocolate intenso con centro suave y topping de nuez." }
];

const PAYMENT_METHODS = [
  { id: "cash", label: "Efectivo", hint: "Pago al recibir" },
  { id: "card", label: "Tarjeta", hint: "Debito o credito" },
  { id: "transfer", label: "Transferencia", hint: "Pago con referencia" }
];

const ORDER_TYPES = [
  { id: "delivery", label: "Delivery", description: "Entrega en tu ubicacion", fee: 2.5 },
  { id: "pickup", label: "Pickup", description: "Retiro sin costo", fee: 0 },
  { id: "dine_in", label: "En local", description: "Preparado para mesa", fee: 0 }
];

const SCHEDULE_OPTIONS = [
  { id: "asap", label: "Lo antes posible" },
  { id: "15", label: "En 15 min" },
  { id: "30", label: "En 30 min" },
  { id: "45", label: "En 45 min" },
  { id: "60", label: "En 60 min" }
];

const PROMO_CODES = {
  BIENVENIDA: { discount: 0.12, label: "12% de descuento" },
  LUNCH10: { discount: 0.1, label: "10% en pedidos agiles" },
  SWEET15: { discount: 0.15, label: "15% en postres y antojos" }
};

const EMPTY_DASHBOARD = { metrics: { total_orders: 0, paid_orders: 0, revenue: 0, satisfaction: 96 }, recent_orders: [] };
const AUTH_INITIAL = {
  login: { email: "", password: "" },
  register: { fullName: "", businessName: "", email: "", password: "", confirmPassword: "" }
};

function formatCurrency(value) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "USD" }).format(value);
}

function safeReadStorage(key, fallback) {
  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : fallback;
  } catch {
    return fallback;
  }
}

function getErrorMessage(error, fallbackMessage) {
  return error instanceof Error && error.message ? error.message : fallbackMessage;
}

async function postJsonRpc(url, params = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.data?.message || `HTTP ${response.status}`);
  }
  return payload.result;
}

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(AUTH_INITIAL);
  const [authStatus, setAuthStatus] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [session, setSession] = useState(null);
  const [versionInfo, setVersionInfo] = useState(null);
  const [status, setStatus] = useState("Conectando con Odoo...");
  const [products, setProducts] = useState(DEFAULT_FOOD_ITEMS);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [cart, setCart] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [orderType, setOrderType] = useState("delivery");
  const [scheduledSlot, setScheduledSlot] = useState("asap");
  const [customerNote, setCustomerNote] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const [orderStatus, setOrderStatus] = useState("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [dbName, setDbName] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);

  useEffect(() => {
    setSession(safeReadStorage(SESSION_STORAGE_KEY, null));
    setCart(safeReadStorage(CART_STORAGE_KEY, {}));
    setFavorites(safeReadStorage(FAVORITES_STORAGE_KEY, []));
  }, []);

  useEffect(() => {
    async function loadHealth() {
      try {
        const result = await postJsonRpc(ODOO_VERSION_URL);
        if (result?.db) {
          setDbName(result.db);
        }
      } catch {
        // Ignore bootstrap errors.
      }
    }

    loadHealth();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    setAuthStatus("");
  }, [authMode]);

  useEffect(() => {
    if (!session) return;
    async function loadOverview() {
      try {
        const [versionResult, dashboardResult, productResult] = await Promise.allSettled([
          postJsonRpc(ODOO_VERSION_URL),
          postJsonRpc(DASHBOARD_URL),
          postJsonRpc(PRODUCT_LIST_URL)
        ]);

        let versionLoaded = false;
        let dashboardLoaded = false;
        let productsLoaded = false;

        if (versionResult.status === "fulfilled") {
          setVersionInfo(versionResult.value || null);
          if (versionResult.value?.db) {
            setDbName(versionResult.value.db);
          }
          versionLoaded = true;
        }
        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value || EMPTY_DASHBOARD);
          dashboardLoaded = true;
        }
        if (productResult.status === "fulfilled" && Array.isArray(productResult.value?.products)) {
          setProducts(productResult.value.products);
          productsLoaded = true;
        }
        if (versionLoaded || dashboardLoaded || productsLoaded) {
          setStatus("Plataforma operativa y lista para recibir pedidos.");
          return;
        }
        throw new Error("No se pudieron cargar los servicios del panel");
      } catch (error) {
        setStatus(`No se pudo conectar con Odoo: ${error.message}`);
      }
    }
    loadOverview();
  }, [session]);

  useEffect(() => {
    if (session?.fullName) setCustomerName((current) => current || session.fullName);
  }, [session]);

  useEffect(() => {
    const validIds = new Set(products.map((item) => item.id));
    setCart((current) => Object.fromEntries(Object.entries(current).filter(([id]) => validIds.has(Number(id)))));
    setFavorites((current) => current.filter((id) => validIds.has(id)));
  }, [products]);

  useEffect(() => {
    if (activeCategory !== "Todos" && !products.some((item) => item.category === activeCategory)) {
      setActiveCategory("Todos");
    }
  }, [activeCategory, products]);

  const categories = ["Todos", ...new Set(products.map((item) => item.category))];
  const visibleItems = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const filtered = products.filter((item) => {
      const matchesCategory = activeCategory === "Todos" || item.category === activeCategory;
      const matchesSearch = !normalizedSearch || item.name.toLowerCase().includes(normalizedSearch) || item.description.toLowerCase().includes(normalizedSearch) || item.tag.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
    const sorted = [...filtered];
    if (sortBy === "price-asc") sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === "price-desc") sorted.sort((a, b) => b.price - a.price);
    else if (sortBy === "rating") sorted.sort((a, b) => b.rating - a.rating);
    else sorted.sort((a, b) => b.rating - a.rating || a.prepTime - b.prepTime);
    return sorted;
  }, [activeCategory, deferredSearch, products, sortBy]);

  const featuredItems = useMemo(() => products.slice().sort((a, b) => b.rating - a.rating).slice(0, 4), [products]);
  const cartItems = useMemo(() => products.filter((item) => cart[item.id]), [cart, products]);
  const itemCount = useMemo(() => cartItems.reduce((sum, item) => sum + (cart[item.id] || 0), 0), [cart, cartItems]);
  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * cart[item.id], 0), [cart, cartItems]);
  const selectedOrderConfig = ORDER_TYPES.find((option) => option.id === orderType) || ORDER_TYPES[0];
  const serviceFee = subtotal > 0 ? selectedOrderConfig.fee : 0;
  const priorityFee = isPriority && subtotal > 0 ? 1.75 : 0;
  const promoData = PROMO_CODES[appliedPromo.toUpperCase()] || null;
  const discountAmount = promoData ? subtotal * promoData.discount : 0;
  const total = Math.max(subtotal + serviceFee + priorityFee - discountAmount, 0);
  const etaMinutes = useMemo(() => {
    const scheduleBoost = scheduledSlot === "asap" ? 0 : Number(scheduledSlot);
    const orderBase = orderType === "pickup" ? 12 : orderType === "dine_in" ? 16 : 24;
    return Math.max(orderBase + Math.max(itemCount - 2, 0) * 4 + (isPriority ? -4 : 0) + scheduleBoost, 10);
  }, [itemCount, isPriority, orderType, scheduledSlot]);
  const requiresPaymentReference = paymentMethod === "card" || paymentMethod === "transfer";
  const hasInvalidPromo = promoCode.trim() && !PROMO_CODES[promoCode.trim().toUpperCase()];
  const isOrderReady =
    cartItems.length > 0 &&
    customerName.trim() &&
    (orderType !== "delivery" || customerAddress.trim()) &&
    (!requiresPaymentReference || paymentReference.trim());
  const orderStatusTone = orderStatus.toLowerCase().startsWith("error") ? "error" : "success";
  const authStatusTone = authStatus.toLowerCase().includes("no se pudo") || authStatus.toLowerCase().includes("completa") || authStatus.toLowerCase().includes("no coincide")
    ? "error"
    : "success";

  function updateAuthForm(mode, field, value) {
    setAuthStatus("");
    setAuthForm((prev) => ({ ...prev, [mode]: { ...prev[mode], [field]: value } }));
  }

  async function handleRegister() {
    const form = authForm.register;
    if (!form.fullName.trim() || !form.businessName.trim() || !form.email.trim() || !form.password.trim()) {
      setAuthStatus("Completa todos los campos para registrar tu cuenta.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setAuthStatus("La confirmacion de la contrasena no coincide.");
      return;
    }
    setIsAuthenticating(true);
    try {
      const result = await postJsonRpc(REGISTER_URL, {
        full_name: form.fullName,
        business_name: form.businessName,
        email: form.email,
        password: form.password,
        confirm_password: form.confirmPassword,
        db: dbName
      });
      const nextSession = {
        fullName: result.user.full_name,
        businessName: result.user.business_name,
        email: result.user.email
      };
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setAuthForm(AUTH_INITIAL);
      setAuthStatus("");
    } catch (error) {
      setAuthStatus(`No se pudo registrar: ${getErrorMessage(error, "Error desconocido")}`);
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogin() {
    const form = authForm.login;
    if (!form.email.trim() || !form.password.trim()) {
      setAuthStatus("Debes indicar correo y contrasena.");
      return;
    }
    setIsAuthenticating(true);
    try {
      const result = await postJsonRpc(LOGIN_URL, {
        email: form.email,
        password: form.password,
        db: dbName
      });
      const nextSession = {
        fullName: result.user.full_name,
        businessName: result.user.business_name,
        email: result.user.email
      };
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setAuthStatus("");
    } catch (error) {
      setAuthStatus(`No se pudo iniciar sesion: ${getErrorMessage(error, "Error desconocido")}`);
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function logout() {
    try {
      await postJsonRpc(LOGOUT_URL);
    } finally {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      setSession(null);
      setOrderStatus("");
    }
  }

  function addToCart(itemId) {
    setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
    setOrderStatus("");
  }

  function removeFromCart(itemId) {
    setCart((prev) => {
      const currentQty = prev[itemId] || 0;
      if (currentQty <= 1) {
        const { [itemId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: currentQty - 1 };
    });
  }

  function toggleFavorite(itemId) {
    setFavorites((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  }

  function applyPromoCode() {
    const normalizedCode = promoCode.trim().toUpperCase();
    if (!normalizedCode) {
      setAppliedPromo("");
      setOrderStatus("Escribe un codigo promocional para aplicarlo.");
      return;
    }
    if (!PROMO_CODES[normalizedCode]) {
      setAppliedPromo("");
      setOrderStatus("Ese codigo no existe o ya no esta disponible.");
      return;
    }
    setAppliedPromo(normalizedCode);
    setOrderStatus(`Promocion aplicada: ${PROMO_CODES[normalizedCode].label}.`);
  }

  async function submitOrder() {
    if (cartItems.length === 0) {
      setOrderStatus("Agrega al menos un producto antes de confirmar.");
      return;
    }
    if (!customerName.trim()) {
      setOrderStatus("Debes escribir el nombre del cliente.");
      return;
    }
    if (orderType === "delivery" && !customerAddress.trim()) {
      setOrderStatus("Para delivery necesitamos una direccion.");
      return;
    }
    if ((paymentMethod === "card" || paymentMethod === "transfer") && !paymentReference.trim()) {
      setOrderStatus("Agrega una referencia para el metodo seleccionado.");
      return;
    }
    setIsSavingOrder(true);
    setOrderStatus("Confirmando pedido y enviando a Odoo...");
    try {
      const result = await postJsonRpc(CREATE_ORDER_URL, {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        total_amount: Number(total.toFixed(2)),
        pay_now: true,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        order_type: orderType,
        scheduled_slot: scheduledSlot,
        customer_note: customerNote,
        promo_code: appliedPromo,
        is_priority: isPriority,
        service_fee: Number(serviceFee.toFixed(2)),
        priority_fee: Number(priorityFee.toFixed(2)),
        discount_amount: Number(discountAmount.toFixed(2)),
        items: cartItems.map((item) => ({ product_name: item.name, category: item.category, quantity: cart[item.id], unit_price: item.price }))
      });
      setOrderStatus(`Pedido ${result.order_name} confirmado. Tiempo estimado: ${result.estimated_ready_minutes} min.`);
      setCart({});
      setCustomerPhone("");
      setCustomerAddress("");
      setPaymentReference("");
      setCustomerNote("");
      setPromoCode("");
      setAppliedPromo("");
      setPaymentMethod("cash");
      setOrderType("delivery");
      setScheduledSlot("asap");
      setIsPriority(false);
      setDashboard((await postJsonRpc(DASHBOARD_URL)) || EMPTY_DASHBOARD);
    } catch (error) {
      setOrderStatus(`Error al guardar el pedido: ${getErrorMessage(error, "Error desconocido")}`);
    } finally {
      setIsSavingOrder(false);
    }
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <section className="auth-brand">
          <div className="brand-chip">Saidy Commerce Suite</div>
          <h1>Una experiencia de pedidos con imagen corporativa y acceso profesional.</h1>
          <p>Organiza el flujo comercial, presenta mejor tus productos y controla el pedido desde una interfaz más seria para una empresa real.</p>
          <div className="brand-grid">
            <article><strong>Operaciones claras</strong><span>Panel visual, orden en el checkout y lectura rápida del negocio.</span></article>
            <article><strong>Acceso de clientes</strong><span>Login y registro integrados para una entrada más formal a la plataforma.</span></article>
            <article><strong>Escalable</strong><span>Cuentas guardadas en Odoo y listas para ampliar el flujo del negocio.</span></article>
          </div>
        </section>
        <section className="auth-panel">
          <div className="auth-toggle">
            <button className={authMode === "login" ? "auth-tab active" : "auth-tab"} onClick={() => setAuthMode("login")}>Login</button>
            <button className={authMode === "register" ? "auth-tab active" : "auth-tab"} onClick={() => setAuthMode("register")}>Register</button>
          </div>
          {authMode === "login" ? (
            <div className="auth-form">
              <div>
                <span className="section-kicker">Acceso</span>
                <h2>Inicia sesion</h2>
              </div>
              <input className="order-input" type="email" placeholder="Correo corporativo" value={authForm.login.email} onChange={(event) => updateAuthForm("login", "email", event.target.value)} />
              <input className="order-input" type="password" placeholder="Contrasena" value={authForm.login.password} onChange={(event) => updateAuthForm("login", "password", event.target.value)} />
              <button className="submit-order" onClick={handleLogin} disabled={isAuthenticating}>{isAuthenticating ? "Validando..." : "Entrar al panel"}</button>
            </div>
          ) : (
            <div className="auth-form">
              <div>
                <span className="section-kicker">Registro</span>
                <h2>Crea tu cuenta</h2>
              </div>
              <input className="order-input" type="text" placeholder="Nombre completo" value={authForm.register.fullName} onChange={(event) => updateAuthForm("register", "fullName", event.target.value)} />
              <input className="order-input" type="text" placeholder="Nombre del negocio" value={authForm.register.businessName} onChange={(event) => updateAuthForm("register", "businessName", event.target.value)} />
              <input className="order-input" type="email" placeholder="Correo" value={authForm.register.email} onChange={(event) => updateAuthForm("register", "email", event.target.value)} />
              <input className="order-input" type="password" placeholder="Contrasena" value={authForm.register.password} onChange={(event) => updateAuthForm("register", "password", event.target.value)} />
              <input className="order-input" type="password" placeholder="Confirmar contrasena" value={authForm.register.confirmPassword} onChange={(event) => updateAuthForm("register", "confirmPassword", event.target.value)} />
              <button className="submit-order" onClick={handleRegister} disabled={isAuthenticating}>{isAuthenticating ? "Creando cuenta..." : "Crear cuenta"}</button>
            </div>
          )}
          {authStatus && <p className={`auth-status ${authStatusTone}`}>{authStatus}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="brand-chip">Saidy Commerce Suite</span>
          <h2>{session.businessName || "Saidy Food Commerce"}</h2>
        </div>
        <div className="topbar-actions">
          <div className="user-badge">
            <strong>{session.fullName}</strong>
            <span>{session.email}</span>
          </div>
          <button className="secondary-button" onClick={logout}>Cerrar sesion</button>
        </div>
      </header>

      <section className="hero-panel corporate">
        <div className="hero-copy">
          <span className="eyebrow">Panel comercial</span>
          <div className="hero-body">
            <div className="hero-text">
              <h1>Una experiencia de pedidos ordenada, vendible y lista para operar.</h1>
              <p>Mejor estructura visual, indicadores claros y un flujo de compra más serio para presentar el negocio con confianza.</p>
            </div>
            <div className="hero-points">
              <article><strong>Estado operativo</strong><span>{status}</span></article>
              <article><strong>Version del sistema</strong><span>{versionInfo ? `Odoo ${versionInfo.server_version}` : "Pendiente"}</span></article>
              <article><strong>Tiempo estimado</strong><span>{itemCount > 0 ? `${etaMinutes} minutos` : "Se calcula al crear un pedido"}</span></article>
            </div>
          </div>
          <div className="hero-actions">
            <div className="hero-search">
              <input type="text" placeholder="Buscar productos, categorias o promos" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            </div>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="featured">Destacados</option>
              <option value="rating">Mejor valorados</option>
              <option value="price-asc">Precio menor</option>
              <option value="price-desc">Precio mayor</option>
            </select>
          </div>
        </div>

        <div className="hero-card hero-stats">
          <p className="status-title">Resumen ejecutivo</p>
          <div className="stats-grid">
            <article><strong>{dashboard.metrics.total_orders}</strong><span>Pedidos</span></article>
            <article><strong>{formatCurrency(dashboard.metrics.revenue)}</strong><span>Ingresos</span></article>
            <article><strong>{dashboard.metrics.paid_orders}</strong><span>Pagados</span></article>
            <article><strong>{dashboard.metrics.satisfaction}%</strong><span>Satisfaccion</span></article>
          </div>
          <div className="eta-card">
            <span>Pedido activo</span>
            <strong>{itemCount} items en carrito</strong>
            <p>Un checkout claro mejora la conversión y reduce errores operativos.</p>
          </div>
        </div>
      </section>

      <section className="featured-strip">
        {featuredItems.map((item) => (
          <article key={item.id} className="featured-card">
            <div>
              <span className="featured-badge">{item.tag}</span>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
            </div>
            <div className="featured-meta">
              <span>{item.emoji}</span>
              <strong>{formatCurrency(item.price)}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="catalog-toolbar">
        <div className="filters">
          {categories.map((category) => (
            <button key={category} className={category === activeCategory ? "filter active" : "filter"} onClick={() => setActiveCategory(category)}>
              {category}
            </button>
          ))}
        </div>
        <div className="promo-banner">
          <span>Promociones disponibles</span>
          <strong>{appliedPromo ? `${appliedPromo}: ${PROMO_CODES[appliedPromo].label}` : "BIENVENIDA, LUNCH10, SWEET15"}</strong>
        </div>
      </section>

      <section className="layout-grid">
        <div className="catalog-column">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Catalogo</span>
              <h2>Productos organizados para una compra más clara</h2>
            </div>
            <span>{visibleItems.length} resultados</span>
          </div>

          <div className="menu-grid">
            {visibleItems.length === 0 && (
              <article className="empty-state">
                <strong>No encontramos productos con ese filtro.</strong>
                <p>Prueba otra categoria, limpia la busqueda o revisa las promociones disponibles.</p>
              </article>
            )}
            {visibleItems.map((item) => {
              const isFavorite = favorites.includes(item.id);
              return (
                <article key={item.id} className="item-card">
                  <button className={isFavorite ? "favorite active" : "favorite"} onClick={() => toggleFavorite(item.id)} aria-label="Marcar favorito">
                    {isFavorite ? "★" : "☆"}
                  </button>
                  <div className="item-topline">
                    <span className="emoji" aria-hidden="true">{item.emoji}</span>
                    <span className="item-tag">{item.tag}</span>
                  </div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <div className="item-insights">
                    <span>{item.category}</span>
                    <span>{item.rating} rating</span>
                    <span>{item.prepTime} min</span>
                  </div>
                  <div className="item-footer">
                    <strong>{formatCurrency(item.price)}</strong>
                    <button onClick={() => addToCart(item.id)}>Agregar</button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <aside className="checkout-column">
          <section className="checkout-card">
            <div className="section-heading compact">
              <div>
                <span className="section-kicker">Checkout</span>
                <h2>Confirma el pedido</h2>
              </div>
            </div>

            <div className="segmented-grid">
              {ORDER_TYPES.map((option) => (
                <button key={option.id} className={option.id === orderType ? "mode-card active" : "mode-card"} onClick={() => setOrderType(option.id)}>
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>

            <div className="form-grid">
              <input className="order-input" type="text" placeholder="Nombre del cliente" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              <input className="order-input" type="text" placeholder="Telefono" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
              <input className="order-input" type="text" placeholder={orderType === "delivery" ? "Direccion de entrega" : "Referencia o ubicacion"} value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} />
              <select className="order-input" value={scheduledSlot} onChange={(event) => setScheduledSlot(event.target.value)}>
                {SCHEDULE_OPTIONS.map((slot) => (
                  <option key={slot.id} value={slot.id}>{slot.label}</option>
                ))}
              </select>
              <textarea className="order-input order-note" placeholder="Notas de cocina o instrucciones especiales" rows="3" value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} />
            </div>

            <div className="priority-box">
              <label className="priority-toggle">
                <input type="checkbox" checked={isPriority} onChange={(event) => setIsPriority(event.target.checked)} />
                <span>Preparacion prioritaria</span>
              </label>
              <small>Mejora la urgencia operativa y reduce el tiempo estimado.</small>
            </div>

            <div className="payment-box">
              <p className="payment-title">Metodo de pago</p>
              <div className="payment-methods">
                {PAYMENT_METHODS.map((method) => (
                  <label key={method.id} className={paymentMethod === method.id ? "payment-option active" : "payment-option"}>
                    <input type="radio" name="payment-method" value={method.id} checked={paymentMethod === method.id} onChange={(event) => setPaymentMethod(event.target.value)} />
                    <div>
                      <strong>{method.label}</strong>
                      <span>{method.hint}</span>
                    </div>
                  </label>
                ))}
              </div>
              {requiresPaymentReference ? (
                <input className="order-input" type="text" placeholder="Referencia de pago" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
              ) : (
                <p className="payment-hint">No necesitas referencia adicional para pagos en efectivo.</p>
              )}
            </div>

            <div className="promo-box">
              <input className="order-input" type="text" placeholder="Codigo promocional" value={promoCode} onChange={(event) => setPromoCode(event.target.value)} />
              <button className="secondary-button" onClick={applyPromoCode}>Aplicar</button>
            </div>
            {hasInvalidPromo && <p className="inline-hint warning">Ese codigo no esta en la lista de promociones activas.</p>}

            <div className="cart-list">
              {cartItems.length === 0 && <p className="empty">Todavia no agregas productos.</p>}
              {cartItems.map((item) => (
                <div key={item.id} className="cart-row">
                  <div>
                    <p>{item.name}</p>
                    <small>{cart[item.id]} x {formatCurrency(item.price)}</small>
                  </div>
                  <button className="remove" onClick={() => removeFromCart(item.id)}>Quitar</button>
                </div>
              ))}
            </div>

            <div className="summary-box">
              <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
              <div><span>Servicio</span><strong>{formatCurrency(serviceFee)}</strong></div>
              <div><span>Prioridad</span><strong>{formatCurrency(priorityFee)}</strong></div>
              <div><span>Descuento</span><strong>-{formatCurrency(discountAmount)}</strong></div>
              <div className="grand-total"><span>Total</span><strong>{formatCurrency(total)}</strong></div>
            </div>

            <button className="submit-order" onClick={submitOrder} disabled={isSavingOrder || !isOrderReady}>
              {isSavingOrder ? "Procesando pedido..." : "Registrar pedido"}
            </button>
            {!isOrderReady && !isSavingOrder && <p className="inline-hint">Completa los datos obligatorios para habilitar el pedido.</p>}
            {orderStatus && <p className={`order-status ${orderStatusTone}`}>{orderStatus}</p>}
          </section>

          <section className="insights-card">
            <div className="section-heading compact">
              <div>
                <span className="section-kicker">Actividad</span>
                <h2>Ultimos movimientos</h2>
              </div>
            </div>

            <div className="insight-metrics">
              <article><strong>{favorites.length}</strong><span>Favoritos</span></article>
              <article><strong>{itemCount}</strong><span>En carrito</span></article>
              <article><strong>{etaMinutes}</strong><span>Min estimados</span></article>
            </div>

            <div className="recent-list">
              {dashboard.recent_orders.length === 0 && <p className="empty">Aun no hay pedidos recientes en el panel.</p>}
              {dashboard.recent_orders.map((order) => (
                <article key={order.name} className="recent-order">
                  <div>
                    <strong>{order.name}</strong>
                    <p>{order.customer_name}</p>
                  </div>
                  <div>
                    <span>{order.order_type}</span>
                    <strong>{formatCurrency(order.total_amount)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
