/**
 * ScenarioInfoPanel — 4 ô read-only Bot-Bán-Hàng style:
 *  · Đường dẫn đến kịch bản (m.me/...?ref=f.<uuid>)
 *  · Liên kết giới thiệu     (cùng URL + .ref.{{client_id}})
 *  · ID của kịch bản          (uuid)
 *  · ID quảng cáo             (<FLOW>_<uuid>)
 *
 * @since 2026-06-01
 */
import CopyField from './CopyField.jsx';
import { buildScenarioLink, buildReferralLink, buildAdRefId } from '../lib/scenarioLinks.js';

export default function ScenarioInfoPanel({ linear }) {
	const scenarioLink = buildScenarioLink(linear);
	const referralLink = buildReferralLink(linear);
	const uuid         = linear?.trigger?.scenario_uuid || '';
	const adRef        = buildAdRefId(linear);

	return (
		<div className="aw-bg-white aw-border aw-border-slate-200 aw-rounded-lg aw-p-3">
			<CopyField
				label="Đường dẫn đến kịch bản"
				value={scenarioLink}
				openHref={scenarioLink}
				placeholder="Cần Instance ID + Lưu để sinh link"
			/>
			<CopyField
				label="Liên kết giới thiệu"
				value={referralLink}
				placeholder="Liên kết có gắn {{client_id}} để tracking"
			/>
			<CopyField
				label="ID của kịch bản"
				value={uuid}
				placeholder="Tự sinh khi Lưu kịch bản lần đầu"
				mono
			/>
			<CopyField
				label="ID quảng cáo (Facebook ref payload)"
				value={adRef}
				placeholder="<FLOW>_<uuid>"
				mono
			/>
		</div>
	);
}
