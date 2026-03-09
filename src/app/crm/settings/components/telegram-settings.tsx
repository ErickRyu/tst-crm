"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Recipient {
  id: number;
  chatId: string;
  label: string;
  chatType: string | null;
  isEnabled: boolean;
}

interface DetectedChat {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramState {
  telegram_bot_token: string;
  telegram_enabled: string;
  telegram_notify_new_lead: string;
  telegram_notify_status_change: string;
  recipients: Recipient[];
}

const DEFAULT_STATE: TelegramState = {
  telegram_bot_token: "",
  telegram_enabled: "0",
  telegram_notify_new_lead: "1",
  telegram_notify_status_change: "1",
  recipients: [],
};

const CHAT_TYPE_LABELS: Record<string, string> = {
  private: "개인",
  group: "그룹",
  supergroup: "슈퍼그룹",
  channel: "채널",
};

export function TelegramSettings() {
  const [settings, setSettings] = useState<TelegramState>(DEFAULT_STATE);
  const [newToken, setNewToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingToken, setSavingToken] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [editingToken, setEditingToken] = useState(false);
  const [detectedChats, setDetectedChats] = useState<DetectedChat[] | null>(null);
  const [selectedChats, setSelectedChats] = useState<Set<number>>(new Set());
  const [addingRecipients, setAddingRecipients] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [manualChatId, setManualChatId] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [addingManual, setAddingManual] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/telegram/settings");
      const json = await res.json();
      if (json.data) {
        const { recipients, ...rest } = json.data;
        setSettings({
          ...DEFAULT_STATE,
          ...rest,
          recipients: recipients || [],
        });
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
  const hasRecipients = settings.recipients.length > 0;
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

  // 자동 감지
  const detectChats = async () => {
    setDetecting(true);
    setDetectedChats(null);
    setSelectedChats(new Set());
    try {
      const res = await fetch("/api/crm/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detect" }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        // 이미 등록된 chatId 제외
        const existingIds = new Set(settings.recipients.map((r) => r.chatId));
        const newChats = (json.data as DetectedChat[]).filter(
          (c) => !existingIds.has(String(c.id))
        );
        if (newChats.length === 0) {
          toast.info("새로 감지된 채팅이 없습니다. 이미 모두 등록되어 있습니다.");
        } else {
          setDetectedChats(newChats);
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

  // 감지된 채팅 선택 토글
  const toggleChatSelection = (chatId: number) => {
    setSelectedChats((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  };

  // 선택한 채팅들 추가
  const addSelectedRecipients = async () => {
    if (!detectedChats || selectedChats.size === 0) return;
    setAddingRecipients(true);
    try {
      const chatsToAdd = detectedChats.filter((c) => selectedChats.has(c.id));
      for (const chat of chatsToAdd) {
        const label = chat.title || chat.first_name || chat.username || `Chat ${chat.id}`;
        await fetch("/api/crm/telegram/recipients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: String(chat.id),
            label,
            chatType: chat.type,
          }),
        });
      }
      toast.success(`${chatsToAdd.length}명의 수신자가 추가되었습니다.`);
      setDetectedChats(null);
      setSelectedChats(new Set());
      await fetchSettings();
    } catch {
      toast.error("수신자 추가 실패");
    } finally {
      setAddingRecipients(false);
    }
  };

  // 수동 추가
  const addManualRecipient = async () => {
    if (!manualChatId.trim() || !manualLabel.trim()) {
      toast.error("Chat ID와 라벨을 모두 입력해주세요.");
      return;
    }
    setAddingManual(true);
    try {
      const res = await fetch("/api/crm/telegram/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: manualChatId.trim(),
          label: manualLabel.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("수신자가 추가되었습니다.");
        setManualChatId("");
        setManualLabel("");
        await fetchSettings();
      } else {
        toast.error(json.message || "추가 실패");
      }
    } catch {
      toast.error("수신자 추가 실패");
    } finally {
      setAddingManual(false);
    }
  };

  // 수신자 활성/비활성 토글
  const toggleRecipient = async (id: number, currentEnabled: boolean) => {
    try {
      const res = await fetch(`/api/crm/telegram/recipients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !currentEnabled }),
      });
      if (res.ok) {
        setSettings((s) => ({
          ...s,
          recipients: s.recipients.map((r) =>
            r.id === id ? { ...r, isEnabled: !currentEnabled } : r
          ),
        }));
      } else {
        toast.error("상태 변경 실패");
      }
    } catch {
      toast.error("상태 변경 실패");
    }
  };

  // 라벨 수정
  const saveLabel = async (id: number) => {
    if (!editingLabelValue.trim()) return;
    try {
      const res = await fetch(`/api/crm/telegram/recipients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editingLabelValue.trim() }),
      });
      if (res.ok) {
        setSettings((s) => ({
          ...s,
          recipients: s.recipients.map((r) =>
            r.id === id ? { ...r, label: editingLabelValue.trim() } : r
          ),
        }));
        setEditingLabelId(null);
        toast.success("라벨이 수정되었습니다.");
      }
    } catch {
      toast.error("수정 실패");
    }
  };

  // 수신자 삭제
  const deleteRecipient = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/crm/telegram/recipients/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSettings((s) => ({
          ...s,
          recipients: s.recipients.filter((r) => r.id !== id),
        }));
        toast.success("수신자가 삭제되었습니다.");
      } else {
        toast.error("삭제 실패");
      }
    } catch {
      toast.error("삭제 실패");
    } finally {
      setDeletingId(null);
    }
  };

  // 수신자별 테스트
  const testRecipient = async (chatId: string, id: number) => {
    setTestingId(id);
    try {
      const res = await fetch("/api/crm/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("테스트 메시지가 전송되었습니다.");
      } else {
        toast.error(json.message || "전송 실패");
      }
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setTestingId(null);
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
    if (step === 2) return hasToken;
    if (step === 3) return hasRecipients;
    return false;
  };

  return (
    <div className="space-y-8">
      {/* Card 1: 봇 연결 + 수신자 관리 */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
          <span className="material-icons text-primary text-lg">smart_toy</span>
          봇 연결 및 수신자 관리
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          텔레그램 봇을 연결하고 알림 수신자를 관리하세요.{" "}
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
                그룹 채팅에서 알림을 받으려면 봇을 그룹에 추가한 후 메시지를 보내주세요.
                <br />
                그 후 아래 &quot;자동 감지&quot; 버튼을 눌러 수신자를 추가하세요.
              </div>
            </div>
          </div>

          {/* Step 3: 수신자 관리 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                stepDone(3) ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
              }`}>
                {stepDone(3) ? <span className="material-icons text-sm">check</span> : "3"}
              </div>
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">수신자 관리</Label>

              {/* 자동 감지 버튼 */}
              <div className="mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={detecting || !hasToken}
                  onClick={detectChats}
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
                {!hasToken && (
                  <span className="text-xs text-slate-400 ml-2">먼저 Bot Token을 저장해주세요.</span>
                )}
              </div>

              {/* 감지된 채팅 목록 (체크박스) */}
              {detectedChats && detectedChats.length > 0 && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-blue-700 mb-2 font-medium">
                    {detectedChats.length}개의 새 채팅이 감지되었습니다. 추가할 채팅을 선택하세요:
                  </p>
                  <div className="space-y-1.5 mb-2">
                    {detectedChats.map((chat) => (
                      <label
                        key={chat.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded border border-blue-100 bg-white cursor-pointer hover:bg-blue-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedChats.has(chat.id)}
                          onChange={() => toggleChatSelection(chat.id)}
                          className="rounded border-slate-300"
                        />
                        <span className="font-mono text-xs text-slate-600">{chat.id}</span>
                        <span className="text-xs text-slate-500">
                          {chat.title || chat.first_name || chat.username || "알 수 없음"}
                        </span>
                        <span className="text-xs text-slate-400 ml-auto">
                          {CHAT_TYPE_LABELS[chat.type] || chat.type}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={selectedChats.size === 0 || addingRecipients}
                      onClick={addSelectedRecipients}
                    >
                      {addingRecipients ? "추가 중..." : `선택 추가 (${selectedChats.size})`}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setDetectedChats(null); setSelectedChats(new Set()); }}
                    >
                      닫기
                    </Button>
                  </div>
                </div>
              )}

              {/* 수신자 목록 테이블 */}
              {hasRecipients ? (
                <div className="border border-slate-200 rounded-md overflow-hidden mb-3">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">라벨</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Chat ID</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">유형</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">활성</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">테스트</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settings.recipients.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2">
                            {editingLabelId === r.id ? (
                              <div className="flex gap-1">
                                <Input
                                  value={editingLabelValue}
                                  onChange={(e) => setEditingLabelValue(e.target.value)}
                                  className="h-7 text-xs w-24"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveLabel(r.id);
                                    if (e.key === "Escape") setEditingLabelId(null);
                                  }}
                                  autoFocus
                                />
                                <Button size="sm" variant="ghost" className="h-7 px-1" onClick={() => saveLabel(r.id)}>
                                  <span className="material-icons text-xs">check</span>
                                </Button>
                              </div>
                            ) : (
                              <button
                                className="text-xs text-slate-700 hover:text-primary hover:underline"
                                onClick={() => { setEditingLabelId(r.id); setEditingLabelValue(r.label); }}
                                title="클릭하여 라벨 수정"
                              >
                                {r.label}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.chatId}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {r.chatType ? (CHAT_TYPE_LABELS[r.chatType] || r.chatType) : "-"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Switch
                              checked={r.isEnabled}
                              onCheckedChange={() => toggleRecipient(r.id, r.isEnabled)}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              disabled={testingId === r.id}
                              onClick={() => testRecipient(r.chatId, r.id)}
                            >
                              {testingId === r.id ? (
                                <span className="material-icons text-sm animate-spin">refresh</span>
                              ) : (
                                <span className="material-icons text-sm">send</span>
                              )}
                            </Button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-400 hover:text-red-600"
                              disabled={deletingId === r.id}
                              onClick={() => deleteRecipient(r.id)}
                            >
                              {deletingId === r.id ? (
                                <span className="material-icons text-sm animate-spin">refresh</span>
                              ) : (
                                <span className="material-icons text-sm">close</span>
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mb-3 px-4 py-6 text-center border border-dashed border-slate-200 rounded-md">
                  <p className="text-xs text-slate-400">
                    수신자가 없습니다. &apos;자동 감지&apos;를 사용하거나 아래에서 직접 추가하세요.
                  </p>
                </div>
              )}

              {/* 수동 추가 */}
              <div className="flex gap-2 items-end">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Chat ID</label>
                  <Input
                    value={manualChatId}
                    onChange={(e) => setManualChatId(e.target.value)}
                    placeholder="-1001234567890"
                    className="w-44 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">라벨</label>
                  <Input
                    value={manualLabel}
                    onChange={(e) => setManualLabel(e.target.value)}
                    placeholder="예: 원장님, 상담실"
                    className="w-36 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") addManualRecipient(); }}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={addingManual || !manualChatId.trim() || !manualLabel.trim()}
                  onClick={addManualRecipient}
                >
                  {addingManual ? "추가 중..." : "직접 추가"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: 알림 설정 */}
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
