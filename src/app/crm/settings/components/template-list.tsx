"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TemplateEditor } from "./template-editor";

interface Template {
  id: number;
  key: string;
  label: string;
  icon: string;
  body: string;
  msgType: "SMS" | "LMS";
  category: string | null;
  statuses: string[] | null;
}

export function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/sms/templates");
      const json = await res.json();
      setTemplates(json.data || []);
    } catch {
      toast.error("템플릿 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = async (id: number) => {
    if (!confirm("이 템플릿을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/crm/sms/templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("템플릿이 삭제되었습니다.");
        fetchTemplates();
      } else {
        toast.error("삭제 실패");
      }
    } catch {
      toast.error("삭제 실패");
    }
  };

  const handleSave = async (data: Omit<Template, "id">, id?: number) => {
    try {
      const url = id ? `/api/crm/sms/templates/${id}` : "/api/crm/sms/templates";
      const method = id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success(id ? "템플릿이 수정되었습니다." : "템플릿이 생성되었습니다.");
        setEditing(null);
        setCreating(false);
        fetchTemplates();
      } else {
        const json = await res.json();
        toast.error(json.message || "저장 실패");
      }
    } catch {
      toast.error("저장 실패");
    }
  };

  if (editing || creating) {
    return (
      <TemplateEditor
        template={editing || undefined}
        onSave={handleSave}
        onCancel={() => { setEditing(null); setCreating(false); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-800">SMS 템플릿 목록</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <span className="material-icons text-sm mr-1">add</span> 새 템플릿
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">불러오는 중...</div>
      ) : templates.length === 0 ? (
        <div className="text-sm text-slate-400 py-8 text-center">등록된 템플릿이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white rounded-lg border border-slate-200 p-4 flex items-start gap-3 hover:border-slate-300 transition-colors"
            >
              <span className="material-icons text-slate-400 mt-0.5">{tpl.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-slate-900">{tpl.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{tpl.msgType}</span>
                  {tpl.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{tpl.category}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 whitespace-pre-wrap">{tpl.body}</p>
                {tpl.statuses && tpl.statuses.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {tpl.statuses.map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setEditing(tpl)}
                  className="p-1.5 text-slate-400 hover:text-primary rounded hover:bg-slate-50"
                >
                  <span className="material-icons text-sm">edit</span>
                </button>
                <button
                  onClick={() => handleDelete(tpl.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50"
                >
                  <span className="material-icons text-sm">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
