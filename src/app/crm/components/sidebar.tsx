"use client";

import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

interface NavItem {
  icon: string;
  path: string | null;
  roles?: string[];
  tooltip?: string;
}

const navItems: NavItem[] = [
  { icon: "dashboard", path: "/crm", tooltip: "대시보드" },
  { icon: "people", path: null, tooltip: "환자" },
  { icon: "chat", path: null, tooltip: "채팅" },
];

const bottomItems: NavItem[] = [
  { icon: "campaign", path: "/crm/updates", tooltip: "업데이트" },
  { icon: "admin_panel_settings", path: "/crm/users", roles: ["ADMIN"], tooltip: "사용자 관리" },
  { icon: "history", path: "/crm/audit-logs", roles: ["ADMIN"], tooltip: "감사 로그" },
  { icon: "settings", path: "/crm/settings", roles: ["ADMIN", "COUNSELOR"], tooltip: "설정" },
];

function isActive(currentPath: string, itemPath: string) {
  if (itemPath === "/crm") return currentPath === "/crm";
  return currentPath.startsWith(itemPath);
}

export function CrmSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED !== "false";
  const userRole = authEnabled
    ? ((session?.user as Record<string, unknown>)?.role as string) || "COUNSELOR"
    : "ADMIN";
  const userName = authEnabled
    ? session?.user?.name || "사용자"
    : process.env.NEXT_PUBLIC_USER_NAME || "상담원";

  const isHospitalStaff = userRole === "HOSPITAL_STAFF";

  const filteredNavItems = isHospitalStaff
    ? [{ icon: "calendar_month", path: "/crm/calendar", tooltip: "캘린더" }]
    : navItems;

  const filteredBottomItems = isHospitalStaff
    ? []
    : bottomItems.filter(
        (item) => !item.roles || item.roles.includes(userRole)
      );

  return (
    <aside className="hidden md:flex w-16 flex-col items-center py-6 bg-card border-r border-border shrink-0">
      <div className="mb-8 w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/30">
        D
      </div>
      <nav className="flex-1 flex flex-col gap-6 items-center w-full">
        {filteredNavItems.map((item) => (
          <button
            key={item.icon}
            title={item.tooltip}
            className={`p-3 ${
              item.path && isActive(pathname, item.path)
                ? "bg-primary/10 text-primary rounded-xl"
                : "text-slate-400 hover:text-primary"
            }`}
            onClick={item.path ? () => router.push(item.path!) : undefined}
          >
            <span className="material-icons">{item.icon}</span>
          </button>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-4 items-center">
        {filteredBottomItems.map((item) => (
          <button
            key={item.icon}
            title={item.tooltip}
            className={`p-3 ${
              item.path && isActive(pathname, item.path)
                ? "bg-primary/10 text-primary rounded-xl"
                : "text-slate-400 hover:text-primary"
            }`}
            onClick={item.path ? () => router.push(item.path!) : undefined}
          >
            <span className="material-icons">{item.icon}</span>
          </button>
        ))}
        {authEnabled && (
          <button
            title="로그아웃"
            className="p-3 text-slate-400 hover:text-red-500"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <span className="material-icons">logout</span>
          </button>
        )}
        <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white overflow-hidden flex items-center justify-center text-xs font-bold text-slate-600" title={userName}>
          {userName.charAt(0)}
        </div>
        <span className="text-[10px] text-slate-300">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
      </div>
    </aside>
  );
}
