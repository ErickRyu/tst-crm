export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <main className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-3 text-2xl font-semibold text-slate-900">TST CRM MVP</h1>
        <p className="mb-6 text-sm text-slate-600">
          세이브 마케팅 아웃바운드 상담용 대시보드입니다.
        </p>
        <div className="flex gap-2">
          <a
            href="/crm"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            CRM 대시보드 열기
          </a>
          <a
            href="/docs"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            API Docs
          </a>
        </div>
      </main>
    </div>
  );
}
