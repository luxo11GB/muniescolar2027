/* ==========================================================
   Farmeando AURA · Municipio Escolar 2027
   ========================================================== */

/* ---------- CONFIGURACIÓN (edita aquí) ---------- */
const CONFIG = {
  // Número de WhatsApp que recibirá los mensajes.
  // Formato internacional, solo dígitos. Perú = 51 + número de 9 dígitos.
  // Ejemplo: "51987654321"
  whatsappNumber: "51936173480",

  // Contador de visitas global (servicio gratuito counterapi.dev).
  // Cambia "namespace" por algo único para que nadie más use el mismo contador.
  counter: {
    enabled: true,
    namespace: "farmeando-aura-ml-2027",
    key: "visitas",
  },
};

/* ---------- Utilidades ---------- */
const $ = (sel) => document.querySelector(sel);
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Acceso seguro a storage (puede fallar en modo privado) */
const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignorar */ } },
  sget(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
  sset(key, value) { try { sessionStorage.setItem(key, value); } catch { /* ignorar */ } },
};

/* ---------- Menú móvil ---------- */
(function initNav() {
  const toggle = $("#navToggle");
  const links = $("#navLinks");
  if (!toggle || !links) return;

  const close = () => {
    links.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú");
  };

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  });

  links.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();

/* ---------- Juego del aura ---------- */
(function initAura() {
  const btn = $("#auraBtn");
  const valueEl = $("#auraValue");
  const rankEl = $("#auraRank");
  if (!btn) return;

  const ranks = [
    [0,    "Toca a los personajes y empieza a farmear"],
    [10,   "Calentando motores"],
    [50,   "Aura en ascenso"],
    [150,  "Nivel Mariscal Luzuriaga"],
    [400,  "Aura de alcaldesa"],
    [1000, "Aura legendaria. Ya puedes votar tranquilo"],
  ];

  let aura = parseInt(store.get("aura_points", "0"), 10) || 0;

  const rankFor = (n) => ranks.filter(([min]) => n >= min).pop()[1];
  const render = () => {
    valueEl.textContent = aura.toLocaleString("es-PE");
    rankEl.textContent = rankFor(aura);
  };

  const floatPlus = (x, y) => {
    if (prefersReducedMotion) return;
    const el = document.createElement("span");
    el.className = "float-plus";
    el.textContent = "+1 aura";
    el.style.left = `${x - 30}px`;
    el.style.top = `${y - 20}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  };

  btn.addEventListener("click", (e) => {
    aura += 1;
    store.set("aura_points", String(aura));
    render();
    // Si fue con teclado, e.clientX es 0: usar el centro del botón
    const rect = btn.getBoundingClientRect();
    const x = e.clientX || rect.left + rect.width / 2;
    const y = e.clientY || rect.top + rect.height / 2;
    floatPlus(x + (Math.random() * 30 - 15), y);
  });

  render();
})();

/* ---------- Contador de visitas ---------- */
(function initVisitCounter() {
  const el = $("#visitCount");
  if (!el) return;

  const renderDigits = (n) => {
    const str = String(Math.max(0, Math.floor(n))).padStart(6, "0");
    el.innerHTML = [...str].map((d) => `<span>${d}</span>`).join("");
    el.setAttribute("aria-label", `${n.toLocaleString("es-PE")} visitas`);
  };

  const animateTo = (target) => {
    if (prefersReducedMotion || target < 30) return renderDigits(target);
    const start = performance.now();
    const duration = 1200;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      renderDigits(target * eased);
      if (t < 1) requestAnimationFrame(tick);
      else renderDigits(target);
    };
    requestAnimationFrame(tick);
  };

  // Valor guardado por si no hay internet o el servicio falla
  const lastKnown = parseInt(store.get("visit_last_count", "0"), 10) || 0;
  renderDigits(lastKnown);

  if (!CONFIG.counter.enabled) return;

  const { namespace, key } = CONFIG.counter;
  const base = `https://api.counterapi.dev/v1/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;

  // Se cuenta una visita por sesión (no suma al recargar la página)
  const alreadyCounted = store.sget("visit_counted") === "1";

  const request = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (typeof data.count !== "number") throw new Error("Respuesta inesperada");
    return data.count;
  };

  (async () => {
    try {
      let count;
      if (alreadyCounted) {
        try { count = await request(base); } catch { count = await request(`${base}/up`); }
      } else {
        count = await request(`${base}/up`);
        store.sset("visit_counted", "1");
      }
      store.set("visit_last_count", String(count));
      animateTo(count);
    } catch (err) {
      console.warn("No se pudo actualizar el contador de visitas:", err);
      // Se queda mostrando el último valor conocido
    }
  })();
})();

/* ---------- Formulario de comentarios → WhatsApp ---------- */
(function initCommentForm() {
  const form = $("#commentForm");
  if (!form) return;

  const msg = $("#cMsg");
  const name = $("#cName");
  const grade = $("#cGrade");
  const count = $("#charCount");
  const status = $("#formStatus");

  const setStatus = (text, type) => {
    status.textContent = text;
    status.className = "form__status" + (type ? ` is-${type}` : "");
  };

  msg.addEventListener("input", () => {
    count.textContent = msg.value.length;
    msg.classList.remove("is-invalid");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const text = msg.value.trim();
    if (text.length < 5) {
      msg.classList.add("is-invalid");
      setStatus("Escribe un mensaje de al menos 5 caracteres.", "error");
      msg.focus();
      return;
    }

    const number = (CONFIG.whatsappNumber || "").replace(/\D/g, "");
    if (!number) {
      setStatus("El envío todavía no está activado: falta configurar el número de WhatsApp.", "error");
      return;
    }

    const lines = ["Hola plancha AURA 👋", ""];
    if (name.value.trim())  lines.push(`Nombre: ${name.value.trim()}`);
    if (grade.value.trim()) lines.push(`Grado y sección: ${grade.value.trim()}`);
    if (name.value.trim() || grade.value.trim()) lines.push("");
    lines.push("Mensaje:", text);

    const url = `https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}`;
    const win = window.open(url, "_blank", "noopener");
    if (!win) window.location.href = url; // si el navegador bloquea la ventana

    setStatus("Listo. Termina de enviar el mensaje en WhatsApp. ¡Gracias por participar!", "ok");
    form.reset();
    count.textContent = "0";
  });
})();
