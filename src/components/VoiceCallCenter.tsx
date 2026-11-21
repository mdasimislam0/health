import React, {useEffect, useState} from 'react';
import {
  AlarmClock,
  Check,
  Clock,
  FileCheck2,
  HeartPulse,
  Moon,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  ShieldAlert,
  Sun,
  Sunset,
} from 'lucide-react';
import {apiRequest, formatBengaliDateTime, formatBengaliScheduleTime} from '../lib/api.ts';
import type {
  CallReport,
  CallReportOutcome,
  CallSlot,
  FamilyMember,
  MemberCallSchedule,
  MedicineItem,
  MedicineSlot,
  SymptomNote,
  VaultState,
} from '../types.ts';

interface VoiceCallCenterProps {
  token: string;
  members: FamilyMember[];
  activeMember: FamilyMember;
  accountHolderName: string;
  callSchedules: Record<string, MemberCallSchedule>;
  callReports: CallReport[];
  symptomNotes?: SymptomNote[];
  consecutiveFailures: Record<string, number>;
  unreadAlertCount: number;
  getSlotMedicines: (slot: MedicineSlot) => MedicineItem[];
  onSelectMember: (memberId: string) => void;
  onVaultUpdated: (vault: VaultState) => void;
  onTriggerCall: (slot: CallSlot, scheduledTime?: string) => void;
  onOpenInbox: () => void;
}

const SLOTS: Array<{
  id: MedicineSlot;
  title: string;
  shortLabel: string;
  defaultTime: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'morning', title: 'সকালের ইনকামিং কল', shortLabel: 'সকাল', defaultTime: '08:00', icon: Sun},
  {id: 'noon', title: 'দুপুরের ইনকামিং কল', shortLabel: 'দুপুর', defaultTime: '14:00', icon: Sunset},
  {id: 'night', title: 'রাতের ইনকামিং কল', shortLabel: 'রাত', defaultTime: '21:30', icon: Moon},
];

const OUTCOME_LABEL: Record<CallReportOutcome, {text: string; cls: string}> = {
  taken: {text: 'ওষুধ খেয়েছেন ✅', cls: 'text-emerald-700'},
  snoozed: {text: 'পরে খাবেন ⏰', cls: 'text-amber-700'},
  voice_note: {text: 'ভয়েস বক্তব্য 💬', cls: 'text-teal-700'},
  missed: {text: 'মিসড কল', cls: 'text-red-700'},
  rejected: {text: 'কল কেটে দিয়েছেন', cls: 'text-red-700'},
  symptom_ok: {text: 'কোনো সমস্যা নেই ✅', cls: 'text-emerald-700'},
  symptom_logged: {text: 'সমস্যা নোট হয়েছে 📝', cls: 'text-amber-700'},
};

export const VoiceCallCenter: React.FC<VoiceCallCenterProps> = ({
  token,
  members,
  activeMember,
  accountHolderName,
  callSchedules,
  callReports,
  symptomNotes = [],
  consecutiveFailures,
  unreadAlertCount,
  getSlotMedicines,
  onSelectMember,
  onVaultUpdated,
  onTriggerCall,
  onOpenInbox,
}) => {
  const buildDraftForMember = (memberId: string): MemberCallSchedule => {
    const existing = callSchedules?.[memberId];
    return {
      morning: existing?.morning || {enabled: true, time: '08:00'},
      noon: existing?.noon || {enabled: true, time: '14:00'},
      night: existing?.night || {enabled: true, time: '21:30'},
      symptom: existing?.symptom || {enabled: true, time: '18:30'},
    };
  };

  const [draft, setDraft] = useState<MemberCallSchedule>(() => buildDraftForMember(activeMember.id));
  const [savingSlot, setSavingSlot] = useState<CallSlot | null>(null);
  const [savedSlot, setSavedSlot] = useState<CallSlot | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<'all' | 'symptom' | 'medicine'>('all');
  const saveTimerRef = React.useRef<number | null>(null);

  useEffect(() => {
    setDraft(buildDraftForMember(activeMember.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMember.id, callSchedules]);

  useEffect(() => {
    setSavedSlot(null);
    setSaveToast(null);
    setSaveError(null);
  }, [activeMember.id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleSaveSlot = async (slotId: CallSlot) => {
    setSavingSlot(slotId);
    setSaveError(null);
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    try {
      const targetSlot = draft[slotId] || {enabled: true, time: '18:30'};
      const res = await apiRequest<{vault: VaultState}>(`/api/call-schedules/${activeMember.id}`, {
        method: 'PUT',
        token,
        body: {
          [slotId]: targetSlot,
        },
      });
      onVaultUpdated(res.vault);
      setSavedSlot(slotId);
      const slotNameBn =
        slotId === 'morning'
          ? 'সকাল বেলার কল'
          : slotId === 'noon'
            ? 'দুপুর বেলার কল'
            : slotId === 'night'
              ? 'রাত বেলার কল'
              : 'বর্তমান সমস্যা চেক-ইন কল';
      const statusText = targetSlot.enabled
        ? `চালু · ${formatBengaliScheduleTime(targetSlot.time)}`
        : 'বন্ধ রাখা হয়েছে';
      setSaveToast(`${slotNameBn} সেভ হয়ে গেছে (${statusText})`);
      saveTimerRef.current = window.setTimeout(() => {
        setSavedSlot((prev) => (prev === slotId ? null : prev));
        setSaveToast(null);
      }, 4500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'কলের সময় সেভ করা যায়নি');
    } finally {
      setSavingSlot(null);
    }
  };

  const userReports = callReports.filter((r) => r.memberId === activeMember.id);
  const memberSymptoms = symptomNotes.filter((s) => s.memberId === activeMember.id);
  const memberSymptomCount = memberSymptoms.length;
  const symptomOrAgentReports = userReports.filter(
    (r) =>
      r.slot === 'symptom' ||
      r.outcome === 'symptom_logged' ||
      r.outcome === 'symptom_ok' ||
      r.outcome === 'voice_note'
  );
  const medicineOnlyReports = userReports.filter(
    (r) => r.slot !== 'symptom' && r.outcome !== 'voice_note'
  );
  const filteredUserReports =
    reportFilter === 'symptom'
      ? symptomOrAgentReports
      : reportFilter === 'medicine'
        ? medicineOnlyReports
        : userReports;
  const symptomSlot = draft.symptom || {enabled: true, time: '18:30'};
  const symptomFails = consecutiveFailures[`${activeMember.id}_symptom`] || 0;

  return (
    <div className="space-y-8">
      {/* Voice Call Agent Header + Profile Switcher */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-700">AI ভয়েস কল এজেন্ট</p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              সকাল, দুপুর ও রাতের ইনকামিং কল সেট করুন — {activeMember.name}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              নির্ধারিত সময়ে স্বয়ংক্রিয় ইনকামিং কল আসবে এবং AI{' '}
              <strong>“{activeMember.gender === 'Female' ? 'ম্যাডাম' : 'স্যার'}”</strong> সম্বোধনে ওষুধের খোঁজ নেবে।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {members.map((m) => {
              const selected = m.id === activeMember.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMember(m.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                    selected
                      ? 'bg-teal-700 border-teal-700 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {m.relation === 'Self' ? `আমি (${m.name})` : m.name}
                </button>
              );
            })}
          </div>
        </div>

        {saveToast && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-800"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveToast(null)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 px-2 py-0.5 rounded"
            >
              ঠিক আছে
            </button>
          </div>
        )}

        {saveError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs sm:text-sm font-semibold text-red-700"
          >
            {saveError}
          </div>
        )}
      </section>

      {/* 3-Slot Per-Card Call Schedule Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {SLOTS.map((slotMeta) => {
          const Icon = slotMeta.icon;
          const slotVal = draft[slotMeta.id];
          const meds = getSlotMedicines(slotMeta.id);
          const fails = consecutiveFailures[`${activeMember.id}_${slotMeta.id}`] || 0;
          const isSaving = savingSlot === slotMeta.id;
          const isSaved = savedSlot === slotMeta.id;

          return (
            <div
              key={slotMeta.id}
              className={`bg-white rounded-2xl border p-5 flex flex-col justify-between space-y-4 transition-colors ${
                slotVal.enabled ? 'border-slate-200' : 'border-slate-200 opacity-85'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{slotMeta.title}</h2>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {formatBengaliScheduleTime(slotVal.time)} · মিস/রিজেক্ট: {fails}/৩
                      </p>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={slotVal.enabled}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [slotMeta.id]: {...prev[slotMeta.id], enabled: e.target.checked},
                        }))
                      }
                      className="w-4 h-4 accent-teal-700 rounded"
                    />
                    <span>{slotVal.enabled ? 'চালু' : 'বন্ধ'}</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {slotMeta.shortLabel} বেলার কলের সময়
                  </label>
                  <input
                    type="time"
                    value={slotVal.time}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [slotMeta.id]: {...prev[slotMeta.id], time: e.target.value},
                      }))
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-semibold text-slate-700">ওষুধ: </span>
                  {meds.length > 0
                    ? meds.map((m) => m.name).join(', ')
                    : 'নির্ধারিত ওষুধ নেই (রিমাইন্ডার কল সচল)'}
                </p>

                {isSaved && (
                  <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>{slotMeta.shortLabel} বেলার কল সময় সেভ হয়েছে</span>
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveSlot(slotMeta.id)}
                  className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60 transition-colors ${
                    isSaved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800'
                  }`}
                >
                  {isSaved ? <Check className="w-4 h-4" /> : <AlarmClock className="w-4 h-4" />}
                  <span>
                    {isSaving ? 'সেভ হচ্ছে...' : isSaved ? 'সেভ হয়ে গেছে ✓' : 'কল সময় সেভ করুন'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerCall(slotMeta.id, slotVal.time)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5"
                >
                  <PhoneIncoming className="w-3.5 h-3.5 text-teal-700" />
                  <span>এখনই টেস্ট কল দেখুন</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Symptom Check-in Scheduled AI Call Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">
                  বর্তমান সমস্যা নোট — AI স্বাস্থ্য চেক-ইন কল
                </h2>
                <span className="text-[11px] font-bold bg-rose-50 text-rose-800 px-2 py-0.5 rounded">
                  সংরক্ষিত নোট: {memberSymptomCount}টি
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                ঠিক ওষুধ রিমাইন্ডারের মতো এখানে একটি সময় সেট করলে নির্ধারিত সময়ে AI ফোন দিয়ে শুনবে{' '}
                <strong>{activeMember.name}</strong>-এর কোনো শারীরিক সমস্যা হচ্ছে কি না এবং সমস্যা জানালে তা
                স্বয়ংক্রিয়ভাবে “বর্তমান সমস্যা নোট”-এ লিখে রাখবে।
              </p>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer shrink-0 self-start md:self-center">
            <input
              type="checkbox"
              checked={symptomSlot.enabled}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  symptom: {...symptomSlot, enabled: e.target.checked},
                }))
              }
              className="w-4 h-4 accent-teal-700 rounded"
            />
            <span>{symptomSlot.enabled ? 'চেক-ইন কল চালু' : 'চেক-ইন কল বন্ধ'}</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              সমস্যা শোনার কলের সময় ({formatBengaliScheduleTime(symptomSlot.time)} · মিস/রিজেক্ট: {symptomFails}/৩)
            </label>
            <input
              type="time"
              value={symptomSlot.time}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  symptom: {...symptomSlot, time: e.target.value},
                }))
              }
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          <button
            type="button"
            disabled={savingSlot === 'symptom'}
            onClick={() => handleSaveSlot('symptom')}
            className={`w-full min-h-[44px] px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60 transition-colors ${
              savedSlot === 'symptom'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {savedSlot === 'symptom' ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlarmClock className="w-4 h-4" />
            )}
            <span>
              {savingSlot === 'symptom'
                ? 'সেভ হচ্ছে...'
                : savedSlot === 'symptom'
                  ? 'সেভ হয়ে গেছে ✓'
                  : 'চেক-ইন কল সময় সেভ করুন'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerCall('symptom', symptomSlot.time)}
            className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5"
          >
            <PhoneIncoming className="w-3.5 h-3.5 text-rose-700" />
            <span>এখনই সমস্যা চেক-ইন টেস্ট কল দেখুন</span>
          </button>
        </div>

        {savedSlot === 'symptom' && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-bold text-emerald-800 flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              চেক-ইন কল সেভ হয়ে গেছে! ({symptomSlot.enabled ? `চালু · ${formatBengaliScheduleTime(symptomSlot.time)}` : 'বন্ধ'})
            </span>
          </div>
        )}
      </section>

      {/* Escalation Notice Banner */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-slate-900">৩ বার মিসড বা রিজেক্ট এসকেলেশন সক্রিয়</p>
            <p className="text-xs text-slate-600 mt-0.5">
              প্রতিটি কলের রিপোর্ট ইউজার প্রোফাইলে এবং অ্যাকাউন্ট হোল্ডারের কেয়ারগিভার ইনবক্সে আলাদাভাবে সংরক্ষিত থাকে।
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenInbox}
          className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>অ্যাকাউন্ট হোল্ডার রিপোর্ট ও ইনবক্স ({unreadAlertCount})</span>
        </button>
      </section>

      {/* User's Own Call Report Copy */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-teal-700 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>ইউজার কল রিপোর্ট কপি · প্রোফাইল: {activeMember.name}</span>
            </p>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              {activeMember.relation === 'Self'
                ? 'আমার সকল AI কলের রিপোর্ট'
                : `${activeMember.name}-এর নিজের কল রিপোর্ট`}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReportFilter('all')}
              className={`min-h-[34px] px-3 py-1 rounded-xl border text-xs font-semibold transition-colors ${
                reportFilter === 'all'
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              সব কল ({userReports.length})
            </button>
            <button
              type="button"
              onClick={() => setReportFilter('symptom')}
              className={`min-h-[34px] px-3 py-1 rounded-xl border text-xs font-semibold transition-colors ${
                reportFilter === 'symptom'
                  ? 'bg-rose-700 border-rose-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              সমস্যা ও এজেন্টের তথ্য ({symptomOrAgentReports.length})
            </button>
            <button
              type="button"
              onClick={() => setReportFilter('medicine')}
              className={`min-h-[34px] px-3 py-1 rounded-xl border text-xs font-semibold transition-colors ${
                reportFilter === 'medicine'
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              ওষুধের কল ({medicineOnlyReports.length})
            </button>
          </div>
        </div>

        {/* Current Symptom Notes & Agent Captured Problems Summary */}
        {memberSymptoms.length > 0 && (
          <div className="rounded-xl bg-rose-50/70 border border-rose-200 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-rose-700" />
                <span>বর্তমান সমস্যা নোট ও AI এজেন্টের সংগৃহীত সমস্যা ({memberSymptoms.length}টি)</span>
              </p>
              <span className="text-[11px] text-rose-700 font-semibold">
                হোল্ডার ({accountHolderName})-এর কাছেও সংরক্ষিত
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {memberSymptoms.slice(0, 4).map((note) => {
                const isFromAiCall = note.text.includes('AI ভয়েস কল');
                return (
                  <div
                    key={note.id}
                    className="rounded-lg bg-white border border-rose-100 px-3 py-2 text-xs text-slate-800 flex items-start justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900 leading-snug">{note.text}</p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {formatBengaliDateTime(note.recordedAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${
                        isFromAiCall
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isFromAiCall ? 'AI কল' : 'সমস্যা নোট'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredUserReports.length === 0 ? (
          <div className="py-10 text-center border-t border-slate-100">
            <PhoneMissed className="w-9 h-9 text-slate-300 mx-auto" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              এই বিভাগে এখনো কোনো কল রিপোর্ট তৈরি হয়নি
            </p>
            <p className="mt-1 text-xs text-slate-500">
              নির্ধারিত সময়ে ইনকামিং কল এলে বা টেস্ট কল রিসিভ/রিজেক্ট করলে এখানে রিপোর্ট যুক্ত হবে।
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {filteredUserReports.map((rep) => {
              const slotBn =
                rep.slot === 'morning'
                  ? 'সকাল বেলার কল'
                  : rep.slot === 'noon'
                    ? 'দুপুর বেলার কল'
                    : rep.slot === 'night'
                      ? 'রাত বেলার কল'
                      : 'সমস্যা চেক-ইন কল';
              const meta = OUTCOME_LABEL[rep.outcome] || {text: rep.outcome, cls: 'text-slate-700'};
              const agentFinding =
                rep.capturedFinding ||
                ((rep.outcome === 'symptom_logged' || rep.outcome === 'voice_note') && rep.transcript
                  ? rep.transcript
                  : rep.outcome === 'symptom_ok'
                    ? 'কোনো শারীরিক সমস্যা নেই — রোগী সুস্থ আছেন'
                    : undefined);
              const isProblemFinding =
                rep.outcome === 'symptom_logged' || rep.outcome === 'voice_note';

              return (
                <article key={rep.id} className="py-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-bold text-slate-900 text-sm">{slotBn}</span>
                      <span>·</span>
                      <span className="tabular-nums">
                        নির্ধারিত সময়: {formatBengaliScheduleTime(rep.scheduledTime)}
                      </span>
                      <span>·</span>
                      <span className={`font-bold ${meta.cls}`}>{meta.text}</span>
                      {typeof rep.durationSeconds === 'number' && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 tabular-nums text-slate-600">
                            <Clock className="w-3 h-3" />
                            <span>{rep.durationSeconds} সেকেন্ড</span>
                          </span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {formatBengaliDateTime(rep.createdAt)}
                    </span>
                  </div>

                  {agentFinding && (
                    <div
                      className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                        isProblemFinding
                          ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                          : rep.outcome === 'symptom_ok'
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className="font-bold">
                        {isProblemFinding
                          ? 'এজেন্ট যা পেয়েছে / বর্তমান সমস্যা: '
                          : 'এজেন্টের প্রাপ্ত তথ্য: '}
                      </span>
                      <span>{agentFinding}</span>
                    </div>
                  )}

                  {rep.transcript && (
                    <p className="text-sm text-slate-800">
                      <span className="text-xs font-semibold text-slate-500">রোগীর উত্তর: </span>“{rep.transcript}”
                    </p>
                  )}
                  {rep.aiReply && (
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold text-teal-800">AI এজেন্টের জবাব: </span>
                      {rep.aiReply}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
