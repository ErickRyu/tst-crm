"use client";

import { useRouter } from "next/navigation";
import { CrmSidebar } from "../../components/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplateList } from "./template-list";
import { AutoSendRules } from "./auto-send-rules";
import { GlobalSettings } from "./global-settings";
import { TelegramSettings } from "./telegram-settings";

export function SettingsShell() {
  const router = useRouter();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-slate-900 font-[family-name:var(--font-sans)]">
      <CrmSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex items-center gap-4 shrink-0">
          <button
            onClick={() => router.push("/crm")}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <span className="material-icons">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-slate-900">CRM 설정</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
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
            <TabsTrigger value="telegram">
              <span className="material-icons text-sm mr-1">send</span>
              텔레그램 알림
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
          <TabsContent value="telegram">
            <TelegramSettings />
          </TabsContent>
        </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
