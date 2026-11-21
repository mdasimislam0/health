import React, {useState} from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  FileText,
  Pill,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {apiRequest, formatBengaliDateTime} from '../lib/api.ts';
import type {
  ActivityLog,
  CaregiverAlert,
  FamilyMember,
  LabReport,
  MedicineSlot,
  Prescription,
  SymptomNote,
  VaultState,
} from '../types.ts';

interface FamilyDashboardProps {
  token: string;
  members: FamilyMember[];
  member: FamilyMember;
  prescriptions: Prescription[];
  labReports: LabReport[];
  symptomNotes: SymptomNote[];
  medicineLogs: VaultState['medicineLogs'];
  caregiverAlerts: CaregiverAlert[];
  activityLogs: ActivityLog[];
  onSelectMember: (memberId: string) => void;
  onOpenAddMember: () => void;
  onMemberDeleted: (vault: VaultState, deletedMemberId: string) => void;
  onOpenRecordsTab: () => void;
  onOpenRoutineTab: () => void;
}

const SLOT_SHORT: Array<{id: MedicineSlot; label: string}> = [
  {id: 'morning', label: 'সকাল'},
  {id: 'noon', label: 'দুপুর'},
  {id: 'night', label: 'রাত'},
];

const RELATION_BN: Record<string, string> = {
  Self: 'নিজে (Self)',
  Father: 'বাবা',
  Mother: 'মা',
  Spouse: 'স্ত্রী/স্বামী',
  Child: 'সন্তান',
  Other: 'অন্যান্য',
};

function computeMemberStats(
  memberId: string,
  prescriptions: Prescription[],
  labReports: LabReport[],
  medicineLogs: VaultState['medicineLogs'],
  today: string
) {
  const memberRx = prescriptions.filter((p) => p.memberId === memberId);
  const memberReports = labReports.filter((r) => r.memberId === memberId);

  const scheduledSlots: Record<MedicineSlot, boolean> = {morning: false, noon: false, night: false};
  for (const rx of memberRx) {
    for (const m of rx.medicines) {
      if (m.morning) scheduledSlots.morning = true;
      if (m.noon) scheduledSlots.noon = true;
      if (m.night) scheduledSlots.night = true;
    }
  }

  const todayLog = medicineLogs[`${memberId}_${today}`];
  const activeSlots = (['morning', 'noon', 'night'] as const).filter((s) => scheduledSlots[s]);
  const slotDenom = activeSlots.length > 0 ? activeSlots.length : 3;
  const todayTaken = (['morning', 'noon', 'night'] as const).filter(
    (s) => todayLog?.[s]?.status === 'taken'
  ).length;
  const todayPercent = Math.min(100, Math.round((todayTaken / slotDenom) * 100));

  let totalLoggedSlots = 0;
  let totalTakenSlots = 0;
  let totalSnoozedSlots = 0;
  for (const [key, slots] of Object.entries(medicineLogs)) {
    if (!key.startsWith(`${memberId}_`)) continue;
    for (const slotKey of ['morning', 'noon', 'night'] as const) {
      const st = slots?.[slotKey]?.status;
      if (st) {
        totalLoggedSlots += 1;
        if (st === 'taken') totalTakenSlots += 1;
        if (st === 'snoozed') totalSnoozedSlots += 1;
      }
    }
  }
  const overallPercent =
    totalLoggedSlots > 0 ? Math.round((totalTakenSlots / totalLoggedSlots) * 100) : todayPercent;

  return {
    rxCount: memberRx.length,
    reportCount: memberReports.length,
    todayLog,
    todayTaken,
    slotDenom,
    todayPercent,
    totalTakenSlots,
    totalSnoozedSlots,
    overallPercent,
  };
}

export const FamilyDashboard: React.FC<FamilyDashboardProps> = ({
  token,
  members,
  member,
  prescriptions,
  labReports,
  symptomNotes,
  medicineLogs,
  caregiverAlerts,
  activityLogs,
  onSelectMember,
  onOpenAddMember,
  onMemberDeleted,
  onOpenRecordsTab,
  onOpenRoutineTab,
}) => {
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<FamilyMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const selfCount = members.filter((m) => m.relation === 'Self').length;
  const canDeleteMember = (target: FamilyMember) =>
    members.length > 1 && !(target.relation === 'Self' && selfCount <= 1);

  const handleConfirmDelete = async () => {
    if (!confirmDeleteMember) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await apiRequest<{vault: VaultState}>(`/api/members/${confirmDeleteMember.id}`, {
        method: 'DELETE',
        token,
      });
      const deletedId = confirmDeleteMember.id;
      setConfirmDeleteMember(null);
      onMemberDeleted(res.vault, deletedId);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'প্রোফাইল ডিলিট করা যায়নি');
    } finally {
      setDeleting(false);
    }
  };

  const sortedMembers = [...members].sort((a, b) => {
    if (a.relation === 'Self') return -1;
    if (b.relation === 'Self') return 1;
    return 0;
  });

  const activeStats = computeMemberStats(member.id, prescriptions, labReports, medicineLogs, today);
  const memberSymptoms = symptomNotes.filter((s) => s.memberId === member.id);
  const memberActivities = activityLogs.filter((a) => a.memberId === member.id);
  const otherMembers = sortedMembers.filter((m) => m.id !== member.id);

  return (
    <div className="space-y-8">
      {/* 1. পারিবারিক প্রোফাইল ড্যাশবোর্ড (Family Switcher + Active Member Summary) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-teal-700">পারিবারিক প্রোফাইল ড্যাশবোর্ড</p>
            <h1 className="text-base font-bold text-slate-900">
              নিজের প্রোফাইলে রুটিন সেট করুন অথবা বাবা-মা ও পরিবারের প্রোফাইল বেছে নিন
            </h1>
          </div>
          <button
            type="button"
            onClick={onOpenAddMember}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-teal-700/30 bg-teal-50 text-teal-800 text-xs font-semibold hover:bg-teal-100 flex items-center gap-1.5 whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ বাবা-মা / নতুন সদস্য যোগ</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sortedMembers.map((m) => {
            const isSelected = m.id === member.id;
            const mStats = computeMemberStats(m.id, prescriptions, labReports, medicineLogs, today);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMember(m.id)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-left transition-colors flex items-center gap-2.5 ${
                  isSelected
                    ? 'bg-teal-700 border-teal-700 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                }`}
              >
                {m.avatarUrl ? (
                  <img
                    src={m.avatarUrl}
                    alt={m.name}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/40"
                  />
                ) : (
                  <span
                    className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {m.name.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate max-w-[140px]">
                    {m.relation === 'Self' ? `আমি (${m.name})` : m.name}
                  </p>
                  <p
                    className={`text-[11px] tabular-nums ${
                      isSelected ? 'text-teal-100' : 'text-slate-500'
                    }`}
                  >
                    {RELATION_BN[m.relation] || m.relation} · আজ {mStats.todayPercent}%
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Active Profile Adherence & Progress Summary */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-teal-700 text-white text-xl font-bold flex items-center justify-center shrink-0">
                {member.name.slice(0, 1)}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-teal-700">
                {member.relation === 'Self'
                  ? 'আমার নিজের ড্যাশবোর্ড · ফলো-আপ রিপোর্ট'
                  : `${RELATION_BN[member.relation] || member.relation} প্রোফাইল · ফলো-আপ রিপোর্ট`}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{member.name}</h2>
              <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                {member.age} বছর · রক্তের গ্রুপ {member.bloodGroup} · {member.idType}: {member.idNumber} · ভয়েস
                সম্বোধন: {member.gender === 'Female' ? 'ম্যাডাম' : 'স্যার'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={onOpenRoutineTab}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap"
            >
              <Pill className="w-4 h-4" />
              <span>ওষুধ রুটিন দেখুন</span>
            </button>
            <button
              type="button"
              onClick={onOpenRecordsTab}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center gap-2 whitespace-nowrap"
            >
              <FileText className="w-4 h-4 text-teal-700" />
              <span>প্রেসক্রিপশন ও টেস্ট সেট করুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {canDeleteMember(member) && (
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmDeleteMember(member);
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100 text-xs font-semibold text-red-700 flex items-center gap-1.5 whitespace-nowrap"
                title="প্রোফাইল ডিলিট করুন"
              >
                <Trash2 className="w-4 h-4" />
                <span>ডিলিট</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs text-slate-500">আজকের রুটিন অনুসরণ</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
              {activeStats.todayPercent}%{' '}
              <span className="text-xs font-normal text-slate-500">
                ({activeStats.todayTaken}/{activeStats.slotDenom} বেলা)
              </span>
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-teal-700 transition-all"
                style={{width: `${activeStats.todayPercent}%`}}
              />
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs text-slate-500">সামগ্রিক ফলো-আপ হার</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700">
              {activeStats.overallPercent}%
            </p>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              মোট {activeStats.totalTakenSlots} ডোজ সম্পন্ন · {activeStats.totalSnoozedSlots} পরে
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs text-slate-500">প্রেসক্রিপশন ও টেস্ট</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
              {activeStats.rxCount} / {activeStats.reportCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">প্রেসক্রিপশন · ল্যাব রিপোর্ট</p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs text-slate-500">চলমান সমস্যা নোট</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
              {memberSymptoms.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">পরবর্তী ভিজিটের জন্য সংরক্ষিত</p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-teal-700" />
              <span>
                {member.relation === 'Self'
                  ? 'আমার সাম্প্রতিক ফলো-আপ কার্যক্রম (কি কি করেছি)'
                  : `${member.name}-এর সাম্প্রতিক কার্যক্রম`}
              </span>
            </p>
            <span className="text-xs text-slate-400 tabular-nums">{memberActivities.length}টি রেকর্ড</span>
          </div>

          {memberActivities.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              এখনো কোনো কার্যক্রম রেকর্ড হয়নি। ওষুধ স্ট্যাটাস বা প্রেসক্রিপশন যুক্ত করলে এখানে দেখা যাবে।
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {memberActivities.slice(0, 4).map((act) => (
                <div key={act.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-800 font-medium">{act.summary}</span>
                  <span className="text-slate-400 tabular-nums shrink-0">
                    {formatBengaliDateTime(act.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. অন্যান্য ফ্যামিলি প্রোফাইল মনিটরিং */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>অন্যান্য ফ্যামিলি প্রোফাইল মনিটরিং</span>
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">
              বাবা-মা ও পরিবারের অন্যরা আজ কতটুকু ফলো করলেন এবং কি কি করেছেন
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenAddMember}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>নতুন সদস্য যোগ</span>
          </button>
        </div>

        {otherMembers.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            অন্যান্য কোনো পারিবারিক সদস্য এখনো যুক্ত করা হয়নি।
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherMembers.map((other) => {
              const st = computeMemberStats(other.id, prescriptions, labReports, medicineLogs, today);
              const otherActs = activityLogs.filter((a) => a.memberId === other.id);
              const otherAlerts = caregiverAlerts.filter((a) => a.memberId === other.id && !a.read);
              const isExpanded = expandedMemberId === other.id;

              return (
                <div
                  key={other.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {other.avatarUrl ? (
                          <img
                            src={other.avatarUrl}
                            alt={other.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 text-sm font-bold flex items-center justify-center shrink-0">
                            {other.name.slice(0, 1)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{other.name}</h3>
                          <p className="text-xs text-slate-500">
                            {RELATION_BN[other.relation] || other.relation} · {other.age} বছর
                          </p>
                        </div>
                      </div>

                      <span className="text-sm font-bold font-mono tabular-nums text-teal-800 shrink-0">
                        {st.todayPercent}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] bg-white border border-slate-200 rounded-lg p-2">
                      {SLOT_SHORT.map((s) => {
                        const slotStatus = st.todayLog?.[s.id]?.status || 'pending';
                        return (
                          <div key={s.id}>
                            <span className="block text-slate-500">{s.label}</span>
                            <span
                              className={`font-bold ${
                                slotStatus === 'taken'
                                  ? 'text-emerald-700'
                                  : slotStatus === 'snoozed'
                                    ? 'text-amber-700'
                                    : 'text-slate-400'
                              }`}
                            >
                              {slotStatus === 'taken'
                                ? 'খেয়েছেন ✓'
                                : slotStatus === 'snoozed'
                                  ? 'পরে ⏰'
                                  : 'বাকি'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-xs text-slate-600 tabular-nums flex items-center justify-between">
                      <span>
                        প্রেসক্রিপশন: {st.rxCount} · রিপোর্ট: {st.reportCount}
                      </span>
                      {otherAlerts.length > 0 && (
                        <span className="font-bold text-red-600">{otherAlerts.length} নতুন অ্যালার্ট</span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 space-y-1">
                      <p className="text-[11px] font-semibold text-slate-500">সাম্প্রতিক কার্যক্রম:</p>
                      {otherActs.length === 0 ? (
                        <p className="text-xs text-slate-400">এখনো কোনো কার্যক্রম রেকর্ড হয়নি</p>
                      ) : (
                        (isExpanded ? otherActs.slice(0, 6) : otherActs.slice(0, 2)).map((act) => (
                          <p key={act.id} className="text-xs text-slate-700 leading-snug">
                            • {act.summary}{' '}
                            <span className="text-[11px] text-slate-400 tabular-nums">
                              ({formatBengaliDateTime(act.timestamp)})
                            </span>
                          </p>
                        ))
                      )}
                      {otherActs.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setExpandedMemberId(isExpanded ? null : other.id)}
                          className="text-[11px] font-semibold text-teal-700 hover:underline pt-0.5"
                        >
                          {isExpanded ? 'কম দেখুন' : `সব দেখুন (${otherActs.length}টি)`}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectMember(other.id);
                        window.scrollTo({top: 0, behavior: 'smooth'});
                      }}
                      className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-900 flex items-center justify-center gap-1.5"
                    >
                      <span>প্রোফাইল খুলুন ও সেট করুন</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {canDeleteMember(other) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmDeleteMember(other);
                        }}
                        aria-label={`${other.name} প্রোফাইল ডিলিট করুন`}
                        title="প্রোফাইল ডিলিট করুন"
                        className="min-h-[40px] min-w-[40px] px-2.5 py-2 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete Profile Confirmation Modal */}
      {confirmDeleteMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => !deleting && setConfirmDeleteMember(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">প্রোফাইল ডিলিট করবেন?</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {confirmDeleteMember.name} ({RELATION_BN[confirmDeleteMember.relation] || confirmDeleteMember.relation})
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteMember(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              আপনি কি নিশ্চিতভাবে <span className="font-bold">{confirmDeleteMember.name}</span> প্রোফাইলটি
              ডিলিট করতে চান? এই প্রোফাইলের সাথে যুক্ত প্রেসক্রিপশন, টেস্ট রিপোর্ট এবং ওষুধের রুটিন তথ্যও মুছে
              যাবে।
            </p>

            {deleteError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteMember(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'ডিলিট হচ্ছে...' : 'হ্যাঁ, ডিলিট করুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
