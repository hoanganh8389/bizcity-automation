/**
 * Scenario deep-link helpers — m.me / zalo.me / t.me + ad ref encoding.
 * @since 2026-06-01
 */
import { triggerDefByKey } from './scenarioSchema.js';

/** Generate a UUID-ish stable id for a scenario (works in PS/old browsers). */
export function generateScenarioUuid() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID().replace(/-/g, '');
	}
	// Fallback (not crypto-strong but stable enough as a ref).
	return 'sc' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ensureScenarioUuid(linear) {
	if (linear?.trigger?.scenario_uuid) return linear;
	return {
		...linear,
		trigger: { ...(linear?.trigger || {}), scenario_uuid: generateScenarioUuid() },
	};
}

/**
 * Build the public deep-link tied to (platform, instance_id, scenario_uuid).
 * Returns '' if any piece missing.
 */
export function buildScenarioLink(linear) {
	const uuid = linear?.trigger?.scenario_uuid;
	const inst = linear?.trigger?.instance_id;
	const def  = triggerDefByKey(linear?.trigger?.key);
	if (!uuid || !inst || !def) return '';
	switch (def.platform) {
		case 'FACEBOOK':
			return `https://m.me/${inst}?ref=f.${uuid}`;
		case 'ZALO_BOT':
			return `https://zalo.me/${inst}?ref=z.${uuid}`;
		case 'TELEGRAM':
			return `https://t.me/${inst}?start=t_${uuid}`;
		default:
			return '';
	}
}

/** Same as scenario link but with a `{{client_id}}` placeholder appended for sharing. */
export function buildReferralLink(linear) {
	const base = buildScenarioLink(linear);
	if (!base) return '';
	// Append a stable suffix that downstream tracker can split on.
	return base + '.ref.{{client_id}}';
}

/** FB ad payload reference id — Bot-Bán-Hàng style "<FLOW>_<uuid>". */
export function buildAdRefId(linear) {
	const uuid = linear?.trigger?.scenario_uuid;
	return uuid ? `<FLOW>_${uuid}` : '';
}

/**
 * QR image endpoint — server-side wrapper trên bizcity.vn (proxy api.qrserver.com).
 * Vì sao bizcity.vn? Để giữ R-GW-8 (client standalone), nhánh #12 catalog.
 * Endpoint chuẩn: https://bizcity.vn/create-qr-code/?size=NxN&data=<urlencoded>
 */
export function qrImageUrl(text, size = 320) {
	if (!text) return '';
	const t = encodeURIComponent(text);
	return `https://bizcity.vn/create-qr-code/?size=${size}x${size}&data=${t}`;
}

/** Copy helper that returns a Promise<boolean>. */
export async function copyToClipboard(text) {
	try {
		await navigator.clipboard.writeText(String(text || ''));
		return true;
	} catch (_) {
		return false;
	}
}
