import React, {useState} from 'react';
import {AlertOctagon, Droplets, KeyRound, Lock, PhoneForwarded, ShieldCheck, Unlock} from 'lucide-react';
import {apiRequest, formatBengaliDate} from '../lib/api.ts';
import type {EmergencyLayer2Data, FamilyMember} from '../types.ts';

interface EmergencyHealthCardProps {
  token: string;
  member: FamilyMember;
}

export const EmergencyHealthCard: React.FC<EmergencyHealthCardProps> = ({token, member}) => {
  const [pin, setPin] = useState('');
  const [layer2, setLayer2] = useState<EmergencyLayer2Data | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset Layer-2 whenever member switches
  React.useEffect(() => {
    setLayer2(null);
    setPin('');
    setError(null);
  }, [member.id]);

  const handleUnlockLayer2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    try {
      const res = await apiRequest<{layer2: EmergencyLayer2Data}>('/api/emergency/verify-pin', {
        method: 'POST',
        token,
        body: {memberId: member.id, pin},
      });
      setLayer2(res.layer2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN যাচাই ব্যর্থ হয়েছে');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <p className="text-xs font-semibold text-red-700">টু-লেয়ার ইমার্জেন্সি সিকিউরিটি</p>
        <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">
          ইমার্জেন্সি হেলথ কার্ড — {member.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          দুর্ঘটনা বা অজ্ঞান অবস্থায় Layer-1 তথ্য পিন ছাড়াই দেখা যাবে। সংবেদনশীল তথ্য দেখতে জরুরি বিভাগের ডাক্তার Layer-2 পিন ব্যবহার করবেন।
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Layer 1: Always Visible Emergency Information */}
        <section className="lg:col-span-6 bg-white border border-red-200 rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold text-red-700">LAYER 1 · সর্বদা দৃশ্যমান জরুরি তথ্য</p>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">{member.name}</h2>
              </div>
              <div className="px-4 py-2 rounded-xl bg-red-600 text-white text-center shrink-0">
                <p className="text-[10px] font-semibold">রক্তের গ্রুপ</p>
                <p className="text-xl font-bold font-mono tabular-nums flex items-center justify-center gap-1">
                  <Droplets className="w-4 h-4" />
                  <span>{member.bloodGroup}</span>
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-red-600" />
                <span>ড্রাগ অ্যালার্জি (Drug Allergies)</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {member.allergies.map((alg, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-sm font-bold text-red-800"
                  >
                    {alg}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500">
                মাস্কড ইমার্জেন্সি কন্টাক্ট (Masked Relay Contact)
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-4">
                <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
                  {member.emergencyRelayMasked}
                </p>
                <a
                  href={`tel:${member.emergencyPhoneRaw}`}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <PhoneForwarded className="w-4 h-4" />
                  <span>রিলে কল</span>
                </a>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                ব্যক্তিগত নম্বর গোপন রেখে পরিবারের মূল অভিভাবকের সাথে জরুরি সংযোগের জন্য।
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
            পরিচিতি বা ঠিকানা ও রোগের ইতিহাস Layer-2 ER Doctor PIN দ্বারা সুরক্ষিত।
          </p>
        </section>

        {/* Layer 2: ER Doctor PIN Protected Information */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-6">
          {!layer2 ? (
            <div className="space-y-5 my-auto">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500">LAYER 2 · ER DOCTOR PIN সুরক্ষিত</p>
                  <h2 className="text-lg font-bold text-slate-900">
                    ডাক্তারি ভেরিফিকেশন পিন দিয়ে আনলক করুন
                  </h2>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                রোগীর {member.idType} নম্বর, সঠিক বয়স এবং সর্বশেষ ডায়াগনসিস দেখতে জরুরি বিভাগের চিকিৎসকের PIN প্রবেশ করান।
              </p>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleUnlockLayer2} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ER Doctor PIN (ডেমো পিন: <span className="font-mono font-bold">2468</span>)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="৪–৬ ডিজিটের PIN"
                      className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-base font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-700"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={verifying}
                  className="w-full min-h-[44px] rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Unlock className="w-4 h-4" />
                  <span>{verifying ? 'যাচাই হচ্ছে...' : 'Layer-2 আনলক করুন'}</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5 text-emerald-700">
                  <ShieldCheck className="w-5 h-5" />
                  <div>
                    <p className="text-xs font-bold">LAYER 2 · ER DOCTOR ACCESS UNLOCKED</p>
                    <h2 className="text-base font-bold text-slate-900">{layer2.name}</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLayer2(null);
                    setPin('');
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>লক করুন</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">{layer2.idType} নম্বর</p>
                  <p className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900">
                    {layer2.idNumber}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">রোগীর বয়স ও লিঙ্গ</p>
                  <p className="mt-1 text-base font-bold text-slate-900 tabular-nums">
                    {layer2.age} বছর · {layer2.gender === 'Female' ? 'মহিলা' : 'পুরুষ'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">সর্বশেষ ডায়াগনসিস (Latest Diagnosis)</span>
                  <span className="tabular-nums">
                    ভিজিট: {layer2.latestVisitDate !== 'N/A' ? formatBengaliDate(layer2.latestVisitDate) : 'N/A'}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900 leading-relaxed">
                  {layer2.latestDiagnosis}
                </p>
              </div>

              {layer2.criticalMedications.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">চলমান প্রধান ওষুধসমূহ</p>
                  <ul className="space-y-1 text-sm text-slate-800">
                    {layer2.criticalMedications.map((med, i) => (
                      <li key={i}>• {med}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
