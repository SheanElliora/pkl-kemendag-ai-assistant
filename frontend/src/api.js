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

// ---- Format tanggal agar mudah dibaca ----

export function fmtDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}