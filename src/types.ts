export type Gender = 'Male' | 'Female';

export type MemberRelation = 'Self' | 'Father' | 'Mother' | 'Spouse' | 'Child' | 'Other';

export type MedicineSlot = 'morning' | 'noon' | 'night';

export type CallSlot = MedicineSlot | 'symptom';

export type MedicineStatus = 'pending' | 'taken' | 'snoozed';

export type ReportResultStatus = 'Normal' | 'Abnormal';

export interface FamilyMember {
  id: string;
  name: string;
  relation: MemberRelation;
  age: number;
  gender: Gender;
  idType: 'NID' | 'Birth Certificate';
  idNumber: string;
  bloodGroup: string;
  allergies: string[];
  emergencyRelayMasked: string;
  emergencyPhoneRaw: string;
  erPin: string;
  avatarUrl?: string;
}

export interface MedicineItem {
  id: string;
  name: string;
  dosage: string;
  morning: boolean;
  noon: boolean;
  night: boolean;
  mealTiming: string;
  duration: string;
}

export interface SuggestedTest {
  id: string;
  name: string;
}

export interface PageImage {
  id: string;
  name: string;
  dataUrl: string;
}

export interface Prescription {
  id: string;
  memberId: string;
  visitDate: string; // YYYY-MM-DD
  doctorName: string;
  specialty: string;
  findings: string;
  medicines: MedicineItem[];
  suggestedTests: SuggestedTest[];
  advice: string;
  pages: PageImage[];
  createdAt: string;
}

export interface LabReport {
  id: string;
  memberId: string;
  prescriptionId?: string;
  suggestedTestId?: string;
  testName: string;
  reportDate: string; // YYYY-MM-DD
  labOrDoctorName: string;
  status: ReportResultStatus;
  findings: string;
  pages: PageImage[];
  createdAt: string;
}

export interface SymptomNote {
  id: string;
  memberId: string;
  text: string;
  isQuickChip: boolean;
  recordedAt: string; // ISO string
}

export interface SlotStatusRecord {
  status: MedicineStatus;
  updatedAt: string;
  snoozeUntil?: string;
}

export interface MedicineDayLog {
  [slot: string]: SlotStatusRecord;
}

export interface CaregiverAlert {
  id: string;
  memberId: string;
  memberName: string;
  type: 'voice_note' | 'missed_escalation' | 'rejected_escalation';
  slot: CallSlot;
  reason: string;
  transcript?: string;
  durationSeconds?: number;
  whatsappMessage: string;
  whatsappTargetPhone: string;
  createdAt: string;
  read: boolean;
}

export interface SlotCallSchedule {
  enabled: boolean;
  time: string; // "HH:MM" 24-hour format e.g. "08:00"
}

export type MemberCallSchedule = Record<MedicineSlot, SlotCallSchedule> & {
  symptom?: SlotCallSchedule;
};

export type CallReportOutcome =
  | 'taken'
  | 'snoozed'
  | 'voice_note'
  | 'missed'
  | 'rejected'
  | 'symptom_ok'
  | 'symptom_logged';

export interface CallReport {
  id: string;
  memberId: string;
  memberName: string;
  memberRelation: MemberRelation;
  accountHolderName: string;
  slot: CallSlot;
  scheduledTime: string;
  outcome: CallReportOutcome;
  durationSeconds?: number;
  transcript?: string;
  capturedFinding?: string;
  aiReply?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  memberId: string;
  category: 'medicine' | 'prescription' | 'report' | 'symptom' | 'call';
  summary: string;
  timestamp: string;
}

export interface VaultState {
  accountHolder: {
    name: string;
    nid: string;
    phone: string;
  };
  members: FamilyMember[];
  prescriptions: Prescription[];
  labReports: LabReport[];
  symptomNotes: SymptomNote[];
  // key: `${memberId}_${YYYY-MM-DD}`
  medicineLogs: Record<string, Record<MedicineSlot, SlotStatusRecord>>;
  // key: memberId
  callSchedules: Record<string, MemberCallSchedule>;
  // key: `${memberId}_${slot}`
  consecutiveCallFailures: Record<string, number>;
  caregiverAlerts: CaregiverAlert[];
  callReports: CallReport[];
  activityLogs: ActivityLog[];
}

export interface EmergencyLayer2Data {
  memberId: string;
  name: string;
  idType: 'NID' | 'Birth Certificate';
  idNumber: string;
  age: number;
  gender: Gender;
  latestDiagnosis: string;
  latestVisitDate: string;
  criticalMedications: string[];
}
