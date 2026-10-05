/**
 * Boot data injected by PHP via `window.BIZCITY_AUTOMATION_BOOT`.
 * Provides a safe default so vite-dev (no PHP) doesn't crash.
 */
export const BOOT = (typeof window !== 'undefined' && window.BIZCITY_AUTOMATION_BOOT) || {
	restUrl:   '/wp-json/bizcity-automation/v1/',
	restNonce: '',
	menuSlug:  'bizcity-automation',
	adminUrl:  '#',
	version:   'dev',
	caps:      { manage: true },
	blockPaths: [],
};
