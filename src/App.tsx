import React, {useEffect, useRef, useState} from 'react';
import {AuthScreen} from './components/AuthScreen.tsx';
import {CaregiverInbox} from './components/CaregiverInbox.tsx';
import {EmergencyHealthCard} from './components/EmergencyHealthCard.tsx';
import {FamilyDashboard} from './components/FamilyDashboard.tsx';
import {FamilyMemberModal} from './components/FamilyMemberModal.tsx';
import {IncomingCallOverlay} from './components/IncomingCallOverlay.tsx';
import {MedicalHistoryTimeline} from './components/MedicalHistoryTimeline.tsx';
import {PrescriptionLabHub} from './components/PrescriptionLabHub.tsx';
import {OfflineIndicator} from './components/PWAInstallButton.tsx';
import {RoutineDashboard} from './components/RoutineDashboard.tsx';
import {TopBar, type ActiveTab} from './components/TopBar.tsx';
import {VoiceCallCenter} from './components/VoiceCallCenter.tsx';
import type {CallSlot, FamilyMember, MedicineItem, MedicineSlot, VaultState} from './types.ts';

interface ActiveCallTarget {
  memberId: string;
  slot: CallSlot;
  scheduledTime?: string;
}

export default function App() {
  // Keep Bearer session token strictly in React memory
  const [token, setToken] = useState<string | null>(null);
  const [vault, setVault] = useState<VaultState | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('routine');

  // Modals & Overlays
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [activeCallTarget, setActiveCallTarget] = useState<ActiveCallTarget | null>(null);
  const [focusedPrescriptionId, setFocusedPrescriptionId] = useState<string | null>(null);

  // Track already-fired automatic scheduled/snooze calls in this session
  const triggeredCallKeysRef = useRef<Set<string>>(new Set());
  // Remember the last tab before opening notifications so clicking the bell again closes it cleanly
  const prevNonInboxTabRef = useRef<ActiveTab>('routine');

  const handleTabChange = (nextTab: ActiveTab) => {
    if (nextTab !== 'inbox') {
      prevNonInboxTabRef.current = nextTab;
    }
    setActiveTab(nextTab);
  };

  const handleToggleNotifications = () => {
    if (activeTab === 'inbox') {
      setActiveTab(prevNonInboxTabRef.current || 'routine');
    } else {
      setActiveTab('inbox');
    }
  };

  const handleAuthenticated = (authToken: string, loadedVault: VaultState) => {
    setToken(authToken);
    setVault(loadedVault);
    if (loadedVault.members.length > 0) {
      const selfMember = loadedVault.members.find((m) => m.relation === 'Self');
      setActiveMemberId(selfMember ? selfMember.id : loadedVault.members[0].id);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setVault(null);
    setActiveMemberId('');
    setActiveCallTarget(null);
    triggeredCallKeysRef.current.clear();
    prevNonInboxTabRef.current = 'routine';
    setActiveTab('routine');
  };

  const handleMemberDeleted = (updatedVault: VaultState, deletedMemberId: string) => {
    setVault(updatedVault);
    if (activeCallTarget?.memberId === deletedMemberId) {
      setActiveCallTarget(null);
    }
    if (activeMemberId === deletedMemberId) {
      const selfMember = updatedVault.members.find((m) => m.relation === 'Self');
      setActiveMemberId(selfMember ? selfMember.id : updatedVault.members[0]?.id || '');
    }
  };

  // Automatic Scheduled AI Call & Snooze Reminder Engine
  useEffect(() => {
    if (!token || !vault || activeCallTarget) return;

    const checkScheduledCalls = () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const localDate = `${yyyy}-${mm}-${dd}`;
      const localHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const orderedMembers = [...vault.members].sort((a, b) => {
        if (a.id === activeMemberId) return -1;
        if (b.id === activeMemberId) return 1;
        return 0;
      });

      for (const m of orderedMembers) {
        const dayLog = vault.medicineLogs?.[`${m.id}_${localDate}`];
        const memberSchedule = vault.callSchedules?.[m.id];

        for (const slot of ['morning', 'noon', 'night'] as const) {
          const slotStatus = dayLog?.[slot];
          if (slotStatus?.status === 'taken') continue;

          const slotSchedule = memberSchedule?.[slot];
          if (slotSchedule?.enabled && slotSchedule.time === localHHMM) {
            const triggerKey = `${m.id}_${localDate}_${slot}_${localHHMM}`;
            if (!triggeredCallKeysRef.current.has(triggerKey)) {
              triggeredCallKeysRef.current.add(triggerKey);
              setActiveCallTarget({
                memberId: m.id,
                slot,
                scheduledTime: slotSchedule.time,
              });
              return;
            }
          }

          if (
            slotStatus?.status === 'snoozed' &&
            slotStatus.snoozeUntil &&
            now.getTime() >= new Date(slotStatus.snoozeUntil).getTime()
          ) {
            const snoozeKey = `${m.id}_${localDate}_${slot}_snooze_${slotStatus.snoozeUntil}`;
            if (!triggeredCallKeysRef.current.has(snoozeKey)) {
              triggeredCallKeysRef.current.add(snoozeKey);
              setActiveCallTarget({
                memberId: m.id,
                slot,
                scheduledTime: slotSchedule?.time,
              });
              return;
            }
          }
        }

        const symptomSchedule = memberSchedule?.symptom;
        if (symptomSchedule?.enabled && symptomSchedule.time === localHHMM) {
          const symptomTriggerKey = `${m.id}_${localDate}_symptom_${localHHMM}`;
          if (!triggeredCallKeysRef.current.has(symptomTriggerKey)) {
            triggeredCallKeysRef.current.add(symptomTriggerKey);
            setActiveCallTarget({
              memberId: m.id,
              slot: 'symptom',
              scheduledTime: symptomSchedule.time,
            });
            return;
          }
        }
      }
    };

    checkScheduledCalls();
    const timer = window.setInterval(checkScheduledCalls, 10000);
    return () => window.clearInterval(timer);
  }, [token, vault, activeMemberId, activeCallTarget]);

  if (!token || !vault) {
    return (
      <>
        <AuthScreen onAuthenticated={handleAuthenticated} />
        <OfflineIndicator />
      </>
    );
  }

  const activeMember =
    vault.members.find((m) => m.id === activeMemberId) || vault.members[0];

  const unreadAlertCount = vault.caregiverAlerts.filter((a) => !a.read).length;

  const getSlotMedicines = (slot: MedicineSlot, memberId = activeMember.id): MedicineItem[] => {
    const list: MedicineItem[] = [];
    const seen = new Set<string>();
    for (const rx of vault.prescriptions) {
      if (rx.memberId !== memberId) continue;
      for (const m of rx.medicines) {
        if (m[slot] && !seen.has(m.name.toLowerCase())) {
          seen.add(m.name.toLowerCase());
          list.push(m);
        }
      }
    }
    return list;
  };

  const activeCallMember = activeCallTarget
    ? vault.members.find((m) => m.id === activeCallTarget.memberId) || activeMember
    : null;

  return (
    <div className="min-h-screen bg-[#F7F9F9] pb-24 lg:pb-12">
      <TopBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onToggleNotifications={handleToggleNotifications}
        members={vault.members}
        activeMember={activeMember}
        onSelectMember={setActiveMemberId}
        onOpenAddMember={() => {
          setEditingMember(null);
          setMemberModalOpen(true);
        }}
        onOpenEditMember={(m) => {
          setEditingMember(m);
          setMemberModalOpen(true);
        }}
        unreadAlertCount={unreadAlertCount}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <FamilyDashboard
            token={token}
            members={vault.members}
            member={activeMember}
            prescriptions={vault.prescriptions}
            labReports={vault.labReports}
            symptomNotes={vault.symptomNotes}
            medicineLogs={vault.medicineLogs}
            caregiverAlerts={vault.caregiverAlerts}
            activityLogs={vault.activityLogs || []}
            onSelectMember={setActiveMemberId}
            onOpenAddMember={() => {
              setEditingMember(null);
              setMemberModalOpen(true);
            }}
            onMemberDeleted={handleMemberDeleted}
            onOpenRecordsTab={() => {
              setFocusedPrescriptionId(null);
              setActiveTab('records');
            }}
            onOpenRoutineTab={() => setActiveTab('routine')}
          />
        )}

        {activeTab === 'history' && (
          <MedicalHistoryTimeline
            member={activeMember}
            prescriptions={vault.prescriptions}
            labReports={vault.labReports}
            onOpenRecordsTab={() => {
              setFocusedPrescriptionId(null);
              handleTabChange('records');
            }}
          />
        )}

        {activeTab === 'routine' && (
          <RoutineDashboard
            token={token}
            member={activeMember}
            prescriptions={vault.prescriptions}
            symptomNotes={vault.symptomNotes}
            medicineLogs={vault.medicineLogs}
            consecutiveFailures={vault.consecutiveCallFailures}
            onOpenRecordsTab={() => {
              setFocusedPrescriptionId(null);
              setActiveTab('records');
            }}
            onOpenPrescription={(rxId) => {
              setFocusedPrescriptionId(rxId);
              setActiveTab('records');
            }}
            onVaultUpdated={setVault}
          />
        )}

        {activeTab === 'records' && (
          <PrescriptionLabHub
            token={token}
            member={activeMember}
            prescriptions={vault.prescriptions}
            labReports={vault.labReports}
            symptomNotes={vault.symptomNotes}
            focusedPrescriptionId={focusedPrescriptionId}
            onClearFocusedPrescription={() => setFocusedPrescriptionId(null)}
            onVaultUpdated={setVault}
          />
        )}

        {activeTab === 'voice' && (
          <VoiceCallCenter
            token={token}
            members={vault.members}
            activeMember={activeMember}
            accountHolderName={vault.accountHolder.name}
            callSchedules={vault.callSchedules || {}}
            callReports={vault.callReports || []}
            symptomNotes={vault.symptomNotes || []}
            consecutiveFailures={vault.consecutiveCallFailures}
            unreadAlertCount={unreadAlertCount}
            getSlotMedicines={(slot) => getSlotMedicines(slot, activeMember.id)}
            onSelectMember={setActiveMemberId}
            onVaultUpdated={setVault}
            onTriggerCall={(slot, scheduledTime) =>
              setActiveCallTarget({
                memberId: activeMember.id,
                slot,
                scheduledTime: scheduledTime || vault.callSchedules?.[activeMember.id]?.[slot]?.time,
              })
            }
            onOpenInbox={() => setActiveTab('inbox')}
          />
        )}

        {activeTab === 'inbox' && (
          <CaregiverInbox
            token={token}
            accountHolderName={vault.accountHolder.name}
            members={vault.members}
            alerts={vault.caregiverAlerts}
            callReports={vault.callReports || []}
            onVaultUpdated={setVault}
          />
        )}

        {activeTab === 'emergency' && (
          <EmergencyHealthCard token={token} member={activeMember} />
        )}
      </main>

      {memberModalOpen && (
        <FamilyMemberModal
          token={token}
          editingMember={editingMember}
          canDelete={
            Boolean(editingMember) &&
            vault.members.length > 1 &&
            !(
              editingMember?.relation === 'Self' &&
              vault.members.filter((m) => m.relation === 'Self').length <= 1
            )
          }
          onClose={() => setMemberModalOpen(false)}
          onSaved={(updatedVault, newMemberId) => {
            setVault(updatedVault);
            if (newMemberId) setActiveMemberId(newMemberId);
            setMemberModalOpen(false);
          }}
          onDeleted={(updatedVault, deletedId) => {
            handleMemberDeleted(updatedVault, deletedId);
            setMemberModalOpen(false);
          }}
        />
      )}

      {activeCallTarget && activeCallMember && (
        <IncomingCallOverlay
          token={token}
          member={activeCallMember}
          slot={activeCallTarget.slot}
          scheduledTime={activeCallTarget.scheduledTime}
          slotMedicines={
            activeCallTarget.slot === 'symptom'
              ? []
              : getSlotMedicines(activeCallTarget.slot, activeCallMember.id)
          }
          onClose={() => setActiveCallTarget(null)}
          onVaultUpdated={setVault}
        />
      )}

      <OfflineIndicator />
    </div>
  );
}
