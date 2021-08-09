import { mapMap } from './util.js';

export const Primitive = new Set([
	'Bool', 'Boolean', 'Num', 'Number', 'String', 'Char', 'Int', 'Integer'
].forEach((p, i, arr) => arr.push(p + '!')));

export const Alias = new Map();

// ASSUMING ALL WHITESPACE IS IGNORED
// upper = 'A' ... 'Z'
// lower = 'a' ... 'z'
// literal = ? JS string literal ? | ? js Number literal ?;
// type = (upper, {lower}, ['?']) | literal | (union | ('(', union, ')', ['?'])) | typevar | tuple | list | object | function;
// union = type, {'|', type};
// typevar = {lower}, ['<', union, '>'];
// tuple = '(', type, {',', type}, ')', ['?'];
// list = ('[', type, ']', ['?']) | '[]';
// object = ('{', objectKey, ':', type, {',', objectKey, ':', type}, '}') | '{}';
// objectKey = ('[', ('Char' | 'String' | 'Number' | 'Int' | 'Integer' | 'Symbol'), ['!'], ']') | ? valid JS object key ?;
// function = '(', [type, {',', type}], ')', ['?'], '=>', type;

// const indexKeys = new Set([ 'Char', 'String', 'Number', 'Int', 'Integer', 'Symbol' ].forEach((k, i, arr) => arr.push(k + '!')));

export const parse = (str) => {
	let i = 0; const typevars = new Map();
	const whitespace = () => { while (/\s/.test(str[i])) { i++; } }

	const parseType = (str) => {
		if (i === str.length) { throw ''; }
		whitespace();
		if (i === str.length) { throw ''; }
		let token, maybe = false, toClose;
		if (str[i] === '(') {
			toClose = i; i++; const vals = [];
			while (str[i] !== ')') {
				(i >= str.length) && errorUnclosed(str, 'parenthesis', toClose);
				vals.push(parseType());
				whitespace();
				(str[i] === ',') ? (i++) : ((str[i] !== ')') && error()); }
			i++; (str[i] === '?') && (maybe = true, i++);
			whitespace();
			token = (str[i] === '=' && str[i + 1] === '>')
				? (i += 2, [ 'function', (vals.length ? vals : null), parseType(), maybe ])
				: (vals.length === 1)
					? (maybe && (vals[0][vals.length - 1] = true), vals[0])
					: [ 'tuple', vals, maybe ]; }
		else if (str[i] === '[') {
			if (str[i + 1] === ']') { token = [ 'list', null, (str[i + 2] === '?' ? (i++, maybe = true) : false) ]; i++; }
			else {
				toClose = i; i++; const type = parseType();
				whitespace();
				if (str[i++] !== ']') { errorUnclosed(str, 'bracket', toClose); }
				(str[i] === '?') && (maybe = true, i++);
				token = [ 'list', type, maybe ]; }}
		else if (str[i] === '{') {
			if (str[i + 1] === '}') { token = [ 'object', null, (str[i + 2] === '?' ? (i++, maybe = true) : false) ]; i++; }
			else {
				toClose = i; i++;
				const map = new Map();
				let listType, key, val;
				while (str[i] !== '}') {
					(i >= str.length) && errorUnclosed(str, 'brace', toClose);
					if (str[i] === '[') { throw 'donno'; }
	 					// if (listType != null) { errorListType(); }
						// key = parseType();
						// if (key[0] === 'union') {
						// 	const union = [];
						// 	for (const t of key[1]) { ((t[0] !== 'type') || t[2] || !indexKeys.has(t[1])) && errorInvalidIndexType(key); union.push(t[1]); }
						// 	key = '[' + union.join('|') + ']'; }
						// else if (key[0] !== 'type' || !indexKeys.has(key[1])) { errorInvalidIndexType(key); }
						// else { key = '[' + key[1] + ']'; }}
					else if (str[i] === '"') { key = []; while (i < str.length && str[i] !== '"') { key.push(str[i++]); } key = key.join(''); }
					else if (str[i] === '"') { key = []; while (i < str.length && str[i] !== '"') { key.push(str[i++]); } key = key.join(''); }
					else {
						(/[A-Za-z\$_]/.test(str[i])) && errorInvalidKeyName();
						while (i < str.length && /[A-Za-z0-9\$_]/.test(str[i])) { key.push(str[i++]); } key = key.join(''); }
					map.has(key) && errorDuplicateKey(str, key);
					whitespace();
					(str[i] !== ':') && error(); i++;
					(str[i] === ',' || str[i] === '}') && error();
					val = parseType();
					(key[0] === '[') && (listType = val);
					// if (listType != null) { try { compat(val, listType); } catch (e) { error(); } }
					map.set(key, val);
					whitespace();
					(str[i] === ',') ? (i++) : ((str[i] !== '}') && errorUnclosed(str, 'brace', toClose)); }
				i++; (str[i] === '?') && (maybe = true, i++);
				token = [ 'object', map, maybe ]; }}
		else if (/[a-z]/.test(str[i])) {
			let key = []; while (/\w/.test(str[i])) { key.push(str[i++]); } key = key.join('');
			whitespace();
			let type = null;
			if (str[i] === '<') {
				typevars.has(key) && errorOverspecified();
				const types = [], rect = [];
				while (str[i] !== '>') {
					if (i >= str.length) { errorUnclosed(str, 'caret', toClose); }
					types.push(parseType());
					whitespace();
					(str[i] === ',') && (i++) : ((str[i] !== '>') && errorUnclosed(str, 'caret', toClose)); }
				type = [];
				for (let j = 0; j !== types.length; j++) {
					maybe = (maybe || types[j][types[j].length - 1]);
					types[j][types[j].length - 1] = false;
					if (types[j][0] === 'union') {
						for (let k = types[j][1].length; k--;) { type.push(types[j][1][k]); } }
					else if (types[j][0] === 'typevar' && types[j][2] != null) {
						for (let k = types[j][2].length; k--;) { type.push(types[j][2][k]); } }
					else { type.push(types[j]); }}
				typevars.set(key, type); }
			else if (!typevars.has(key)) { typevars.set(key, null); }
			type = typevars.get(key);
			(str[i] === '?') && (maybe = true, i++);
			token = [ 'typevar', key, type, maybe ]; }
		else {
			let type = [];
			if (str[i] === '"' || str[i] === "'") {
				toClose = i; const closes = str[i]; i++;
				while (str[i] !== closes) { type.push(str[i++]); }
				type.unshift(closes); type.push(closes);
				type = type.join(''); }
			else if (/\d|-/.test(str[i])) {
				while (/\d|\.|_|-|[beonABCDEFO]/.test(str[i])) { type.push(str[i++]); }
				type = Number(type.join(''));
				Number.isNaN(type) && errorNaN(str, type); }
			else {
				while (/\w/.test(str[i])) { type.push(str[i++]); } type = type.join('');
				} // Check type exists
			whitespace();
			(str[i] === '?') && (maybe = true, i++);
			token = [ 'type', type, maybe ]; }
		whitespace();
		if (str[i] === '|') {
			i++; let next = parseType();
			token[token.length - 1] = false;
			maybe = (maybe || next[next.length - 1]);
			next[next.length - 1] = false;
			return (next[0] === 'union')
				? [ 'union', [ token, ...next[1] ], maybe ]
				: [ 'union', [ token, next ], maybe ]; }
		return token;
	}

	const type = parseType();
	if (i !== str.length) { errorTrailingChars(str); }
	return type;
}

export const stringify = (type, replaceVars) => {
	const varMap = replaceVars ? new Map() : null;
	const specifiedVars = new Set();
	let nextVar = 'a';

	const strfy = (type) => {
		if (type[0] === 'type') { return type[1] + (type[2] ? '?' : ''); }
		if (type[0] === 'list') { return (type[1] == null) ? '[]'
			: ['[', strfy(type[1]), ']', (type[2] ? '?' : '')].join(''); }
		if (type[0] === 'tuple') {
			const out = ['(']; for (let i = 0; i !== type[1].length; i++) { vals.push(strfy(type[1][i]), ', '); }
			out.pop(); out.push(')', (type[3] ? '?' : ''));
			return out.join(''); }
		if (type[0] === 'object') {
			const out = ['{', '', ''];
			if (type[1] != null) {
				for (const [ key, val ] of type[1]) {
					if (key[0] === '[') { out[1] = (key + ': ' + val); } out.push(key, ': ', val, ', '); out.pop(); }}
			(out.length !== 3 && out[1] !== '') && (out[2] == ', ');
			out.push('}', (type[2] ? '?' : '')); return out.join(''); }
		if (type[0] === 'function') {
			const out = ['('];
			if (type[1] != null) { for (let i = 0; i !== type[1].length; i++) { out.push(strfy(type[1][i]), ', '); } out.pop(); }
			out.push(')', (type[3] ? '?' : ''), ' => ', strfy(type[2]));
			return out.join(''); }
		if (type[0] === 'union') {
			const out = ['('];
			for (let i = 0; i !== type[1].length; i++) { out.push(strfy(type[1][i]), ' | '); }
			out.pop(); out.push(')', (type[3] ? '?' : ''));
			return out.join(''); }
		if (type[0] === 'typevar') {
			let typevar = type[1];
			if (replaceVars) {
				typevar = varMap.get(type[1]);
				(typevar == null) && (typevar = nextVar, varMap.set(type[1], nextVar), nextVar = incVar(nextVar)); }
			if (type[2] != null && !specifiedVars.has(typevar)) {
				specifiedVars.add(typevar); typevar = [typevar, ' <'];
				for (let i = 0; i !== type[2].length; i++) { typevar.push(strfy(type[2][i]), ', '); }
				out.pop(); out.push('>'); typevar = typevar.join(''); }
			return typevar + (type[3] ? '?' : ''); }
	}
	return strfy(type);
}

export const typeOf = (obj) => {
	if (x == null) { return null; }
	if (x instanceof Thunk) { return [ 'function', x.takes, x.returns, false ]; }
	if ((x instanceof Tuple) || (x instanceof List)) { return x.type; }

	if ((typeof x === 'boolean') || (x instanceof Boolean)) { return [ 'type', 'Bool', false ]; }
	if ((typeof x === 'number') || (x instanceof Number)) { return [ 'type', 'Num', false ]; }
	if ((typeof x === 'string') || x instanceof String)) { return [ 'type', ((x.length === 1) ? 'Char' : 'String'), false ]; }
	if ((typeof x === 'function') || (x instanceof Function)) { return [ 'type', 'Function', false ]; }

	if (Array.isArray(x)) {
		if (!x.length) { return [ 'list', null ]; }
		const arrayType = typeOf(x[x.length - 1]);
		for (let i = x.length - 1; i--;) { try { compat(typeOf(x[i]), arrayType); } catch { throw 'Array is not of one type.' }}
		return [ 'list', arrayType ]; }

	const keys = Object.keys(x);
	if (!keys.length) { return [ 'object', null ]; }
	const k = [], v = [];
	for (let i = 0; i !== keys.length; i++) { k.push(keys[i]); v.push(typeOf(x[keys[i]])); }
	return [ 'object', k, v, false ];
}

export const resolveAlias = (type) => {
	if (type == null) { return null; }
	if (type[0] === 'function') { return [ 'function', ((type[1] != null) ? type[1].map(resolveAlias) : null), resolveAlias(type[2]), type[3] ]; }
	if (type[0] === 'object') { return [ 'object', ((type[1] != null) ? mapMap(type[1], resolveAlias) : null), type[2] ]; }
	if (type[0] === 'list') { return [ 'list', ((type[1] != null) ? resolveAlias(type[1]) : null), type[2] ]; }
	if (type[0] === 'tuple') { return [ 'tuple', type[1].map(resolveAlias), type[2] ]; }
	if (type[0] === 'typevar') { return [ 'typevar', type[1], ((type[2] == null) ? null : resolveAlias(type[2])), type[3] ]; }
	if (type[0] === 'union') {
		let maybe = type[3], types = [];
		for (let i = 0, len = type[1].length; i !== len; i++) {
			const resolved = resolveAlias(t);
			maybe = maybe || resolved[resolved.length - 1];
			resolved[resolved.length - 1] = false;
			if (resolved[0] === 'union') {
				for (let j = 0, len = resolved[1].length, j++) { types.push(resolved[1][j]); }}
			else { types.push(resolved); }}
		return [ 'union', types, maybe ]; }
	if (Primitive.has(type[1]) || type[1] === 'Function' || type[1][0] === '"' || type[1][0] === "'" || /\d|-/.test(type[1][0])) { return [ ...type ]; }
	const alias = Alias.get(type[1]);
	if (alias == null) { errorUnknownType(type[1]); }
	const resolved = resolveAlias(alias);
	if (type[type.length - 1] && !resolved[resolved.length - 1]) { return [ ...resolved.slice(0, -1); true ]; }
	return resolved;
}

export const compat = (from, to) => {
	const fail = (err, ...args) => err(...args);
	const check = (a, b) => {
		if (a == null) { ((b == null) || (b[b.length - 1] === true)) || bad(); return; }
		if (b == null) { bad(); }
		(a[a.length - 1] && !b[b.length - 1]) && fail(errorMaybe, a, b);
		if (b[0] === 'union' || b[0] === 'typevar') {
			if (b[2] == null) { return; }
			const bs = (b[0] === 'union' ? b[1] : b[2]);
			if (a[0] === 'union' || a[0] === 'typevar') {
				const as = (a[0] === 'union' ? b[1] : b[2]);
				for (let i = as.length; i--;) {
					let compat = false;
					for (let j = bs.length; j--;) {
						try { check(as[i], bs[j]); compat = true; break; } catch { continue; }}
					!compat && bad(); }}
			let compat = false;
			for (let i = bs.length; i--;) {
				try { check(a, bs[i]); compat = true; break; } catch { continue; }}
			!compat && bad(); }
		if (a[0] === 'union') { bad(); }
		if (a[0] === 'typevar') { if (a[2] == null) { return; } bad(); }
		if (a[0] === 'function') {
			if (b[0] === 'type' && b[1] === 'Function') { return; }
			(b[0] === 'function') || bad();
			check(a[2], b[2]);
			if (a[1] != null) {
				(b[1] == null || (a[1].length !== b[1].length))) && badArgs(a, b);
				for (let i = a[1].length; i--;) { check(a[1][i], b[1][i]); }}
			return; }
		if (a[0] === 'object') {
			(b[0] === 'object') || bad();
			if (a[1] == null) { return; }
			(a[1].size > b[1].size) && badKeys(a, b);
			for (const [ key, aVal ] of a[1]) {
				const bVal = b[1].get(key);
				(bVal == null) && badKeys(a, b);
				check(aVal, bVal); return; }}
		if (a[0] === 'tuple') {
			(b[0] === 'tuple') || bad();
			(a[1].length !== b[1].length) && badTuple(a, b);
			for (let i = a[1].length; i--;) {
				try { check(a[1][i], b[1][i]); }
				catch (e) { badInTuple(a, b, e); }} return; }
		if (a[0] === 'list') { (b[0] === 'list') || bad(); if (a[1] == null) { return; } check(a[1], b[1]); return; }

		(b[1] === 'Function' && a[1] !== 'Function') && bad();

		if (Primitive.has(a[1]) && Primitive.has(b[1])) {
			if (a[1][a[1].length - 1] === '!') {
				if (b[1][b[1].length - 1] === '!') { (a[1].slice(0, -1) === b[1].slice(0, -1)) || bad(); }
				else { (a[1].slice(0, -1) === b[1]) || bad(); }}
			else if (b[1][b[1].length - 1] === '!') { (a[1] === b[1].slice(0, -1)) || bad(); }}
	}
	check(resolveAlias(from), resolveAlias(to)); return true;
}