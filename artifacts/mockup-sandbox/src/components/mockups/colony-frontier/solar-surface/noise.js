export function hash2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
}
function smooth(t) {
    return t * t * (3 - 2 * t);
}
export function valueNoise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const tl = hash2(xi, yi);
    const tr = hash2(xi + 1, yi);
    const bl = hash2(xi, yi + 1);
    const br = hash2(xi + 1, yi + 1);
    const u = smooth(xf);
    const v = smooth(yf);
    const top = tl + (tr - tl) * u;
    const bottom = bl + (br - bl) * u;
    return top + (bottom - top) * v;
}
export function fbm(x, y, octaves = 5) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let max = 0;
    for (let i = 0; i < octaves; i += 1) {
        value += amplitude * valueNoise(x * frequency, y * frequency);
        max += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return value / max;
}
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
