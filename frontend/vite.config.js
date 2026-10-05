import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: { '@': path.resolve(__dirname, 'src') },
	},
	build: {
		outDir: path.resolve(__dirname, '../assets/dist'),
		emptyOutDir: true,
		cssCodeSplit: false,
		sourcemap: false,
		rollupOptions: {
			input: path.resolve(__dirname, 'src/main.jsx'),
			output: {
				format: 'iife',
				entryFileNames: 'automation-app.js',
				assetFileNames: (asset) =>
					asset.name && asset.name.endsWith('.css')
						? 'automation-app.css'
						: 'assets/[name][extname]',
				inlineDynamicImports: true,
			},
		},
	},
});
