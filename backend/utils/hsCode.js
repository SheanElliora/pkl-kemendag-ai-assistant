const HS_BARE = /\b\d{6,10}\b/g;
const HS_DOTTED = /\b\d{4}(?:\.\d{2}){1,2}\b/g;

function toDigits(value) {
    return String(value || "").replace(/\D/g, "");
}

export function extractHsCodes(text) {
    const source = String(text || "");
    const found = [];
    for (const m of source.match(HS_DOTTED) || []) {
        const d = toDigits(m);
        if (d.length >= 6) found.push(d);
    }
    for (const m of source.match(HS_BARE) || []) {
        if (m.length >= 6) found.push(m);
    }
    return [...new Set(found)];
}

export function hsMatchForms(code) {
    const d = toDigits(code);
    if (d.length < 6) return [];
    const forms = [d];
    forms.push(d.slice(0, 4) + "." + d.slice(4, 6));
    if (d.length >= 8) {
        forms.push(d.slice(0, 4) + "." + d.slice(4, 6) + "." + d.slice(6, 8));
    }
    if (d.length >= 4) {
        forms.push(d.slice(0, 4) + "." + d.slice(0, 2));
    }
    return [...new Set(forms)];
}

export function hsQueryHint(text) {
    const codes = extractHsCodes(text);
    if (codes.length === 0) return "";
    const forms = codes.flatMap(hsMatchForms);
    return [...new Set(forms)].join(" ");
}

export function expandHsTokens(tokens) {
    const extra = [];
    for (const token of tokens) {
        if (!/^\d{6,10}$/.test(token)) continue;
        const forms = hsMatchForms(token);
        for (const form of forms) {
            for (const part of form.split(/[^a-z0-9]+/)) {
                if (part && part !== token) extra.push(part);
            }
        }
        extra.push(token);
    }
    return [...new Set([...tokens, ...extra])];
}

export function docHasHsCode(lowerDoc, code) {
    const forms = hsMatchForms(code);
    return forms.some((form) => String(lowerDoc || "").includes(form));
}
