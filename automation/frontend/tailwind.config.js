/** @type {import('tailwindcss').Config} */
export default {
	// Scope every utility under #bizcity-automation-root with prefix `aw-`
	// to prevent collision with wp-admin global styles.
	prefix: 'aw-',
	important: '#bizcity-automation-root',
	content: ['./src/**/*.{js,jsx}', './index.html'],
	theme: {
		extend: {
			colors: {
				brand: {
					DEFAULT: '#4f46e5', // indigo-600
					soft:    '#eef2ff', // indigo-50
				},
			},
		},
	},
	plugins: [],
};
