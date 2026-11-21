import React, {useState} from 'react';
import {Save, Trash2, X} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import type {FamilyMember, Gender, MemberRelation, VaultState} from '../types.ts';

interface FamilyMemberModalProps {
  token: string;
  editingMember: FamilyMember | null;
  canDelete?: boolean;
  onClose: () => void;
  onSaved: (vault: VaultState, newMemberId?: string) => void;
  onDeleted?: (vault: VaultState, deletedMemberId: string) => void;
}

export const FamilyMemberModal: React.FC<FamilyMemberModalProps> = ({
  token,
  editingMember,
  canDelete = false,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const [name, setName] = useState(editingMember?.name || '');
  const [relation, setRelation] = useState<MemberRelation>(editingMember?.relation || 'Mother');
  const [age, setAge] = useState<number>(editingMember?.age ?? 55);
  const [gender, setGender] = useState<Gender>(editingMember?.gender || 'Female');
  const [idNumber, setIdNumber] = useState(editingMember?.idNumber || '');
  const [bloodGroup, setBloodGroup] = useState(editingMember?.bloodGroup || 'B+');
  const [allergiesText, setAllergiesText] = useState(
    editingMember?.allergies.join(', ') || 'কোনো জানা অ্যালার্জি নেই'
  );
  const [emergencyPhoneRaw, setEmergencyPhoneRaw] = useState(
    editingMember?.emergencyPhoneRaw || '01711223344'
  );
  const [erPin, setErPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdult = age >= 18;
  const idLabel = isAdult ? 'জাতীয় পরিচয়পত্র নম্বর (NID Card)' : 'জন্ম নিবন্ধন নম্বর (Birth Certificate)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const allergies = allergiesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (editingMember) {
        const res = await apiRequest<{vault: VaultState}>(`/api/members/${editingMember.id}`, {
          method: 'PATCH',
          token,
          body: {
            name,
            relation,
            age: Number(age),
            gender,
            idNumber,
            bloodGroup,
            allergies,
            emergencyPhoneRaw,
            ...(erPin.trim() ? {erPin: erPin.trim()} : {}),
          },
        });
        onSaved(res.vault);
      } else {
        const res = await apiRequest<{vault: VaultState; memberId: string}>('/api/members', {
          method: 'POST',
          token,
          body: {
            name,
            relation,
            age: Number(age),
            gender,
            idNumber,
            bloodGroup,
            allergies,
            emergencyPhoneRaw,
            erPin: erPin.trim() || '2468',
          },
        });
        onSaved(res.vault, res.memberId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'সংরক্ষণ করা যায়নি');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingMember || !onDeleted) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await apiRequest<{vault: VaultState}>(`/api/members/${editingMember.id}`, {
        method: 'DELETE',
        token,
      });
      onDeleted(res.vault, editingMember.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'প্রোফাইল ডিলিট করা যায়নি');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingMember ? 'সদস্য প্রোফাইল এডিট করুন' : 'নতুন ফ্যামিলি মেম্বার যুক্ত করুন'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              বয়স ১৮+ হলে NID এবং ১৮ বছরের কম হলে জন্ম নিবন্ধন প্রযোজ্য হবে
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">সদস্যের পূর্ণ নাম</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: আনোয়ারা বেগম"
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">সম্পর্ক</label>
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value as MemberRelation)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                <option value="Father">বাবা (Father)</option>
                <option value="Mother">মা (Mother)</option>
                <option value="Spouse">স্ত্রী / স্বামী (Spouse)</option>
                <option value="Child">সন্তান (Child)</option>
                <option value="Self">নিজে (Self)</option>
                <option value="Other">অন্যান্য</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">বয়স (বছর)</label>
              <input
                type="number"
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-700"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                লিঙ্গ (AI ভয়েস সম্বোধন)
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                <option value="Female">মহিলা (কল এজেন্ট: “ম্যাডাম”)</option>
                <option value="Male">পুরুষ (কল এজেন্ট: “স্যার”)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-xs font-semibold text-slate-700">{idLabel}</label>
              <span className="text-[11px] font-medium text-teal-800">
                {isAdult ? 'বয়স ১৮+ · NID প্রযোজ্য' : 'বয়স ১৮-এর কম · জন্ম নিবন্ধন প্রযোজ্য'}
              </span>
            </div>
            <input
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder={isAdult ? 'NID নম্বর লিখুন' : '১৭ ডিজিটের জন্ম নিবন্ধন নম্বর'}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-700"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">রক্তের গ্রুপ</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                জরুরি যোগাযোগ নম্বর (মাস্কড হবে)
              </label>
              <input
                type="tel"
                value={emergencyPhoneRaw}
                onChange={(e) => setEmergencyPhoneRaw(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ড্রাগ অ্যালার্জি (কমা দিয়ে আলাদা করুন)
            </label>
            <input
              type="text"
              value={allergiesText}
              onChange={(e) => setAllergiesText(e.target.value)}
              placeholder="যেমন: Penicillin, Sulfa Drugs"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ER Doctor PIN (৪–৬ ডিজিট){editingMember ? ' — পরিবর্তন করতে চাইলে লিখুন' : ' — ডিফল্ট: 2468'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={erPin}
              onChange={(e) => setErPin(e.target.value.replace(/\D/g, ''))}
              placeholder={editingMember ? 'অপরিবর্তিত রাখতে খালি রাখুন' : '2468'}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              {editingMember && canDelete && onDeleted && (
                !confirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={saving || deleting}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100 text-xs font-semibold text-red-700 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>প্রোফাইল ডিলিট</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {deleting ? 'ডিলিট হচ্ছে...' : 'নিশ্চিত ডিলিট'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      থাক
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={deleting}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 flex items-center gap-2 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
