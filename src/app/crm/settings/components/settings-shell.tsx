"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CrmSidebar } from "../../components/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplateList } from "./template-list";
import { AutoSendRules } from "./auto-send-rules";
import { GlobalSettings } from "./global-settings";
import { MyTelegramSettings } from "./my-telegram-settings";
import { MyProfile } from "./my-profile";

interface TabDef {
  value: string;
  label: string;
  icon: string;
  roles: string[];
  component: React.ReactNode;
}

const ALL_TABS: TabDef[] = [
  { value: "templates", label: "템플릿 관리", icon: "sms", roles: ["ADMIN"], component: <TemplateList /> },
  { value: "auto-send", label: "자동발송 규칙", icon: "bolt", roles: ["ADMIN"], component: <AutoSendRules /> },
  { value: "general", label: "기본 설정", icon: "settings", roles: ["ADMIN"], component: <GlobalSettings /> },
  { value: "my-telegram", label: "텔레그램 알림", icon: "send", roles: ["ADMIN", "COUNSELOR"], component: <MyTelegramSettings /> },
  { value: "my-profile", label: "내 정보", icon: "person", roles: ["ADMIN", "COUNSELOR"], component: <MyProfile /> },
];

export function SettingsShell() {
  const router = useRouter();
  const { data: session } = useSession();

  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED !== "false";
  const userRole = authEnabled
    ? ((session?.user as Record<string, unknown>)?.role as string) || "COUNSELOR"
    : "ADMIN";

  const visibleTabs = ALL_TABS.filter((tab) => tab.roles.includes(userRole));
  const defaultTab = userRole === "ADMIN" ? "templates" : "my-telegram";

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
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-6">
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                <span className="material-icons text-sm mr-1">{tab.icon}</span>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {visibleTabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.component}
            </TabsContent>
          ))}
        </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
