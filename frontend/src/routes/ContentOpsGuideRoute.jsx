import { BookOpen, CalendarDays, CheckCircle2, Image, Megaphone, Newspaper, Search, Settings2, Zap } from 'lucide-react';

const groups = [
	{
		icon: CalendarDays,
		title: 'Đăng content hằng ngày',
		desc: 'Các workflow chạy theo lịch để duy trì nhịp nội dung Facebook, WordPress và Zalo.',
		items: [
			['[content ops] Web Research → Script Zalo (Cron 8h)', '08:00 mỗi ngày', 'Tìm xu hướng web nhanh, tóm tắt thành script ngắn rồi gửi Zalo Bot.'],
			['[content ops] Notebook → Bài FB hàng ngày (Cron 8h)', '08:00 mỗi ngày', 'Lấy tri thức từ Notebook/Guru, soạn bài Facebook theo phong cách thương hiệu.'],
			['[content ops] Notebook → Bài WP hàng ngày (Cron 9h, Draft)', '09:00 mỗi ngày', 'Soạn bài blog từ Notebook và tạo WordPress draft để duyệt.'],
			['[content ops] Đăng FB hàng ngày 08:00 (Cron + LLM)', '08:00 mỗi ngày', 'Tìm chủ đề từ KG, soạn caption Facebook buổi sáng và đăng page.'],
			['[content ops] Đăng FB hàng ngày 09:00 (Cron + LLM)', '09:00 mỗi ngày', 'Soạn bài Facebook giờ vàng, nhấn vào sản phẩm/dịch vụ và CTA.'],
			['[content ops] Đăng FB hàng ngày 10:00 (Cron + LLM)', '10:00 mỗi ngày', 'Soạn bài chia sẻ tips/kiến thức để tăng tương tác.'],
		],
	},
	{
		icon: Image,
		title: 'Content có ảnh AI',
		desc: 'Các workflow tạo ảnh minh họa, featured image và bài đăng có media.',
		items: [
			['[content ops] Tạo Ảnh AI On-demand (@tạo ảnh)', 'Zalo command', 'Tạo ảnh AI từ mô tả và gửi link ảnh qua Zalo.'],
			['[content ops] Đăng FB On-demand + Ảnh Auto (@đăng fb)', 'Zalo command', 'Soạn caption, tạo ảnh minh họa, đăng Facebook Page.'],
			['[content ops] Đăng WP On-demand + Ảnh Auto (@đăng web)', 'Zalo command', 'Research web, soạn bài blog, tạo featured image, tạo WP draft.'],
			['[content ops] Đăng FB Hàng Ngày 08:00 + Ảnh Auto (Cron)', '08:00 mỗi ngày', 'Tự soạn caption FB, tạo ảnh minh họa, đăng page kèm ảnh.'],
			['[content ops] Đăng WP Hàng Ngày 09:00 + Ảnh Auto (Cron, Draft)', '09:00 mỗi ngày', 'Tìm xu hướng, viết bài blog, tạo ảnh featured, lưu draft WordPress.'],
		],
	},
	{
		icon: Search,
		title: 'Xu hướng, news và marketing intelligence',
		desc: 'Các workflow dùng để nghiên cứu insight, trend, nguồn tham khảo và cơ hội nội dung.',
		items: [
			['[content ops] Xu Hướng + Link Đọc Thêm → Zalo (Cron 9h)', '09:00 mỗi ngày', 'Tìm trend web/Reddit/TikTok, gửi phân tích và link đọc thêm qua Zalo.'],
			['[content ops] Đọc Báo On-demand + Link → Zalo (@news)', 'Zalo @news', 'Tìm tin theo chủ đề, tổng hợp nguồn và gửi link đọc thêm.'],
			['[content ops] Xu Hướng Hàng Ngày → Zalo (4 tin)', '09:00 mỗi ngày', 'Gửi 4 phần: nghiên cứu, nguồn, phân tích, kết luận.'],
			['[content ops] Trending On-demand qua Zalo (@trending)', 'Zalo @trending', 'Người dùng hỏi trend bất kỳ, bot trả báo cáo compact và nguồn tham khảo.'],
			['[content ops] Xu hướng hôm nay qua Zalo (từ khoá VN)', 'Keyword contains', 'Bot tự bắt keyword tiếng Việt và trả 4 tin xu hướng.'],
		],
	},
	{
		icon: Megaphone,
		title: 'Ra lệnh Zalo vừa tạo',
		desc: 'Hai workflow thao tác nhanh để đội content ra lệnh bằng Zalo và nhận kết quả ngay.',
		items: [
			['[content ops] Ra lệnh Zalo: Đăng FB theo chủ đề', 'đăng fb / post fb', 'AI trích chủ đề, soạn caption, tạo ảnh, tạo WP draft KPI và đăng Facebook.'],
			['[content ops] Ra lệnh Zalo: Đăng Web theo chủ đề', 'đăng web / viết bài', 'AI viết bài blog, tạo ảnh featured, tạo WP draft và gửi link sửa/xem.'],
		],
	},
];

const quickPick = [
	['Đăng bài Facebook mỗi ngày', 'Chọn template có “Đăng FB hàng ngày” hoặc “Daily FB”.'],
	['Đăng bài WordPress mỗi ngày', 'Chọn template có “Bài WP”, “Đăng WP”, “Draft”.'],
	['Ra lệnh trực tiếp từ Zalo', 'Chọn template có “On-demand”, “@đăng fb”, “@đăng web”, “Ra lệnh Zalo”.'],
	['Cần tạo ảnh AI kèm bài viết', 'Chọn template có “Ảnh Auto”, “Tạo Ảnh AI”, “featured image”.'],
	['Cần theo dõi xu hướng', 'Chọn template có “Xu Hướng”, “Trending”, “Đọc Báo”, “News”.'],
];

const setupCards = [
	['Zalo Bot', 'Chọn instance_id, kiểm tra keywords, dùng keyword_start cho lệnh ở đầu câu và keyword_contains cho câu có chứa từ khóa.'],
	['Facebook Page', 'Điền fb_page_id, giữ content là {{gen.content}} hoặc {{gen.output}}, kiểm tra permalink sau khi đăng.'],
	['WordPress Post', 'Giai đoạn đào tạo nên để status=draft, giữ content={{gen.content}}, chỉ publish tự động khi đã có quy trình duyệt.'],
	['Notebook / KG / Guru', 'Dùng làm nguồn tri thức và persona viết bài; không dùng làm nơi lưu cấu hình workflow.'],
	['Tạo Ảnh AI', 'Dùng 1024x1024 cho social post, 1536x1024 cho featured image, thêm NO text nếu không muốn ảnh có chữ.'],
];

const testFlows = [
	['Đăng FB qua Zalo', 'đăng fb chủ đề ưu đãi combo chăm sóc khách hàng cuối tuần', 'Có preview caption, ảnh AI, WP draft KPI, bài Facebook và link trả về Zalo.'],
	['Đăng Web qua Zalo', 'đăng web cách bảo trì thiết bị công nghiệp đúng cách', 'Có preview bài viết, featured image, WordPress draft và link sửa/xem.'],
	['Trending on-demand', '@trending xu hướng bán hàng B2B tại Việt Nam tháng này', 'Có báo cáo compact, nguồn tham khảo và insight cho marketing.'],
	['News on-demand', '@news thị trường bán lẻ Việt Nam', 'Có tổng hợp tin, nguồn và link đọc thêm.'],
];

const checklist = [
	'Template có prefix [content ops] và đúng mục đích.',
	'Workflow đã import thành công.',
	'Zalo Bot đã kết nối và bắt đúng từ khóa.',
	'Facebook Page đã cấu hình fb_page_id nếu có đăng FB.',
	'WordPress post đang để draft nếu cần duyệt.',
	'Notebook/KG/Guru đã gắn đúng nếu cần theo brand.',
	'Node tạo ảnh AI đã test có image_url.',
	'Zalo reply trả kết quả rõ ràng cho người vận hành.',
	'Đã test ít nhất 1 lần bằng dữ liệu giả lập.',
];

export default function ContentOpsGuideRoute() {
	return (
		<div className="aw-guide-root">
			<header className="aw-guide-hero">
				<div>
					<div className="aw-guide-kicker"><BookOpen size={15} /> Content Ops Automation Training</div>
					<h1>Hướng dẫn kịch bản content, xu hướng và marketing</h1>
					<p>
						Tìm template bằng prefix <strong>[content ops]</strong>, import về workflow, cấu hình kênh gửi và test đầu ra trước khi bật chạy thật.
					</p>
				</div>
				<div className="aw-guide-hero-card">
					<span>18</span>
					<small>template Content Ops</small>
					<code>core/automation/docs/CONTENT-OPS-AUTOMATION-TRAINING.md</code>
				</div>
			</header>

			<section className="aw-guide-grid">
				{groups.map(({ icon: Icon, title, desc, items }) => (
					<article className="aw-guide-section" key={title}>
						<div className="aw-guide-section-head">
							<span><Icon size={18} /></span>
							<div>
								<h2>{title}</h2>
								<p>{desc}</p>
							</div>
						</div>
						<div className="aw-guide-template-list">
							{items.map(([name, trigger, purpose]) => (
								<div className="aw-guide-template" key={name}>
									<div>
										<strong>{name}</strong>
										<p>{purpose}</p>
									</div>
									<small>{trigger}</small>
								</div>
							))}
						</div>
					</article>
				))}
			</section>

			<section className="aw-guide-two-col">
				<article className="aw-guide-panel">
					<h2><Zap size={18} /> Cách chọn nhanh</h2>
					{quickPick.map(([need, pick]) => (
						<div className="aw-guide-row" key={need}>
							<strong>{need}</strong>
							<p>{pick}</p>
						</div>
					))}
				</article>

				<article className="aw-guide-panel">
					<h2><Settings2 size={18} /> Node cần cấu hình</h2>
					{setupCards.map(([title, body]) => (
						<div className="aw-guide-row" key={title}>
							<strong>{title}</strong>
							<p>{body}</p>
						</div>
					))}
				</article>
			</section>

			<section className="aw-guide-two-col">
				<article className="aw-guide-panel">
					<h2><Newspaper size={18} /> Tin nhắn test mẫu</h2>
					{testFlows.map(([name, input, expected]) => (
						<div className="aw-guide-test" key={name}>
							<strong>{name}</strong>
							<code>{input}</code>
							<p>{expected}</p>
						</div>
					))}
				</article>

				<article className="aw-guide-panel">
					<h2><CheckCircle2 size={18} /> Checklist go-live</h2>
					<ul className="aw-guide-checklist">
						{checklist.map((item) => <li key={item}>{item}</li>)}
					</ul>
				</article>
			</section>
		</div>
	);
}
