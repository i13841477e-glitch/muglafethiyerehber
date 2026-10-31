(function () {
  const data = window.KESFET;
  const state = { q: "", region: "all", category: "all", favOnly: false, route: data.routes[0].id };
  const favKey = "kesfet-turkiye-favs";
  const catColor = {
    plaj: ["#1f8f9a", "#0e4d57"],
    koy: ["#2a8f6f", "#14483d"],
    doga: ["#3d8b4a", "#1d4630"],
    tarih: ["#c4823a", "#6a3a22"],
    aktivite: ["#c4622d", "#7a3418"]
  };

  const $ = (sel) => document.querySelector(sel);
  const regionName = (id) => (data.regions.find((r) => r.id === id) || {}).name || "";
  const catName = (id) => (data.categories.find((c) => c.id === id) || {}).name || "";
  const placeById = (id) => data.places.find((p) => p.id === id);

  function loadFavs() {
    try { return new Set(JSON.parse(localStorage.getItem(favKey)) || []); }
    catch (e) { return new Set(); }
  }
  let favs = loadFavs();
  function saveFavs() {
    localStorage.setItem(favKey, JSON.stringify([...favs]));
  }
  function norm(s) {
    return (s || "").toLocaleLowerCase("tr")
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/â/g, "a").replace(/î/g, "i");
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function filtered() {
    const q = norm(state.q);
    return data.places.filter((p) => {
      if (state.region !== "all" && p.region !== state.region) return false;
      if (state.category !== "all" && p.category !== state.category) return false;
      if (state.favOnly && !favs.has(p.id)) return false;
      if (!q) return true;
      const blob = norm([p.name, p.blurb, p.about, p.keys, regionName(p.region), catName(p.category)].join(" "));
      return blob.includes(q);
    });
  }

  function card(p) {
    const colors = catColor[p.category] || ["#1c7c74", "#11464a"];
    const on = favs.has(p.id) ? " on" : "";
    const img = p.image
      ? `<img alt="" src="${esc(p.image)}" />`
      : "";
    return `<article class="place-card" data-id="${esc(p.id)}">
      <div class="media${p.image ? "" : " broken"}" style="--c1:${colors[0]};--c2:${colors[1]}">
        ${img}
        <div class="fallback"><span>${esc(catName(p.category))}</span><b>${esc(p.name)}</b></div>
        <button class="heart${on}" type="button" aria-label="Listeme ekle" data-fav="${esc(p.id)}">${favs.has(p.id) ? "✓" : "+"}</button>
      </div>
      <div class="card-body">
        <div class="meta"><span class="pill">${esc(p.tag)}</span><span class="count">${esc(regionName(p.region))}</span></div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.blurb)}</p>
      </div>
    </article>`;
  }

  function paintCards(root, list, emptyHtml) {
    root.innerHTML = list.length ? list.map(card).join("") : emptyHtml;
    root.querySelectorAll("img").forEach((img) => {
      img.addEventListener("error", () => img.parentElement.classList.add("broken"));
    });
  }

  function renderPlaces() {
    const list = filtered();
    $("#result-count").textContent = list.length + " durak";
    paintCards($("#place-grid"), list, `<div class="empty"><strong>Bu süzgeçte durak yok.</strong><p>Aramayı temizleyin ya da başka bir bölge seçin.</p></div>`);
  }

  function renderList() {
    const list = data.places.filter((p) => favs.has(p.id));
    $("#list-count").textContent = list.length + " durak";
    paintCards($("#list-grid"), list, `<div class="empty"><strong>Listeniz boş.</strong><p>Keşfet ekranında bir durağın üstündeki artıya basın. Seçtikleriniz burada kalır.</p></div>`);
  }

  const screens = ["ev", "kesfet", "harita", "rotalar", "lezzet", "rehber", "listem", "rezerve"];
  const rezKey = "kesfet-turkiye-reservations";
  function showView(name) {
    if (!screens.includes(name)) name = "ev";
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.toggle("active", el.dataset.screen === name);
    });
    document.querySelectorAll("[data-go]").forEach((el) => {
      el.classList.toggle("active", el.dataset.go === name);
    });
    if (name === "listem") renderList();
    if (name === "rezerve") renderReservations();
    if (name === "harita" && map) setTimeout(() => map.invalidateSize(), 50);
    window.scrollTo(0, 0);
  }

  function renderRegions() {
    $("#region-grid").innerHTML = data.regions.map((r) => {
      const n = data.places.filter((p) => p.region === r.id).length;
      return `<button class="region-card" type="button" data-region="${esc(r.id)}">
        <strong>${esc(r.name)}</strong><span>${esc(r.line)}</span><em>${n} durak</em>
      </button>`;
    }).join("");
  }

  function renderFilters() {
    const regions = [{ id: "all", name: "Tüm Muğla" }].concat(data.regions);
    const cats = [{ id: "all", name: "Her tür" }].concat(data.categories);
    $("#region-filters").innerHTML = regions.map((r) =>
      `<button class="chip${state.region === r.id ? " active" : ""}" type="button" data-set-region="${esc(r.id)}">${esc(r.name)}</button>`
    ).join("") + `<button class="chip fav${state.favOnly ? " active" : ""}" type="button" data-fav-only>Listem (${favs.size})</button>`;
    $("#cat-filters").innerHTML = cats.map((c) =>
      `<button class="chip${state.category === c.id ? " active" : ""}" type="button" data-set-cat="${esc(c.id)}">${esc(c.name)}</button>`
    ).join("");
  }

  let map;
  let markers = {};
  function initMap() {
    const holder = $("#map");
    if (!window.L) {
      holder.innerHTML = `<p class="map-fallback">Harita açılmadı. Duraklar yine de listedeki kartlardan gezilebilir.</p>`;
      return;
    }
    map = L.map(holder, { scrollWheelZoom: false }).setView([36.75, 28.4], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 16,
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);
    data.places.forEach((p) => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        color: "#11464a",
        weight: 2,
        fillColor: "#e7c27a",
        fillOpacity: 0.95
      }).addTo(map);
      marker.bindTooltip(p.name, { direction: "top" });
      marker.on("click", () => openPlace(p.id));
      markers[p.id] = marker;
    });
    const side = $("#map-side");
    side.innerHTML = data.regions.map((r) =>
      `<button type="button" data-zoom="${esc(r.id)}"><strong>${esc(r.name)}</strong><span>${esc(r.line)}</span></button>`
    ).join("");
  }

  function zoomRegion(id) {
    const pts = data.places.filter((p) => p.region === id);
    if (!map || !pts.length) return;
    const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.3));
  }

  function openPlace(id) {
    const p = placeById(id);
    if (!p) return;
    const colors = catColor[p.category] || ["#1c7c74", "#11464a"];
    const dlg = $("#place-dialog");
    const on = favs.has(p.id);
    dlg.innerHTML = `
      <div class="dialog-hero${p.image ? "" : " broken"}" style="--c1:${colors[0]};--c2:${colors[1]};background:linear-gradient(145deg, ${colors[0]}, ${colors[1]})">
        ${p.image ? `<img alt="${esc(p.name)}" src="${esc(p.image)}" />` : ""}
        <button class="close-x" type="button" data-close="1" aria-label="Kapat">×</button>
      </div>
      <div class="dialog-body">
        <div class="meta"><span class="pill">${esc(p.tag)}</span><span class="count">${esc(regionName(p.region))} · ${esc(catName(p.category))}</span></div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.about)}</p>
        <div class="facts">
          <div><span>Süre</span><strong>${esc(p.time)}</strong></div>
          <div><span>Dönem</span><strong>${esc(p.season)}</strong></div>
          <div><span>Ulaşım</span><strong>${esc(p.reach)}</strong></div>
        </div>
        <p><strong>Yerinde</strong></p>
        <ul>${p.see.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
        <p style="margin-top:12px"><strong>Not</strong></p>
        <ul>${p.tips.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
        <div class="dialog-actions">
          <button class="btn tiny clay" type="button" data-book="${esc(p.id)}">Rezerve et</button>
          <button class="btn tiny" type="button" data-fav="${esc(p.id)}">${on ? "Listeden çıkar" : "Listeme ekle"}</button>
          <button class="btn tiny ghost" type="button" data-map="${esc(p.id)}">Haritada gör</button>
        </div>
      </div>`;
    const heroImg = dlg.querySelector(".dialog-hero img");
    if (heroImg) heroImg.addEventListener("error", () => heroImg.parentElement.classList.add("broken"));
    if (!dlg.open) dlg.showModal();
    history.replaceState(null, "", "#" + id);
  }

  function closePlace() {
    const dlg = $("#place-dialog");
    if (dlg.open) dlg.close();
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  function toggleFav(id) {
    if (favs.has(id)) favs.delete(id);
    else favs.add(id);
    saveFavs();
    renderFilters();
    renderPlaces();
    renderList();
    if ($("#place-dialog").open) openPlace(id);
  }

  function renderRoute() {
    const route = data.routes.find((r) => r.id === state.route) || data.routes[0];
    $("#route-switch").innerHTML = data.routes.map((r) =>
      `<button class="chip${r.id === route.id ? " active" : ""}" type="button" data-route="${esc(r.id)}">${esc(r.days)}</button>`
    ).join("");
    $("#route-body").innerHTML = `
      <h3>${esc(route.title)}</h3>
      <p>${esc(route.summary)}</p>
      <div class="days">
        ${route.steps.map((step) => `
          <div class="day">
            <b>${esc(step.day)}</b>
            <div>
              <strong>${esc(step.title)}</strong>
              <p>${esc(step.text)}</p>
              <div class="day-links">
                ${step.ids.map((id) => {
                  const p = placeById(id);
                  return p ? `<button type="button" data-id="${esc(id)}">${esc(p.name)}</button>` : "";
                }).join("")}
              </div>
            </div>
          </div>`).join("")}
      </div>`;
  }

  function renderRest() {
    $("#food-grid").innerHTML = data.foods.map((f) =>
      `<article class="food-card"><span>${esc(f.area)}</span><h3>${esc(f.name)}</h3><p>${esc(f.text)}</p></article>`
    ).join("");
    $("#stay-grid").innerHTML = data.stays.map((s) =>
      `<article class="stay-card"><span>Konaklama</span><h3>${esc(s.name)}</h3><p>${esc(s.text)}</p></article>`
    ).join("");
    $("#guide-grid").innerHTML = data.guide.map((g) =>
      `<article class="guide-card"><h3>${esc(g.title)}</h3><p>${esc(g.text)}</p></article>`
    ).join("");
    const month = new Date().getMonth();
    $("#season-note").textContent = data.monthNotes[month];
    $("#stat-count").textContent = data.places.length;
  }

  function loadReservations() {
    try { return JSON.parse(localStorage.getItem(rezKey)) || []; }
    catch (e) { return []; }
  }
  function saveReservations(list) {
    localStorage.setItem(rezKey, JSON.stringify(list));
  }
  function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function fillReserveForm(placeId) {
    const sel = $("#rez-place");
    sel.innerHTML = data.places.map((p) =>
      `<option value="${esc(p.id)}">${esc(p.name)}</option>`
    ).join("");
    if (placeId && placeById(placeId)) sel.value = placeId;
    const date = $("#rez-date");
    date.min = todayISO();
    if (!date.value || date.value < date.min) date.value = date.min;
  }
  function renderReservations() {
    fillReserveForm($("#rez-place").value);
    const list = loadReservations().sort((a, b) => a.date.localeCompare(b.date));
    $("#rez-list").innerHTML = list.length
      ? list.map((r) => {
        const p = placeById(r.placeId);
        const when = new Date(r.date + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
        return `<article class="book-card">
          <div>
            <span class="pill">${esc(r.code)}</span>
            <strong>${esc(r.title || (p ? p.name : "Durak"))}</strong>
            <p>${esc(when)} · ${esc(r.people)} kişi · ${esc(r.name)} · ${esc(r.phone)}</p>
            ${r.note ? `<p>${esc(r.note)}</p>` : ""}
          </div>
          <button class="btn tiny ghost" type="button" data-cancel="${esc(r.id)}">İptal</button>
        </article>`;
      }).join("")
      : `<div class="empty"><strong>Henüz rezervasyon yok.</strong><p>Formu doldurunca kayıt burada görünür.</p></div>`;
  }
  function openReserve(placeId) {
    closePlace();
    showView("rezerve");
    fillReserveForm(placeId);
    $("#rez-msg").textContent = "";
  }
  function saveReservation(event) {
    event.preventDefault();
    const placeId = $("#rez-place").value;
    const date = $("#rez-date").value;
    const people = Number($("#rez-people").value);
    const name = $("#rez-name").value.trim();
    const phone = $("#rez-phone").value.trim();
    const note = $("#rez-note").value.trim();
    const msg = $("#rez-msg");
    if (!placeById(placeId)) { msg.textContent = "Bir durak seçin."; return; }
    if (!date || date < todayISO()) { msg.textContent = "Tarih bugün ya da sonrası olmalı."; return; }
    if (!people || people < 1 || people > 20) { msg.textContent = "Kişi sayısı 1 ile 20 arasında olmalı."; return; }
    if (name.length < 2) { msg.textContent = "Adı yazın."; return; }
    if (phone.replace(/\D/g, "").length < 10) { msg.textContent = "Telefon en az 10 rakam olmalı."; return; }
    const item = {
      id: Date.now().toString(36),
      code: "KT-" + Math.random().toString(36).slice(2, 6).toUpperCase(),
      placeId, date, people, name, phone, note
    };
    const list = loadReservations();
    list.push(item);
    saveReservations(list);
    $("#rez-note").value = "";
    msg.textContent = item.code + " kaydedildi.";
    renderReservations();
  }

  function setRegion(id) {
    state.region = id;
    state.q = "";
    const q = $("#q");
    if (q) q.value = "";
    renderFilters();
    renderPlaces();
    showView("kesfet");
  }

  document.body.addEventListener("click", (event) => {
    const t = event.target.closest("button, article, a");
    if (!t) return;
    if (t.dataset.go) {
      event.preventDefault();
      showView(t.dataset.go);
      return;
    }
    if (t.id === "clear-q") {
      state.q = "";
      $("#q").value = "";
      renderPlaces();
      return;
    }
    if (t.dataset.fav) {
      event.stopPropagation();
      toggleFav(t.dataset.fav);
      return;
    }
    if (t.dataset.book) {
      openReserve(t.dataset.book);
      return;
    }
    if (t.dataset.cancel) {
      saveReservations(loadReservations().filter((r) => r.id !== t.dataset.cancel));
      renderReservations();
      return;
    }
    if (t.dataset.close) closePlace();
    if (t.dataset.map) {
      const id = t.dataset.map;
      closePlace();
      showView("harita");
      const p = placeById(id);
      if (map && p) {
        setTimeout(() => {
          map.invalidateSize();
          map.setView([p.lat, p.lng], 13);
          markers[id].openTooltip();
        }, 80);
      }
    }
    if (t.dataset.region) setRegion(t.dataset.region);
    if (t.dataset.setRegion) setRegion(t.dataset.setRegion);
    if (t.dataset.setCat) {
      state.category = t.dataset.setCat;
      renderFilters();
      renderPlaces();
    }
    if (t.dataset.favOnly !== undefined) {
      state.favOnly = !state.favOnly;
      renderFilters();
      renderPlaces();
    }
    if (t.dataset.route) {
      state.route = t.dataset.route;
      renderRoute();
    }
    if (t.dataset.zoom) zoomRegion(t.dataset.zoom);
    if (t.dataset.id && t.classList.contains("place-card")) openPlace(t.dataset.id);
    if (t.dataset.id && t.closest(".day-links")) openPlace(t.dataset.id);
  });

  $("#rez-form").addEventListener("submit", saveReservation);

  $("#q").addEventListener("input", (e) => {
    state.q = e.target.value;
    renderPlaces();
  });

  $("#place-dialog").addEventListener("click", (e) => {
    if (e.target.id === "place-dialog") closePlace();
  });
  $("#place-dialog").addEventListener("close", () => {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  });

  document.addEventListener("scroll", () => {
    $(".nav").classList.toggle("scrolled", window.scrollY > 8);
  }, { passive: true });

  $("#stat-count").textContent = String(data.places.length);
  renderRegions();
  renderFilters();
  renderPlaces();
  renderRoute();
  renderRest();
  initMap();

  const start = location.hash.replace("#", "");
  if (placeById(start)) {
    showView("kesfet");
    openPlace(start);
  } else {
    showView(screens.includes(start) ? start : "ev");
  }
})();
