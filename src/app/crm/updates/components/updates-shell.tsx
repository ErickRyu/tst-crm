"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CrmSidebar } from "../../components/sidebar";
import type { ChangelogEntry } from "@/lib/changelog";

const categoryStyle: Record<string, { icon: string; color: string; bg: string }> = {
  "새 기능": { icon: "add_circle", color: "text-emerald-600", bg: "bg-emerald-50" },
  "개선": { icon: "sync", color: "text-blue-600", bg: "bg-blue-50" },
  "버그 수정": { icon: "build", color: "text-amber-600", bg: "bg-amber-50" },
};

function getCategoryStyle(name: string) {
  return categoryStyle[name] ?? { icon: "info", color: "text-slate-600", bg: "bg-slate-50" };
}

export default function UpdatesShell() {
  const router = useRouter();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crm/changelog")
      .then((r) => r.json())
      .then((d) => setEntries(d.data ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-slate-900 font-[family-name:var(--font-sans)]">
      <CrmSidebar />

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 md:px-6 bg-card border-b border-border shrink-0">
          <button
            onClick={() => router.push("/crm")}
            className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors"
          >
            <span className="material-icons text-xl">arrow_back</span>
          </button>
          <div>
            <h1 className="text-base md:text-xl font-bold">업데이트 소식</h1>
            <p className="text-xs text-slate-400">프로젝트 변경 이력</p>
          </div>
        </header>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <span className="material-icons animate-spin text-primary text-3xl">refresh</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center text-slate-400 py-20">변경 이력이 없습니다.</div>
          ) : (
            <div className="max-w-2xl mx-auto relative">
              {/* Timeline line */}
              <div className="absolute left-4 md:left-6 top-0 bottom-0 w-0.5 bg-slate-200" />

              {entries.map((entry, i) => (
                <div key={entry.version} className="relative pl-10 md:pl-16 pb-10 last:pb-0">
                  {/* Timeline dot */}
                  <div className="absolute left-2.5 md:left-4.5 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-white" />

                  {/* Version badge + date */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary text-white">
                      v{entry.version}
                    </span>
                    <span className="text-sm text-slate-400">{entry.date}</span>
                    {i === 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                        최신
                      </span>
                    )}
                  </div>

                  {/* Categories */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {entry.categories.map((cat) => {
                      const style = getCategoryStyle(cat.name);
                      return (
                        <div key={cat.name} className="p-4 border-b border-slate-100 last:border-b-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`material-icons text-base ${style.color}`}>{style.icon}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${style.bg} ${style.color}`}>
                              {cat.name}
                            </span>
                          </div>
                          <ul className="space-y-1.5">
                            {cat.items.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                                <span className="text-slate-300 mt-1 text-xs">•</span>
                                <span>
                                  {item.title ? (
                                    <>
                                      <strong className="text-slate-800">{item.title}</strong>
                                      <span className="text-slate-400 mx-1">—</span>
                                      {item.description}
                                    </>
                                  ) : (
                                    item.description
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
