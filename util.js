const abc = 'abcdefghijklmnopqrstuvwxyz';
export const repeat = (num, val) => { const out = []; while (num) { out[num--] = val; } return out; }
export const incVar = (v) => !v ? 'a' : (v[v.length - 1] === 'z') ? repeat(v.length, 'a').join('') : (v.slice(0, -1) + abc[abc.indexOf(v[v.length - 1]) + 1]);

export const mapMap = (map, fn) => {
	const out = new Map();
	for (const [ key, val ] of map) { out.set(key, fn(val)); }
	return out;
}
