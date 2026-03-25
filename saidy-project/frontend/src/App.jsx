import { useEffect, useMemo, useState } from "react";

const ODOO_VERSION_URL = "/odoo/web/webclient/version_info";
const CREATE_ORDER_URL = "/odoo/food_orders/create";

// Hola mudno

const FOOD_ITEMS = [
  { id: 1, name: "Pizza Margarita", category: "Pizzas", price: 8.5, emoji: "🍕" },
  { id: 2, name: "Hamburguesa Clasica", category: "Burgers", price: 6.25, emoji: "🍔" },
  { id: 3, name: "Tacos de Pollo", category: "Tacos", price: 5.75, emoji: "🌮" },
  { id: 4, name: "Ensalada Cesar", category: "Saludable", price: 4.9, emoji: "🥗" },
  { id: 5, name: "Pasta Alfredo", category: "Pastas", price: 7.2, emoji: "🍝" },
  { id: 6, name: "Limonada Natural", category: "Bebidas", price: 2.25, emoji: "🥤" }
];

const PAYMENT_METHODS = [
  { id: "cash", label: "Efectivo" },
  { id: "card", label: "Tarjeta" },
  { id: "transfer", label: "Transferencia" }
];

export default function App() {
  const [versionInfo, setVersionInfo] = useState(null);
  const [status, setStatus] = useState("Cargando conexion con Odoo...");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [cart, setCart] = useState({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const categories = ["Todos", ...new Set(FOOD_ITEMS.map((item) => item.category))];
  const visibleItems =
    activeCategory === "Todos"
      ? FOOD_ITEMS
      : FOOD_ITEMS.filter((item) => item.category === activeCategory);

  const cartItems = useMemo(() => FOOD_ITEMS.filter((item) => cart[item.id]), [cart]);
  const total = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * cart[item.id], 0),
    [cart, cartItems]
  );

  useEffect(() => {
    async function checkOdoo() {
      try {
        const response = await fetch(ODOO_VERSION_URL, { method: "POST" });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        setVersionInfo(payload.result);
        setStatus("Conexion exitosa con Odoo");
      } catch (error) {
        setStatus(`No se pudo conectar con Odoo: ${error.message}`);
      }
    }

    checkOdoo();
  }, []);

  function addToCart(itemId) {
    setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
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

  async function submitOrder() {
    if (cartItems.length === 0) {
      setOrderStatus("Agrega al menos un producto antes de pagar.");
      return;
    }

    if (!customerName.trim()) {
      setOrderStatus("Debes escribir tu nombre.");
      return;
    }

    if (!paymentMethod) {
      setOrderStatus("Selecciona un metodo de pago.");
      return;
    }

    setIsSavingOrder(true);
    setOrderStatus("Procesando pago y pedido...");

    try {
      const response = await fetch(CREATE_ORDER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "call",
          params: {
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: customerAddress,
            total_amount: total,
            pay_now: true,
            payment_method: paymentMethod,
            payment_reference: paymentReference,
            items: cartItems.map((item) => ({
              product_name: item.name,
              category: item.category,
              quantity: cart[item.id],
              unit_price: item.price
            }))
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (payload.error) {
        throw new Error(payload.error.data?.message || "No se pudo procesar el pago");
      }

      setOrderStatus(
        `Pago aprobado. Pedido ${payload.result.order_name} registrado como ${payload.result.payment_status}.`
      );
      setCart({});
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setPaymentReference("");
      setPaymentMethod("cash");
    } catch (error) {
      setOrderStatus(`Error al pagar: ${error.message}`);
    } finally {
      setIsSavingOrder(false);
    }
  }

  return (
    <main className="container">
      <header className="hero">
        <h1>Tienda de Comida</h1>
        <p>Ordena y paga desde React con backend en Odoo 18.</p>
      </header>

      <section className="status-card">
        <p>{status}</p>
        {versionInfo && <small>Odoo {versionInfo.server_version}</small>}
      </section>

      <section className="filters">
        {categories.map((category) => (
          <button
            key={category}
            className={category === activeCategory ? "filter active" : "filter"}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </section>

      <section className="content">
        <div className="menu-grid">
          {visibleItems.map((item) => (
            <article key={item.id} className="item-card">
              <span className="emoji" aria-hidden="true">
                {item.emoji}
              </span>
              <h2>{item.name}</h2>
              <p>{item.category}</p>
              <div className="item-footer">
                <strong>US${item.price.toFixed(2)}</strong>
                <button onClick={() => addToCart(item.id)}>Agregar</button>
              </div>
            </article>
          ))}
        </div>

        <aside className="cart">
          <h3>Carrito</h3>
          {cartItems.length === 0 && <p className="empty">Aun no agregas productos.</p>}

          {cartItems.map((item) => (
            <div key={item.id} className="cart-row">
              <div>
                <p>{item.name}</p>
                <small>
                  {cart[item.id]} x US${item.price.toFixed(2)}
                </small>
              </div>
              <button className="remove" onClick={() => removeFromCart(item.id)}>
                Quitar
              </button>
            </div>
          ))}

          <div className="total">
            <span>Total</span>
            <strong>US${total.toFixed(2)}</strong>
          </div>

          <input
            className="order-input"
            type="text"
            placeholder="Tu nombre"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
          />
          <input
            className="order-input"
            type="text"
            placeholder="Telefono (opcional)"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
          />
          <textarea
            className="order-input"
            placeholder="Direccion de entrega (opcional)"
            rows="3"
            value={customerAddress}
            onChange={(event) => setCustomerAddress(event.target.value)}
          />

          <div className="payment-box">
            <p className="payment-title">Metodo de pago</p>
            <div className="payment-methods">
              {PAYMENT_METHODS.map((method) => (
                <label key={method.id} className="payment-option">
                  <input
                    type="radio"
                    name="payment-method"
                    value={method.id}
                    checked={paymentMethod === method.id}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                  />
                  {method.label}
                </label>
              ))}
            </div>
            <input
              className="order-input"
              type="text"
              placeholder="Referencia de pago (opcional)"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
            />
          </div>

          <button className="submit-order" onClick={submitOrder} disabled={isSavingOrder}>
            {isSavingOrder ? "Procesando pago..." : "Pagar y realizar pedido"}
          </button>
          {orderStatus && <p className="order-status">{orderStatus}</p>}
        </aside>
      </section>
    </main>
  );
}