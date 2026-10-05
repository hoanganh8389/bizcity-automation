/** Tiny nanoid replacement (no dep). */
const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function nanoid(n = 8) {
	let s = '';
	for (let i = 0; i < n; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
	return s;
}
