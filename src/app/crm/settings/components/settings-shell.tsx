"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplateList } from "./template-list";
import { AutoSendRules } from "./auto-send-rules";
import { GlobalSettings } from "./global-settings";

export function SettingsShell() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 font-[family-name:var(--font-sans)]">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/crm")}
          className="text-slate-400 hover:text-slate-600 p-1"
        >
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-slate-900">CRM 설정</h1>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
        <Tabs defaultValue="templates">
          <TabsList className="mb-6">
            <TabsTrigger value="templates">
              <span className="material-icons text-sm mr-1">sms</span>
              템플릿 관리
            </TabsTrigger>
            <TabsTrigger value="auto-send">
              <span className="material-icons text-sm mr-1">bolt</span>
              자동발송 규칙
            </TabsTrigger>
            <TabsTrigger value="general">
              <span className="material-icons text-sm mr-1">settings</span>
              기본 설정
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <TemplateList />
          </TabsContent>
          <TabsContent value="auto-send">
            <AutoSendRules />
          </TabsContent>
          <TabsContent value="general">
            <GlobalSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
