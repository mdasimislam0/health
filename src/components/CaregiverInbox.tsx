import React, {useState} from 'react';
import {AlertTriangle, Check, Clock, FileCheck2, MessageSquare, PhoneMissed} from 'lucide-react';
import {apiRequest, formatBengaliDateTime, formatBengaliScheduleTime} from '../lib/api.ts';
import type {
  CallReport,
  CallReportOutcome,
  CaregiverAlert,
  FamilyMember,
  VaultState,
} from '../types.ts';

interface CaregiverInboxProps {
  token: string;
  accountHolderName: string;
  members: FamilyMember[];
  alerts: CaregiverAlert[];
  callReports: CallReport[];
  onVaultUpdated: (vault: VaultState) => void;
}

const SLOT_BN: Record<string, string> = {
  morning: 'সকাল',
  noon: 'দুপুর',
  night: 'রাত',
  symptom: 'সমস্যা চেক-ইন',
};

const RELATION_BN: Record<string, string> = {
  Self: 'নিজে',
  Father: 'বাবা',
  Mother: 'মা',
  Spouse: 'স্ত্রী/স্বামী',
  Child: 'সন্তান',
  Other: 'অন্যান্য',
};

const OUTCOME_META: Record<CallReportOutcome, {label: string; cls: string}> = {
  taken: {label: 'ওষুধ খেয়েছেন ✅', cls: 'text-emerald-700'},
  snoozed: {label: 'পরে খাবেন ⏰', cls: 'text-amber-700'},
  voice_note: {label: 'ভয়েস বক্তব্য 💬', cls: 'text-teal-700'},
  missed: {label: 'মিসড কল', cls: 'text-red-700'},
  rejected: {label: 'কল কেটে দিয়েছেন', cls: 'text-red-700'},
  symptom_ok: {label: 'কোনো সমস্যা নেই ✅', cls: 'text-emerald-700'},
  symptom_logged: {label: 'সমস্যা নোট হয়েছে 📝', cls: 'text-amber-700'},
};

export const CaregiverInbox: React.FC<CaregiverInboxProps> = ({
  token,
  accountHolderName,
  members,
  alerts,
  callReports,
  onVaultUpdated,
}) => {
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');

  const handleMarkRead = async (id: string) => {
    const res = await apiRequest<{vault: VaultState}>(`/api/alerts/${id}/read`, {
      method: 'PATCH',
      token,
    });
    onVaultUpdated(res.vault);
  };

  const buildWhatsAppUrl = (phone: string, message: string) => {
    const digits = phone.replace(/\D/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  };

  const filteredReports =
    selectedMemberFilter === 'all'
      ? callReports
      : callReports.filter((r) => r.memberId === selectedMemberFilter);

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-teal-700">
            অ্যাকাউন্ট হোল্ডার ({accountHolderName})-এর ড্যাশবোর্ড কপি
          </p>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            কেয়ারগিভার ইনবক্স, WhatsApp অ্যালার্ট ও সকল কলের রিপোর্ট
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            প্রতিটি কলের রিপোর্ট সংশ্লিষ্ট সদস্যের পাশাপাশি অ্যাকাউন্ট হোল্ডারের কাছেও সংরক্ষিত থাকে।
          </p>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-xs text-slate-500">মোট কল রিপোর্ট</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-teal-800">
              {callReports.length}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">মোট অ্যালার্ট</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {alerts.length}
            </p>
          </div>
        </div>
      </div>

      {/* Account Holder Synchronized Call Reports Section */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-700 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>অ্যাকাউন্ট হোল্ডারের কল রিপোর্ট কপি</span>
            </p>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              পরিবারের সকল সদস্যের AI কল রিপোর্ট ({filteredReports.length}টি)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedMemberFilter('all')}
              className={`min-h-[36px] px-3 py-1 rounded-xl border text-xs font-semibold transition-colors ${
                selectedMemberFilter === 'all'
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              সকল সদস্য
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMemberFilter(m.id)}
                className={`min-h-[36px] px-3 py-1 rounded-xl border text-xs font-semibold transition-colors ${
                  selectedMemberFilter === m.id
                    ? 'bg-teal-700 border-teal-700 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <div className="py-10 text-center border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700">কোনো কল রিপোর্ট পাওয়া যায়নি</p>
            <p className="text-xs text-slate-500 mt-1">
              যেকোনো সদস্যের ইনকামিং কল সম্পন্ন বা মিসড হলে এখানে রিপোর্ট জমা হবে।
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {filteredReports.map((rep) => {
              const outcomeMeta = OUTCOME_META[rep.outcome];
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
                <article key={rep.id} className="py-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-bold text-slate-900 text-sm">{rep.memberName}</span>
                      <span>({RELATION_BN[rep.memberRelation] || rep.memberRelation})</span>
                      <span>·</span>
                      <span>
                        {rep.slot === 'symptom'
                          ? 'সমস্যা চেক-ইন'
                          : `${SLOT_BN[rep.slot] || rep.slot} বেলা`}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">
                        সময়: {formatBengaliScheduleTime(rep.scheduledTime)}
                      </span>
                      <span>·</span>
                      <span className={`font-bold ${outcomeMeta.cls}`}>{outcomeMeta.label}</span>
                      {typeof rep.durationSeconds === 'number' && (
                        <>
                          <span>·</span>
                          <span className="tabular-nums text-slate-600">{rep.durationSeconds} সেকেন্ড</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {formatBengaliDateTime(rep.createdAt)}
                    </span>
                  </div>

                  {agentFinding && (
                    <div
                      className={`rounded-xl border px-3.5 py-2 text-xs leading-relaxed ${
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
                      <span className="text-xs font-semibold text-slate-500">উত্তর: </span>“{rep.transcript}”
                    </p>
                  )}
                  {rep.aiReply && (
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold text-teal-800">AI এজেন্ট: </span>
                      {rep.aiReply}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Caregiver Escalation & WhatsApp Alerts */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">জরুরি কেয়ারগিভার ও WhatsApp অ্যালার্ট</h2>

        {alerts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-3 text-base font-semibold text-slate-800">কোনো কেয়ারগিভার অ্যালার্ট নেই</p>
            <p className="mt-1 text-sm text-slate-500">
              রোগী ভয়েস কলে সমস্যার কথা বললে বা পরপর ৩ বার কল মিস/রিজেক্ট করলে এখানে দেখা যাবে।
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const isEscalation = alert.type !== 'voice_note';
              const waUrl = buildWhatsAppUrl(alert.whatsappTargetPhone, alert.whatsappMessage);

              return (
                <article
                  key={alert.id}
                  className={`bg-white border rounded-2xl p-5 sm:p-6 transition-colors ${
                    !alert.read
                      ? isEscalation
                        ? 'border-red-300'
                        : 'border-teal-300'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isEscalation
                            ? 'bg-red-50 text-red-700'
                            : 'bg-teal-50 text-teal-700'
                        }`}
                      >
                        {isEscalation ? (
                          <PhoneMissed className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-bold text-slate-900 text-sm">{alert.memberName}</span>
                          <span>·</span>
                          <span>
                            {alert.slot === 'symptom'
                              ? 'সমস্যা চেক-ইন'
                              : `${SLOT_BN[alert.slot] || alert.slot} বেলা`}
                          </span>
                          <span>·</span>
                          <span className="tabular-nums">{formatBengaliDateTime(alert.createdAt)}</span>
                          {!alert.read && (
                            <>
                              <span>·</span>
                              <span className="font-bold text-red-600">নতুন অ্যালার্ট</span>
                            </>
                          )}
                        </div>
                        <h3 className="mt-1 text-base font-bold text-slate-900">{alert.reason}</h3>
                      </div>
                    </div>

                    {typeof alert.durationSeconds === 'number' && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        <span>কথা বলেছেন: {alert.durationSeconds} সেকেন্ড</span>
                      </div>
                    )}
                  </div>

                  {alert.transcript && (
                    <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                      <p className="text-xs font-semibold text-slate-500">রোগীর কণ্ঠস্বরের বিবরণ:</p>
                      <p className="mt-1 text-sm text-slate-900 leading-relaxed">“{alert.transcript}”</p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500 max-w-2xl truncate">
                      WhatsApp প্রিভিউ: {alert.whatsappMessage}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {!alert.read && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(alert.id)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>পড়া হয়েছে</span>
                        </button>
                      )}
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>WhatsApp অ্যালার্ট পাঠান</span>
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
