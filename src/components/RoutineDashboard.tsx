import React, {useState} from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Moon,
  NotebookText,
  Plus,
  Sun,
  Sunset,
  Trash2,
} from 'lucide-react';
import {apiRequest, formatBengaliDate, formatBengaliDateTime} from '../lib/api.ts';
import type {
  FamilyMember,
  MedicineItem,
  MedicineSlot,
  MedicineStatus,
  Prescription,
  SymptomNote,
  VaultState,
} from '../types.ts';

interface RoutineDashboardProps {
  token: string;
  member: FamilyMember;
  prescriptions: Prescription[];
  symptomNotes: SymptomNote[];
  medicineLogs: VaultState['medicineLogs'];
  consecutiveFailures: Record<string, number>;
  onOpenRecordsTab: () => void;
  onOpenPrescription?: (prescriptionId: string) => void;
  onVaultUpdated: (vault: VaultState) => void;
}

const SLOT_META: Array<{
  id: MedicineSlot;
  label: string;
  timeHint: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'morning', label: 'সকাল (Morning)', timeHint: 'সকাল ৮:০০', icon: Sun},
  {id: 'noon', label: 'দুপুর (Noon)', timeHint: 'দুপুর ২:০০', icon: Sunset},
  {id: 'night', label: 'রাত (Night)', timeHint: 'রাত ৯:৩০', icon: Moon},
];

const QUICK_SYMPTOM_CHIPS = [
  'মাথাব্যথা',
  'মাথা ঘোরা',
  'বুক ধড়ফড়',
  'জ্বর / শরীর গরম',
  'পেটে গ্যাস / জ্বালাপোড়া',
  'শ্বাসকষ্ট',
  'অতিরিক্ত দুর্বলতা',
  'রাতের ঘুম কম',
];

export const RoutineDashboard: React.FC<RoutineDashboardProps> = ({
  token,
  member,
  prescriptions,
  symptomNotes,
  medicineLogs,
  consecutiveFailures,
  onOpenRecordsTab,
  onOpenPrescription,
  onVaultUpdated,
}) => {
  const [customSymptom, setCustomSymptom] = useState('');
  const [savingSymptom, setSavingSymptom] = useState(false);
  const [updatingSlot, setUpdatingSlot] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const dayLog = medicineLogs[`${member.id}_${today}`];

  // Collect active medicines for this member across prescriptions
  const memberMeds: Array<MedicineItem & {doctorName: string}> = [];
  const seenNames = new Set<string>();
  for (const rx of prescriptions) {
    if (rx.memberId !== member.id) continue;
    for (const m of rx.medicines) {
      const key = m.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        memberMeds.push({...m, doctorName: rx.doctorName});
      }
    }
  }

  const getSlotMeds = (slot: MedicineSlot) => memberMeds.filter((m) => m[slot]);

  const handleStatusChange = async (slot: MedicineSlot, status: MedicineStatus) => {
    setUpdatingSlot(slot);
    try {
      const res = await apiRequest<{vault: VaultState}>('/api/medicine-logs/status', {
        method: 'POST',
        token,
        body: {memberId: member.id, date: today, slot, status},
      });
      onVaultUpdated(res.vault);
    } finally {
      setUpdatingSlot(null);
    }
  };

  const handleAddSymptom = async (text: string, isQuickChip: boolean) => {
    if (!text.trim()) return;
    setSavingSymptom(true);
    try {
      const res = await apiRequest<{vault: VaultState}>('/api/symptoms', {
        method: 'POST',
        token,
        body: {memberId: member.id, text: text.trim(), isQuickChip},
      });
      onVaultUpdated(res.vault);
      if (!isQuickChip) setCustomSymptom('');
    } finally {
      setSavingSymptom(false);
    }
  };

  const handleDeleteSymptom = async (id: string) => {
    const res = await apiRequest<{vault: VaultState}>(`/api/symptoms/${id}`, {
      method: 'DELETE',
      token,
    });
    onVaultUpdated(res.vault);
  };

  const memberSymptoms = symptomNotes.filter((s) => s.memberId === member.id);
  const doctorAdviceNotes = [...prescriptions]
    .filter((rx) => rx.memberId === member.id && rx.advice && rx.advice.trim().length > 0)
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  return (
    <div className="space-y-8">
      {/* First Section: নোটস (Doctor's Advice linked from Prescriptions) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <NotebookText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">নোটস</h2>
              <p className="text-xs text-slate-500">
                প্রেসক্রিপশনে থাকা ডাক্তারের পরামর্শ ও জরুরি নির্দেশনা ({member.name})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenRecordsTab}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 whitespace-nowrap"
          >
            <span>সকল প্রেসক্রিপশন দেখুন</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {doctorAdviceNotes.length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              এই প্রোফাইলের প্রেসক্রিপশনে এখনো ডাক্তারের কোনো পরামর্শ যুক্ত করা হয়নি।
            </p>
            <button
              type="button"
              onClick={onOpenRecordsTab}
              className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1"
            >
              <span>প্রেসক্রিপশন যোগ করুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {doctorAdviceNotes.map((rx) => (
              <button
                key={rx.id}
                type="button"
                onClick={() =>
                  onOpenPrescription ? onOpenPrescription(rx.id) : onOpenRecordsTab()
                }
                className="w-full py-3.5 text-left hover:bg-slate-50/80 transition-colors rounded-lg px-2 -mx-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 leading-relaxed">
                    {rx.advice}
                  </p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {rx.doctorName} · ভিজিট: {formatBengaliDate(rx.visitDate)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-teal-700 group-hover:underline flex items-center gap-1 shrink-0">
                  <span>প্রেসক্রিপশন দেখুন</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Main Routine & Symptom Notes Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 3-Slot Medicine Routine */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">দৈনিক তিন বেলার ওষুধ রুটিন</h2>
              <p className="text-xs text-slate-500">
                প্রেসক্রিপশন অনুযায়ী স্বয়ংক্রিয়ভাবে সকাল, দুপুর ও রাত স্লটে বিভক্ত
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {SLOT_META.map((slot) => {
              const Icon = slot.icon;
              const meds = getSlotMeds(slot.id);
              const record = dayLog?.[slot.id];
              const status: MedicineStatus = record?.status || 'pending';
              const failCount = consecutiveFailures[`${member.id}_${slot.id}`] || 0;

              return (
                <div
                  key={slot.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{slot.label}</h3>
                        <p className="text-xs text-slate-500 tabular-nums">
                          নির্ধারিত সময়: {slot.timeHint}
                          {failCount > 0 ? ` · মিস/রিজেক্ট কাউন্ট: ${failCount}/৩` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {status === 'taken' && (
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>খেয়েছেন ✅</span>
                        </span>
                      )}
                      {status === 'snoozed' && (
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700">
                          <Clock className="w-4 h-4" />
                          <span>পরে খাবেন ⏰ (৩০ মি.)</span>
                        </span>
                      )}
                      {status === 'pending' && (
                        <span className="text-sm font-semibold text-slate-500">বাকি আছে</span>
                      )}
                    </div>
                  </div>

                  {meds.length === 0 ? (
                    <p className="text-sm text-slate-500 py-2">
                      এই বেলায় কোনো নির্ধারিত ওষুধ নেই।
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
                      {meds.map((med) => (
                        <div key={med.id} className="py-2.5 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{med.name}</p>
                            <p className="text-xs text-slate-500">
                              {med.dosage} · {med.mealTiming} · {med.duration}
                            </p>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{med.doctorName}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        disabled={updatingSlot === slot.id}
                        onClick={() => handleStatusChange(slot.id, 'pending')}
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          status === 'pending'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        বাকি আছে
                      </button>
                      <button
                        type="button"
                        disabled={updatingSlot === slot.id}
                        onClick={() => handleStatusChange(slot.id, 'taken')}
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          status === 'taken'
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        খেয়েছেন ✅
                      </button>
                      <button
                        type="button"
                        disabled={updatingSlot === slot.id}
                        onClick={() => handleStatusChange(slot.id, 'snoozed')}
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          status === 'snoozed'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        পরে খাবেন ⏰
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Current Symptoms Note for Next Doctor Visit */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">বর্তমান সমস্যা নোট</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              পরবর্তী ডাক্তার ভিজিটে বলার জন্য চলমান শারীরিক সমস্যা তারিখ ও সময়সহ লিখে রাখুন
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">দ্রুত যুক্ত করুন (Quick Chips)</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_SYMPTOM_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={savingSymptom}
                  onClick={() => handleAddSymptom(chip, true)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-xs font-semibold text-slate-700 hover:text-teal-900 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{chip}</span>
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddSymptom(customSymptom, false);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={customSymptom}
              onChange={(e) => setCustomSymptom(e.target.value)}
              placeholder="কাস্টম সমস্যার বিবরণ লিখুন..."
              className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
            <button
              type="submit"
              disabled={savingSymptom || !customSymptom.trim()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              নোট করুন
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-3">
              সংরক্ষিত সমস্যা ({memberSymptoms.length}টি)
            </p>
            {memberSymptoms.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                এখনো কোনো শারীরিক সমস্যা নোট করা হয়নি।
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {memberSymptoms.map((note) => (
                  <div key={note.id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{note.text}</p>
                      <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        {formatBengaliDateTime(note.recordedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSymptom(note.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
