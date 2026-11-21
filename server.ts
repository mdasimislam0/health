import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type {NextFunction, Request, Response} from 'express';
import {GoogleGenAI, Type} from '@google/genai';
import {createServer as createViteServer} from 'vite';
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
} from './src/types.ts';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'vault-store.json');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface AuthenticatedRequest extends Request {
  accountId?: string;
}

interface OtpChallenge {
  nid: string;
  phone: string;
  code: string;
  expiresAt: number;
}

const otpChallenges = new Map<string, OtpChallenge>();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function createDefaultMemberCallSchedule(): MemberCallSchedule {
  return {
    morning: {enabled: true, time: '08:00'},
    noon: {enabled: true, time: '14:00'},
    night: {enabled: true, time: '21:30'},
    symptom: {enabled: true, time: '18:30'},
  };
}

function createInitialSeedData(): Record<string, VaultState> {
  const demoNid = '1988269123456';
  const today = todayIso();

  const members: FamilyMember[] = [
    {
      id: 'mem_self',
      name: 'মোঃ রাশেদুল ইসলাম',
      relation: 'Self',
      age: 38,
      gender: 'Male',
      idType: 'NID',
      idNumber: demoNid,
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

  const yesterday = daysAgoIso(1);
  const medicineLogs: Record<string, Record<MedicineSlot, {status: MedicineStatus; updatedAt: string}>> = {
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

  const callSchedules: Record<string, MemberCallSchedule> = {
    mem_self: createDefaultMemberCallSchedule(),
    mem_mother: createDefaultMemberCallSchedule(),
    mem_father: createDefaultMemberCallSchedule(),
    mem_child: {
      morning: {enabled: false, time: '08:00'},
      noon: {enabled: false, time: '14:00'},
      night: {enabled: false, time: '21:00'},
      symptom: {enabled: false, time: '18:30'},
    },
  };

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

  return {
    [demoNid]: {
      accountHolder: {
        name: 'মোঃ রাশেদুল ইসলাম',
        nid: demoNid,
        phone: '01711223344',
      },
      members,
      prescriptions,
      labReports,
      symptomNotes,
      medicineLogs,
      callSchedules,
      consecutiveCallFailures: {},
      caregiverAlerts,
      callReports,
      activityLogs,
    },
  };
}

function recordActivity(
  vault: VaultState,
  memberId: string,
  category: ActivityLog['category'],
  summary: string
): void {
  if (!Array.isArray(vault.activityLogs)) {
    vault.activityLogs = [];
  }
  vault.activityLogs.unshift({
    id: `act_${crypto.randomUUID().slice(0, 8)}`,
    memberId,
    category,
    summary,
    timestamp: new Date().toISOString(),
  });
  if (vault.activityLogs.length > 200) {
    vault.activityLogs = vault.activityLogs.slice(0, 200);
  }
}

function recordCallReport(
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
  if (!Array.isArray(vault.callReports)) {
    vault.callReports = [];
  }
  const fallbackTime =
    vault.callSchedules?.[member.id]?.[slot]?.time ||
    (slot === 'morning'
      ? '08:00'
      : slot === 'noon'
        ? '14:00'
        : slot === 'night'
          ? '21:30'
          : '18:30');
  const report: CallReport = {
    id: `crep_${crypto.randomUUID().slice(0, 8)}`,
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

function readStore(): Record<string, VaultState> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
  if (!fs.existsSync(STORE_PATH)) {
    const seed = createInitialSeedData();
    fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, VaultState>;
  const demoSeed = createInitialSeedData()['1988269123456'];
  let changed = false;

  for (const key of Object.keys(parsed)) {
    const v = parsed[key];
    if (!Array.isArray(v.activityLogs)) {
      v.activityLogs = key === '1988269123456' ? demoSeed.activityLogs : [];
      changed = true;
    }
    if (!v.callSchedules || typeof v.callSchedules !== 'object') {
      v.callSchedules = {};
      changed = true;
    }
    for (const m of v.members) {
      if (!v.callSchedules[m.id]) {
        v.callSchedules[m.id] =
          key === '1988269123456' && demoSeed.callSchedules[m.id]
            ? demoSeed.callSchedules[m.id]
            : createDefaultMemberCallSchedule();
        changed = true;
      } else if (!v.callSchedules[m.id].symptom) {
        v.callSchedules[m.id].symptom = {
          enabled: m.relation !== 'Child',
          time: '18:30',
        };
        changed = true;
      }
    }
    if (!Array.isArray(v.callReports)) {
      v.callReports = key === '1988269123456' ? demoSeed.callReports : [];
      changed = true;
    }
    if (
      key === '1988269123456' &&
      v.members.some((m) => m.id === 'mem_self') &&
      !v.callReports.some((r) => r.memberId === 'mem_self' && r.slot === 'symptom')
    ) {
      const seedSymReport = demoSeed.callReports.find((r) => r.id === 'crep_seed_symptom_1');
      if (seedSymReport) {
        v.callReports.push(seedSymReport);
        changed = true;
      }
    }
    for (const rep of v.callReports) {
      if (!rep.capturedFinding && rep.transcript && (rep.outcome === 'symptom_logged' || rep.outcome === 'voice_note')) {
        rep.capturedFinding = rep.transcript;
        changed = true;
      }
    }
    if (key === '1988269123456' && !v.prescriptions.some((p) => p.memberId === 'mem_self')) {
      v.prescriptions.unshift(...demoSeed.prescriptions.filter((p) => p.memberId === 'mem_self'));
      v.labReports.unshift(...demoSeed.labReports.filter((r) => r.memberId === 'mem_self'));
      v.symptomNotes.unshift(...demoSeed.symptomNotes.filter((s) => s.memberId === 'mem_self'));
      v.medicineLogs = {...demoSeed.medicineLogs, ...v.medicineLogs};
      changed = true;
    }
  }
  if (changed) {
    writeStore(parsed);
  }
  return parsed;
}

function writeStore(store: Record<string, VaultState>): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function signToken(accountId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: accountId,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (!parsed.sub || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed.sub;
  } catch {
    return null;
  }
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({error: 'অথেনটিকেশন প্রয়োজন। অনুগ্রহ করে লগইন করুন।'});
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const accountId = verifyToken(token);
  if (!accountId) {
    res.status(401).json({error: 'সেশন মেয়াদ শেষ হয়েছে। আবার লগইন করুন।'});
    return;
  }
  req.accountId = accountId;
  next();
}

function getOrCreateAccountVault(store: Record<string, VaultState>, nid: string, phone: string): VaultState {
  if (store[nid]) return store[nid];
  const selfId = `mem_${crypto.randomUUID().slice(0, 8)}`;
  const newVault: VaultState = {
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
        age: 30,
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
    callSchedules: {
      [selfId]: createDefaultMemberCallSchedule(),
    },
    consecutiveCallFailures: {},
    caregiverAlerts: [],
    callReports: [],
    activityLogs: [],
  };
  store[nid] = newVault;
  writeStore(store);
  return newVault;
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

function sanitizeVaultForClient(vault: VaultState): VaultState {
  return {
    ...vault,
    members: vault.members.map((m) => ({
      ...m,
      // Keep erPin masked in regular state so Layer-2 PIN verification happens on server
      erPin: '••••',
    })),
  };
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function dataUrlToPart(dataUrlOrPath: string): {inlineData: {mimeType: string; data: string}} {
  if (dataUrlOrPath.startsWith('data:')) {
    const match = dataUrlOrPath.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid image data URL');
    }
    return {
      inlineData: {
        mimeType: match[1],
        data: match[2],
      },
    };
  }
  // Support bundled sample asset inside src/assets/images safely
  const safePublicBase = path.resolve(process.cwd(), 'src', 'assets', 'images');
  const fileName = path.basename(dataUrlOrPath);
  const resolved = path.resolve(safePublicBase, fileName);
  if (!resolved.startsWith(safePublicBase + path.sep) || !fs.existsSync(resolved)) {
    throw new Error('Image asset not found');
  }
  const bytes = fs.readFileSync(resolved);
  return {
    inlineData: {
      mimeType: resolved.endsWith('.png') ? 'image/png' : 'image/jpeg',
      data: bytes.toString('base64'),
    },
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '25mb'}));

  // --- Auth Endpoints ---
  app.post('/api/auth/request-otp', (req: Request, res: Response) => {
    const {nid, phone} = req.body as {nid?: string; phone?: string};
    const cleanNid = (nid || '').replace(/\D/g, '');
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (cleanNid.length < 10 || cleanNid.length > 17) {
      res.status(400).json({error: 'সঠিক ১০, ১৩ বা ১৭ ডিজিটের জাতীয় পরিচয়পত্র নম্বর (NID) দিন।'});
      return;
    }
    if (cleanPhone.length < 10) {
      res.status(400).json({error: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।'});
      return;
    }
    const challengeId = crypto.randomUUID();
    const code = String(crypto.randomInt(100000, 999999));
    otpChallenges.set(challengeId, {
      nid: cleanNid,
      phone: cleanPhone,
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    res.json({
      ok: true,
      challengeId,
      // Returned in preview so user can verify OTP seamlessly without external SMS gateway
      previewOtp: code,
    });
  });

  app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
    const {challengeId, code} = req.body as {challengeId?: string; code?: string};
    if (!challengeId || !code) {
      res.status(400).json({error: 'OTP কোড দিন।'});
      return;
    }
    const challenge = otpChallenges.get(challengeId);
    if (!challenge || challenge.expiresAt < Date.now()) {
      res.status(400).json({error: 'OTP মেয়াদোত্তীর্ণ বা ভুল। অনুগ্রহ করে আবার চেষ্টা করুন।'});
      return;
    }
    const provided = Buffer.from(code.trim());
    const expected = Buffer.from(challenge.code);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      res.status(401).json({error: 'OTP কোড মেলেনি। আবার যাচাই করুন।'});
      return;
    }
    otpChallenges.delete(challengeId);
    const store = readStore();
    const vault = getOrCreateAccountVault(store, challenge.nid, challenge.phone);
    const token = signToken(challenge.nid);
    res.json({
      token,
      vault: sanitizeVaultForClient(vault),
    });
  });

  app.post('/api/auth/demo-login', (_req: Request, res: Response) => {
    const store = readStore();
    const demoNid = '1988269123456';
    const vault = getOrCreateAccountVault(store, demoNid, '01711223344');
    const token = signToken(demoNid);
    res.json({
      token,
      vault: sanitizeVaultForClient(vault),
    });
  });

  // --- Vault Data Endpoints ---
  app.get('/api/vault', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const store = readStore();
    const vault = store[req.accountId!];
    if (!vault) {
      res.status(404).json({error: 'অ্যাকাউন্ট পাওয়া যায়নি।'});
      return;
    }
    res.json({vault: sanitizeVaultForClient(vault)});
  });

  app.post('/api/members', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as Partial<FamilyMember>;
    if (!body.name || !body.relation || typeof body.age !== 'number' || !body.gender || !body.idNumber) {
      res.status(400).json({error: 'সদস্যের নাম, সম্পর্ক, বয়স, লিঙ্গ ও আইডি নম্বর আবশ্যক।'});
      return;
    }
    const expectedIdType = body.age >= 18 ? 'NID' : 'Birth Certificate';
    const store = readStore();
    const vault = store[req.accountId!];
    const phoneRaw = body.emergencyPhoneRaw ? normalizePhone(body.emergencyPhoneRaw) : normalizePhone(vault.accountHolder.phone);
    const newMember: FamilyMember = {
      id: `mem_${crypto.randomUUID().slice(0, 8)}`,
      name: body.name.trim(),
      relation: body.relation,
      age: body.age,
      gender: body.gender,
      idType: expectedIdType,
      idNumber: body.idNumber.trim(),
      bloodGroup: (body.bloodGroup || 'O+').trim(),
      allergies: Array.isArray(body.allergies) && body.allergies.length > 0 ? body.allergies : ['কোনো জানা অ্যালার্জি নেই'],
      emergencyRelayMasked: maskPhone(phoneRaw),
      emergencyPhoneRaw: phoneRaw,
      erPin: (body.erPin && /^\d{4,6}$/.test(body.erPin) ? body.erPin : '2468'),
    };
    vault.members.push(newMember);
    if (!vault.callSchedules) vault.callSchedules = {};
    vault.callSchedules[newMember.id] = createDefaultMemberCallSchedule();
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault), memberId: newMember.id});
  });

  app.patch('/api/members/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const store = readStore();
    const vault = store[req.accountId!];
    const member = vault.members.find((m) => m.id === req.params.id);
    if (!member) {
      res.status(404).json({error: 'সদস্য পাওয়া যায়নি।'});
      return;
    }
    const body = req.body as Partial<FamilyMember>;
    if (body.name) member.name = body.name.trim();
    if (typeof body.age === 'number') {
      member.age = body.age;
      member.idType = body.age >= 18 ? 'NID' : 'Birth Certificate';
    }
    if (body.gender) member.gender = body.gender;
    if (body.idNumber) member.idNumber = body.idNumber.trim();
    if (body.bloodGroup) member.bloodGroup = body.bloodGroup.trim();
    if (Array.isArray(body.allergies)) member.allergies = body.allergies;
    if (body.emergencyPhoneRaw) {
      const normalized = normalizePhone(body.emergencyPhoneRaw);
      member.emergencyPhoneRaw = normalized;
      member.emergencyRelayMasked = maskPhone(normalized);
    }
    if (body.erPin && /^\d{4,6}$/.test(body.erPin)) {
      member.erPin = body.erPin;
    }
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault)});
  });

  app.delete('/api/members/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const memberId = req.params.id;
    const store = readStore();
    const vault = store[req.accountId!];
    const memberIdx = vault.members.findIndex((m) => m.id === memberId);
    if (memberIdx === -1) {
      res.status(404).json({error: 'সদস্য প্রোফাইল পাওয়া যায়নি।'});
      return;
    }
    const targetMember = vault.members[memberIdx];
    if (vault.members.length <= 1) {
      res.status(400).json({error: 'কমপক্ষে একটি প্রোফাইল থাকতে হবে।'});
      return;
    }
    if (
      targetMember.relation === 'Self' &&
      vault.members.filter((m) => m.relation === 'Self').length <= 1
    ) {
      res.status(400).json({error: 'মূল অ্যাকাউন্ট হোল্ডার (Self) প্রোফাইল ডিলিট করা যাবে না।'});
      return;
    }

    vault.members.splice(memberIdx, 1);
    vault.prescriptions = vault.prescriptions.filter((p) => p.memberId !== memberId);
    vault.labReports = vault.labReports.filter((r) => r.memberId !== memberId);
    vault.symptomNotes = vault.symptomNotes.filter((s) => s.memberId !== memberId);
    vault.caregiverAlerts = vault.caregiverAlerts.filter((a) => a.memberId !== memberId);
    if (vault.callReports) {
      vault.callReports = vault.callReports.filter((c) => c.memberId !== memberId);
    }
    if (vault.activityLogs) {
      vault.activityLogs = vault.activityLogs.filter((a) => a.memberId !== memberId);
    }
    for (const key of Object.keys(vault.medicineLogs)) {
      if (key.startsWith(`${memberId}_`)) {
        delete vault.medicineLogs[key];
      }
    }
    for (const key of Object.keys(vault.consecutiveCallFailures)) {
      if (key.startsWith(`${memberId}_`)) {
        delete vault.consecutiveCallFailures[key];
      }
    }
    if (vault.callSchedules && vault.callSchedules[memberId]) {
      delete vault.callSchedules[memberId];
    }

    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault)});
  });

  app.post('/api/prescriptions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as Omit<Prescription, 'id' | 'createdAt'>;
    if (!body.memberId || !body.doctorName || !body.visitDate) {
      res.status(400).json({error: 'সদস্য, ডাক্তারের নাম ও ভিজিটের তারিখ আবশ্যক।'});
      return;
    }
    const store = readStore();
    const vault = store[req.accountId!];
    const rx: Prescription = {
      ...body,
      id: `rx_${crypto.randomUUID().slice(0, 8)}`,
      medicines: Array.isArray(body.medicines) ? body.medicines : [],
      suggestedTests: Array.isArray(body.suggestedTests) ? body.suggestedTests : [],
      pages: Array.isArray(body.pages) ? body.pages : [],
      createdAt: new Date().toISOString(),
    };
    vault.prescriptions.unshift(rx);
    recordActivity(vault, rx.memberId, 'prescription', `নতুন প্রেসক্রিপশন যুক্ত (${rx.doctorName})`);
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault), prescription: rx});
  });

  app.patch('/api/prescriptions/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const store = readStore();
    const vault = store[req.accountId!];
    const idx = vault.prescriptions.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({error: 'প্রেসক্রিপশন পাওয়া যায়নি।'});
      return;
    }
    const existing = vault.prescriptions[idx];
    const body = req.body as Partial<Prescription>;
    vault.prescriptions[idx] = {
      ...existing,
      ...body,
      id: existing.id,
      memberId: existing.memberId,
      createdAt: existing.createdAt,
    };
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault)});
  });

  app.post('/api/reports', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as Omit<LabReport, 'id' | 'createdAt'>;
    if (!body.memberId || !body.testName || !body.reportDate || !body.labOrDoctorName) {
      res.status(400).json({error: 'টেস্টের নাম, তারিখ এবং ল্যাব/ডাক্তারের নাম আবশ্যক।'});
      return;
    }
    const store = readStore();
    const vault = store[req.accountId!];
    const report: LabReport = {
      ...body,
      id: `rep_${crypto.randomUUID().slice(0, 8)}`,
      status: body.status === 'Abnormal' ? 'Abnormal' : 'Normal',
      pages: Array.isArray(body.pages) ? body.pages : [],
      createdAt: new Date().toISOString(),
    };
    vault.labReports.unshift(report);
    recordActivity(
      vault,
      report.memberId,
      'report',
      `${report.testName} রিপোর্ট যুক্ত (${report.status})`
    );
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault), report});
  });

  app.patch('/api/reports/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const store = readStore();
    const vault = store[req.accountId!];
    const idx = vault.labReports.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({error: 'রিপোর্ট পাওয়া যায়নি।'});
      return;
    }
    const existing = vault.labReports[idx];
    const body = req.body as Partial<LabReport>;
    vault.labReports[idx] = {
      ...existing,
      ...body,
      id: existing.id,
      memberId: existing.memberId,
      status: body.status === 'Abnormal' ? 'Abnormal' : body.status === 'Normal' ? 'Normal' : existing.status,
      pages: Array.isArray(body.pages) ? body.pages : existing.pages,
      createdAt: existing.createdAt,
    };
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault), report: vault.labReports[idx]});
  });

  app.post('/api/symptoms', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const {memberId, text, isQuickChip} = req.body as {
      memberId?: string;
      text?: string;
      isQuickChip?: boolean;
    };
    if (!memberId || !text || !text.trim()) {
      res.status(400).json({error: 'সমস্যার বিবরণ লিখুন।'});
      return;
    }
    const store = readStore();
    const vault = store[req.accountId!];
    const note: SymptomNote = {
      id: `sym_${crypto.randomUUID().slice(0, 8)}`,
      memberId,
      text: text.trim(),
      isQuickChip: Boolean(isQuickChip),
      recordedAt: new Date().toISOString(),
    };
    vault.symptomNotes.unshift(note);
    recordActivity(vault, memberId, 'symptom', `সমস্যা নোট: ${note.text}`);
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault)});
  });

  app.delete('/api/symptoms/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const store = readStore();
    const vault = store[req.accountId!];
    vault.symptomNotes = vault.symptomNotes.filter((s) => s.id !== req.params.id);
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault)});
  });

  app.post('/api/medicine-logs/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const {memberId, date, slot, status} = req.body as {
      memberId?: string;
      date?: string;
      slot?: MedicineSlot;
      status?: MedicineStatus;
    };
    if (!memberId || !slot || !status || !['morning', 'noon', 'night'].includes(slot)) {
      res.status(400).json({error: 'সঠিক তথ্য দিন।'});
      return;
    }
    const store = readStore();
    const vault = store[req.accountId!];
    const targetDate = date || todayIso();
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
    // Reset consecutive failure count when answered/taken
    if (status === 'taken') {
      vault.consecutiveCallFailures[`${memberId}_${slot}`] = 0;
    }
    const slotBn = slot === 'morning' ? 'সকাল' : slot === 'noon' ? 'দুপুর' : 'রাত';
    const statusBn =
      status === 'taken' ? 'খেয়েছেন ✅' : status === 'snoozed' ? 'পরে খাবেন ⏰' : 'বাকি আছে';
    recordActivity(vault, memberId, 'medicine', `${slotBn} বেলার ওষুধ স্ট্যাটাস: ${statusBn}`);
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault)});
  });

  // --- AI Call Schedule Management (Routine & Centralized Call Tab) ---
  app.put('/api/call-schedules/:memberId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const store = readStore();
    const vault = store[req.accountId!];
    const member = vault.members.find((m) => m.id === req.params.memberId);
    if (!member) {
      res.status(404).json({error: 'সদস্য পাওয়া যায়নি।'});
      return;
    }
    const body = req.body as Partial<MemberCallSchedule>;
    if (!vault.callSchedules) vault.callSchedules = {};
    const existing = vault.callSchedules[member.id] || createDefaultMemberCallSchedule();
    const existingSymptom = existing.symptom || {enabled: true, time: '18:30'};
    const nextSchedule: MemberCallSchedule = {
      morning: existing.morning,
      noon: existing.noon,
      night: existing.night,
      symptom: existingSymptom,
    };

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const slot of ['morning', 'noon', 'night', 'symptom'] as const) {
      const incoming = body[slot];
      if (incoming) {
        const baseSlot = slot === 'symptom' ? existingSymptom : existing[slot];
        const timeVal = typeof incoming.time === 'string' && timeRegex.test(incoming.time)
          ? incoming.time
          : baseSlot.time;
        const enabledVal = typeof incoming.enabled === 'boolean' ? incoming.enabled : baseSlot.enabled;
        nextSchedule[slot] = {enabled: enabledVal, time: timeVal};
      }
    }

    vault.callSchedules[member.id] = nextSchedule;
    const summaryText = body.symptom
      ? `সমস্যা নোট চেক-ইন কল সেট করা হয়েছে (${nextSchedule.symptom?.time || '18:30'})`
      : `AI ইনকামিং কল শিডিউল সেট করা হয়েছে (সকাল ${nextSchedule.morning.time}, দুপুর ${nextSchedule.noon.time}, রাত ${nextSchedule.night.time})`;
    recordActivity(vault, member.id, 'call', summaryText);
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault)});
  });

  // --- Completed AI Call Report (Taken / Snoozed) ---
  app.post('/api/calls/complete', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const {memberId, slot, outcome, transcript, aiReply, durationSeconds, scheduledTime} = req.body as {
      memberId?: string;
      slot?: MedicineSlot;
      outcome?: 'taken' | 'snoozed';
      transcript?: string;
      aiReply?: string;
      durationSeconds?: number;
      scheduledTime?: string;
    };
    if (!memberId || !slot || !['morning', 'noon', 'night'].includes(slot) || (outcome !== 'taken' && outcome !== 'snoozed')) {
      res.status(400).json({error: 'সঠিক কল রিপোর্টের তথ্য দিন।'});
      return;
    }
    const store = readStore();
    const vault = store[req.accountId!];
    const member = vault.members.find((m) => m.id === memberId);
    if (!member) {
      res.status(404).json({error: 'সদস্য পাওয়া যায়নি।'});
      return;
    }

    const targetDate = todayIso();
    const key = `${memberId}_${targetDate}`;
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
    if (outcome === 'taken') {
      vault.consecutiveCallFailures[`${memberId}_${slot}`] = 0;
    }

    const slotBn = slot === 'morning' ? 'সকাল' : slot === 'noon' ? 'দুপুর' : 'রাত';
    const statusBn = outcome === 'taken' ? 'ওষুধ খেয়েছেন ✅' : '৩০ মিনিট পর রিমাইন্ডার ⏰';

    const report = recordCallReport(vault, member, slot, outcome, {
      scheduledTime,
      durationSeconds: typeof durationSeconds === 'number' ? Math.max(1, Math.round(durationSeconds)) : undefined,
      transcript: transcript?.trim(),
      capturedFinding:
        outcome === 'taken'
          ? `${slotBn} বেলার ওষুধ খেয়েছেন নিশ্চিত হয়েছে ✅`
          : `${slotBn} বেলার ওষুধ ৩০ মিনিট পর খাওয়ার জন্য রিমাইন্ডার সেট ⏰`,
      aiReply: aiReply?.trim(),
    });

    recordActivity(vault, member.id, 'call', `${slotBn} বেলার AI কল সম্পন্ন: ${statusBn}`);
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault), report});
  });

  // --- Completed AI Symptom Check-in Call ---
  app.post('/api/calls/symptom-checkin', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const {memberId, outcome, transcript, symptomText, aiReply, durationSeconds, scheduledTime} = req.body as {
      memberId?: string;
      outcome?: 'symptom_ok' | 'symptom_logged';
      transcript?: string;
      symptomText?: string;
      aiReply?: string;
      durationSeconds?: number;
      scheduledTime?: string;
    };
    if (!memberId || (outcome !== 'symptom_ok' && outcome !== 'symptom_logged')) {
      res.status(400).json({error: 'সঠিক স্বাস্থ্য চেক-ইন কল তথ্য দিন।'});
      return;
    }
    const store = readStore();
    const vault = store[req.accountId!];
    const member = vault.members.find((m) => m.id === memberId);
    if (!member) {
      res.status(404).json({error: 'সদস্য পাওয়া যায়নি।'});
      return;
    }

    vault.consecutiveCallFailures[`${memberId}_symptom`] = 0;
    const secs = typeof durationSeconds === 'number' ? Math.max(1, Math.round(durationSeconds)) : undefined;
    const noteText = (symptomText || transcript || '').trim();

    if (outcome === 'symptom_logged' && noteText) {
      const note: SymptomNote = {
        id: `sym_${crypto.randomUUID().slice(0, 8)}`,
        memberId: member.id,
        text: `${noteText} (AI ভয়েস কল থেকে)`,
        isQuickChip: false,
        recordedAt: new Date().toISOString(),
      };
      vault.symptomNotes.unshift(note);

      const whatsappMessage = `স্বাস্থ্যভল্ট সমস্যা চেক-ইন অ্যালার্ট: ${member.name} (${member.relation}) AI কলে জানিয়েছেন: "${noteText}"`;
      const alert: CaregiverAlert = {
        id: `alt_${crypto.randomUUID().slice(0, 8)}`,
        memberId: member.id,
        memberName: member.name,
        type: 'voice_note',
        slot: 'symptom',
        reason: 'সমস্যা চেক-ইন কলে শারীরিক সমস্যার কথা জানিয়েছেন',
        transcript: noteText,
        durationSeconds: secs,
        whatsappMessage,
        whatsappTargetPhone: normalizePhone(vault.accountHolder.phone),
        createdAt: new Date().toISOString(),
        read: false,
      };
      vault.caregiverAlerts.unshift(alert);
      recordActivity(vault, member.id, 'symptom', `AI কলে সমস্যা নোট যুক্ত: ${noteText.slice(0, 60)}`);
    } else {
      recordActivity(vault, member.id, 'call', 'স্বাস্থ্য চেক-ইন কল সম্পন্ন: কোনো সমস্যা নেই ✅');
    }

    const report = recordCallReport(vault, member, 'symptom', outcome, {
      scheduledTime,
      durationSeconds: secs,
      transcript: transcript?.trim(),
      capturedFinding:
        outcome === 'symptom_logged' && noteText
          ? noteText
          : 'কোনো শারীরিক সমস্যা নেই — রোগী সুস্থ আছেন ✅',
      aiReply: aiReply?.trim(),
    });

    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault), report});
  });

  app.post('/api/calls/missed-or-rejected', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const {memberId, slot, outcome, scheduledTime} = req.body as {
      memberId?: string;
      slot?: CallSlot;
      outcome?: 'missed' | 'rejected';
      scheduledTime?: string;
    };
    if (!memberId || !slot || (outcome !== 'missed' && outcome !== 'rejected')) {
      res.status(400).json({error: 'অবৈধ কল স্ট্যাটাস।'});
      return;
    }
    const store = readStore();
    const vault = store[req.accountId!];
    const member = vault.members.find((m) => m.id === memberId);
    if (!member) {
      res.status(404).json({error: 'সদস্য পাওয়া যায়নি।'});
      return;
    }
    const failKey = `${memberId}_${slot}`;
    const nextCount = (vault.consecutiveCallFailures[failKey] || 0) + 1;
    vault.consecutiveCallFailures[failKey] = nextCount;

    const slotBn =
      slot === 'morning'
        ? 'সকাল'
        : slot === 'noon'
          ? 'দুপুর'
          : slot === 'night'
            ? 'রাত'
            : 'সমস্যা চেক-ইন';
    let escalatedAlert: CaregiverAlert | null = null;

    if (nextCount >= 3) {
      const reason =
        outcome === 'missed'
          ? `${slotBn} কল পরপর ৩ বার রিসিভ করেননি (Missed 3x)`
          : `${slotBn} কল পরপর ৩ বার কেটে দিয়েছেন (Rejected 3x)`;
      const whatsappMessage = `জরুরি স্বাস্থ্যভল্ট কেয়ারগিভার অ্যালার্ট: ${member.name} (${member.relation}) ${reason}। অনুগ্রহ করে এখনই খোঁজ নিন।`;
      escalatedAlert = {
        id: `alt_${crypto.randomUUID().slice(0, 8)}`,
        memberId: member.id,
        memberName: member.name,
        type: outcome === 'missed' ? 'missed_escalation' : 'rejected_escalation',
        slot,
        reason,
        whatsappMessage,
        whatsappTargetPhone: normalizePhone(vault.accountHolder.phone),
        createdAt: new Date().toISOString(),
        read: false,
      };
      vault.caregiverAlerts.unshift(escalatedAlert);
      vault.consecutiveCallFailures[failKey] = 0;
    }

    recordCallReport(vault, member, slot, outcome, {
      scheduledTime,
      aiReply:
        outcome === 'missed'
          ? `কল রিসিভ করা হয়নি (মিস কাউন্ট ${nextCount}/৩)`
          : `কল কেটে দেওয়া হয়েছে (রিজেক্ট কাউন্ট ${nextCount}/৩)`,
    });

    recordActivity(
      vault,
      member.id,
      'call',
      `${slotBn} কল ${outcome === 'missed' ? 'মিসড' : 'রিজেক্ট'} (${nextCount}/৩)`
    );

    writeStore(store);
    res.json({
      vault: sanitizeVaultForClient(vault),
      consecutiveCount: nextCount,
      escalatedAlert,
    });
  });

  app.post('/api/calls/escalation-alert', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const {memberId, slot, transcript, durationSeconds, aiReply, scheduledTime} = req.body as {
      memberId?: string;
      slot?: MedicineSlot;
      transcript?: string;
      durationSeconds?: number;
      aiReply?: string;
      scheduledTime?: string;
    };
    if (!memberId || !slot || !transcript) {
      res.status(400).json({error: 'ভয়েস বক্তব্যের তথ্য অসম্পূর্ণ।'});
      return;
    }
    const store = readStore();
    const vault = store[req.accountId!];
    const member = vault.members.find((m) => m.id === memberId);
    if (!member) {
      res.status(404).json({error: 'সদস্য পাওয়া যায়নি।'});
      return;
    }
    const slotBn = slot === 'morning' ? 'সকাল' : slot === 'noon' ? 'দুপুর' : 'রাত';
    const secs = Math.max(1, Math.round(durationSeconds || 1));
    const whatsappMessage = `স্বাস্থ্যভল্ট কেয়ারগিভার অ্যালার্ট: ${member.name} (${member.relation}) ${slotBn} বেলার AI কলে ${secs} সেকেন্ড কথা বলেছেন: "${transcript}"`;

    const cleanTranscript = transcript.trim();
    const note: SymptomNote = {
      id: `sym_${crypto.randomUUID().slice(0, 8)}`,
      memberId: member.id,
      text: `${cleanTranscript} (AI ভয়েস কল থেকে)`,
      isQuickChip: false,
      recordedAt: new Date().toISOString(),
    };
    vault.symptomNotes.unshift(note);

    const alert: CaregiverAlert = {
      id: `alt_${crypto.randomUUID().slice(0, 8)}`,
      memberId: member.id,
      memberName: member.name,
      type: 'voice_note',
      slot,
      reason: `ওষুধের বাইরে কথা বা সমস্যার বিবরণ (${secs} সেকেন্ড)`,
      transcript: cleanTranscript,
      durationSeconds: secs,
      whatsappMessage,
      whatsappTargetPhone: normalizePhone(vault.accountHolder.phone),
      createdAt: new Date().toISOString(),
      read: false,
    };
    vault.caregiverAlerts.unshift(alert);
    vault.consecutiveCallFailures[`${memberId}_${slot}`] = 0;

    recordCallReport(vault, member, slot, 'voice_note', {
      scheduledTime,
      durationSeconds: secs,
      transcript: cleanTranscript,
      capturedFinding: cleanTranscript,
      aiReply,
    });

    recordActivity(
      vault,
      member.id,
      'call',
      `ভয়েস কলে বক্তব্য (${secs} সেকেন্ড): "${cleanTranscript.slice(0, 60)}"`
    );
    writeStore(store);
    res.json({vault: sanitizeVaultForClient(vault), alert});
  });

  app.patch('/api/alerts/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const store = readStore();
    const vault = store[req.accountId!];
    const alert = vault.caregiverAlerts.find((a) => a.id === req.params.id);
    if (alert) {
      alert.read = true;
      writeStore(store);
    }
    res.json({vault: sanitizeVaultForClient(vault)});
  });

  // --- Emergency Layer-2 ER Doctor PIN Verification ---
  app.post('/api/emergency/verify-pin', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const {memberId, pin} = req.body as {memberId?: string; pin?: string};
    if (!memberId || !pin) {
      res.status(400).json({error: 'সদস্য এবং ER Doctor PIN প্রদান করুন।'});
      return;
    }
    const store = readStore();
    const vault = store[req.accountId!];
    const member = vault.members.find((m) => m.id === memberId);
    if (!member) {
      res.status(404).json({error: 'সদস্য পাওয়া যায়নি।'});
      return;
    }
    const provided = Buffer.from(pin.trim());
    const expected = Buffer.from(member.erPin);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      res.status(403).json({error: 'ভুল ER Doctor PIN। অনুগ্রহ করে সঠিক পিন দিন।'});
      return;
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
    res.json({layer2});
  });

  // --- Server-Side Gemini AI Endpoints ---
  app.post('/api/ai/scan-prescription', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {images} = req.body as {images?: Array<{dataUrl: string}>};
      if (!Array.isArray(images) || images.length === 0) {
        res.status(400).json({error: 'কমপক্ষে একটি প্রেসক্রিপশনের ছবি দিন।'});
        return;
      }
      const ai = getAiClient();
      const imageParts = images.slice(0, 6).map((img) => dataUrlToPart(img.dataUrl));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            ...imageParts,
            {
              text:
                'You are a clinical medical record digitizer for Bangladeshi prescriptions (English/Bengali). ' +
                'Analyze all provided prescription page images together and extract structured clinical information. ' +
                'Return visitDate in YYYY-MM-DD format (if missing use today ' +
                todayIso() +
                '). ' +
                'For each medicine, convert dosing notation like 1+0+1 or 0+1+1 into boolean morning/noon/night flags, ' +
                'and write mealTiming and duration in concise natural Bengali (e.g., "খাবারের পর", "১০ দিন"). ' +
                'Write advice in clear Bengali if present or concise medical summary.',
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              visitDate: {type: Type.STRING},
              doctorName: {type: Type.STRING},
              specialty: {type: Type.STRING},
              findings: {type: Type.STRING},
              medicines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: {type: Type.STRING},
                    dosage: {type: Type.STRING},
                    morning: {type: Type.BOOLEAN},
                    noon: {type: Type.BOOLEAN},
                    night: {type: Type.BOOLEAN},
                    mealTiming: {type: Type.STRING},
                    duration: {type: Type.STRING},
                  },
                },
              },
              suggestedTests: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
              },
              advice: {type: Type.STRING},
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({extracted: parsed});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI প্রেসক্রিপশন স্ক্যান ব্যর্থ হয়েছে।';
      res.status(500).json({error: msg});
    }
  });

  app.post('/api/ai/scan-report', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {images} = req.body as {images?: Array<{dataUrl: string}>};
      if (!Array.isArray(images) || images.length === 0) {
        res.status(400).json({error: 'রিপোর্টের ছবি দিন।'});
        return;
      }
      const ai = getAiClient();
      const imageParts = images.slice(0, 6).map((img) => dataUrlToPart(img.dataUrl));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            ...imageParts,
            {
              text:
                'Extract structured lab report details from these medical test report pages. ' +
                'Return reportDate as YYYY-MM-DD, labOrDoctorName, testName, status strictly as "Normal" or "Abnormal", and concise clinical findings.',
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              testName: {type: Type.STRING},
              reportDate: {type: Type.STRING},
              labOrDoctorName: {type: Type.STRING},
              status: {type: Type.STRING},
              findings: {type: Type.STRING},
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({extracted: parsed});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI রিপোর্ট স্ক্যান ব্যর্থ হয়েছে।';
      res.status(500).json({error: msg});
    }
  });

  app.post('/api/ai/tts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {text, gender} = req.body as {text?: string; gender?: 'Male' | 'Female'};
      if (!text) {
        res.status(400).json({error: 'TTS টেক্সট প্রয়োজন।'});
        return;
      }
      const ai = getAiClient();
      const voiceName = gender === 'Male' ? 'Kore' : 'Kore';
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: 'Warm, respectful, calm Bangladeshi healthcare assistant speaking clear Bengali',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {voiceName},
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({error: 'অডিও তৈরি করা যায়নি।'});
        return;
      }
      res.json({audioBase64: base64Audio, mimeType: 'audio/wav'});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gemini TTS ত্রুটি হয়েছে।';
      res.status(500).json({error: msg});
    }
  });

  app.post('/api/ai/transcribe', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {audioBase64, mimeType} = req.body as {audioBase64?: string; mimeType?: string};
      if (!audioBase64) {
        res.status(400).json({error: 'অডিও ডেটা প্রয়োজন।'});
        return;
      }
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe the spoken Bengali (or mixed Bengali/English) audio accurately in Bengali script.',
            },
          ],
        },
      });
      res.json({transcript: (response.text ?? '').trim()});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'অডিও ট্রান্সক্রিপশন ব্যর্থ হয়েছে।';
      res.status(500).json({error: msg});
    }
  });

  app.post('/api/ai/voice-turn', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {transcript, memberName, gender, slotLabel, callType} = req.body as {
        transcript?: string;
        memberName?: string;
        gender?: 'Male' | 'Female';
        slotLabel?: string;
        callType?: 'medicine' | 'symptom';
      };
      if (!transcript) {
        res.status(400).json({error: 'রোগীর বক্তব্য পাওয়া যায়নি।'});
        return;
      }
      const honorific = gender === 'Female' ? 'ম্যাডাম' : 'স্যার';
      const lower = transcript.toLowerCase();

      if (callType === 'symptom') {
        let intent: 'symptom_ok' | 'symptom_logged' = 'symptom_logged';
        let symptomSummary = transcript.trim();
        let replyBn = '';

        try {
          const ai = getAiClient();
          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents:
              `Patient Name: ${memberName || 'রোগী'}\n` +
              `Required Honorific: ${honorific}\n` +
              `Call Purpose: Daily Symptom & Health Check-in (জিজ্ঞাসা করা যে বর্তমান কোনো শারীরিক সমস্যা হচ্ছে কি না)\n` +
              `Patient spoken transcript: "${transcript}"\n\n` +
              `Classify the patient's utterance into exactly one intent:\n` +
              `- "symptom_ok": if they explicitly said they have NO problem, feel fine/healthy (e.g., কোনো সমস্যা নেই, ভালো আছি, সুস্থ আছি, ঠিক আছি, না).\n` +
              `- "symptom_logged": if they mentioned ANY physical problem, symptom, pain, discomfort, weakness, dizziness, fever, acidity, sleeplessness, etc.\n\n` +
              `Also provide:\n` +
              `- "symptomSummary": concise Bengali summary of the problem for the patient's Symptom Note (if symptom_ok, empty string "").\n` +
              `- "replyBn": polite Bengali response addressing the patient as "${honorific}".\n` +
              `  - For "symptom_ok": express gladness they are doing well and wish them good health.\n` +
              `  - For "symptom_logged": empathetically confirm that you have saved this problem to their "বর্তমান সমস্যা নোট" for the next doctor visit and notified the caregiver.`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  intent: {type: Type.STRING},
                  symptomSummary: {type: Type.STRING},
                  replyBn: {type: Type.STRING},
                },
              },
            },
          });

          const parsed = JSON.parse((response.text ?? '{}').trim()) as {
            intent?: string;
            symptomSummary?: string;
            replyBn?: string;
          };
          intent = parsed.intent === 'symptom_ok' ? 'symptom_ok' : 'symptom_logged';
          symptomSummary = intent === 'symptom_logged' ? (parsed.symptomSummary || transcript).trim() : '';
          replyBn = parsed.replyBn || '';
        } catch {
          const noProblemMatch =
            /(কোনো সমস্যা নেই|সমস্যা নেই|ভালো আছি|সুস্থ আছি|ঠিক আছি|আলহামদুলিল্লাহ ভালো|কিছু না|^না$|\bno\b|\bfine\b|\bok\b)/i.test(
              lower
            ) && !/(ব্যথা|জ্বর|মাথা|বমি|দুর্বল|কাশি|শ্বাস|গ্যাস|অ্যাসিডিটি|ঘুম|চুলকানি|অস্বস্তি|খারাপ)/i.test(lower);
          intent = noProblemMatch ? 'symptom_ok' : 'symptom_logged';
          symptomSummary = intent === 'symptom_logged' ? transcript.trim() : '';
        }

        res.json({
          intent,
          symptomSummary,
          replyBn:
            replyBn ||
            (intent === 'symptom_ok'
              ? `আলহামদুলিল্লাহ ${honorific}, শুনে খুব ভালো লাগলো যে আপনি সুস্থ আছেন। নিজের যত্ন নেবেন, আল্লাহ হাফেজ।`
              : `জি ${honorific}, আমি আপনার এই সমস্যার কথাটি “বর্তমান সমস্যা নোট”-এ লিখে রেখেছি এবং কেয়ারগিভারকেও জানিয়ে দিয়েছি। পরবর্তী ডাক্তার ভিজিটে এটি দেখাতে পারবেন।`),
        });
        return;
      }

      let intent: 'taken' | 'snooze' | 'other' = 'other';
      let replyBn = '';

      try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents:
            `Patient Name: ${memberName || 'রোগী'}\n` +
            `Required Honorific: ${honorific}\n` +
            `Slot: ${slotLabel || 'ওষুধের বেলা'}\n` +
            `Patient spoken transcript: "${transcript}"\n\n` +
            `Classify the patient's utterance into exactly one intent:\n` +
            `- "taken": if they confirmed they already took / ate the medicine (e.g., হ্যাঁ, খেয়েছি, নিয়েছি, খাওয়া হয়েছে, yes).\n` +
            `- "snooze": if they said no / will take later / remind later (e.g., না, পরে খাবো, একটু পরে, এখন না, later).\n` +
            `- "other": if they asked any other question, shared any physical symptom/problem, or talked about anything outside confirming/postponing the medicine.\n\n` +
            `Write replyBn strictly in polite Bengali addressing the patient as "${honorific}":\n` +
            `- For "taken": thank them warmly and confirm the medicine status is updated as taken, then say goodbye.\n` +
            `- For "snooze": politely say you will remind them again after 30 minutes and update the status as take later.\n` +
            `- For "other": politely state that you do not have information on that matter, however you have noted down what they said and are forwarding it to the primary account holder right now.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                intent: {type: Type.STRING},
                replyBn: {type: Type.STRING},
              },
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim()) as {
          intent?: string;
          replyBn?: string;
        };
        intent =
          parsed.intent === 'taken' || parsed.intent === 'snooze' || parsed.intent === 'other'
            ? parsed.intent
            : 'other';
        replyBn = parsed.replyBn || '';
      } catch {
        if (/(হ্যাঁ|খেয়েছি|নিয়েছি|খাওয়া হয়েছে|খেয়ে নিয়েছি|taken|yes)/i.test(lower)) {
          intent = 'taken';
        } else if (/(পরে|এখন না|একটু পর|স্নুজ|snooze|later|^না$)/i.test(lower)) {
          intent = 'snooze';
        } else {
          intent = 'other';
        }
      }

      res.json({
        intent,
        replyBn:
          replyBn ||
          (intent === 'taken'
            ? `ধন্যবাদ ${honorific}। আমি আপনার ওষুধ খাওয়ার তথ্য আপডেট করে দিচ্ছি। সুস্থ থাকবেন, আল্লাহ হাফেজ।`
            : intent === 'snooze'
              ? `জি ${honorific}, ঠিক আছে। আমি ৩০ মিনিট পর আবার মনে করিয়ে দেবো।`
              : `দুঃখিত ${honorific}, এই বিষয়ে আমার সরাসরি জানা নেই। তবে আপনার কথাটি নোট করে আমি এখনই মূল অ্যাকাউন্ট হোল্ডারের কাছে পাঠিয়ে দিচ্ছি।`),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI ভয়েস এজেন্ট প্রসেসিং ত্রুটি।';
      res.status(500).json({error: msg});
    }
  });

  // --- Vite Dev Middleware / Production Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShasthyaVault server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
