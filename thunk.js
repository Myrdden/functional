import { incVar } from './util.js';
import { Primitive, compat, typeOf } from './types.js'

const compose = (left, right) => {
	const from = right.returns, to = left.takes[0];
	compat(from, to);

	let returnVar = false, takesVar;
	if (to[0] === 'typevar') {
		takesVar = (from[0] === 'typevar')
			? (returnVar = true, from[2]) : (from[0] === 'union')
				? from[1] : from; }

	const takes = []; let src = right.takes;
	const varMap = new Map(); nextVar = 'a';
	for (let i = 0; i !== src.length; i++) {
		if (src[i][0] === 'typevar') {
			let mapped = varMap.get(src[i][1]);
			if (mapped == null) {
				mapped = [ 'typevar', nextVar, src[i][2], src[i][3] ];
				varMap.set(src[i][1], mapped);
				nextVar = incVar(nextVar); }
			takes.push(mapped); }}

	if (takesVar) {
		if (returnVar) {
			let mapped = varMap.get(from[1]);
			if (mapped == null) { mapped = nextVar; nextVar = incVar(nextVar); }
			takesVar = [ 'typevar', mapped, takesVar, false ]; }
		else { takesVar = [ 'typevar', nextVar, takesVar, false ]; nextVar = incVar(nextVar); }
		varMap.clear();
		varMap.add(to[1], takesVar); }
	else { varMap.clear(); }

	src = left.takes;
	for (let i = 1; i < src.length; i++) {
		if (src[i][0] === 'typevar') {
			let mapped = varMap.get(src[i][1]);
			if (mapped == null) {
				mapped = [ 'typevar', nextVar, src[i][2], src[i][3] ];
				varMap.set(src[i][1], mapped);
				nextVar = incVar(nextVar); }
			takes.push(mapped); }}

	let returns = left.returns;
	if (returns[0] === 'typevar') {
		let mapped = varMap.get(returns[1]);
		returns = (mapped == null)
			? [ 'typevar', nextVar, returns[2], returns[3] ]
			: [ 'typevar', mapped[1], mapped[2], returns[3] ] }

	if (Array.isArray(right.fn)) {
		if (right.args != null && (right.args.length > 1 || right.args[0].length)) {
			return ((left.args != null && (left.args.length > 1 || left.args[0].length)) || !Array.isArray(left.fn))
				? new Thunk([right, left], takes, returns, [right.takes.length, left.takes.length - 1])
				: new Thunk([right, ...left.fn], takes, returns, [right.takes.length, (left.argNums[0] - 1), ...left.argNums.slice(1)]); }
		return ((left.args != null && (left.args.length > 1 || left.args[0].length)) || !Array.isArray(left.fn))
			? new Thunk([...right.fn, left], takes, returns, [...right.argNums, left.takes.length - 1])
			: new Thunk([...right.fn, ...left.fn], takes, returns, [...right.argNums, (left.argNums[0] - 1), ...left.argNums.slice(1)]); }
	return ((left.args != null && (left.args.length > 1 || left.args[0].length)) || !Array.isArray(left.fn))
		? new Thunk([right, left], takes, returns, [right.takes.length, left.takes.length - 1])
		: new Thunk([right, ...left.fn], takes, returns, [right.takes.length, (left.argNums[0] - 1), ...left.argNums.slice(1)]);
}

const coerce = (obj, type) => {
	(type[type.length - 1] === '!') && (type = type.slice(0, -1));
	if ((typeof obj === 'boolean') || (obj instanceof Boolean)) {
		if (type === 'Char') { return (obj === true ? '1' : '0'); }
		if (type === 'String') { return (obj === true ? 'true' : 'false'); }
		if (type === 'Num' || type === 'Number' || type === 'Int' || type === 'Integer') { return (obj === true ? 1 : 0); }}
	else if ((typeof obj === 'number') || (obj instanceof Number)) {
		if (type === 'Bool' || type === 'Boolean') { return Boolean(obj); }
		if (type === 'Char') { return (obj <= 0 && obj <= 9) ? obj.toString() : String.fromCharCode(obj); }
		if (type === 'String') { return obj.toString(); }
		if (type === 'Int' || type === 'Integer') { return Math.round(obj); }}
	else if ((typeof obj === 'string') || (obj instanceof String)) {
		if (type === 'Bool' || type === 'Boolean') { return Boolean(obj); }
		if (obj.length === 1) {
			if (type === 'Num' || type === 'Number' || type === 'Int' || type === 'Integer') {
				return /\d/.test(obj) ? Number(obj) : obj.charCodeAt(0); }}
		else {
			if (type === 'Char') { return obj[0]; }
			if (type === 'Num' || type === 'Number') { return Number(obj); }
			if (type === 'Int' || type === 'Integer') { return Math.round(Number(obj)); }}}
	return obj;
}

const resolve = (thunk, args) => {

}

const Reserved = new Set([
	'call', 'apply'
]);

const ThunkHandler = {
	get: (thunk, prop) => {
		if (prop === 'call' || prop === 'apply') { return Reflect.get(thunk, prop); }
		if (prop instanceof Thunk) { return compose(thunk, prop); }
		if (typeof prop !== 'string') { throw (prop + ' is not composable.'); }
	}
	getPrototypeOf: () => Thunk.prototype,
	set: () => false,
	deleteProperty: () => false
}

function Thunk (fn, takes, returns, argNums, args) {
	this.fn = fn; this.takes = takes; this.returns = returns;
	this.argNums = argNums || takes.length;
	this.args = args;

	const Thunk = (...args) => {
		let toApply, futureArgs;
		if (args.length > this.takes.length) {
			toApply = args.slice(0, this.takes.length - 1);
			futureArgs = args.slice(this.takes.length); }
		else { toApply = args; }
		let tail = this.args.length - 1;
		const applied = (this.args == null) ? [[]] : (this.args[tail].length === this.argNums[tail])
			?	([...this.args, []], tail++)
			: (this.args.length === 1)
				? [this.args[tail].slice(0)]
				: [...this.args.slice(0, -1), this.args[tail].slice(0)];
		else { toApply = args; }
		let applying, type;
		for (let i = 0; i !== toApply.length; i++) {
			applying = toApply[i], type = typeOf(applying);
			compat(type, this.takes[i]);
			if (Primitive.has(type)) { applying = coerce(applying, this.takes[i]); }
			else if (Array.isArray(applying)) { applying = [...applying]; }
			else { applying = Object.assign({}, applying); }
			const tailArgs = applied[tail];
			const tailLen = this.argNums[tail];
			if (tailArgs.length === tailLen) {
				applied.push([applying]); tail++; }
			else { tailArgs.push(applying); }}
		if (futureArgs != null) { return resolve(this, applied)(futureArgs); }
		if (toApply === this.takes.length) { return resolve(this, applied); }
		return new Thunk(this.fn, this.takes.slice(toApply.length), this.returns, this.argNums, applied);
	}

	return new Proxy(Thunk, ThunkHandler);
}