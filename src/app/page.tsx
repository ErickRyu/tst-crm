export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-[#f0f0f0] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="material-icons text-[20px]">hub</span>
            <span className="text-[15px] font-bold tracking-tight">TST CRM</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/crm"
              className="rounded-lg border border-[#e5e5e5] bg-white px-4 py-2 text-[13px] font-medium text-[#0f172a] transition hover:border-[#ccc] hover:bg-[#fafafa]"
            >
              로그인
            </a>
            <a
              href="/crm"
              className="rounded-lg bg-[#0f172a] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-[#1e293b]"
            >
              무료로 시작하기
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pb-6 pt-24 text-center">
        <div className="mx-auto max-w-[1200px] px-6">
          <a
            href="/crm"
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-[#fafafa] px-4 py-1.5 text-[13px] text-[#666] transition hover:border-[#ccc]"
          >
            치과 마케팅을 위한 CRM
            <span className="material-icons text-[14px]">arrow_forward</span>
          </a>
          <h1 className="mx-auto mb-6 max-w-3xl text-[clamp(36px,5.5vw,72px)] font-bold leading-[1.05] tracking-[-0.03em]">
            상담 관리의
            <br />
            새로운 기준.
          </h1>
          <p className="mx-auto mb-10 max-w-lg text-[16px] leading-relaxed text-[#888]">
            신규 인입부터 예약 완료까지. 칸반 보드, 자동 SMS, 메모 이력을 하나의 대시보드에서 관리하세요.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href="/crm"
              className="rounded-lg bg-[#0f172a] px-6 py-3 text-[14px] font-medium text-white transition hover:bg-[#1e293b]"
            >
              무료로 시작하기
            </a>
            <a
              href="/crm"
              className="rounded-lg border border-[#e5e5e5] bg-white px-6 py-3 text-[14px] font-medium text-[#0f172a] transition hover:border-[#ccc] hover:bg-[#fafafa]"
            >
              대시보드 보기
            </a>
          </div>
        </div>
      </section>

      {/* ── Product Preview ── */}
      <section className="pb-32 pt-16">
        <div className="mx-auto max-w-[1100px] px-6">
          <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-[#fafafa] shadow-[0_20px_80px_rgba(0,0,0,0.06)]">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-[#eee] bg-white px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <div className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="ml-4 flex-1 rounded-md bg-[#f5f5f5] px-3 py-1 text-center text-[11px] text-[#999]">
                tst-crm.vercel.app/crm
              </div>
            </div>
            {/* Kanban content */}
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-icons text-[18px] text-[#999]">view_kanban</span>
                  <span className="text-[13px] font-semibold">칸반 보드</span>
                  <span className="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[11px] text-[#888]">실시간</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#f0f0f0] px-2 py-1 text-[11px] text-[#888]">
                    <span className="material-icons text-[12px]">search</span>
                  </span>
                  <span className="rounded-md bg-[#f0f0f0] px-2 py-1 text-[11px] text-[#888]">
                    <span className="material-icons text-[12px]">filter_list</span>
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {[
                  { label: "신규인입", color: "#3b82f6", count: 12, items: [
                    { name: "김OO", desc: "임플란트 문의", time: "2분 전" },
                    { name: "이OO", desc: "교정 상담", time: "8분 전" },
                  ]},
                  { label: "응대중", color: "#f59e0b", count: 8, items: [
                    { name: "박OO", desc: "통화 완료", time: "15분 전" },
                    { name: "정OO", desc: "콜백 예정", time: "1시간 전" },
                  ]},
                  { label: "상담완료", color: "#8b5cf6", count: 5, items: [
                    { name: "최OO", desc: "견적 전달", time: "30분 전" },
                  ]},
                  { label: "예약완료", color: "#10b981", count: 15, items: [
                    { name: "한OO", desc: "3/7 14:00", time: "오늘" },
                    { name: "윤OO", desc: "3/8 10:30", time: "내일" },
                  ]},
                  { label: "내원완료", color: "#06b6d4", count: 23, items: [
                    { name: "서OO", desc: "수납 완료", time: "어제" },
                  ]},
                ].map((col) => (
                  <div key={col.label}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />
                        <span className="text-[11px] font-semibold text-[#555]">{col.label}</span>
                      </div>
                      <span className="text-[10px] text-[#bbb]">{col.count}</span>
                    </div>
                    <div className="space-y-1.5">
                      {col.items.map((item) => (
                        <div key={item.name} className="rounded-lg border border-[#eee] bg-white p-2.5">
                          <div className="text-[11px] font-semibold text-[#333]">{item.name}</div>
                          <div className="text-[10px] text-[#999]">{item.desc}</div>
                          <div className="mt-1 text-[9px] text-[#ccc]">{item.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="border-t border-[#f0f0f0] py-32">
        <div className="mx-auto max-w-[1200px] px-6">
          {/* Section label */}
          <div className="mb-20 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[12px] font-medium tracking-[0.1em] text-[#999] uppercase">
              <span>[01]</span>
              <span>핵심 기능</span>
            </div>
          </div>

          {/* Feature 1 — Kanban */}
          <div className="mb-32 grid items-start gap-16 lg:grid-cols-2">
            <div>
              <h2 className="mb-5 text-[clamp(28px,3.5vw,44px)] font-bold leading-[1.15] tracking-[-0.02em]">
                <span className="text-[#999]">칸반 보드.</span>{" "}
                9단계 상태를 드래그앤드롭으로. 신규인입부터 내원완료까지 모든 흐름을 한눈에 추적하세요.
              </h2>
              <a href="/crm" className="inline-flex items-center gap-1 text-[14px] font-medium text-[#0f172a] transition hover:text-[#555]">
                칸반 보드 살펴보기 <span className="material-icons text-[16px]">arrow_forward</span>
              </a>
            </div>
            <div className="rounded-2xl border border-[#eee] bg-[#fafafa] p-6">
              <div className="space-y-2">
                {["신규인입", "부재중", "응대중", "상담완료", "예약완료", "내원완료", "추후통화희망", "추가상담거부", "블랙리스트"].map((status, i) => (
                  <div key={status} className="flex items-center gap-3 rounded-lg bg-white px-4 py-2.5 border border-[#f0f0f0]">
                    <div className="h-2.5 w-2.5 rounded-full" style={{
                      backgroundColor: ["#3b82f6","#ef4444","#f59e0b","#8b5cf6","#10b981","#06b6d4","#6366f1","#f97316","#1e293b"][i]
                    }} />
                    <span className="text-[13px] font-medium text-[#333]">{status}</span>
                    <span className="ml-auto text-[11px] text-[#ccc]">{[12,3,8,5,15,23,2,1,0][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 2 — SMS */}
          <div className="mb-32 grid items-start gap-16 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <div className="rounded-2xl border border-[#eee] bg-[#fafafa] p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="material-icons text-[16px] text-[#999]">sms</span>
                  <span className="text-[12px] font-semibold text-[#555]">자동 발송 설정</span>
                </div>
                <div className="space-y-2">
                  {[
                    { from: "신규인입", to: "응대중", msg: "안녕하세요, OOO치과입니다..." },
                    { from: "예약완료", to: "—", msg: "예약이 확정되었습니다. 3/7(금)..." },
                    { from: "내원완료", to: "—", msg: "내원해주셔서 감사합니다..." },
                  ].map((rule) => (
                    <div key={rule.from} className="rounded-lg border border-[#f0f0f0] bg-white p-3">
                      <div className="mb-1 flex items-center gap-2 text-[11px]">
                        <span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 font-medium text-[#555]">{rule.from}</span>
                        <span className="material-icons text-[12px] text-[#ccc]">arrow_forward</span>
                        <span className="text-[#999]">SMS 자동 발송</span>
                      </div>
                      <div className="text-[11px] text-[#bbb] truncate">{rule.msg}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="mb-5 text-[clamp(28px,3.5vw,44px)] font-bold leading-[1.15] tracking-[-0.02em]">
                <span className="text-[#999]">SMS 자동발송.</span>{" "}
                상태가 바뀌면 문자가 나갑니다. 템플릿 설정으로 반복 작업을 없애세요.
              </h2>
              <a href="/crm" className="inline-flex items-center gap-1 text-[14px] font-medium text-[#0f172a] transition hover:text-[#555]">
                SMS 설정 살펴보기 <span className="material-icons text-[16px]">arrow_forward</span>
              </a>
            </div>
          </div>

          {/* Feature 3 — More features grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: "view_list", title: "리스트 & 검색", desc: "빠른 검색, 필터링, 엑셀 내보내기" },
              { icon: "calendar_today", title: "캘린더 뷰", desc: "팔로업과 예약 일정 한눈에" },
              { icon: "edit_note", title: "메모 & 이력", desc: "버전별 메모, 완벽한 인수인계" },
              { icon: "people", title: "담당자 배분", desc: "리드 배분과 나의 건 필터링" },
            ].map((f) => (
              <div key={f.icon} className="rounded-2xl border border-[#f0f0f0] bg-[#fafafa] p-6 transition hover:border-[#ddd]">
                <span className="material-icons mb-4 block text-[20px] text-[#999]">{f.icon}</span>
                <h3 className="mb-1 text-[14px] font-semibold text-[#333]">{f.title}</h3>
                <p className="text-[13px] leading-relaxed text-[#999]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-t border-[#f0f0f0] bg-[#fafafa] py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-16 flex items-center gap-3 text-[12px] font-medium tracking-[0.1em] text-[#999] uppercase">
            <span>[02]</span>
            <span>숫자로 보는 TST CRM</span>
          </div>
          <div className="grid grid-cols-2 gap-12 md:grid-cols-4">
            {[
              { num: "9", label: "상담 단계", desc: "신규인입부터 내원완료까지" },
              { num: "24/7", label: "실시간 접속", desc: "언제 어디서든 웹 브라우저로" },
              { num: "30초", label: "자동 갱신", desc: "폴링 기반 실시간 동기화" },
              { num: "100%", label: "웹 기반", desc: "설치 없이 바로 시작" },
            ].map((s) => (
              <div key={s.label}>
                <div className="mb-2 text-[clamp(32px,4vw,56px)] font-bold leading-none tracking-[-0.03em]">{s.num}</div>
                <div className="mb-1 text-[14px] font-semibold text-[#333]">{s.label}</div>
                <div className="text-[13px] text-[#999]">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-32 text-center">
        <div className="mx-auto max-w-[600px] px-6">
          <h2 className="mb-5 text-[clamp(32px,4.5vw,56px)] font-bold leading-[1.1] tracking-[-0.03em]">
            지금 바로
            <br />
            시작하세요.
          </h2>
          <p className="mb-10 text-[16px] text-[#888]">
            별도 설치 없이 브라우저에서 바로 사용할 수 있습니다.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href="/crm"
              className="rounded-lg bg-[#0f172a] px-8 py-3.5 text-[14px] font-medium text-white transition hover:bg-[#1e293b]"
            >
              무료로 시작하기
            </a>
            <a
              href="/crm"
              className="rounded-lg border border-[#e5e5e5] bg-white px-8 py-3.5 text-[14px] font-medium text-[#0f172a] transition hover:border-[#ccc]"
            >
              대시보드 보기
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#f0f0f0] py-8 text-center text-[12px] text-[#bbb]">
        © 2026 세이브 마케팅. All rights reserved.
      </footer>
    </div>
  );
}
