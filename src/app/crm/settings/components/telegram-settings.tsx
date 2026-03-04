"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface TelegramState {
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_enabled: string;
  telegram_notify_new_lead: string;
  telegram_notify_status_change: string;
}

const DEFAULT_STATE: TelegramState = {
  telegram_bot_token: "",
  telegram_chat_id: "",
  telegram_enabled: "0",
  telegram_notify_new_lead: "1",
  telegram_notify_status_change: "1",
};

export function TelegramSettings() {
  const [settings, setSettings] = useState<TelegramState>(DEFAULT_STATE);
  const [newToken, setNewToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedChats, setDetectedChats] = useState<{ id: number; type: string; title?: string; first_name?: string; username?: string }[] | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/telegram/settings");
      const json = await res.json();
      if (json.data) {
        setSettings({ ...DEFAULT_STATE, ...json.data });
      }
    } catch {
      toast.error("텔레그램 설정 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        telegram_chat_id: settings.telegram_chat_id,
        telegram_enabled: settings.telegram_enabled,
        telegram_notify_new_lead: settings.telegram_notify_new_lead,
        telegram_notify_status_change: settings.telegram_notify_status_change,
      };
      if (newToken) {
        payload.telegram_bot_token = newToken;
      }
      const res = await fetch("/api/crm/telegram/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("텔레그램 설정이 저장되었습니다.");
        setNewToken("");
        fetchSettings();
      } else {
        toast.error("저장 실패");
      }
    } catch {
      toast.error("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    const token = newToken || "";
    const chatId = settings.telegram_chat_id;

    if (!token && !settings.telegram_bot_token) {
      toast.error("Bot Token을 입력해주세요.");
      return;
    }
    if (!chatId) {
      toast.error("Chat ID를 입력해주세요.");
      return;
    }
    if (!token) {
      toast.error("테스트를 위해 Bot Token을 새로 입력해주세요.");
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/crm/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: token, chatId }),
      });
      const json = await res.json();
      setTestResult({ ok: res.ok, message: json.message });
    } catch {
      setTestResult({ ok: false, message: "네트워크 오류" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-400 py-8 text-center">불러오는 중...</div>;
  }

  const isEnabled = settings.telegram_enabled === "1";
  const hasToken = !!settings.telegram_bot_token && settings.telegram_bot_token !== "***";

  return (
    <div className="space-y-8">
      {/* Card 1: Bot Settings */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span className="material-icons text-primary text-lg">smart_toy</span>
          봇 설정
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          텔레그램 봇을 통해 CRM 알림을 받을 수 있습니다.{" "}
          <a
            href="https://core.telegram.org/bots#how-do-i-create-a-bot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            봇 생성 방법 안내
          </a>
        </p>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-1 block">Bot Token</Label>
            <Input
              type="password"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder={hasToken ? `현재: ${settings.telegram_bot_token}` : "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"}
              className="max-w-md font-mono text-sm"
            />
            {hasToken && !newToken && (
              <p className="text-xs text-slate-400 mt-1">저장된 토큰이 있습니다. 변경하려면 새로 입력하세요.</p>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 mb-1 block">Chat ID</Label>
            <div className="flex gap-2">
              <Input
                value={settings.telegram_chat_id}
                onChange={(e) => { setSettings({ ...settings, telegram_chat_id: e.target.value }); setDetectedChats(null); }}
                placeholder="-1001234567890"
                className="max-w-md font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={detecting || (!newToken && !settings.telegram_bot_token)}
                onClick={async () => {
                  const token = newToken;
                  if (!token) { toast.error("Chat ID 감지를 위해 Bot Token을 먼저 입력해주세요."); return; }
                  setDetecting(true);
                  setDetectedChats(null);
                  try {
                    const res = await fetch("/api/crm/telegram/test", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ botToken: token, action: "detect" }),
                    });
                    const json = await res.json();
                    if (res.ok && json.data) {
                      setDetectedChats(json.data);
                      if (json.data.length === 1) {
                        setSettings((s) => ({ ...s, telegram_chat_id: String(json.data[0].id) }));
                        toast.success("Chat ID가 자동으로 설정되었습니다.");
                      }
                    } else {
                      toast.error(json.message || "감지 실패");
                    }
                  } catch {
                    toast.error("네트워크 오류");
                  } finally {
                    setDetecting(false);
                  }
                }}
              >
                {detecting ? "감지 중..." : "자동 감지"}
              </Button>
            </div>
            {detectedChats && detectedChats.length > 1 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-500">{detectedChats.length}개의 채팅이 감지되었습니다. 선택하세요:</p>
                {detectedChats.map((chat) => (
                  <button
                    key={chat.id}
                    className={`w-full text-left px-3 py-1.5 rounded text-xs border transition-colors ${
                      settings.telegram_chat_id === String(chat.id)
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                    onClick={() => setSettings({ ...settings, telegram_chat_id: String(chat.id) })}
                  >
                    <span className="font-mono font-medium">{chat.id}</span>
                    <span className="ml-2 text-slate-400">
                      {chat.title || chat.first_name || chat.username || chat.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1">
              봇에게 메시지를 보낸 후 &quot;자동 감지&quot; 버튼을 누르면 Chat ID를 자동으로 찾습니다.
            </p>
          </div>
        </div>
      </div>

      {/* Card 2: Notification Settings */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span className="material-icons text-primary text-lg">notifications</span>
          알림 설정
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">알림 활성화</p>
              <p className="text-xs text-slate-400">마스터 토글 — OFF 시 모든 알림이 중단됩니다</p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, telegram_enabled: checked ? "1" : "0" })
              }
            />
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-3">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-slate-700">새 리드 인입 알림</p>
                <p className="text-xs text-slate-400">새로운 DB가 들어오면 알림</p>
              </div>
              <Switch
                checked={settings.telegram_notify_new_lead === "1"}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, telegram_notify_new_lead: checked ? "1" : "0" })
                }
                disabled={!isEnabled}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-slate-700">상태 변경 알림</p>
                <p className="text-xs text-slate-400">리드 상태가 변경되면 알림</p>
              </div>
              <Switch
                checked={settings.telegram_notify_status_change === "1"}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, telegram_notify_status_change: checked ? "1" : "0" })
                }
                disabled={!isEnabled}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Test & Save */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span className="material-icons text-primary text-lg">science</span>
          연결 테스트
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          저장 전에 테스트 메시지를 보내 연결 상태를 확인할 수 있습니다.
        </p>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={testConnection} disabled={testing}>
            {testing ? (
              <>
                <span className="material-icons text-sm mr-1 animate-spin">refresh</span>
                테스트 중...
              </>
            ) : (
              <>
                <span className="material-icons text-sm mr-1">send</span>
                테스트 메시지 전송
              </>
            )}
          </Button>

          <Button onClick={save} disabled={saving}>
            {saving ? "저장 중..." : "설정 저장"}
          </Button>
        </div>

        {testResult && (
          <div
            className={`mt-3 px-3 py-2 rounded-md text-sm ${
              testResult.ok
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {testResult.ok ? "✅ " : "❌ "}
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
