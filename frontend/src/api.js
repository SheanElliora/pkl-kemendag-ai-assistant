// Helper fetch yang otomatis menyertakan JWT jika sudah login.
export async function api(path, { method = "GET", headers = {}, body } = {}) {

  const token = localStorage.getItem("cms_token");

  const h = { ...headers };

  if (token) {
    h.Authorization = "Bearer " + token;
  }

  if (body !== undefined && !(body instanceof FormData)) {
    h["Content-Type"] = "application/json";
  }

  const res = await fetch(path, {
    method,
    headers: h,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    // tidak ada body JSON
  }

  if (!res.ok) {
    // 401 = token tidak valid/sesi habis -> bersihkan sesi dan tandai
    // agar halaman login bisa menampilkan pesan "sesi berakhir".
    if (res.status === 401) {
      clearSession();
      localStorage.setItem("cms_session_expired", "1");
    }
    const err = new Error(data.error || "Permintaan gagal");
    err.status = res.status;
    throw err;
  }

  return data;
}

// ---- Sesimpan sesi login di localStorage ----

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("cms_user"));
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  localStorage.setItem("cms_token", token);
  localStorage.setItem("cms_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("cms_token");
  localStorage.removeItem("cms_user");
}

// ---- Buka PDF (dengan token) di tab baru ----

export async function openPdf(path) {
  const token = localStorage.getItem("cms_token");
  const res = await fetch(path, {
    headers: token ? { Authorization: "Bearer " + token } : {}
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      localStorage.setItem("cms_session_expired", "1");
    }
    let msg = "Gagal memuat dokumen";
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {
      // abaikan
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ---- Format tanggal agar mudah dibaca ----

export function fmtDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}