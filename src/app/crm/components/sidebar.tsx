"use client";

import { useRouter, usePathname } from "next/navigation";

const navItems = [
  { icon: "dashboard", path: "/crm" },
  { icon: "people", path: null },
  { icon: "chat", path: null },
];

const bottomItems = [
  { icon: "campaign", path: "/crm/updates" },
  { icon: "settings", path: "/crm/settings" },
];

function isActive(currentPath: string, itemPath: string) {
  if (itemPath === "/crm") return currentPath === "/crm";
  return currentPath.startsWith(itemPath);
}

export function CrmSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-16 flex-col items-center py-6 bg-card border-r border-border shrink-0">
      <div className="mb-8 w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/30">
        D
      </div>
      <nav className="flex-1 flex flex-col gap-6 items-center w-full">
        {navItems.map((item) => (
          <button
            key={item.icon}
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
        {bottomItems.map((item) => (
          <button
            key={item.icon}
            className={`p-3 ${
              isActive(pathname, item.path)
                ? "bg-primary/10 text-primary rounded-xl"
                : "text-slate-400 hover:text-primary"
            }`}
            onClick={() => router.push(item.path)}
          >
            <span className="material-icons">{item.icon}</span>
          </button>
        ))}
        <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://lh3.googleusercontent.com/a/default-user" alt="User" />
        </div>
        <span className="text-[10px] text-slate-300">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
      </div>
    </aside>
  );
}
