import type {
  ActivityLog,
  CallReport,
  CallReportOutcome,
  CallSlot,
  CaregiverAlert,
  EmergencyLayer2Data,
  FamilyMember,
  LabReport,
  MemberCallSchedule,
  MedicineSlot,
  MedicineStatus,
  Prescription,
  SymptomNote,
  VaultState,
} from '../types.ts';

const LOCAL_STORE_KEY = 'shasthyavault_local_store_v1';
const DEMO_NID = '1988269123456';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function randomId(prefix: string): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${raw}`;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `88${digits}`;
  return `880${digits}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('880') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  if (local.length >= 9) {
    return `+880 ${local.slice(0, 2)}XX-XXX${local.slice(-3)}`;
  }
  return `+880 1XXX-XXX${digits.slice(-3)}`;
}

function createDefaultMemberCallSchedule(): MemberCallSchedule {
  return {
    morning: {enabled: true, time: '08:00'},
    noon: {enabled: true, time: '14:00'},
    night: {enabled: true, time: '21:30'},
    symptom: {enabled: true, time: '18:30'},
  };
}

function createDemoVault(): VaultState {
  const today = todayIso();
  const yesterday = daysAgoIso(1);

  const members: FamilyMember[] = [
    {
      id: 'mem_self',
      name: 'মোঃ রাশেদুল ইসলাম',
      relation: 'Self',
      age: 38,
      gender: 'Male',
      idType: 'NID',
      idNumber: DEMO_NID,
      bloodGroup: 'AB+',
      allergies: ['কোনো জানা ড্রাগ অ্যালার্জি নেই'],
      emergencyRelayMasked: '+880 18XX-XXX512',
      emergencyPhoneRaw: '8801819554512',
      erPin: '2468',
    },
    {
      id: 'mem_mother',
      name: 'আনোয়ারা বেগম',
      relation: 'Mother',
      age: 64,
      gender: 'Female',
      idType: 'NID',
      idNumber: '1962441098211',
      bloodGroup: 'B+',
      allergies: ['Penicillin', 'Sulfa Drugs'],
      emergencyRelayMasked: '+880 17XX-XXX344',
      emergencyPhoneRaw: '8801711223344',
      erPin: '2468',
      avatarUrl: '/src/assets/images/avatar_elder_mother_1795272679177.jpg',
    },
    {
      id: 'mem_father',
      name: 'মোঃ করিম উদ্দিন',
      relation: 'Father',
      age: 69,
      gender: 'Male',
      idType: 'NID',
      idNumber: '1957268112233',
      bloodGroup: 'O+',
      allergies: ['Aspirin (High Dose)'],
      emergencyRelayMasked: '+880 17XX-XXX344',
      emergencyPhoneRaw: '8801711223344',
      erPin: '2468',
      avatarUrl: '/src/assets/images/avatar_elder_father_1795272679185.jpg',
    },
    {
      id: 'mem_child',
      name: 'তাসনিম ইসলাম',
      relation: 'Child',
      age: 11,
      gender: 'Female',
      idType: 'Birth Certificate',
      idNumber: '20152691044558812',
      bloodGroup: 'B+',
      allergies: ['Amoxicillin', 'Dust Mites'],
      emergencyRelayMasked: '+880 17XX-XXX344',
      emergencyPhoneRaw: '8801711223344',
      erPin: '2468',
    },
  ];

  const prescriptions: Prescription[] = [
    {
      id: 'rx_self_1',
      memberId: 'mem_self',
      visitDate: daysAgoIso(3),
      doctorName: 'ডা. তানভীর আহমেদ',
      specialty: 'মেডিসিন বিশেষজ্ঞ',
      findings: 'Mild Gastritis & Vitamin D Deficiency',
      medicines: [
        {
          id: 'med_self_1',
          name: 'Cap. Maxpro 20 mg',
          dosage: '১টি ক্যাপসুল',
          morning: true,
          noon: false,
          night: true,
          mealTiming: 'খাবারের ৩০ মিনিট আগে',
          duration: '১৪ দিন',
        },
        {
          id: 'med_self_2',
          name: 'Tab. D-Rise 2000 IU',
          dosage: '১টি ট্যাবলেট',
          morning: false,
          noon: true,
          night: false,
          mealTiming: 'দুপুরে খাবারের পর',
          duration: '৩০ দিন',
        },
      ],
      suggestedTests: [{id: 'tst_self_1', name: 'Serum Vitamin D (25-OH)'}],
      advice: 'নিয়মিত সময়ে খাবার খাবেন এবং প্রতিদিন ২০ মিনিট রোদে থাকবেন।',
      pages: [],
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 'rx_1',
      memberId: 'mem_mother',
      visitDate: daysAgoIso(4),
      doctorName: 'ডা. মাহমুদুল হাসান',
      specialty: 'কার্ডিওলজি ও মেডিসিন বিশেষজ্ঞ',
      findings: 'Essential Hypertension (BP 150/92 mmHg), Type 2 Diabetes Mellitus',
      medicines: [
        {
          id: 'med_1',
          name: 'Tab. Bizoran 5/20 mg',
          dosage: '১টি ট্যাবলেট',
          morning: true,
          noon: false,
          night: true,
          mealTiming: 'খাবারের পর',
          duration: '৩০ দিন',
        },
        {
          id: 'med_2',
          name: 'Tab. Comet 500 mg',
          dosage: '১টি ট্যাবলেট',
          morning: false,
          noon: true,
          night: true,
          mealTiming: 'খাবারের পর',
          duration: '৩০ দিন',
        },
        {
          id: 'med_3',
          name: 'Tab. Sergel 20 mg',
          dosage: '১টি ক্যাপসুল',
          morning: true,
          noon: false,
          night: false,
          mealTiming: 'খাবারের ৩০ মিনিট আগে',
          duration: '১৫ দিন',
        },
      ],
      suggestedTests: [
        {id: 'tst_1', name: 'HbA1c (3-Month Blood Sugar)'},
        {id: 'tst_2', name: 'Fasting Lipid Profile'},
        {id: 'tst_3', name: 'Serum Creatinine'},
      ],
      advice: 'প্রতিদিন সকালে ৩০ মিনিট হাঁটবেন, লবণ কম খাবেন এবং নিয়মিত রক্তচাপ ও সুগার মাপবেন।',
      pages: [
        {
          id: 'pg_seed_1',
          name: 'prescription_page_1.jpg',
          dataUrl: '/src/assets/images/sample_prescription_doc_1795272679369.jpg',
        },
      ],
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
    {
      id: 'rx_2',
      memberId: 'mem_father',
      visitDate: daysAgoIso(12),
      doctorName: 'অধ্যাপক ডা. শফিকুর রহমান',
      specialty: 'মেডিসিন ও বক্ষব্যাধি',
      findings: 'Mild IHD, Controlled Hypertension',
      medicines: [
        {
          id: 'med_4',
          name: 'Tab. Osartil 50 mg',
          dosage: '১টি ট্যাবলেট',
          morning: true,
          noon: false,
          night: false,
          mealTiming: 'খাবারের পর',
          duration: 'চলমান',
        },
        {
          id: 'med_5',
          name: 'Tab. Atova 10 mg',
          dosage: '১টি ট্যাবলেট',
          morning: false,
          noon: false,
          night: true,
          mealTiming: 'রাতে খাবারের পর',
          duration: '৩০ দিন',
        },
      ],
      suggestedTests: [{id: 'tst_4', name: 'ECG (12 Lead)'}],
      advice: 'ধূমপান ও অতিরিক্ত চর্বিযুক্ত খাবার সম্পূর্ণ পরিহার করুন।',
      pages: [],
      createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    },
  ];

  const labReports: LabReport[] = [
    {
      id: 'rep_self_1',
      memberId: 'mem_self',
      prescriptionId: 'rx_self_1',
      suggestedTestId: 'tst_self_1',
      testName: 'Serum Vitamin D (25-OH)',
      reportDate: daysAgoIso(2),
      labOrDoctorName: 'ল্যাবএইড ডায়াগনস্টিক, ধানমন্ডি',
      status: 'Abnormal',
      findings: 'Vitamin D: 18.5 ng/mL (Insufficient; optimal 30–100 ng/mL).',
      pages: [],
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'rep_1',
      memberId: 'mem_mother',
      prescriptionId: 'rx_1',
      suggestedTestId: 'tst_1',
      testName: 'HbA1c (3-Month Blood Sugar)',
      reportDate: daysAgoIso(2),
      labOrDoctorName: 'পপুলার ডায়াগনস্টিক সেন্টার, ধানমন্ডি',
      status: 'Abnormal',
      findings: 'HbA1c: 7.4% (Target < 7.0%). Mildly elevated glycemic average.',
      pages: [],
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'rep_2',
      memberId: 'mem_mother',
      testName: 'Complete Blood Count (CBC)',
      reportDate: daysAgoIso(35),
      labOrDoctorName: 'ল্যাবএইড ডায়াগনস্টিক, ঢাকা',
      status: 'Normal',
      findings: 'Hemoglobin 12.1 g/dL, WBC 6,800/cumm, Platelets 245,000/cumm — Normal parameters.',
      pages: [],
      createdAt: new Date(Date.now() - 35 * 86400000).toISOString(),
    },
  ];

  const symptomNotes: SymptomNote[] = [
    {
      id: 'sym_self_1',
      memberId: 'mem_self',
      text: 'সন্ধ্যার পর হালকা অ্যাসিডিটি অনুভূত হয়েছে',
      isQuickChip: false,
      recordedAt: new Date(Date.now() - 10 * 3600000).toISOString(),
    },
    {
      id: 'sym_1',
      memberId: 'mem_mother',
      text: 'সকালে ঘুম থেকে ওঠার পর হালকা মাথা ঘোরা',
      isQuickChip: true,
      recordedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    },
  ];

  const medicineLogs: VaultState['medicineLogs'] = {
    [`mem_self_${today}`]: {
      morning: {status: 'taken', updatedAt: new Date().toISOString()},
      noon: {status: 'taken', updatedAt: new Date().toISOString()},
      night: {status: 'pending', updatedAt: new Date().toISOString()},
    },
    [`mem_self_${yesterday}`]: {
      morning: {status: 'taken', updatedAt: new Date(Date.now() - 86400000).toISOString()},
      noon: {status: 'taken', updatedAt: new Date(Date.now() - 86400000).toISOString()},
      night: {status: 'taken', updatedAt: new Date(Date.now() - 86400000).toISOString()},
    },
    [`mem_mother_${today}`]: {
      morning: {status: 'taken', updatedAt: new Date().toISOString()},
      noon: {status: 'pending', updatedAt: new Date().toISOString()},
      night: {status: 'pending', updatedAt: new Date().toISOString()},
    },
    [`mem_mother_${yesterday}`]: {
      morning: {status: 'taken', updatedAt: new Date(Date.now() - 86400000).toISOString()},
      noon: {status: 'snoozed', updatedAt: new Date(Date.now() - 86400000).toISOString()},
      night: {status: 'taken', updatedAt: new Date(Date.now() - 86400000).toISOString()},
    },
    [`mem_father_${today}`]: {
      morning: {status: 'taken', updatedAt: new Date().toISOString()},
      noon: {status: 'pending', updatedAt: new Date().toISOString()},
      night: {status: 'pending', updatedAt: new Date().toISOString()},
    },
  };

  const caregiverAlerts: CaregiverAlert[] = [
    {
      id: 'alt_seed_1',
      memberId: 'mem_mother',
      memberName: 'আনোয়ারা বেগম',
      type: 'voice_note',
      slot: 'morning',
      reason: 'ওষুধের বাইরে শারীরিক সমস্যার কথা জানিয়েছেন',
      transcript: 'সকালের গ্যাস্ট্রিকের ওষুধ খেয়েছি, কিন্তু আজ সকাল থেকে একটু মাথা ঘুরছে আর বুক হালকা ভার লাগছে।',
      durationSeconds: 11,
      whatsappMessage:
        'স্বাস্থ্যভল্ট কেয়ারগিভার অ্যালার্ট: আনোয়ারা বেগম (মা) সকাল বেলার ভয়েস কলে ১১ সেকেন্ড কথা বলেছেন: "সকালের গ্যাস্ট্রিকের ওষুধ খেয়েছি, কিন্তু আজ সকাল থেকে একটু মাথা ঘুরছে আর বুক হালকা ভার লাগছে।"',
      whatsappTargetPhone: '8801711223344',
      createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      read: false,
    },
  ];

  const callReports: CallReport[] = [
    {
      id: 'crep_seed_symptom_1',
      memberId: 'mem_self',
      memberName: 'মোঃ রাশেদুল ইসলাম',
      memberRelation: 'Self',
      accountHolderName: 'মোঃ রাশেদুল ইসলাম',
      slot: 'symptom',
      scheduledTime: '18:30',
      outcome: 'symptom_logged',
      durationSeconds: 14,
      transcript: 'সন্ধ্যার পর থেকে হালকা অ্যাসিডিটি ও বুক জ্বালাপোড়া অনুভব করছি।',
      capturedFinding: 'সন্ধ্যার পর হালকা অ্যাসিডিটি অনুভূত হয়েছে',
      aiReply: 'জি স্যার, আমি আপনার অ্যাসিডিটির সমস্যার কথাটি “বর্তমান সমস্যা নোট”-এ লিখে রেখেছি এবং কেয়ারগিভারকেও জানিয়ে দিয়েছি।',
      createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    },
    {
      id: 'crep_seed_1',
      memberId: 'mem_self',
      memberName: 'মোঃ রাশেদুল ইসলাম',
      memberRelation: 'Self',
      accountHolderName: 'মোঃ রাশেদুল ইসলাম',
      slot: 'noon',
      scheduledTime: '14:00',
      outcome: 'taken',
      durationSeconds: 6,
      transcript: 'হ্যাঁ, দুপুরের ওষুধ খেয়েছি।',
      capturedFinding: 'দুপুর বেলার ওষুধ সময়মতো খেয়েছেন ✅',
      aiReply: 'ধন্যবাদ স্যার, আপনার দুপুর বেলার ওষুধ খাওয়ার তথ্য সংরক্ষণ করা হয়েছে।',
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      id: 'crep_seed_2',
      memberId: 'mem_mother',
      memberName: 'আনোয়ারা বেগম',
      memberRelation: 'Mother',
      accountHolderName: 'মোঃ রাশেদুল ইসলাম',
      slot: 'morning',
      scheduledTime: '08:00',
      outcome: 'voice_note',
      durationSeconds: 11,
      transcript: 'সকালের গ্যাস্ট্রিকের ওষুধ খেয়েছি, কিন্তু আজ সকাল থেকে একটু মাথা ঘুরছে আর বুক হালকা ভার লাগছে।',
      capturedFinding: 'সকাল থেকে হালকা মাথা ঘোরা ও বুক ভার লাগা (কেয়ারগিভার ও নোট আপডেটেড)',
      aiReply: 'জি ম্যাডাম, আপনার সমস্যার কথা আপনার পরিবারের কেয়ারগিভারকে জানিয়ে দেওয়া হয়েছে।',
      createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
    {
      id: 'crep_seed_3',
      memberId: 'mem_father',
      memberName: 'মোঃ করিম উদ্দিন',
      memberRelation: 'Father',
      accountHolderName: 'মোঃ রাশেদুল ইসলাম',
      slot: 'morning',
      scheduledTime: '08:00',
      outcome: 'taken',
      durationSeconds: 5,
      transcript: 'হ্যাঁ, সকালের প্রেশারের ওষুধ খেয়েছি।',
      capturedFinding: 'সকাল বেলার প্রেশারের ওষুধ খেয়েছেন ✅',
      aiReply: 'ধন্যবাদ স্যার, ভালো থাকবেন।',
      createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    },
  ];

  const activityLogs: ActivityLog[] = [
    {
      id: 'act_self_1',
      memberId: 'mem_self',
      category: 'medicine',
      summary: 'আজ দুপুর বেলার ওষুধ (Tab. D-Rise 2000 IU) খেয়েছেন ✅',
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      id: 'act_self_2',
      memberId: 'mem_self',
      category: 'medicine',
      summary: 'আজ সকাল বেলার ওষুধ (Cap. Maxpro 20 mg) খেয়েছেন ✅',
      timestamp: new Date(Date.now() - 7 * 3600000).toISOString(),
    },
    {
      id: 'act_self_3',
      memberId: 'mem_self',
      category: 'report',
      summary: 'Serum Vitamin D (25-OH) রিপোর্ট যুক্ত করেছেন (Abnormal)',
      timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'act_mother_1',
      memberId: 'mem_mother',
      category: 'medicine',
      summary: 'সকাল বেলার ওষুধ খেয়েছেন ✅ (ভয়েস কল কনফার্ম)',
      timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
    {
      id: 'act_mother_2',
      memberId: 'mem_mother',
      category: 'symptom',
      summary: 'সমস্যা নোট: সকালে ঘুম থেকে ওঠার পর হালকা মাথা ঘোরা',
      timestamp: new Date(Date.now() - 6 * 3600000).toISOString(),
    },
    {
      id: 'act_father_1',
      memberId: 'mem_father',
      category: 'medicine',
      summary: 'সকাল বেলার ওষুধ (Tab. Osartil 50 mg) খেয়েছেন ✅',
      timestamp: new Date(Date.now() - 6 * 3600000).toISOString(),
    },
  ];

  return {
    accountHolder: {
      name: 'মোঃ রাশেদুল ইসলাম',
      nid: DEMO_NID,
      phone: '01711223344',
    },
    members,
    prescriptions,
    labReports,
    symptomNotes,
    medicineLogs,
    callSchedules: {
      mem_self: createDefaultMemberCallSchedule(),
      mem_mother: createDefaultMemberCallSchedule(),
      mem_father: createDefaultMemberCallSchedule(),
      mem_child: {
        morning: {enabled: false, time: '08:00'},
        noon: {enabled: false, time: '14:00'},
        night: {enabled: false, time: '21:00'},
        symptom: {enabled: false, time: '18:30'},
      },
    },
    consecutiveCallFailures: {},
    caregiverAlerts,
    callReports,
    activityLogs,
  };
}

interface LocalStore {
  vaults: Record<string, VaultState>;
  pins: Record<string, Record<string, string>>;
}

function readLocalStore(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalStore;
      if (parsed && parsed.vaults) {
        if (!parsed.vaults[DEMO_NID]) {
          parsed.vaults[DEMO_NID] = createDemoVault();
        }
        if (!parsed.pins) parsed.pins = {};
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  const initial: LocalStore = {
    vaults: {[DEMO_NID]: createDemoVault()},
    pins: {[DEMO_NID]: {mem_self: '2468', mem_mother: '2468', mem_father: '2468', mem_child: '2468'}},
  };
  writeLocalStore(initial);
  return initial;
}

function writeLocalStore(store: LocalStore): void {
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}

function getAccountFromToken(token?: string | null): string {
  if (token && token.startsWith('local-token:')) {
    return token.slice('local-token:'.length) || DEMO_NID;
  }
  return DEMO_NID;
}

function sanitizeVault(vault: VaultState): VaultState {
  return {
    ...vault,
    members: vault.members.map((m) => ({
      ...m,
      erPin: '••••',
    })),
  };
}

function recordLocalActivity(
  vault: VaultState,
  memberId: string,
  category: ActivityLog['category'],
  summary: string
): void {
  if (!Array.isArray(vault.activityLogs)) vault.activityLogs = [];
  vault.activityLogs.unshift({
    id: randomId('act'),
    memberId,
    category,
    summary,
    timestamp: new Date().toISOString(),
  });
  if (vault.activityLogs.length > 200) {
    vault.activityLogs = vault.activityLogs.slice(0, 200);
  }
}

function recordLocalCallReport(
  vault: VaultState,
  member: FamilyMember,
  slot: CallSlot,
  outcome: CallReportOutcome,
  options: {
    scheduledTime?: string;
    durationSeconds?: number;
    transcript?: string;
    capturedFinding?: string;
    aiReply?: string;
  } = {}
): CallReport {
  if (!Array.isArray(vault.callReports)) vault.callReports = [];
  const fallbackTime =
    vault.callSchedules?.[member.id]?.[slot]?.time ||
    (slot === 'morning' ? '08:00' : slot === 'noon' ? '14:00' : slot === 'night' ? '21:30' : '18:30');
  const report: CallReport = {
    id: randomId('crep'),
    memberId: member.id,
    memberName: member.name,
    memberRelation: member.relation,
    accountHolderName: vault.accountHolder.name,
    slot,
    scheduledTime: options.scheduledTime || fallbackTime,
    outcome,
    durationSeconds: options.durationSeconds,
    transcript: options.transcript,
    capturedFinding: options.capturedFinding,
    aiReply: options.aiReply,
    createdAt: new Date().toISOString(),
  };
  vault.callReports.unshift(report);
  if (vault.callReports.length > 300) {
    vault.callReports = vault.callReports.slice(0, 300);
  }
  return report;
}

function ensureAccountVault(store: LocalStore, nid: string, phone: string): VaultState {
  if (store.vaults[nid]) return store.vaults[nid];
  const selfId = randomId('mem');
  const created: VaultState = {
    accountHolder: {
      name: 'অ্যাকাউন্ট হোল্ডার (Self)',
      nid,
      phone,
    },
    members: [
      {
        id: selfId,
        name: 'অ্যাকাউন্ট হোল্ডার (Self)',
        relation: 'Self',
        age: 32,
        gender: 'Male',
        idType: 'NID',
        idNumber: nid,
        bloodGroup: 'O+',
        allergies: ['কোনো জানা অ্যালার্জি নেই'],
        emergencyRelayMasked: maskPhone(phone),
        emergencyPhoneRaw: normalizePhone(phone),
        erPin: '2468',
      },
    ],
    prescriptions: [],
    labReports: [],
    symptomNotes: [],
    medicineLogs: {},
    callSchedules: {[selfId]: createDefaultMemberCallSchedule()},
    consecutiveCallFailures: {},
    caregiverAlerts: [],
    callReports: [],
    activityLogs: [],
  };
  store.vaults[nid] = created;
  if (!store.pins[nid]) store.pins[nid] = {};
  store.pins[nid][selfId] = '2468';
  writeLocalStore(store);
  return created;
}

export async function localVaultRequest<T>(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
  } = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const pathOnly = url.split('?')[0];
  const body = (options.body || {}) as Record<string, any>;
  const store = readLocalStore();

  // --- Auth endpoints ---
  if (pathOnly === '/api/auth/demo-login' && method === 'POST') {
    const vault = ensureAccountVault(store, DEMO_NID, '01711223344');
    return {
      token: `local-token:${DEMO_NID}`,
      vault: sanitizeVault(vault),
    } as T;
  }

  if (pathOnly === '/api/auth/direct-login' && method === 'POST') {
    const cleanNid = String(body.nid || DEMO_NID).replace(/\D/g, '') || DEMO_NID;
    const cleanPhone = String(body.phone || '01711223344').replace(/\D/g, '') || '01711223344';
    const vault = ensureAccountVault(store, cleanNid, cleanPhone);
    return {
      token: `local-token:${cleanNid}`,
      vault: sanitizeVault(vault),
    } as T;
  }

  if (pathOnly === '/api/auth/request-otp' && method === 'POST') {
    const cleanNid = String(body.nid || DEMO_NID).replace(/\D/g, '') || DEMO_NID;
    const cleanPhone = String(body.phone || '01711223344').replace(/\D/g, '') || '01711223344';
    return {
      ok: true,
      challengeId: `local:${cleanNid}:${cleanPhone}`,
      previewOtp: '123456',
    } as T;
  }

  if (pathOnly === '/api/auth/verify-otp' && method === 'POST') {
    const parts = String(body.challengeId || '').split(':');
    const cleanNid = parts[1] || DEMO_NID;
    const cleanPhone = parts[2] || '01711223344';
    const vault = ensureAccountVault(store, cleanNid, cleanPhone);
    return {
      token: `local-token:${cleanNid}`,
      vault: sanitizeVault(vault),
    } as T;
  }

  const accountId = getAccountFromToken(options.token);
  const vault = ensureAccountVault(store, accountId, '01711223344');

  if (pathOnly === '/api/vault' && method === 'GET') {
    return {vault: sanitizeVault(vault)} as T;
  }

  // --- Members ---
  if (pathOnly === '/api/members' && method === 'POST') {
    const age = Number(body.age || 30);
    const phoneRaw = body.emergencyPhoneRaw
      ? normalizePhone(String(body.emergencyPhoneRaw))
      : normalizePhone(vault.accountHolder.phone);
    const pin = body.erPin && /^\d{4,6}$/.test(String(body.erPin)) ? String(body.erPin) : '2468';
    const newMember: FamilyMember = {
      id: randomId('mem'),
      name: String(body.name || 'সদস্য').trim(),
      relation: body.relation || 'Other',
      age,
      gender: body.gender === 'Female' ? 'Female' : 'Male',
      idType: age >= 18 ? 'NID' : 'Birth Certificate',
      idNumber: String(body.idNumber || '0000000000').trim(),
      bloodGroup: String(body.bloodGroup || 'O+').trim(),
      allergies: Array.isArray(body.allergies) && body.allergies.length > 0 ? body.allergies : ['কোনো জানা অ্যালার্জি নেই'],
      emergencyRelayMasked: maskPhone(phoneRaw),
      emergencyPhoneRaw: phoneRaw,
      erPin: pin,
    };
    vault.members.push(newMember);
    vault.callSchedules[newMember.id] = createDefaultMemberCallSchedule();
    if (!store.pins[accountId]) store.pins[accountId] = {};
    store.pins[accountId][newMember.id] = pin;
    writeLocalStore(store);
    return {vault: sanitizeVault(vault), memberId: newMember.id} as T;
  }

  if (pathOnly.startsWith('/api/members/')) {
    const memberId = pathOnly.slice('/api/members/'.length);
    if (method === 'PATCH') {
      const m = vault.members.find((x) => x.id === memberId);
      if (m) {
        if (body.name) m.name = String(body.name).trim();
        if (typeof body.age === 'number') {
          m.age = body.age;
          m.idType = body.age >= 18 ? 'NID' : 'Birth Certificate';
        }
        if (body.gender) m.gender = body.gender;
        if (body.idNumber) m.idNumber = String(body.idNumber).trim();
        if (body.bloodGroup) m.bloodGroup = String(body.bloodGroup).trim();
        if (Array.isArray(body.allergies)) m.allergies = body.allergies;
        if (body.emergencyPhoneRaw) {
          const normalized = normalizePhone(String(body.emergencyPhoneRaw));
          m.emergencyPhoneRaw = normalized;
          m.emergencyRelayMasked = maskPhone(normalized);
        }
        if (body.erPin && /^\d{4,6}$/.test(String(body.erPin))) {
          m.erPin = String(body.erPin);
          if (!store.pins[accountId]) store.pins[accountId] = {};
          store.pins[accountId][memberId] = String(body.erPin);
        }
        writeLocalStore(store);
      }
      return {vault: sanitizeVault(vault)} as T;
    }

    if (method === 'DELETE') {
      const idx = vault.members.findIndex((m) => m.id === memberId);
      if (idx !== -1 && vault.members.length > 1) {
        vault.members.splice(idx, 1);
        vault.prescriptions = vault.prescriptions.filter((p) => p.memberId !== memberId);
        vault.labReports = vault.labReports.filter((r) => r.memberId !== memberId);
        vault.symptomNotes = vault.symptomNotes.filter((s) => s.memberId !== memberId);
        vault.caregiverAlerts = vault.caregiverAlerts.filter((a) => a.memberId !== memberId);
        vault.callReports = vault.callReports.filter((c) => c.memberId !== memberId);
        vault.activityLogs = vault.activityLogs.filter((a) => a.memberId !== memberId);
        for (const k of Object.keys(vault.medicineLogs)) {
          if (k.startsWith(`${memberId}_`)) delete vault.medicineLogs[k];
        }
        for (const k of Object.keys(vault.consecutiveCallFailures)) {
          if (k.startsWith(`${memberId}_`)) delete vault.consecutiveCallFailures[k];
        }
        delete vault.callSchedules[memberId];
        writeLocalStore(store);
      }
      return {vault: sanitizeVault(vault)} as T;
    }
  }

  // --- Prescriptions ---
  if (pathOnly === '/api/prescriptions' && method === 'POST') {
    const rx: Prescription = {
      ...(body as Omit<Prescription, 'id' | 'createdAt'>),
      id: randomId('rx'),
      medicines: Array.isArray(body.medicines) ? body.medicines : [],
      suggestedTests: Array.isArray(body.suggestedTests) ? body.suggestedTests : [],
      pages: Array.isArray(body.pages) ? body.pages : [],
      createdAt: new Date().toISOString(),
    };
    vault.prescriptions.unshift(rx);
    recordLocalActivity(vault, rx.memberId, 'prescription', `নতুন প্রেসক্রিপশন যুক্ত (${rx.doctorName})`);
    writeLocalStore(store);
    return {vault: sanitizeVault(vault), prescription: rx} as T;
  }

  if (pathOnly.startsWith('/api/prescriptions/') && method === 'PATCH') {
    const rxId = pathOnly.slice('/api/prescriptions/'.length);
    const idx = vault.prescriptions.findIndex((p) => p.id === rxId);
    if (idx !== -1) {
      const existing = vault.prescriptions[idx];
      vault.prescriptions[idx] = {
        ...existing,
        ...body,
        id: existing.id,
        memberId: existing.memberId,
        createdAt: existing.createdAt,
      };
      writeLocalStore(store);
    }
    return {vault: sanitizeVault(vault)} as T;
  }

  // --- Lab Reports ---
  if (pathOnly === '/api/reports' && method === 'POST') {
    const report: LabReport = {
      ...(body as Omit<LabReport, 'id' | 'createdAt'>),
      id: randomId('rep'),
      status: body.status === 'Abnormal' ? 'Abnormal' : 'Normal',
      pages: Array.isArray(body.pages) ? body.pages : [],
      createdAt: new Date().toISOString(),
    };
    vault.labReports.unshift(report);
    recordLocalActivity(vault, report.memberId, 'report', `${report.testName} রিপোর্ট যুক্ত (${report.status})`);
    writeLocalStore(store);
    return {vault: sanitizeVault(vault), report} as T;
  }

  if (pathOnly.startsWith('/api/reports/') && method === 'PATCH') {
    const repId = pathOnly.slice('/api/reports/'.length);
    const idx = vault.labReports.findIndex((r) => r.id === repId);
    if (idx !== -1) {
      const existing = vault.labReports[idx];
      vault.labReports[idx] = {
        ...existing,
        ...body,
        id: existing.id,
        memberId: existing.memberId,
        status: body.status === 'Abnormal' ? 'Abnormal' : body.status === 'Normal' ? 'Normal' : existing.status,
        pages: Array.isArray(body.pages) ? body.pages : existing.pages,
        createdAt: existing.createdAt,
      };
      writeLocalStore(store);
      return {vault: sanitizeVault(vault), report: vault.labReports[idx]} as T;
    }
    return {vault: sanitizeVault(vault)} as T;
  }

  // --- Symptoms ---
  if (pathOnly === '/api/symptoms' && method === 'POST') {
    const note: SymptomNote = {
      id: randomId('sym'),
      memberId: String(body.memberId || vault.members[0]?.id || 'mem_self'),
      text: String(body.text || '').trim(),
      isQuickChip: Boolean(body.isQuickChip),
      recordedAt: new Date().toISOString(),
    };
    vault.symptomNotes.unshift(note);
    recordLocalActivity(vault, note.memberId, 'symptom', `সমস্যা নোট: ${note.text}`);
    writeLocalStore(store);
    return {vault: sanitizeVault(vault)} as T;
  }

  if (pathOnly.startsWith('/api/symptoms/') && method === 'DELETE') {
    const symId = pathOnly.slice('/api/symptoms/'.length);
    vault.symptomNotes = vault.symptomNotes.filter((s) => s.id !== symId);
    writeLocalStore(store);
    return {vault: sanitizeVault(vault)} as T;
  }

  // --- Medicine Logs ---
  if (pathOnly === '/api/medicine-logs/status' && method === 'POST') {
    const memberId = String(body.memberId || '');
    const slot = body.slot as MedicineSlot;
    const status = body.status as MedicineStatus;
    const targetDate = String(body.date || todayIso());
    const key = `${memberId}_${targetDate}`;
    if (!vault.medicineLogs[key]) {
      vault.medicineLogs[key] = {
        morning: {status: 'pending', updatedAt: new Date().toISOString()},
        noon: {status: 'pending', updatedAt: new Date().toISOString()},
        night: {status: 'pending', updatedAt: new Date().toISOString()},
      };
    }
    vault.medicineLogs[key][slot] = {
      status,
      updatedAt: new Date().toISOString(),
      snoozeUntil: status === 'snoozed' ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : undefined,
    };
    if (status === 'taken') {
      vault.consecutiveCallFailures[`${memberId}_${slot}`] = 0;
    }
    writeLocalStore(store);
    return {vault: sanitizeVault(vault)} as T;
  }

  // --- Call Schedules ---
  if (pathOnly.startsWith('/api/call-schedules/') && method === 'PUT') {
    const memberId = pathOnly.slice('/api/call-schedules/'.length);
    const existing = vault.callSchedules[memberId] || createDefaultMemberCallSchedule();
    vault.callSchedules[memberId] = {
      morning: body.morning || existing.morning,
      noon: body.noon || existing.noon,
      night: body.night || existing.night,
      symptom: body.symptom || existing.symptom || {enabled: true, time: '18:30'},
    };
    writeLocalStore(store);
    return {vault: sanitizeVault(vault)} as T;
  }

  // --- Call Outcomes ---
  if (pathOnly === '/api/calls/complete' && method === 'POST') {
    const member = vault.members.find((m) => m.id === body.memberId) || vault.members[0];
    const slot = (body.slot || 'morning') as MedicineSlot;
    const outcome = (body.outcome || 'taken') as 'taken' | 'snoozed';
    const key = `${member.id}_${todayIso()}`;
    if (!vault.medicineLogs[key]) {
      vault.medicineLogs[key] = {
        morning: {status: 'pending', updatedAt: new Date().toISOString()},
        noon: {status: 'pending', updatedAt: new Date().toISOString()},
        night: {status: 'pending', updatedAt: new Date().toISOString()},
      };
    }
    vault.medicineLogs[key][slot] = {
      status: outcome,
      updatedAt: new Date().toISOString(),
      snoozeUntil: outcome === 'snoozed' ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : undefined,
    };
    if (outcome === 'taken') vault.consecutiveCallFailures[`${member.id}_${slot}`] = 0;
    const slotBn = slot === 'morning' ? 'সকাল' : slot === 'noon' ? 'দুপুর' : 'রাত';
    const report = recordLocalCallReport(vault, member, slot, outcome, {
      scheduledTime: body.scheduledTime,
      durationSeconds: body.durationSeconds,
      transcript: body.transcript,
      capturedFinding:
        outcome === 'taken'
          ? `${slotBn} বেলার ওষুধ খেয়েছেন নিশ্চিত হয়েছে ✅`
          : `${slotBn} বেলার ওষুধ ৩০ মিনিট পর খাওয়ার জন্য রিমাইন্ডার সেট ⏰`,
      aiReply: body.aiReply,
    });
    writeLocalStore(store);
    return {vault: sanitizeVault(vault), report} as T;
  }

  if (pathOnly === '/api/calls/symptom-checkin' && method === 'POST') {
    const member = vault.members.find((m) => m.id === body.memberId) || vault.members[0];
    const outcome = (body.outcome || 'symptom_ok') as 'symptom_ok' | 'symptom_logged';
    const noteText = String(body.symptomText || body.transcript || '').trim();
    if (outcome === 'symptom_logged' && noteText) {
      vault.symptomNotes.unshift({
        id: randomId('sym'),
        memberId: member.id,
        text: `${noteText} (AI ভয়েস কল থেকে)`,
        isQuickChip: false,
        recordedAt: new Date().toISOString(),
      });
      vault.caregiverAlerts.unshift({
        id: randomId('alt'),
        memberId: member.id,
        memberName: member.name,
        type: 'voice_note',
        slot: 'symptom',
        reason: 'সমস্যা চেক-ইন কলে শারীরিক সমস্যার কথা জানিয়েছেন',
        transcript: noteText,
        durationSeconds: body.durationSeconds,
        whatsappMessage: `স্বাস্থ্যভল্ট সমস্যা চেক-ইন অ্যালার্ট: ${member.name} (${member.relation}) AI কলে জানিয়েছেন: "${noteText}"`,
        whatsappTargetPhone: normalizePhone(vault.accountHolder.phone),
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
    const report = recordLocalCallReport(vault, member, 'symptom', outcome, {
      scheduledTime: body.scheduledTime,
      durationSeconds: body.durationSeconds,
      transcript: body.transcript,
      capturedFinding:
        outcome === 'symptom_logged' && noteText
          ? noteText
          : 'কোনো শারীরিক সমস্যা নেই — রোগী সুস্থ আছেন ✅',
      aiReply: body.aiReply,
    });
    writeLocalStore(store);
    return {vault: sanitizeVault(vault), report} as T;
  }

  if (pathOnly === '/api/calls/missed-or-rejected' && method === 'POST') {
    const member = vault.members.find((m) => m.id === body.memberId) || vault.members[0];
    const slot = (body.slot || 'morning') as CallSlot;
    const outcome = (body.outcome || 'rejected') as 'missed' | 'rejected';
    const failKey = `${member.id}_${slot}`;
    const nextCount = (vault.consecutiveCallFailures[failKey] || 0) + 1;
    vault.consecutiveCallFailures[failKey] = nextCount;
    let escalatedAlert: CaregiverAlert | null = null;
    if (nextCount >= 3) {
      escalatedAlert = {
        id: randomId('alt'),
        memberId: member.id,
        memberName: member.name,
        type: outcome === 'missed' ? 'missed_escalation' : 'rejected_escalation',
        slot,
        reason: outcome === 'missed' ? 'পরপর ৩ বার কল মিসড' : 'পরপর ৩ বার কল রিজেক্ট',
        whatsappMessage: `জরুরি স্বাস্থ্যভল্ট কেয়ারগিভার অ্যালার্ট: ${member.name} পরপর ৩ বার কল ধরেননি।`,
        whatsappTargetPhone: normalizePhone(vault.accountHolder.phone),
        createdAt: new Date().toISOString(),
        read: false,
      };
      vault.caregiverAlerts.unshift(escalatedAlert);
      vault.consecutiveCallFailures[failKey] = 0;
    }
    recordLocalCallReport(vault, member, slot, outcome, {
      scheduledTime: body.scheduledTime,
      aiReply: outcome === 'missed' ? 'কল রিসিভ করা হয়নি' : 'কল কেটে দেওয়া হয়েছে',
    });
    writeLocalStore(store);
    return {vault: sanitizeVault(vault), consecutiveCount: nextCount, escalatedAlert} as T;
  }

  if (pathOnly === '/api/calls/escalation-alert' && method === 'POST') {
    const member = vault.members.find((m) => m.id === body.memberId) || vault.members[0];
    const slot = (body.slot || 'morning') as MedicineSlot;
    const cleanTranscript = String(body.transcript || '').trim();
    vault.symptomNotes.unshift({
      id: randomId('sym'),
      memberId: member.id,
      text: `${cleanTranscript} (AI ভয়েস কল থেকে)`,
      isQuickChip: false,
      recordedAt: new Date().toISOString(),
    });
    const alert: CaregiverAlert = {
      id: randomId('alt'),
      memberId: member.id,
      memberName: member.name,
      type: 'voice_note',
      slot,
      reason: `ওষুধের বাইরে কথা বা সমস্যার বিবরণ (${body.durationSeconds || 5} সেকেন্ড)`,
      transcript: cleanTranscript,
      durationSeconds: body.durationSeconds,
      whatsappMessage: `স্বাস্থ্যভল্ট অ্যালার্ট: ${member.name}: "${cleanTranscript}"`,
      whatsappTargetPhone: normalizePhone(vault.accountHolder.phone),
      createdAt: new Date().toISOString(),
      read: false,
    };
    vault.caregiverAlerts.unshift(alert);
    recordLocalCallReport(vault, member, slot, 'voice_note', {
      scheduledTime: body.scheduledTime,
      durationSeconds: body.durationSeconds,
      transcript: cleanTranscript,
      capturedFinding: cleanTranscript,
      aiReply: body.aiReply,
    });
    writeLocalStore(store);
    return {vault: sanitizeVault(vault), alert} as T;
  }

  if (pathOnly.startsWith('/api/alerts/') && pathOnly.endsWith('/read') && method === 'PATCH') {
    const alertId = pathOnly.slice('/api/alerts/'.length, -'/read'.length);
    const alert = vault.caregiverAlerts.find((a) => a.id === alertId);
    if (alert) {
      alert.read = true;
      writeLocalStore(store);
    }
    return {vault: sanitizeVault(vault)} as T;
  }

  // --- Emergency Layer 2 PIN ---
  if (pathOnly === '/api/emergency/verify-pin' && method === 'POST') {
    const member = vault.members.find((m) => m.id === body.memberId);
    if (!member) throw new Error('সদস্য পাওয়া যায়নি।');
    const expectedPin = store.pins?.[accountId]?.[member.id] || member.erPin || '2468';
    const cleanExpected = expectedPin === '••••' ? '2468' : expectedPin;
    if (String(body.pin || '').trim() !== cleanExpected) {
      throw new Error('ভুল ER Doctor PIN। অনুগ্রহ করে সঠিক পিন দিন।');
    }
    const memberRx = [...vault.prescriptions]
      .filter((p) => p.memberId === member.id)
      .sort((a, b) => b.visitDate.localeCompare(a.visitDate));
    const latestRx = memberRx[0];
    const layer2: EmergencyLayer2Data = {
      memberId: member.id,
      name: member.name,
      idType: member.idType,
      idNumber: member.idNumber,
      age: member.age,
      gender: member.gender,
      latestDiagnosis: latestRx?.findings || 'সর্বশেষ কোনো ডায়াগনসিস যুক্ত করা হয়নি',
      latestVisitDate: latestRx?.visitDate || 'N/A',
      criticalMedications: latestRx?.medicines.map((m) => `${m.name} (${m.dosage})`) || [],
    };
    return {layer2} as T;
  }

  // --- AI Voice & Scan Local Fallbacks ---
  if (pathOnly === '/api/ai/voice-turn' && method === 'POST') {
    const transcript = String(body.transcript || '').trim();
    const lower = transcript.toLowerCase();
    const honorific = body.gender === 'Female' ? 'ম্যাডাম' : 'স্যার';
    if (body.callType === 'symptom') {
      const noProblem =
        /(কোনো সমস্যা নেই|সমস্যা নেই|ভালো আছি|সুস্থ আছি|ঠিক আছি|কিছু না|^না$|\bno\b|\bfine\b|\bok\b)/i.test(lower) &&
        !/(ব্যথা|জ্বর|মাথা|বমি|দুর্বল|কাশি|শ্বাস|গ্যাস|অ্যাসিডিটি|ঘুম|অস্বস্তি)/i.test(lower);
      const intent = noProblem ? 'symptom_ok' : 'symptom_logged';
      return {
        intent,
        symptomSummary: intent === 'symptom_logged' ? transcript : '',
        replyBn:
          intent === 'symptom_ok'
            ? `আলহামদুলিল্লাহ ${honorific}, শুনে খুব ভালো লাগলো যে আপনি সুস্থ আছেন। নিজের যত্ন নেবেন।`
            : `জি ${honorific}, আমি আপনার এই সমস্যার কথাটি “বর্তমান সমস্যা নোট”-এ লিখে রেখেছি এবং কেয়ারগিভারকেও জানিয়ে দিয়েছি।`,
      } as T;
    }
    let intent: 'taken' | 'snooze' | 'other' = 'other';
    if (/(হ্যাঁ|খেয়েছি|নিয়েছি|খাওয়া হয়েছে|taken|yes)/i.test(lower)) intent = 'taken';
    else if (/(পরে|এখন না|একটু পর|snooze|later|^না$)/i.test(lower)) intent = 'snooze';
    return {
      intent,
      replyBn:
        intent === 'taken'
          ? `ধন্যবাদ ${honorific}। আপনার ওষুধ খাওয়ার তথ্য আপডেট করা হয়েছে।`
          : intent === 'snooze'
            ? `জি ${honorific}, ঠিক আছে। আমি ৩০ মিনিট পর আবার মনে করিয়ে দেবো।`
            : `জি ${honorific}, আপনার কথাটি নোট করে বর্তমান সমস্যা নোট ও কেয়ারগিভার ইনবক্সে পাঠিয়ে দিয়েছি।`,
    } as T;
  }

  if (pathOnly === '/api/ai/scan-prescription' && method === 'POST') {
    return {
      extracted: {
        visitDate: todayIso(),
        doctorName: 'ডা. তানভীর আহমেদ',
        specialty: 'মেডিসিন বিশেষজ্ঞ',
        findings: 'প্রাথমিক পর্যবেক্ষণ ও প্রেসক্রিপশন তথ্য',
        medicines: [
          {
            name: 'Tab. Napa 500 mg',
            dosage: '১টি ট্যাবলেট',
            morning: true,
            noon: false,
            night: true,
            mealTiming: 'খাবারের পর',
            duration: '৭ দিন',
          },
        ],
        suggestedTests: ['Complete Blood Count (CBC)'],
        advice: 'নিয়মিত ওষুধ সেবন ও পর্যাপ্ত বিশ্রাম নেবেন।',
      },
    } as T;
  }

  if (pathOnly === '/api/ai/scan-report' && method === 'POST') {
    return {
      extracted: {
        testName: 'Complete Blood Count (CBC)',
        reportDate: todayIso(),
        labOrDoctorName: 'ডায়াগনস্টিক সেন্টার',
        status: 'Normal',
        findings: 'রিপোর্টের ছবি সংযুক্ত করা হয়েছে। প্রয়োজনে তথ্য যাচাই ও এডিট করুন।',
      },
    } as T;
  }

  if (pathOnly === '/api/ai/transcribe' && method === 'POST') {
    return {transcript: ''} as T;
  }

  throw new Error(`অজানা রিকোয়েস্ট: ${pathOnly}`);
}
