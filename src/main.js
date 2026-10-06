import { supabase, hasSupabaseConfig } from "./supabaseClient.js";

const FRUITS = [
  { id: "semangka", n: "Semangka", e: "🍉" }, { id: "melon", n: "Melon", e: "🍈" },
  { id: "nanas", n: "Nanas", e: "🍍" }, { id: "mangga", n: "Mangga", e: "🥭" },
  { id: "jeruk", n: "Jeruk", e: "🍊" }, { id: "anggur", n: "Anggur", e: "🍇" },
  { id: "apel", n: "Apel", e: "🍎" }, { id: "pir", n: "Pir", e: "🍐" },
  { id: "kiwi", n: "Kiwi", e: "🥝" }, { id: "stroberi", n: "Stroberi", e: "🍓" },
  { id: "pisang", n: "Pisang", e: "🍌" }, { id: "persik", n: "Persik", e: "🍑" },
];
const MAX = 3;
const byId = Object.fromEntries(FRUITS.map((f) => [f.id, f]));
const $ = (id) => document.getElementById(id);

let selected = [];
let proofBlob = null;
let orders = [];
let confirmingId = null;
let realtimeChannel = null;
const signedUrlCache = new Map(); // path -> {url, exp}

/* ---------- Reduced motion for bg video ---------- */
try {
  const bgVideo = $("bgVideo");
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (bgVideo) {
    if (mql.matches) { bgVideo.removeAttribute("autoplay"); bgVideo.pause(); }
    mql.addEventListener?.("change", (e) => {
      if (e.matches) bgVideo.pause(); else bgVideo.play().catch(() => {});
    });
  }
} catch {}

/* ---------- Config banner ---------- */
if (!hasSupabaseConfig) $("cfgBanner").hidden = false;

/* ---------- Tabs ---------- */
function showTab(t) {
  const dash = t === "dash";
  $("view-pesan").hidden = dash; $("view-dash").hidden = !dash;
  $("tab-pesan").setAttribute("aria-selected", String(!dash));
  $("tab-dash").setAttribute("aria-selected", String(dash));
}
$("tab-pesan").onclick = () => showTab("pesan");
$("tab-dash").onclick = () => showTab("dash");

/* ---------- Fruit grid ---------- */
function buildGrid() {
  const g = $("fruitGrid"); g.textContent = "";
  FRUITS.forEach((f) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "fruit"; b.dataset.id = f.id;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<span class="e">${f.e}</span><span class="n">${f.n}</span>`;
    b.onclick = () => toggleFruit(f.id);
    g.appendChild(b);
  });
}
function toggleFruit(id) {
  const i = selected.indexOf(id);
  if (i >= 0) selected.splice(i, 1);
  else if (selected.length >= MAX) { setMsg(`Maksimal ${MAX} buah dalam satu kotak.`, "err"); return; }
  else selected.push(id);
  setMsg("");
  refresh();
}
function renderSlots(el, list) {
  el.textContent = "";
  for (let i = 0; i < MAX; i++) {
    const f = list[i] ? byId[list[i]] : null;
    const s = document.createElement("div");
    s.className = "slot" + (f ? " filled" : "");
    s.innerHTML = f ? `<span class="e">${f.e}</span><span>${f.n}</span>` : "Kosong";
    el.appendChild(s);
  }
}
function refresh() {
  const full = selected.length >= MAX;
  document.querySelectorAll(".fruit").forEach((b) => {
    const on = selected.includes(b.dataset.id);
    b.setAttribute("aria-pressed", String(on));
    b.disabled = full && !on;
  });
  $("count").textContent = `(${selected.length}/${MAX})`;
  renderSlots($("slots"), selected);
  $("saveBtn").disabled = selected.length === 0;
  $("hint").textContent = selected.length === 0
    ? "Pilih sampai 3 buah untuk dicampur."
    : selected.length < MAX
    ? `Kamu bisa tambah ${MAX - selected.length} buah lagi.`
    : "Kotak penuh. Siap disimpan.";
}
function setMsg(t, k) { const m = $("msg"); m.textContent = t; m.className = "msg" + (k ? " " + k : ""); }
function setDashMsg(t, k) { const m = $("dashMsg"); if (!m) return; m.textContent = t; m.className = "msg" + (k ? " " + k : ""); }
function setLoginMsg(t, k) { const m = $("loginMsg"); m.textContent = t; m.className = "msg" + (k ? " " + k : ""); }

/* ---------- Bukti pembayaran (compress client-side) ---------- */
function compress(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1100;
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/jpeg", 0.78);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}
$("pickBtn").onclick = () => $("proofFile").click();
$("proofFile").onchange = async function () {
  const f = this.files?.[0]; if (!f) return;
  if (!f.type.startsWith("image/")) { setMsg("File harus berupa gambar.", "err"); this.value = ""; return; }
  try {
    proofBlob = await compress(f);
    $("previewImg").src = URL.createObjectURL(proofBlob);
    $("preview").classList.add("show");
    $("pickBtn").textContent = "✓ Screenshot terlampir"; $("pickBtn").classList.add("has");
    setMsg("");
  } catch {
    proofBlob = null;
    setMsg("Gambar tidak bisa dibaca. Coba screenshot lain.", "err");
  }
  this.value = "";
};
function clearProof() {
  proofBlob = null; $("previewImg").removeAttribute("src"); $("preview").classList.remove("show");
  $("pickBtn").textContent = "📎 Pilih screenshot"; $("pickBtn").classList.remove("has");
}
$("removeProof").onclick = () => { clearProof(); $("proofFile").click(); };

/* ---------- Signed URL untuk bukti bayar (hanya bisa diminta saat login) ---------- */
async function getSignedUrl(path) {
  const cached = signedUrlCache.get(path);
  if (cached && cached.exp > Date.now() + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from("bukti-bayar").createSignedUrl(path, 3600);
  if (error || !data) return null;
  signedUrlCache.set(path, { url: data.signedUrl, exp: Date.now() + 3600_000 });
  return data.signedUrl;
}

/* ---------- Lightbox ---------- */
function openLb(o, url) {
  $("lbCap").textContent = `${o.nama} · lantai ${o.lantai}`;
  $("lbImg").src = url; $("lbDl").href = url; $("lb").hidden = false;
}
$("lbClose").onclick = () => { $("lb").hidden = true; };
$("lb").onclick = (e) => { if (e.target === $("lb")) $("lb").hidden = true; };
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("lb").hidden = true; });

/* ---------- Save order (pembeli, tanpa login) ---------- */
$("saveBtn").onclick = async () => {
  const nama = $("nama").value.trim(), lantai = $("lantai").value.trim();
  if (!nama) { setMsg("Isi nama dulu.", "err"); $("nama").focus(); return; }
  if (!lantai) { setMsg("Isi nomor lantai dulu.", "err"); $("lantai").focus(); return; }
  if (!selected.length) { setMsg("Pilih minimal 1 buah.", "err"); return; }
  if (!proofBlob) { setMsg("Lampirkan screenshot bukti pembayaran dulu.", "err"); $("pickBtn").focus(); return; }
  if (!hasSupabaseConfig) { setMsg("Supabase belum terhubung. Isi .env lebih dulu.", "err"); return; }

  $("saveBtn").disabled = true;
  setMsg("Mengunggah bukti pembayaran...");
  try {
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error: upErr } = await supabase.storage.from("bukti-bayar").upload(path, proofBlob, {
      contentType: "image/jpeg", upsert: false,
    });
    if (upErr) throw upErr;

    const { error: insErr } = await supabase.from("orders").insert({
      nama, lantai, buah: selected.slice(), bukti_path: path, status: "baru",
    });
    if (insErr) throw insErr;

    $("doneText").textContent = `Atas nama ${nama}, lantai ${lantai}.`;
    renderSlots($("doneSlots"), selected);
    $("formPanel").hidden = true; $("boxPanel").hidden = true; $("donePanel").hidden = false;
    $("donePanel").scrollIntoView({ behavior: "smooth", block: "start" });
    setMsg("");
  } catch (e) {
    console.error(e);
    setMsg("Pesanan belum tersimpan. Periksa koneksi lalu coba lagi.", "err");
  } finally {
    $("saveBtn").disabled = selected.length === 0;
  }
};
$("againBtn").onclick = () => {
  selected = []; clearProof();
  $("formPanel").hidden = false; $("boxPanel").hidden = false; $("donePanel").hidden = true;
  setMsg(""); refresh(); window.scrollTo({ top: 0, behavior: "smooth" });
};

/* ---------- Login / logout (dashboard, khusus kamu) ---------- */
$("loginBtn").onclick = async () => {
  const email = $("loginEmail").value.trim();
  const password = $("loginPass").value;
  if (!email || !password) { setLoginMsg("Isi email dan password.", "err"); return; }
  $("loginBtn").disabled = true;
  setLoginMsg("Memeriksa...");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  $("loginBtn").disabled = false;
  if (error) { console.error(error); let msg = "Gagal masuk: " + error.message; if (/invalid login credentials/i.test(error.message)) msg = "Email atau password salah."; else if (/email not confirmed/i.test(error.message)) msg = "Akun belum dikonfirmasi di Supabase."; setLoginMsg(msg, "err"); return; }
  setLoginMsg("");
  $("loginPass").value = "";
};
$("logoutBtn").onclick = async () => {
  await supabase.auth.signOut();
};

function showLoggedOut() {
  $("loginPanel").hidden = false; $("dashPanel").hidden = true;
  if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
  orders = []; signedUrlCache.clear();
}
function showLoggedIn() {
  $("loginPanel").hidden = true; $("dashPanel").hidden = false;
  loadOrders();
  if (!realtimeChannel) {
    realtimeChannel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .subscribe();
  }
}

/* ---------- Dashboard ---------- */
function renderDash() {
  const body = $("rows"); body.textContent = "";
  orders.forEach((o) => {
    const tr = document.createElement("tr");
    const td = (t) => { const c = document.createElement("td"); if (t != null) c.textContent = t; tr.appendChild(c); return c; };

    td(new Date(o.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    td(o.nama); td(o.lantai);

    const bc = td(); const chips = document.createElement("div"); chips.className = "chips";
    (o.buah || []).forEach((id) => {
      const f = byId[id]; if (!f) return;
      const s = document.createElement("span"); s.className = "chip"; s.textContent = `${f.e} ${f.n}`;
      chips.appendChild(s);
    });
    bc.appendChild(chips);

    const pc = td();
    if (o.bukti_path) {
      const tb = document.createElement("button"); tb.type = "button"; tb.className = "thumb";
      tb.setAttribute("aria-label", `Lihat bukti bayar ${o.nama}`);
      const img = document.createElement("img"); img.alt = "";
      img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:7px;display:block;background:var(--bg)";
      tb.appendChild(img); pc.appendChild(tb);
      getSignedUrl(o.bukti_path).then((url) => {
        if (!url) return;
        img.src = url;
        tb.onclick = () => openLb(o, url);
      });
    } else {
      const nb = document.createElement("span"); nb.className = "noproof"; nb.textContent = "Belum ada"; pc.appendChild(nb);
    }

    const sc = td(); const sb = document.createElement("button"); sb.type = "button";
    sb.className = "st " + o.status; sb.textContent = o.status === "baru" ? "Baru" : "Selesai";
    sb.title = "Ubah status"; sb.onclick = () => toggleStatus(o); sc.appendChild(sb);

    const dc = td(); dc.className = "dcell";
    if (confirmingId === o.id) {
      const wrap = document.createElement("span"); wrap.className = "confirmRow";
      const yes = document.createElement("button"); yes.type = "button"; yes.className = "yes";
      yes.textContent = "Hapus"; yes.onclick = () => { confirmingId = null; removeOrder(o); };
      const no = document.createElement("button"); no.type = "button"; no.className = "no";
      no.textContent = "Batal"; no.onclick = () => { confirmingId = null; renderDash(); };
      wrap.append(yes, no); dc.appendChild(wrap);
    } else {
      const xb = document.createElement("button"); xb.type = "button"; xb.className = "x";
      xb.setAttribute("aria-label", `Hapus pesanan ${o.nama}`); xb.textContent = "✕";
      xb.onclick = () => { confirmingId = o.id; renderDash(); };
      dc.appendChild(xb);
    }
    body.appendChild(tr);
  });

  const done = orders.filter((o) => o.status === "selesai").length;
  $("sTotal").textContent = orders.length;
  $("sDone").textContent = done;
  $("sBaru").textContent = orders.length - done;
  $("empty").hidden = orders.length > 0;
  $("storeNote").textContent = hasSupabaseConfig ? "" : "Supabase belum terhubung — dashboard tidak akan menerima data.";
}

async function toggleStatus(o) {
  const next = o.status === "baru" ? "selesai" : "baru";
  const prev = o.status;
  o.status = next; renderDash();
  const { error } = await supabase.from("orders").update({ status: next }).eq("id", o.id);
  if (error) { o.status = prev; renderDash(); setDashMsg("Gagal mengubah status. Coba lagi.", "err"); }
}

async function removeOrder(o) {
  const idx = orders.indexOf(o);
  orders = orders.filter((x) => x !== o);
  renderDash(); // optimistic: langsung hilang
  const { error } = await supabase.from("orders").delete().eq("id", o.id);
  if (error) {
    if (idx >= 0) orders.splice(idx, 0, o); else orders.unshift(o);
    renderDash();
    setDashMsg("Pesanan gagal dihapus di server. Muncul lagi karena belum benar-benar terhapus.", "err");
  }
}

async function loadOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) { setDashMsg("Gagal memuat data pesanan dari server.", "err"); return; }
  orders = data || [];
  renderDash();
}

/* ---------- Init ---------- */
buildGrid();
refresh();

if (hasSupabaseConfig) {
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) showLoggedIn(); else showLoggedOut();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) showLoggedIn(); else showLoggedOut();
  });
} else {
  showLoggedOut();
}
