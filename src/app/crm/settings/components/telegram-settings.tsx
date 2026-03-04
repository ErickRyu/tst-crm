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
  const [savingToken, setSavingToken] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [editingToken, setEditingToken] = useState(false);
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

  const hasToken = !!settings.telegram_bot_token && settings.telegram_bot_token !== "***";
  const hasChatId = !!settings.telegram_chat_id;
  const isEnabled = settings.telegram_enabled === "1";

  // Step 1: 토큰 저장
  const saveToken = async () => {
    if (!newToken.trim()) {
      toast.error("Bot Token을 입력해주세요.");
      return;
    }
    setSavingToken(true);
    try {
      const res = await fetch("/api/crm/telegram/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_bot_token: newToken }),
      });
      if (res.ok) {
        toast.success("Bot Token이 저장되었습니다.");
        setNewToken("");
        setEditingToken(false);
        await fetchSettings();
      } else {
        toast.error("토큰 저장 실패");
      }
    } catch {
      toast.error("토큰 저장 실패");
    } finally {
      setSavingToken(false);
    }
  };

  // Step 3: Chat ID 자동 감지 (서버에서 DB 토큰 사용)
  const detectChatId = async () => {
    setDetecting(true);
    setDetectedChats(null);
    try {
      const res = await fetch("/api/crm/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detect" }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setDetectedChats(json.data);
        if (json.data.length === 1) {
          const chatId = String(json.data[0].id);
          // 바로 DB에 저장
          await fetch("/api/crm/telegram/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ telegram_chat_id: chatId }),
          });
          setSettings((s) => ({ ...s, telegram_chat_id: chatId }));
          toast.success("Chat ID가 자동으로 감지 및 저장되었습니다.");
        }
      } else {
        toast.error(json.message || "감지 실패");
      }
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setDetecting(false);
    }
  };

  // Chat ID 선택 시 바로 저장
  const selectChatId = async (chatId: string) => {
    setSettings((s) => ({ ...s, telegram_chat_id: chatId }));
    try {
      await fetch("/api/crm/telegram/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_chat_id: chatId }),
      });
      toast.success("Chat ID가 저장되었습니다.");
    } catch {
      toast.error("Chat ID 저장 실패");
    }
  };

  // 테스트 메시지 (서버에서 DB 토큰+chatId 사용)
  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/crm/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setTestResult({ ok: res.ok, message: json.message });
    } catch {
      setTestResult({ ok: false, message: "네트워크 오류" });
    } finally {
      setTesting(false);
    }
  };

  // 알림 설정 저장
  const saveNotifySettings = async () => {
    setSavingNotify(true);
    try {
      const res = await fetch("/api/crm/telegram/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_enabled: settings.telegram_enabled,
          telegram_notify_new_lead: settings.telegram_notify_new_lead,
          telegram_notify_status_change: settings.telegram_notify_status_change,
        }),
      });
      if (res.ok) {
        toast.success("알림 설정이 저장되었습니다.");
      } else {
        toast.error("저장 실패");
      }
    } catch {
      toast.error("저장 실패");
    } finally {
      setSavingNotify(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-400 py-8 text-center">불러오는 중...</div>;
  }

  const stepDone = (step: number) => {
    if (step === 1) return hasToken;
    if (step === 2) return hasToken; // 안내 단계이므로 토큰만 있으면 됨
    if (step === 3) return hasChatId;
    return false;
  };

  return (
    <div className="space-y-8">
      {/* Card 1: 봇 연결 (스텝 가이드) */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
          <span className="material-icons text-primary text-lg">smart_toy</span>
          봇 연결
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          텔레그램 봇을 연결하여 CRM 알림을 받으세요.{" "}
          <a
            href="https://core.telegram.org/bots#how-do-i-create-a-bot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            봇 생성 방법
          </a>
        </p>

        <div className="space-y-5">
          {/* Step 1: Bot Token */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                stepDone(1) ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
              }`}>
                {stepDone(1) ? <span className="material-icons text-sm">check</span> : "1"}
              </div>
              <div className="w-px flex-1 bg-slate-200 mt-1" />
            </div>
            <div className="flex-1 pb-4">
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Bot Token 입력</Label>
              {hasToken && !editingToken ? (
                <div className="flex items-center gap-2">
                  <code className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm text-slate-600 font-mono">
                    {settings.telegram_bot_token}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingToken(true)}
                  >
                    변경
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                    className="max-w-md font-mono text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") saveToken(); }}
                  />
                  <Button
                    size="sm"
                    onClick={saveToken}
                    disabled={savingToken || !newToken.trim()}
                  >
                    {savingToken ? "저장 중..." : "토큰 저장"}
                  </Button>
                  {editingToken && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditingToken(false); setNewToken(""); }}
                    >
                      취소
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: 안내 메시지 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                stepDone(2) ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
              }`}>
                {stepDone(2) ? <span className="material-icons text-sm">check</span> : "2"}
              </div>
              <div className="w-px flex-1 bg-slate-200 mt-1" />
            </div>
            <div className="flex-1 pb-4">
              <p className="text-sm font-medium text-slate-700 mb-1">봇에게 메시지 보내기</p>
              <div className={`text-xs px-3 py-2 rounded-md border ${
                hasToken
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}>
                텔레그램 앱에서 봇에게 아무 메시지를 보내주세요. (예: &quot;hello&quot;)
                <br />
                그 후 아래 &quot;Chat ID 자동 감지&quot; 버튼을 눌러주세요.
              </div>
            </div>
          </div>

          {/* Step 3: Chat ID 자동 감지 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                stepDone(3) ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
              }`}>
                {stepDone(3) ? <span className="material-icons text-sm">check</span> : "3"}
              </div>
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Chat ID 설정</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={settings.telegram_chat_id}
                  onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                  placeholder="-1001234567890"
                  className="max-w-md font-mono text-sm"
                  readOnly={detecting}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={detecting || !hasToken}
                  onClick={detectChatId}
                >
                  {detecting ? (
                    <>
                      <span className="material-icons text-sm mr-1 animate-spin">refresh</span>
                      감지 중...
                    </>
                  ) : (
                    <>
                      <span className="material-icons text-sm mr-1">search</span>
                      자동 감지
                    </>
                  )}
                </Button>
              </div>

              {/* 감지된 채팅 목록 (다수일 때) */}
              {detectedChats && detectedChats.length > 1 && (
                <div className="space-y-1 mb-2">
                  <p className="text-xs text-slate-500">{detectedChats.length}개의 채팅이 감지되었습니다. 선택하세요:</p>
                  {detectedChats.map((chat) => (
                    <button
                      key={chat.id}
                      className={`w-full text-left px-3 py-1.5 rounded text-xs border transition-colors ${
                        settings.telegram_chat_id === String(chat.id)
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-slate-200 hover:border-slate-300 text-slate-600"
                      }`}
                      onClick={() => selectChatId(String(chat.id))}
                    >
                      <span className="font-mono font-medium">{chat.id}</span>
                      <span className="ml-2 text-slate-400">
                        {chat.title || chat.first_name || chat.username || chat.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {!hasToken && (
                <p className="text-xs text-slate-400">먼저 Bot Token을 저장해주세요.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: 연결 테스트 */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
          <span className="material-icons text-primary text-lg">science</span>
          연결 테스트
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          설정이 올바른지 테스트 메시지를 보내 확인하세요.
        </p>

        <Button
          variant="outline"
          onClick={testConnection}
          disabled={testing || !hasToken || !hasChatId}
        >
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

        {!hasToken && !hasChatId && (
          <p className="text-xs text-slate-400 mt-2">봇 연결을 먼저 완료해주세요.</p>
        )}

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

      {/* Card 3: 알림 설정 */}
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

        <div className="mt-5 pt-4 border-t border-slate-100">
          <Button onClick={saveNotifySettings} disabled={savingNotify}>
            {savingNotify ? "저장 중..." : "알림 설정 저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}
