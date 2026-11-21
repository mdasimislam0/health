import React, {useEffect, useMemo, useState} from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileImage,
  FlaskConical,
  History,
  Pill,
  Stethoscope,
  X,
} from 'lucide-react';
import {formatBengaliDate} from '../lib/api.ts';
import type {FamilyMember, LabReport, Prescription} from '../types.ts';

interface MedicalHistoryTimelineProps {
  member: FamilyMember;
  prescriptions: Prescription[];
  labReports: LabReport[];
  onOpenRecordsTab: () => void;
}

type HistoryFilter = 'all' | 'rx' | 'report';

type TimelineSelection =
  | {kind: 'rx'; id: string}
  | {kind: 'report'; id: string}
  | null;

type TimelineEntry =
  | {
      kind: 'rx';
      id: string;
      date: string;
      sortTime: string;
      rx: Prescription;
    }
  | {
      kind: 'report';
      id: string;
      date: string;
      sortTime: string;
      report: LabReport;
    };

export const MedicalHistoryTimeline: React.FC<MedicalHistoryTimelineProps> = ({
  member,
  prescriptions,
  labReports,
  onOpenRecordsTab,
}) => {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [selection, setSelection] = useState<TimelineSelection>(null);
  const [zoomImage, setZoomImage] = useState<{name: string; url: string} | null>(null);

  // Reset detail view when user switches family profile
  useEffect(() => {
    setSelection(null);
    setZoomImage(null);
  }, [member.id]);

  const memberRx = useMemo(
    () => prescriptions.filter((p) => p.memberId === member.id),
    [prescriptions, member.id]
  );

  const memberReports = useMemo(
    () => labReports.filter((r) => r.memberId === member.id),
    [labReports, member.id]
  );

  const rxById = useMemo(() => {
    const map = new Map<string, Prescription>();
    for (const rx of memberRx) map.set(rx.id, rx);
    return map;
  }, [memberRx]);

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    const items: TimelineEntry[] = [];

    if (filter === 'all' || filter === 'rx') {
      for (const rx of memberRx) {
        items.push({
          kind: 'rx',
          id: rx.id,
          date: rx.visitDate,
          sortTime: rx.createdAt || rx.visitDate,
          rx,
        });
      }
    }

    if (filter === 'all' || filter === 'report') {
      for (const report of memberReports) {
        items.push({
          kind: 'report',
          id: report.id,
          date: report.reportDate,
          sortTime: report.createdAt || report.reportDate,
          report,
        });
      }
    }

    return items.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.sortTime.localeCompare(a.sortTime);
    });
  }, [memberRx, memberReports, filter]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{date: string; entries: TimelineEntry[]}> = [];
    for (const entry of timelineEntries) {
      const last = groups[groups.length - 1];
      if (last && last.date === entry.date) {
        last.entries.push(entry);
      } else {
        groups.push({date: entry.date, entries: [entry]});
      }
    }
    return groups;
  }, [timelineEntries]);

  const selectedRx =
    selection?.kind === 'rx' ? memberRx.find((r) => r.id === selection.id) || null : null;
  const selectedReport =
    selection?.kind === 'report' ? memberReports.find((r) => r.id === selection.id) || null : null;

  // --- Detail View: Doctor Prescription (What medicines & advice were given) ---
  if (selectedRx) {
    const attachedReports = memberReports.filter((r) => r.prescriptionId === selectedRx.id);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>টাইমলাইনে ফিরে যান</span>
          </button>

          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            <CalendarDays className="w-3.5 h-3.5 text-teal-700" />
            <span>ভিজিটের তারিখ: {formatBengaliDate(selectedRx.visitDate)}</span>
          </span>
        </div>

        {/* Doctor Header Card */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-md">
                  ডাক্তার ভিজিট ও প্রেসক্রিপশন
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-1.5">
                  {selectedRx.doctorName}
                </h2>
                {selectedRx.specialty && (
                  <p className="text-sm text-slate-600 mt-0.5">{selectedRx.specialty}</p>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">সদস্য</p>
              <p className="text-sm font-bold text-slate-900">{member.name}</p>
            </div>
          </div>

          {selectedRx.findings && (
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4">
              <p className="text-xs font-bold text-slate-500 mb-1">রোগের বিবরণ (Findings)</p>
              <p className="text-sm text-slate-800 leading-relaxed">{selectedRx.findings}</p>
            </div>
          )}

          {/* Prescribed Medicines */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pill className="w-4 h-4 text-teal-700" />
                <span>ডাক্তার যে ওষুধগুলো দিয়েছেন ({selectedRx.medicines.length}টি)</span>
              </h3>
            </div>

            {selectedRx.medicines.length === 0 ? (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 border border-slate-200">
                এই প্রেসক্রিপশনে কোনো ওষুধের তালিকা সংরক্ষিত নেই।
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedRx.medicines.map((med, idx) => {
                  const slots = [
                    med.morning ? 'সকাল' : null,
                    med.noon ? 'দুপুর' : null,
                    med.night ? 'রাত' : null,
                  ].filter(Boolean) as string[];

                  return (
                    <div
                      key={med.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-700/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-teal-50 text-teal-800 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{med.name}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{med.dosage}</p>
                          </div>
                        </div>
                        {med.duration && (
                          <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md shrink-0">
                            {med.duration}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {slots.length > 0 ? (
                            slots.map((s) => (
                              <span
                                key={s}
                                className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-semibold"
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500">নির্ধারিত স্লট নেই</span>
                          )}
                        </div>
                        {med.mealTiming && (
                          <span className="text-slate-600 font-medium inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {med.mealTiming}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Doctor Advice */}
          {selectedRx.advice && (
            <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-4">
              <p className="text-xs font-bold text-amber-900 mb-1">ডাক্তারের পরামর্শ</p>
              <p className="text-sm text-amber-950 leading-relaxed">{selectedRx.advice}</p>
            </div>
          )}

          {/* Suggested Tests & Linked Reports */}
          {(selectedRx.suggestedTests.length > 0 || attachedReports.length > 0) && (
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-teal-700" />
                <span>সাজেস্টেড টেস্ট ও সংযুক্ত রিপোর্ট</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedRx.suggestedTests.map((t) => {
                  const linked = attachedReports.find(
                    (r) =>
                      r.suggestedTestId === t.id ||
                      r.testName.toLowerCase() === t.name.toLowerCase()
                  );
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{t.name}</p>
                        {linked ? (
                          <p className="text-xs text-slate-500 mt-0.5">
                            রিপোর্ট: {formatBengaliDate(linked.reportDate)} ·{' '}
                            <span
                              className={
                                linked.status === 'Abnormal'
                                  ? 'text-red-700 font-bold'
                                  : 'text-emerald-700 font-bold'
                              }
                            >
                              {linked.status}
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-0.5">রিপোর্ট এখনো যুক্ত হয়নি</p>
                        )}
                      </div>

                      {linked && (
                        <button
                          type="button"
                          onClick={() => setSelection({kind: 'report', id: linked.id})}
                          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-teal-700/40 text-xs font-semibold text-teal-800 inline-flex items-center gap-1"
                        >
                          <span>রিপোর্ট দেখুন</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prescription Uploaded Pages */}
          {selectedRx.pages.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileImage className="w-4 h-4 text-teal-700" />
                <span>প্রেসক্রিপশনের কপি ({selectedRx.pages.length} পাতা)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {selectedRx.pages.map((pg, idx) => (
                  <button
                    key={pg.id}
                    type="button"
                    onClick={() => setZoomImage({name: pg.name || `পাতা ${idx + 1}`, url: pg.dataUrl})}
                    className="group relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 aspect-[3/4] hover:border-teal-700 transition-colors"
                  >
                    <img
                      src={pg.dataUrl}
                      alt={pg.name || `পাতা ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1.5 left-1.5 right-1.5 bg-slate-900/75 text-white text-[11px] font-medium px-2 py-0.5 rounded-md truncate">
                      পাতা {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {zoomImage && (
          <ImageLightbox
            name={zoomImage.name}
            url={zoomImage.url}
            onClose={() => setZoomImage(null)}
          />
        )}
      </div>
    );
  }

  // --- Detail View: Lab Test Report (What report & findings were given) ---
  if (selectedReport) {
    const parentRx = selectedReport.prescriptionId
      ? rxById.get(selectedReport.prescriptionId)
      : undefined;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>টাইমলাইনে ফিরে যান</span>
          </button>

          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            <CalendarDays className="w-3.5 h-3.5 text-teal-700" />
            <span>রিপোর্টের তারিখ: {formatBengaliDate(selectedReport.reportDate)}</span>
          </span>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <FlaskConical className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                    ল্যাব টেস্ট রিপোর্ট
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                      selectedReport.status === 'Abnormal'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {selectedReport.status === 'Abnormal' ? 'Abnormal (সতর্কতা)' : 'Normal (স্বাভাবিক)'}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1.5">
                  {selectedReport.testName}
                </h2>
                {selectedReport.labOrDoctorName && (
                  <p className="text-sm text-slate-600 mt-0.5">
                    ল্যাব/ডাক্তার: {selectedReport.labOrDoctorName}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">সদস্য</p>
              <p className="text-sm font-bold text-slate-900">{member.name}</p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4">
            <p className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
              <span>রিপোর্টের ফলাফল ও বিস্তারিত ফাইন্ডিংস</span>
            </p>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
              {selectedReport.findings || 'এই রিপোর্টে কোনো অতিরিক্ত ফাইন্ডিংস লেখা নেই।'}
            </p>
          </div>

          {parentRx && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-bold text-teal-800">সম্পর্কিত ডাক্তার ভিজিট</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {parentRx.doctorName} · {formatBengaliDate(parentRx.visitDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelection({kind: 'rx', id: parentRx.id})}
                className="px-3 py-2 rounded-xl bg-white border border-teal-200 hover:border-teal-700 text-xs font-bold text-teal-800 inline-flex items-center gap-1"
              >
                <span>প্রেসক্রিপশন ও ওষুধ দেখুন</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {selectedReport.pages.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileImage className="w-4 h-4 text-indigo-700" />
                <span>রিপোর্টের কপি ({selectedReport.pages.length} পাতা)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {selectedReport.pages.map((pg, idx) => (
                  <button
                    key={pg.id}
                    type="button"
                    onClick={() => setZoomImage({name: pg.name || `পাতা ${idx + 1}`, url: pg.dataUrl})}
                    className="group relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 aspect-[3/4] hover:border-indigo-600 transition-colors"
                  >
                    <img
                      src={pg.dataUrl}
                      alt={pg.name || `পাতা ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1.5 left-1.5 right-1.5 bg-slate-900/75 text-white text-[11px] font-medium px-2 py-0.5 rounded-md truncate">
                      পাতা {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {zoomImage && (
          <ImageLightbox
            name={zoomImage.name}
            url={zoomImage.url}
            onClose={() => setZoomImage(null)}
          />
        )}
      </div>
    );
  }

  // --- Main Chronological Date-Wise Timeline View ---
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-md mb-1.5">
            <History className="w-3.5 h-3.5" />
            <span>মেডিকেল হিস্ট্রি টাইমলাইন</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {member.name}-এর তারিখভিত্তিক হিস্ট্রি
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            কোন তারিখে কোন ডাক্তার দেখানো হয়েছে বা কোন টেস্ট হয়েছে তা দেখুন এবং বিস্তারিত জানতে ক্লিক করুন।
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="inline-flex items-center rounded-xl bg-white border border-slate-200 p-1 self-start sm:self-auto">
          {(
            [
              {id: 'all', label: `সব (${memberRx.length + memberReports.length})`},
              {id: 'rx', label: `ডাক্তার (${memberRx.length})`},
              {id: 'report', label: `টেস্ট (${memberReports.length})`},
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === tab.id
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {groupedByDate.length === 0 ? (
        <section className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <History className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            এখনো কোনো হিস্ট্রি যুক্ত করা হয়নি
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {member.name}-এর প্রেসক্রিপশন বা টেস্ট রিপোর্ট যুক্ত করলে তারিখ অনুযায়ী এখানে সম্পূর্ণ টাইমলাইন দেখা যাবে।
          </p>
          <button
            type="button"
            onClick={onOpenRecordsTab}
            className="mt-2 min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition-colors"
          >
            প্রেসক্রিপশন ও টেস্ট যোগ করুন
          </button>
        </section>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-8 before:content-[''] before:absolute before:left-[11px] sm:before:left-[15px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {groupedByDate.map((group) => (
            <section key={group.date} className="relative space-y-3">
              {/* Timeline Date Marker */}
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="absolute -left-[22px] sm:-left-[24px] w-4 h-4 rounded-full bg-teal-700 border-[3px] border-[#F7F9F9] ring-2 ring-teal-700/25"
                />
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-xs">
                  <CalendarDays className="w-3.5 h-3.5 text-teal-700" />
                  <span>{formatBengaliDate(group.date)}</span>
                </span>
              </div>

              {/* Entries on this date */}
              <div className="space-y-2.5">
                {group.entries.map((entry) => {
                  if (entry.kind === 'rx') {
                    const {rx} = entry;
                    return (
                      <button
                        key={`rx_${rx.id}`}
                        type="button"
                        onClick={() => setSelection({kind: 'rx', id: rx.id})}
                        className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-teal-700/50 hover:shadow-sm p-4 sm:p-5 transition-all flex items-center justify-between gap-4 group"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                            <Stethoscope className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                                ডাক্তার ভিজিট
                              </span>
                              {rx.specialty && (
                                <span className="text-xs text-slate-500 truncate">
                                  {rx.specialty}
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-slate-900 mt-1 truncate group-hover:text-teal-800 transition-colors">
                              {rx.doctorName}
                            </h3>
                            {rx.findings && (
                              <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                                {rx.findings}
                              </p>
                            )}
                            <p className="text-xs font-medium text-slate-500 mt-2">
                              {rx.medicines.length}টি ওষুধ দেওয়া হয়েছে
                              {rx.suggestedTests.length > 0
                                ? ` · ${rx.suggestedTests.length}টি টেস্ট সাজেস্ট`
                                : ''}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-teal-700">
                          <span className="hidden sm:inline">ওষুধ ও প্রেসক্রিপশন দেখুন</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    );
                  }

                  const {report} = entry;
                  const parentRx = report.prescriptionId
                    ? rxById.get(report.prescriptionId)
                    : undefined;

                  return (
                    <button
                      key={`rep_${report.id}`}
                      type="button"
                      onClick={() => setSelection({kind: 'report', id: report.id})}
                      className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-indigo-600/50 hover:shadow-sm p-4 sm:p-5 transition-all flex items-center justify-between gap-4 group"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                          <FlaskConical className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded">
                              টেস্ট রিপোর্ট
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                report.status === 'Abnormal'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {report.status}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 mt-1 truncate group-hover:text-indigo-800 transition-colors">
                            {report.testName}
                          </h3>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">
                            {report.labOrDoctorName || 'ল্যাব রিপোর্ট'}
                            {parentRx ? ` · (${parentRx.doctorName})` : ''}
                          </p>
                          {report.findings && (
                            <p className="text-xs text-slate-500 mt-1.5 line-clamp-1">
                              {report.findings}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                        <span className="hidden sm:inline">রিপোর্ট দেখুন</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

interface ImageLightboxProps {
  name: string;
  url: string;
  onClose: () => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({name, url, onClose}) => (
  <div
    className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-900 truncate">{name}</p>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600"
          aria-label="বন্ধ করুন"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-[80vh] overflow-auto bg-slate-50 flex items-center justify-center p-3">
        <img src={url} alt={name} className="max-w-full h-auto rounded-lg" />
      </div>
    </div>
  </div>
);
