import React, {useEffect, useRef, useState} from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  FilePlus2,
  FlaskConical,
  Layers,
  Plus,
  Printer,
  ScanLine,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {apiRequest, fileToDataUrl, formatBengaliDate, formatBengaliDateTime} from '../lib/api.ts';
import type {
  FamilyMember,
  LabReport,
  MedicineItem,
  PageImage,
  Prescription,
  ReportResultStatus,
  SymptomNote,
  VaultState,
} from '../types.ts';

interface PrescriptionLabHubProps {
  token: string;
  member: FamilyMember;
  prescriptions: Prescription[];
  labReports: LabReport[];
  symptomNotes: SymptomNote[];
  focusedPrescriptionId?: string | null;
  onClearFocusedPrescription?: () => void;
  onVaultUpdated: (vault: VaultState) => void;
}

interface InlineTestDraft {
  id: string;
  name: string;
  showReportPanel: boolean;
  existingReportId?: string;
  reportDate: string;
  labOrDoctorName: string;
  status: ReportResultStatus;
  findings: string;
  pages: PageImage[];
  scanning?: boolean;
}

interface RxDraft {
  id?: string;
  visitDate: string;
  doctorName: string;
  specialty: string;
  findings: string;
  medicines: MedicineItem[];
  suggestedTests: InlineTestDraft[];
  advice: string;
  pages: PageImage[];
}

interface ReportDraft {
  id?: string;
  prescriptionId?: string;
  suggestedTestId?: string;
  testName: string;
  reportDate: string;
  labOrDoctorName: string;
  status: ReportResultStatus;
  findings: string;
  pages: PageImage[];
}

const emptyMedicine = (): MedicineItem => ({
  id: `med_${Math.random().toString(36).slice(2, 9)}`,
  name: '',
  dosage: '১টি ট্যাবলেট',
  morning: true,
  noon: false,
  night: false,
  mealTiming: 'খাবারের পর',
  duration: '১৫ দিন',
});

const emptyInlineTest = (today: string, openPanel = true): InlineTestDraft => ({
  id: `tst_${Math.random().toString(36).slice(2, 9)}`,
  name: '',
  showReportPanel: openPanel,
  reportDate: today,
  labOrDoctorName: '',
  status: 'Normal',
  findings: '',
  pages: [],
});

export const PrescriptionLabHub: React.FC<PrescriptionLabHubProps> = ({
  token,
  member,
  prescriptions,
  labReports,
  symptomNotes,
  focusedPrescriptionId,
  onClearFocusedPrescription,
  onVaultUpdated,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [highlightedRxId, setHighlightedRxId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusedPrescriptionId) return;
    setHighlightedRxId(focusedPrescriptionId);
    const scrollTimer = window.setTimeout(() => {
      const el = document.getElementById(`rx-${focusedPrescriptionId}`);
      if (el) {
        el.scrollIntoView({behavior: 'smooth', block: 'center'});
      }
      onClearFocusedPrescription?.();
    }, 100);
    const clearTimer = window.setTimeout(() => {
      setHighlightedRxId((curr) => (curr === focusedPrescriptionId ? null : curr));
    }, 3200);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusedPrescriptionId, onClearFocusedPrescription]);

  // Prescription Modal State
  const [rxDraft, setRxDraft] = useState<RxDraft | null>(null);
  const [scanningRx, setScanningRx] = useState(false);
  const [savingRx, setSavingRx] = useState(false);
  const [rxError, setRxError] = useState<string | null>(null);
  const rxFileInputRef = useRef<HTMLInputElement | null>(null);
  const rxCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Report Modal State (Inline or Standalone or Edit)
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);
  const [scanningReport, setScanningReport] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const reportFileInputRef = useRef<HTMLInputElement | null>(null);
  const reportCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Printable Clinical Summary Modal
  const [summaryRx, setSummaryRx] = useState<Prescription | null>(null);

  useEffect(() => {
    if (!summaryRx) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSummaryRx(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [summaryRx]);

  const memberRx = [...prescriptions]
    .filter((p) => p.memberId === member.id)
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  const memberReports = [...labReports]
    .filter((r) => r.memberId === member.id)
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate));

  const standaloneReports = memberReports.filter((r) => !r.prescriptionId);
  const memberSymptoms = symptomNotes.filter((s) => s.memberId === member.id);

  type TimelineEntry =
    | {kind: 'rx'; date: string; item: Prescription}
    | {kind: 'report'; date: string; item: LabReport};

  const timeline: TimelineEntry[] = [
    ...memberRx.map((item) => ({kind: 'rx' as const, date: item.visitDate, item})),
    ...standaloneReports.map((item) => ({kind: 'report' as const, date: item.reportDate, item})),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const openNewPrescription = () => {
    setRxError(null);
    setRxDraft({
      visitDate: today,
      doctorName: '',
      specialty: '',
      findings: '',
      medicines: [emptyMedicine()],
      suggestedTests: [],
      advice: '',
      pages: [],
    });
  };

  const openEditPrescription = (rx: Prescription) => {
    setRxError(null);
    const attached = memberReports.filter((r) => r.prescriptionId === rx.id);
    setRxDraft({
      id: rx.id,
      visitDate: rx.visitDate,
      doctorName: rx.doctorName,
      specialty: rx.specialty,
      findings: rx.findings,
      medicines: rx.medicines.length > 0 ? rx.medicines.map((m) => ({...m})) : [emptyMedicine()],
      suggestedTests: rx.suggestedTests.map((t) => {
        const linked = attached.find(
          (r) => r.suggestedTestId === t.id || r.testName.toLowerCase() === t.name.toLowerCase()
        );
        return {
          id: t.id,
          name: t.name,
          showReportPanel: Boolean(linked),
          existingReportId: linked?.id,
          reportDate: linked?.reportDate || today,
          labOrDoctorName: linked?.labOrDoctorName || '',
          status: linked?.status || 'Normal',
          findings: linked?.findings || '',
          pages: linked?.pages ? [...linked.pages] : [],
        };
      }),
      advice: rx.advice,
      pages: [...rx.pages],
    });
  };

  const handleAddRxPages = async (files: FileList | null) => {
    if (!files || !rxDraft) return;
    const newPages: PageImage[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file);
      newPages.push({
        id: `pg_${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        dataUrl,
      });
    }
    setRxDraft({...rxDraft, pages: [...rxDraft.pages, ...newPages]});
  };

  const handleUseSamplePrescription = async () => {
    const sampleUrl = '/src/assets/images/sample_prescription_doc_1795272679369.jpg';
    const baseDraft: RxDraft = rxDraft || {
      visitDate: today,
      doctorName: '',
      specialty: '',
      findings: '',
      medicines: [],
      suggestedTests: [],
      advice: '',
      pages: [],
    };
    const updatedDraft: RxDraft = {
      ...baseDraft,
      pages: [
        ...baseDraft.pages,
        {
          id: `pg_sample_${Date.now()}`,
          name: 'sample_prescription.jpg',
          dataUrl: sampleUrl,
        },
      ],
    };
    setRxDraft(updatedDraft);
    await runAiScanPrescription(updatedDraft);
  };

  const runAiScanPrescription = async (draftToScan?: RxDraft) => {
    const target = draftToScan || rxDraft;
    if (!target || target.pages.length === 0) {
      setRxError('AI স্ক্যান করতে আগে কমপক্ষে ১ পাতা প্রেসক্রিপশনের ছবি যুক্ত করুন।');
      return;
    }
    setRxError(null);
    setScanningRx(true);
    try {
      const res = await apiRequest<{
        extracted: {
          visitDate?: string;
          doctorName?: string;
          specialty?: string;
          findings?: string;
          medicines?: Array<{
            name: string;
            dosage: string;
            morning: boolean;
            noon: boolean;
            night: boolean;
            mealTiming: string;
            duration: string;
          }>;
          suggestedTests?: string[];
          advice?: string;
        };
      }>('/api/ai/scan-prescription', {
        method: 'POST',
        token,
        body: {images: target.pages.map((p) => ({dataUrl: p.dataUrl}))},
      });

      const ext = res.extracted;
      setRxDraft((curr) => {
        if (!curr) return null;
        return {
          ...curr,
          visitDate: ext.visitDate || curr.visitDate || today,
          doctorName: ext.doctorName || curr.doctorName,
          specialty: ext.specialty || curr.specialty,
          findings: ext.findings || curr.findings,
          medicines:
            Array.isArray(ext.medicines) && ext.medicines.length > 0
              ? ext.medicines.map((m) => ({
                  id: `med_${Math.random().toString(36).slice(2, 9)}`,
                  name: m.name || '',
                  dosage: m.dosage || '১টি',
                  morning: Boolean(m.morning),
                  noon: Boolean(m.noon),
                  night: Boolean(m.night),
                  mealTiming: m.mealTiming || 'খাবারের পর',
                  duration: m.duration || 'চলমান',
                }))
              : curr.medicines,
          suggestedTests:
            Array.isArray(ext.suggestedTests) && ext.suggestedTests.length > 0
              ? ext.suggestedTests.map((t) => ({
                  ...emptyInlineTest(today, false),
                  name: t,
                }))
              : curr.suggestedTests,
          advice: ext.advice || curr.advice,
        };
      });
    } catch (err) {
      setRxError(err instanceof Error ? err.message : 'AI স্ক্যান ব্যর্থ হয়েছে');
    } finally {
      setScanningRx(false);
    }
  };

  // Inline Test Image Capture / Upload + Automatic AI Report Gather inside Prescription Modal
  const handleAddInlineTestPages = async (
    testId: string,
    files: FileList | null,
    autoGather = false
  ) => {
    if (!files || files.length === 0) return;
    const newPages: PageImage[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file);
      newPages.push({
        id: `tpg_${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        dataUrl,
      });
    }

    const existingTest = rxDraft?.suggestedTests.find((t) => t.id === testId);
    const combinedPages = [...(existingTest?.pages || []), ...newPages];

    setRxDraft((curr) => {
      if (!curr) return null;
      return {
        ...curr,
        suggestedTests: curr.suggestedTests.map((t) =>
          t.id === testId ? {...t, showReportPanel: true, pages: [...t.pages, ...newPages]} : t
        ),
      };
    });

    if (autoGather && combinedPages.length > 0) {
      await runAiScanInlineTest(testId, combinedPages);
    }
  };

  const runAiScanInlineTest = async (testId: string, explicitPages?: PageImage[]) => {
    const testItem = rxDraft?.suggestedTests.find((t) => t.id === testId);
    const pagesToScan = explicitPages || testItem?.pages || [];
    if (pagesToScan.length === 0) {
      setRxError('টেস্ট রিপোর্ট গ্যাদার করতে আগে টেস্টের ছবি তুলুন বা আপলোড করুন।');
      return;
    }

    setRxError(null);
    setRxDraft((curr) =>
      curr
        ? {
            ...curr,
            suggestedTests: curr.suggestedTests.map((t) =>
              t.id === testId ? {...t, scanning: true} : t
            ),
          }
        : null
    );

    try {
      const res = await apiRequest<{
        extracted: {
          testName?: string;
          reportDate?: string;
          labOrDoctorName?: string;
          status?: string;
          findings?: string;
        };
      }>('/api/ai/scan-report', {
        method: 'POST',
        token,
        body: {images: pagesToScan.map((p) => ({dataUrl: p.dataUrl}))},
      });
      const ext = res.extracted;
      setRxDraft((curr) =>
        curr
          ? {
              ...curr,
              suggestedTests: curr.suggestedTests.map((t) =>
                t.id === testId
                  ? {
                      ...t,
                      name: ext.testName || t.name,
                      reportDate: ext.reportDate || t.reportDate || today,
                      labOrDoctorName: ext.labOrDoctorName || t.labOrDoctorName,
                      status: ext.status === 'Abnormal' ? 'Abnormal' : 'Normal',
                      findings: ext.findings || t.findings,
                      scanning: false,
                    }
                  : t
              ),
            }
          : null
      );
    } catch (err) {
      setRxError(err instanceof Error ? err.message : 'টেস্ট রিপোর্ট স্ক্যান ব্যর্থ হয়েছে');
      setRxDraft((curr) =>
        curr
          ? {
              ...curr,
              suggestedTests: curr.suggestedTests.map((t) =>
                t.id === testId ? {...t, scanning: false} : t
              ),
            }
          : null
      );
    }
  };

  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rxDraft) return;
    setRxError(null);
    setSavingRx(true);
    try {
      const validTests = rxDraft.suggestedTests.filter(
        (t) => t.name.trim() || t.pages.length > 0 || t.findings.trim()
      );
      const payload = {
        memberId: member.id,
        visitDate: rxDraft.visitDate,
        doctorName: rxDraft.doctorName,
        specialty: rxDraft.specialty,
        findings: rxDraft.findings,
        medicines: rxDraft.medicines.filter((m) => m.name.trim()),
        suggestedTests: validTests.map((t) => ({
          id: t.id,
          name: t.name.trim() || 'ল্যাব টেস্ট রিপোর্ট',
        })),
        advice: rxDraft.advice,
        pages: rxDraft.pages,
      };

      let latestVault: VaultState;
      let savedRxId = rxDraft.id;

      if (rxDraft.id) {
        const res = await apiRequest<{vault: VaultState}>(`/api/prescriptions/${rxDraft.id}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
        latestVault = res.vault;
      } else {
        const res = await apiRequest<{vault: VaultState; prescription: Prescription}>(
          '/api/prescriptions',
          {
            method: 'POST',
            token,
            body: payload,
          }
        );
        latestVault = res.vault;
        savedRxId = res.prescription.id;
      }

      // Persist any inline test reports gathered/edited inside the prescription modal
      for (const t of validTests) {
        const hasReportData =
          t.pages.length > 0 || t.findings.trim().length > 0 || t.labOrDoctorName.trim().length > 0;
        if (!hasReportData && !t.existingReportId) continue;

        const reportPayload = {
          memberId: member.id,
          prescriptionId: savedRxId,
          suggestedTestId: t.id,
          testName: t.name.trim() || 'ল্যাব টেস্ট রিপোর্ট',
          reportDate: t.reportDate || rxDraft.visitDate || today,
          labOrDoctorName: t.labOrDoctorName.trim() || rxDraft.doctorName || 'ল্যাব রিপোর্ট',
          status: t.status,
          findings: t.findings.trim(),
          pages: t.pages,
        };

        if (t.existingReportId) {
          const repRes = await apiRequest<{vault: VaultState}>(`/api/reports/${t.existingReportId}`, {
            method: 'PATCH',
            token,
            body: reportPayload,
          });
          latestVault = repRes.vault;
        } else {
          const repRes = await apiRequest<{vault: VaultState}>('/api/reports', {
            method: 'POST',
            token,
            body: reportPayload,
          });
          latestVault = repRes.vault;
        }
      }

      onVaultUpdated(latestVault);
      setRxDraft(null);
    } catch (err) {
      setRxError(err instanceof Error ? err.message : 'প্রেসক্রিপশন সেভ করা যায়নি');
    } finally {
      setSavingRx(false);
    }
  };

  const openInlineReport = (rx: Prescription, test: {id: string; name: string}) => {
    setReportError(null);
    setReportDraft({
      prescriptionId: rx.id,
      suggestedTestId: test.id,
      testName: test.name,
      reportDate: today,
      labOrDoctorName: '',
      status: 'Normal',
      findings: '',
      pages: [],
    });
  };

  const openEditReport = (rep: LabReport) => {
    setReportError(null);
    setReportDraft({
      id: rep.id,
      prescriptionId: rep.prescriptionId,
      suggestedTestId: rep.suggestedTestId,
      testName: rep.testName,
      reportDate: rep.reportDate,
      labOrDoctorName: rep.labOrDoctorName,
      status: rep.status,
      findings: rep.findings,
      pages: [...rep.pages],
    });
  };

  const openStandaloneReport = () => {
    setReportError(null);
    setReportDraft({
      testName: '',
      reportDate: today,
      labOrDoctorName: '',
      status: 'Normal',
      findings: '',
      pages: [],
    });
  };

  const handleAddReportPages = async (files: FileList | null, autoScan = false) => {
    if (!files || !reportDraft) return;
    const newPages: PageImage[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file);
      newPages.push({
        id: `rpg_${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        dataUrl,
      });
    }
    const updatedDraft: ReportDraft = {
      ...reportDraft,
      pages: [...reportDraft.pages, ...newPages],
    };
    setReportDraft(updatedDraft);
    if (autoScan && updatedDraft.pages.length > 0) {
      await runAiScanReport(updatedDraft);
    }
  };

  const runAiScanReport = async (draftOverride?: ReportDraft) => {
    const target = draftOverride || reportDraft;
    if (!target || target.pages.length === 0) {
      setReportError('AI স্ক্যানের জন্য আগে রিপোর্টের ছবি যুক্ত করুন।');
      return;
    }
    setReportError(null);
    setScanningReport(true);
    try {
      const res = await apiRequest<{
        extracted: {
          testName?: string;
          reportDate?: string;
          labOrDoctorName?: string;
          status?: string;
          findings?: string;
        };
      }>('/api/ai/scan-report', {
        method: 'POST',
        token,
        body: {images: target.pages.map((p) => ({dataUrl: p.dataUrl}))},
      });
      const ext = res.extracted;
      setReportDraft((curr) =>
        curr
          ? {
              ...curr,
              testName: ext.testName || curr.testName,
              reportDate: ext.reportDate || curr.reportDate,
              labOrDoctorName: ext.labOrDoctorName || curr.labOrDoctorName,
              status: ext.status === 'Abnormal' ? 'Abnormal' : 'Normal',
              findings: ext.findings || curr.findings,
            }
          : null
      );
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'AI রিপোর্ট স্ক্যান ব্যর্থ হয়েছে');
    } finally {
      setScanningReport(false);
    }
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDraft) return;
    setReportError(null);
    setSavingReport(true);
    try {
      const res = reportDraft.id
        ? await apiRequest<{vault: VaultState}>(`/api/reports/${reportDraft.id}`, {
            method: 'PATCH',
            token,
            body: {
              ...reportDraft,
              memberId: member.id,
            },
          })
        : await apiRequest<{vault: VaultState}>('/api/reports', {
            method: 'POST',
            token,
            body: {
              memberId: member.id,
              ...reportDraft,
            },
          });
      onVaultUpdated(res.vault);
      setReportDraft(null);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'রিপোর্ট সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setSavingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            প্রেসক্রিপশন ও টেস্ট রিপোর্ট — {member.name}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            তারিখভিত্তিক ভিজিট হিস্ট্রি, মাল্টি-পেজ AI স্ক্যান, ইনলাইন টেস্ট রিপোর্ট এবং ক্লিনিক্যাল PDF সামারি
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={openStandaloneReport}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <FlaskConical className="w-4 h-4 text-teal-700" />
            <span>+ আলাদা টেস্ট রিপোর্ট</span>
          </button>

          <button
            type="button"
            onClick={openNewPrescription}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>+ নতুন প্রেসক্রিপশন (AI স্ক্যান)</span>
          </button>
        </div>
      </div>

      {/* Chronological Timeline */}
      {timeline.length === 0 ? (
        <div className="no-print bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <FilePlus2 className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="mt-3 text-base font-bold text-slate-900">কোনো প্রেসক্রিপশন বা রিপোর্ট নেই</p>
          <p className="mt-1 text-sm text-slate-500">
            প্রথম প্রেসক্রিপশন স্ক্যান করুন অথবা পুরনো টেস্ট রিপোর্ট আপলোড করুন।
          </p>
          <button
            type="button"
            onClick={openNewPrescription}
            className="mt-5 min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800"
          >
            নতুন প্রেসক্রিপশন যুক্ত করুন
          </button>
        </div>
      ) : (
        <div className="no-print space-y-6">
          {timeline.map((entry) => {
            if (entry.kind === 'report') {
              const rep = entry.item;
              return (
                <article
                  key={rep.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 tabular-nums">
                        স্বতন্ত্র ল্যাব রিপোর্ট · {formatBengaliDate(rep.reportDate)} · {rep.labOrDoctorName}
                      </p>
                      <h2 className="mt-1 text-lg font-bold text-slate-900">{rep.testName}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-bold ${
                          rep.status === 'Abnormal' ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {rep.status === 'Abnormal' ? '⚠ Abnormal' : '✓ Normal'}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditReport(rep)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>এডিট</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{rep.findings}</p>
                  {rep.pages.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {rep.pages.map((pg, idx) => (
                        <img
                          key={pg.id}
                          src={pg.dataUrl}
                          alt={`রিপোর্ট পাতা ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-20 h-24 object-cover rounded-lg border border-slate-200"
                        />
                      ))}
                    </div>
                  )}
                </article>
              );
            }

            const rx = entry.item;
            const attachedReports = memberReports.filter((r) => r.prescriptionId === rx.id);

            return (
              <article
                id={`rx-${rx.id}`}
                key={rx.id}
                className={`bg-white border rounded-2xl p-6 space-y-5 transition-all ${
                  highlightedRxId === rx.id
                    ? 'border-teal-600 ring-2 ring-teal-600/20'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <p className="text-xs font-medium text-slate-500 tabular-nums">
                      ভিজিট তারিখ: {formatBengaliDate(rx.visitDate)} · {rx.specialty || 'চিকিৎসক পরামর্শ'}
                      {rx.pages.length > 0 ? ` · ${rx.pages.length} পাতা সংযুক্ত` : ''}
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">{rx.doctorName}</h2>
                    <p className="mt-1 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">রোগের বিবরণ (Findings):</span>{' '}
                      {rx.findings || 'উল্লেখ নেই'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditPrescription(rx)}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>এডিট</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummaryRx(rx)}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Clinical PDF সামারি</span>
                    </button>
                  </div>
                </div>

                {/* Medicines Table */}
                {rx.medicines.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2">ওষুধের তালিকা ও খাওয়ার নিয়ম</h3>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-4 font-semibold">ওষুধের নাম</th>
                            <th className="py-2.5 px-4 font-semibold">মাত্রা</th>
                            <th className="py-2.5 px-4 font-semibold tabular-nums">সকাল · দুপুর · রাত</th>
                            <th className="py-2.5 px-4 font-semibold">নিয়ম ও মেয়াদ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rx.medicines.map((med) => (
                            <tr key={med.id} className="hover:bg-slate-50/60">
                              <td className="py-2.5 px-4 font-semibold text-slate-900">{med.name}</td>
                              <td className="py-2.5 px-4 text-slate-700">{med.dosage}</td>
                              <td className="py-2.5 px-4 font-mono tabular-nums text-slate-900">
                                {med.morning ? '১' : '০'} + {med.noon ? '১' : '০'} + {med.night ? '১' : '০'}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">
                                {med.mealTiming} · {med.duration}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Suggested Tests + Inline Report Attachment */}
                {rx.suggestedTests.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2">
                      সাজেস্টেড টেস্ট ও সংযুক্ত রিপোর্ট
                    </h3>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {rx.suggestedTests.map((test) => {
                        const linked = attachedReports.filter(
                          (r) => r.suggestedTestId === test.id || r.testName.toLowerCase() === test.name.toLowerCase()
                        );
                        return (
                          <div key={test.id} className="p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">{test.name}</p>
                              <button
                                type="button"
                                onClick={() => openInlineReport(rx, test)}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-teal-700/30 bg-teal-50 text-teal-800 text-xs font-semibold hover:bg-teal-100 transition-colors whitespace-nowrap"
                              >
                                + রিপোর্ট দিন
                              </button>
                            </div>

                            {linked.map((rep) => (
                              <div
                                key={rep.id}
                                className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <span className="text-slate-600 tabular-nums">
                                    তারিখ: {formatBengaliDate(rep.reportDate)} · {rep.labOrDoctorName}
                                  </span>
                                  <div className="flex items-center gap-2.5">
                                    <span
                                      className={`font-bold ${
                                        rep.status === 'Abnormal' ? 'text-red-700' : 'text-emerald-700'
                                      }`}
                                    >
                                      {rep.status === 'Abnormal' ? '⚠ Abnormal' : '✓ Normal'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openEditReport(rep)}
                                      className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-semibold flex items-center gap-1"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>এডিট</span>
                                    </button>
                                  </div>
                                </div>
                                <p className="text-sm text-slate-800">{rep.findings}</p>
                                {rep.pages.length > 0 && (
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    {rep.pages.map((pg, idx) => (
                                      <img
                                        key={pg.id}
                                        src={pg.dataUrl}
                                        alt={`রিপোর্ট পাতা ${idx + 1}`}
                                        referrerPolicy="no-referrer"
                                        className="w-16 h-20 object-cover rounded-md border border-slate-200"
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {rx.advice && (
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">ডাক্তারের পরামর্শ:</span> {rx.advice}
                  </p>
                )}

                {rx.pages.length > 0 && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {rx.pages.map((pg, idx) => (
                      <div key={pg.id} className="text-center">
                        <img
                          src={pg.dataUrl}
                          alt={`প্রেসক্রিপশন পাতা ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-20 h-28 object-cover rounded-lg border border-slate-200"
                        />
                        <span className="block text-[11px] text-slate-500 mt-1 tabular-nums">
                          পাতা {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Prescription AI Scan & Edit Modal */}
      {rxDraft && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-xl my-8 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {rxDraft.id ? 'প্রেসক্রিপশন ও টেস্ট এডিট করুন' : 'AI প্রেসক্রিপশন স্ক্যান ও মাল্টি-পেজ আপলোড'}
                </h2>
                <p className="text-xs text-slate-500">
                  ছবি তুলে বা আপলোড করে AI দিয়ে তথ্য আলাদা করুন, টেস্টের রিপোর্টও এখানেই যোগ ও এডিট করা যাবে
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRxDraft(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrescription} className="p-6 space-y-5 overflow-y-auto">
              {rxError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {rxError}
                </div>
              )}

              {/* Multi-Page Prescription Capture + Upload + More + Sample AI Test */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-teal-700" />
                      <span>প্রেসক্রিপশন পাতা ({rxDraft.pages.length}টি সংযুক্ত)</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      একাধিক পাতা হলে “+ আরো পাতা (More)” চেপে পরপর যুক্ত করুন
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={rxCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        handleAddRxPages(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <input
                      ref={rxFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleAddRxPages(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => rxCameraInputRef.current?.click()}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-teal-700" />
                      <span>ছবি তুলুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rxFileInputRef.current?.click()}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{rxDraft.pages.length > 0 ? '+ আরো পাতা (More)' : 'পাতা আপলোড'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={scanningRx}
                      onClick={handleUseSamplePrescription}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-teal-700/30 bg-teal-50 text-xs font-semibold text-teal-800 hover:bg-teal-100 flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>নমুনা প্রেসক্রিপশন AI টেস্ট</span>
                    </button>

                    {rxDraft.pages.length > 0 && (
                      <button
                        type="button"
                        disabled={scanningRx}
                        onClick={() => runAiScanPrescription()}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 flex items-center gap-1.5 disabled:opacity-60"
                      >
                        <ScanLine className="w-3.5 h-3.5" />
                        <span>{scanningRx ? 'AI স্ক্যান চলছে...' : 'AI স্ক্যান চালান'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {rxDraft.pages.length > 0 && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {rxDraft.pages.map((pg, idx) => (
                      <div key={pg.id} className="relative group">
                        <img
                          src={pg.dataUrl}
                          alt={`পাতা ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-20 h-24 object-cover rounded-lg border border-slate-300"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setRxDraft({
                              ...rxDraft,
                              pages: rxDraft.pages.filter((p) => p.id !== pg.id),
                            })
                          }
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                          title="পাতা সরান"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <span className="block text-[11px] text-center text-slate-600 mt-1">
                          পাতা {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ভিজিটের তারিখ</label>
                  <input
                    type="date"
                    value={rxDraft.visitDate}
                    onChange={(e) => setRxDraft({...rxDraft, visitDate: e.target.value})}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ডাক্তারের নাম</label>
                  <input
                    type="text"
                    value={rxDraft.doctorName}
                    onChange={(e) => setRxDraft({...rxDraft, doctorName: e.target.value})}
                    placeholder="যেমন: ডা. মাহমুদুল হাসান"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">বিভাগ / স্পেশালিটি</label>
                  <input
                    type="text"
                    value={rxDraft.specialty}
                    onChange={(e) => setRxDraft({...rxDraft, specialty: e.target.value})}
                    placeholder="যেমন: মেডিসিন ও কার্ডিওলজি"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  রোগের বিবরণ / ডায়াগনসিস (Findings)
                </label>
                <textarea
                  rows={2}
                  value={rxDraft.findings}
                  onChange={(e) => setRxDraft({...rxDraft, findings: e.target.value})}
                  placeholder="রোগের বিবরণ ও পরীক্ষা-নিরীক্ষার তথ্য..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              {/* Editable Medicines List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">ওষুধের তালিকা ও সময়</label>
                  <button
                    type="button"
                    onClick={() =>
                      setRxDraft({...rxDraft, medicines: [...rxDraft.medicines, emptyMedicine()]})
                    }
                    className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ওষুধ যোগ করুন</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {rxDraft.medicines.map((med, idx) => (
                    <div
                      key={med.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={med.name}
                        onChange={(e) => {
                          const next = [...rxDraft.medicines];
                          next[idx] = {...med, name: e.target.value};
                          setRxDraft({...rxDraft, medicines: next});
                        }}
                        placeholder="ওষুধের নাম"
                        className="sm:col-span-4 min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                      <input
                        type="text"
                        value={med.dosage}
                        onChange={(e) => {
                          const next = [...rxDraft.medicines];
                          next[idx] = {...med, dosage: e.target.value};
                          setRxDraft({...rxDraft, medicines: next});
                        }}
                        placeholder="মাত্রা"
                        className="sm:col-span-2 min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                      <div className="sm:col-span-3 flex items-center gap-2 text-xs">
                        {(['morning', 'noon', 'night'] as const).map((slotKey) => (
                          <label key={slotKey} className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={med[slotKey]}
                              onChange={(e) => {
                                const next = [...rxDraft.medicines];
                                next[idx] = {...med, [slotKey]: e.target.checked};
                                setRxDraft({...rxDraft, medicines: next});
                              }}
                              className="rounded text-teal-700"
                            />
                            <span>{slotKey === 'morning' ? 'সকাল' : slotKey === 'noon' ? 'দুপুর' : 'রাত'}</span>
                          </label>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={med.mealTiming}
                        onChange={(e) => {
                          const next = [...rxDraft.medicines];
                          next[idx] = {...med, mealTiming: e.target.value};
                          setRxDraft({...rxDraft, medicines: next});
                        }}
                        placeholder="খাবারের নিয়ম"
                        className="sm:col-span-2 min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setRxDraft({
                            ...rxDraft,
                            medicines: rxDraft.medicines.filter((m) => m.id !== med.id),
                          })
                        }
                        className="sm:col-span-1 min-h-[36px] flex items-center justify-center text-slate-400 hover:text-red-600"
                        title="মুছুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Tests with Inline Camera/Image Capture + AI Report Gather + Edit */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      সাজেস্টেড টেস্ট ও টেস্ট রিপোর্ট ছবি (AI গ্যাদার ও এডিট)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      টেস্ট যোগ করলে এখানেই রিপোর্টের ছবি তুলে AI দিয়ে তথ্য গ্যাদার ও এডিট করা যাবে
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRxDraft({
                        ...rxDraft,
                        suggestedTests: [...rxDraft.suggestedTests, emptyInlineTest(today, true)],
                      })
                    }
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-700/25 text-xs font-semibold text-teal-800 hover:bg-teal-100 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ টেস্ট যোগ করুন</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {rxDraft.suggestedTests.map((t, idx) => (
                    <div
                      key={t.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={t.name}
                          onChange={(e) => {
                            const next = [...rxDraft.suggestedTests];
                            next[idx] = {...t, name: e.target.value};
                            setRxDraft({...rxDraft, suggestedTests: next});
                          }}
                          placeholder="টেস্টের নাম (যেমন: CBC, HbA1c, Lipid Profile)"
                          className="flex-1 min-w-[180px] min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            const next = [...rxDraft.suggestedTests];
                            next[idx] = {...t, showReportPanel: !t.showReportPanel};
                            setRxDraft({...rxDraft, suggestedTests: next});
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-teal-700/30 bg-white text-xs font-semibold text-teal-800 hover:bg-teal-50 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>
                            {t.showReportPanel ? 'ছবি ও রিপোর্ট লুকান' : 'ছবি তুলুন / রিপোর্ট যুক্ত'}
                          </span>
                          {t.showReportPanel ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setRxDraft({
                              ...rxDraft,
                              suggestedTests: rxDraft.suggestedTests.filter((item) => item.id !== t.id),
                            })
                          }
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600"
                          title="টেস্ট সরান"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {t.showReportPanel && (
                        <div className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-3">
                          {/* Same Camera + Upload + More + AI Gather controls as Prescription */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              টেস্ট রিপোর্টের ছবি ({t.pages.length}টি পাতা)
                            </span>

                            <div className="flex flex-wrap items-center gap-2">
                              <label className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                                <Camera className="w-3.5 h-3.5 text-teal-700" />
                                <span>ছবি তুলুন</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={(e) => {
                                    handleAddInlineTestPages(t.id, e.target.files, true);
                                    e.target.value = '';
                                  }}
                                />
                              </label>

                              <label className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                                <Upload className="w-3.5 h-3.5" />
                                <span>{t.pages.length > 0 ? '+ আরো পাতা (More)' : 'ছবি আপলোড'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => {
                                    handleAddInlineTestPages(t.id, e.target.files, true);
                                    e.target.value = '';
                                  }}
                                />
                              </label>

                              {t.pages.length > 0 && (
                                <button
                                  type="button"
                                  disabled={t.scanning}
                                  onClick={() => runAiScanInlineTest(t.id)}
                                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 flex items-center gap-1.5 disabled:opacity-60"
                                >
                                  <ScanLine className="w-3.5 h-3.5" />
                                  <span>{t.scanning ? 'তথ্য গ্যাদার হচ্ছে...' : 'AI দিয়ে রিপোর্ট গ্যাদার'}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {t.pages.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {t.pages.map((pg, pgIdx) => (
                                <div key={pg.id} className="relative">
                                  <img
                                    src={pg.dataUrl}
                                    alt={`টেস্ট পাতা ${pgIdx + 1}`}
                                    referrerPolicy="no-referrer"
                                    className="w-16 h-20 object-cover rounded-lg border border-slate-300"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...rxDraft.suggestedTests];
                                      next[idx] = {
                                        ...t,
                                        pages: t.pages.filter((p) => p.id !== pg.id),
                                      };
                                      setRxDraft({...rxDraft, suggestedTests: next});
                                    }}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Editable Gathered Report Fields */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                রিপোর্টের তারিখ
                              </label>
                              <input
                                type="date"
                                value={t.reportDate}
                                onChange={(e) => {
                                  const next = [...rxDraft.suggestedTests];
                                  next[idx] = {...t, reportDate: e.target.value};
                                  setRxDraft({...rxDraft, suggestedTests: next});
                                }}
                                className="w-full min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                ল্যাব / ডাক্তারের নাম
                              </label>
                              <input
                                type="text"
                                value={t.labOrDoctorName}
                                onChange={(e) => {
                                  const next = [...rxDraft.suggestedTests];
                                  next[idx] = {...t, labOrDoctorName: e.target.value};
                                  setRxDraft({...rxDraft, suggestedTests: next});
                                }}
                                placeholder="যেমন: পপুলার / ল্যাবএইড"
                                className="w-full min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                ফলাফলের অবস্থা
                              </label>
                              <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg">
                                {(['Normal', 'Abnormal'] as const).map((st) => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => {
                                      const next = [...rxDraft.suggestedTests];
                                      next[idx] = {...t, status: st};
                                      setRxDraft({...rxDraft, suggestedTests: next});
                                    }}
                                    className={`min-h-[30px] rounded-md text-xs font-semibold transition-colors ${
                                      t.status === st
                                        ? st === 'Abnormal'
                                          ? 'bg-red-600 text-white'
                                          : 'bg-emerald-700 text-white'
                                        : 'text-slate-600'
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              রিপোর্ট ফাইন্ডিংস (গ্যাদার্ড / এডিটেবল)
                            </label>
                            <textarea
                              rows={2}
                              value={t.findings}
                              onChange={(e) => {
                                const next = [...rxDraft.suggestedTests];
                                next[idx] = {...t, findings: e.target.value};
                                setRxDraft({...rxDraft, suggestedTests: next});
                              }}
                              placeholder="AI ছবি থেকে রিপোর্টের ফলাফল এখানে গ্যাদার করবে, আপনি চাইলে এডিট করতে পারবেন..."
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ডাক্তারের পরামর্শ</label>
                <textarea
                  rows={2}
                  value={rxDraft.advice}
                  onChange={(e) => setRxDraft({...rxDraft, advice: e.target.value})}
                  placeholder="জীবনযাত্রা ও ফলোআপ নির্দেশনা..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRxDraft(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingRx}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 flex items-center gap-2 disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingRx ? 'সংরক্ষণ হচ্ছে...' : '✅ সম্পন্ন (Done)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline, Standalone, or Edit Lab Report Modal */}
      {reportDraft && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReportDraft(null);
          }}
        >
          <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {reportDraft.id
                    ? 'টেস্ট রিপোর্ট এডিট করুন'
                    : reportDraft.prescriptionId
                      ? 'সাজেস্টেড টেস্টের রিপোর্ট সংযুক্তি'
                      : 'আলাদা টেস্ট রিপোর্ট আপলোড'}
                </h2>
                <p className="text-xs text-slate-500">
                  ছবি তুলে বা আপলোড করে AI দিয়ে রিপোর্ট গ্যাদার ও এডিট করে OK চাপুন
                </p>
              </div>
              <button
                type="button"
                aria-label="বন্ধ করুন"
                onClick={() => setReportDraft(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReport} className="p-6 space-y-4 overflow-y-auto">
              {reportError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                  {reportError}
                </div>
              )}

              {/* Camera + Multi-page upload for report */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    রিপোর্ট পাতা ({reportDraft.pages.length}টি)
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={reportCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        handleAddReportPages(e.target.files, true);
                        e.target.value = '';
                      }}
                    />
                    <input
                      ref={reportFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleAddReportPages(e.target.files, true);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => reportCameraInputRef.current?.click()}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-teal-700" />
                      <span>ছবি তুলুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => reportFileInputRef.current?.click()}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{reportDraft.pages.length > 0 ? '+ আরো পাতা' : 'ছবি যুক্ত করুন'}</span>
                    </button>
                    {reportDraft.pages.length > 0 && (
                      <button
                        type="button"
                        disabled={scanningReport}
                        onClick={() => runAiScanReport()}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 flex items-center gap-1.5 disabled:opacity-60"
                      >
                        <ScanLine className="w-3.5 h-3.5" />
                        <span>{scanningReport ? 'স্ক্যান হচ্ছে...' : 'AI স্ক্যান'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {reportDraft.pages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {reportDraft.pages.map((pg, idx) => (
                      <div key={pg.id} className="relative">
                        <img
                          src={pg.dataUrl}
                          alt={`রিপোর্ট পাতা ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-16 h-20 object-cover rounded-lg border border-slate-300"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setReportDraft({
                              ...reportDraft,
                              pages: reportDraft.pages.filter((p) => p.id !== pg.id),
                            })
                          }
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">টেস্টের নাম</label>
                <input
                  type="text"
                  value={reportDraft.testName}
                  onChange={(e) => setReportDraft({...reportDraft, testName: e.target.value})}
                  placeholder="যেমন: HbA1c / Lipid Profile / CBC"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">রিপোর্টের তারিখ</label>
                  <input
                    type="date"
                    value={reportDraft.reportDate}
                    onChange={(e) => setReportDraft({...reportDraft, reportDate: e.target.value})}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ফলাফলের অবস্থা</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                    {(['Normal', 'Abnormal'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setReportDraft({...reportDraft, status: st})}
                        className={`min-h-[34px] rounded-lg text-xs font-semibold transition-colors ${
                          reportDraft.status === st
                            ? st === 'Abnormal'
                              ? 'bg-red-600 text-white'
                              : 'bg-emerald-700 text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ল্যাব / ডাক্তারের নাম</label>
                <input
                  type="text"
                  value={reportDraft.labOrDoctorName}
                  onChange={(e) => setReportDraft({...reportDraft, labOrDoctorName: e.target.value})}
                  placeholder="যেমন: পপুলার ডায়াগনস্টিক সেন্টার"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ফাইন্ডিংস (Findings)</label>
                <textarea
                  rows={3}
                  value={reportDraft.findings}
                  onChange={(e) => setReportDraft({...reportDraft, findings: e.target.value})}
                  placeholder="টেস্টের গুরুত্বপূর্ণ মান ও মন্তব্য লিখুন..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReportDraft(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingReport}
                  className="min-h-[44px] px-6 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-60"
                >
                  {savingReport ? 'সংরক্ষণ হচ্ছে...' : 'OK'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Clinical Visit Summary Modal */}
      {summaryRx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSummaryRx(null);
          }}
        >
          <div className="print-container w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="no-print px-4 sm:px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <p className="text-sm font-bold text-slate-900">Clinical Visit Summary (PDF প্রিন্ট প্রিভিউ)</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>প্রিন্ট / PDF সেভ করুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryRx(null)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5"
                  aria-label="বন্ধ করুন"
                >
                  <X className="w-4 h-4" />
                  <span>বন্ধ করুন</span>
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6 text-slate-900 overflow-y-auto flex-1">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <p className="text-xs font-semibold text-teal-800">SHASTHYAVAULT · CLINICAL VISIT SUMMARY</p>
                  <h2 className="text-2xl font-bold mt-1">{member.name}</h2>
                  <p className="text-xs text-slate-600 mt-1 tabular-nums">
                    বয়স: {member.age} বছর · লিঙ্গ: {member.gender} · রক্তের গ্রুপ: {member.bloodGroup} ·{' '}
                    {member.idType}: {member.idNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{summaryRx.doctorName}</p>
                  <p className="text-xs text-slate-600">{summaryRx.specialty}</p>
                  <p className="text-xs text-slate-600 mt-1 tabular-nums">
                    ভিজিট: {formatBengaliDate(summaryRx.visitDate)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  ডায়াগনসিস ও ক্লিনিক্যাল ফাইন্ডিংস
                </h3>
                <p className="mt-1 text-sm leading-relaxed">{summaryRx.findings || 'উল্লেখ নেই'}</p>
              </div>

              {summaryRx.medicines.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    নির্ধারিত ওষুধ (Rx)
                  </h3>
                  <table className="w-full text-sm border border-slate-300">
                    <thead className="bg-slate-100 text-xs">
                      <tr>
                        <th className="py-2 px-3 text-left border-b border-slate-300">ওষুধ</th>
                        <th className="py-2 px-3 text-left border-b border-slate-300">মাত্রা</th>
                        <th className="py-2 px-3 text-left border-b border-slate-300">সকাল+দুপুর+রাত</th>
                        <th className="py-2 px-3 text-left border-b border-slate-300">নিয়ম</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRx.medicines.map((m) => (
                        <tr key={m.id} className="border-b border-slate-200">
                          <td className="py-2 px-3 font-semibold">{m.name}</td>
                          <td className="py-2 px-3">{m.dosage}</td>
                          <td className="py-2 px-3 font-mono tabular-nums">
                            {m.morning ? '1' : '0'}+{m.noon ? '1' : '0'}+{m.night ? '1' : '0'}
                          </td>
                          <td className="py-2 px-3">
                            {m.mealTiming} ({m.duration})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  সংযুক্ত টেস্ট ও ল্যাব ফলাফল
                </h3>
                {memberReports.filter((r) => r.prescriptionId === summaryRx.id).length === 0 ? (
                  <p className="text-sm text-slate-600">
                    সাজেস্টেড টেস্ট:{' '}
                    {summaryRx.suggestedTests.map((t) => t.name).join(', ') || 'কোনো টেস্ট নেই'}
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {memberReports
                      .filter((r) => r.prescriptionId === summaryRx.id)
                      .map((r) => (
                        <li key={r.id}>
                          <strong>{r.testName}</strong> ({r.status}) — {r.findings} [{r.labOrDoctorName},{' '}
                          {formatBengaliDate(r.reportDate)}]
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              {memberSymptoms.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    রোগীর বর্তমান সমস্যা নোট
                  </h3>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {memberSymptoms.slice(0, 5).map((s) => (
                      <li key={s.id}>
                        {s.text} ({formatBengaliDateTime(s.recordedAt)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summaryRx.advice && (
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-sm">
                    <strong>ডাক্তারের পরামর্শ:</strong> {summaryRx.advice}
                  </p>
                </div>
              )}
            </div>

            <div className="no-print px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSummaryRx(null)}
                className="min-h-[40px] px-5 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>ক্লোজ করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
