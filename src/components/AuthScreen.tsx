import React, {useState} from 'react';
import {ArrowRight, Phone, ShieldCheck, UserCheck} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import type {VaultState} from '../types.ts';
import {PWAInstallButton} from './PWAInstallButton.tsx';

interface AuthScreenProps {
  onAuthenticated: (token: string, vault: VaultState) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({onAuthenticated}) => {
  const [nid, setNid] = useState('1988269123456');
  const [phone, setPhone] = useState('01711223344');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{token: string; vault: VaultState}>('/api/auth/direct-login', {
        method: 'POST',
        body: {nid, phone},
      });
      onAuthenticated(res.token, res.vault);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'প্রবেশ করা যায়নি, অনুগ্রহ করে ডেমো লগইন ব্যবহার করুন');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{token: string; vault: VaultState}>('/api/auth/demo-login', {
        method: 'POST',
      });
      onAuthenticated(res.token, res.vault);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ডেমো লগইন ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9F9] flex flex-col">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-sm">
              স্বা
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">স্বাস্থ্যভল্ট</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton compact />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <section className="lg:col-span-6 flex flex-col justify-between bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="relative h-64 sm:h-80 lg:h-[380px] bg-slate-100">
            <img
              src="/src/assets/images/hero_family_care_1795272679813.jpg"
              alt="বাংলাদেশি পরিবারের স্বাস্থ্য যত্ন"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
            <div className="absolute bottom-5 left-6 right-6 text-white">
              <p className="text-xs font-medium text-teal-200">
                পারিবারিক স্বাস্থ্য সুরক্ষা · AI ভয়েস কেয়ার · ইমার্জেন্সি কার্ড
              </p>
              <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold leading-snug text-balance">
                পুরো পরিবারের প্রেসক্রিপশন, ওষুধ ও জরুরি তথ্য এক নিরাপদ ভল্টে
              </h1>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-200 bg-white">
            <div>
              <p className="text-sm font-bold text-slate-900">AI প্রেসক্রিপশন স্ক্যান</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                মাল্টি-পেজ ছবি থেকে ডাক্তারের নাম, ওষুধ ও টেস্ট অটো-এক্সট্র্যাক্ট
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">বাংলা AI ভয়েস কল</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                স্যার/ম্যাডাম সম্বোধনে তিন বেলার ওষুধের কল ও কেয়ারগিভার অ্যালার্ট
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">টু-লেয়ার ইমার্জেন্সি কার্ড</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                অ্যালার্জি ও রক্তের গ্রুপ ওপেন; ER Doctor PIN দিয়ে NID ও ডায়াগনসিস
              </p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <p className="text-xs font-semibold text-teal-700">অ্যাকাউন্ট প্রবেশ</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              স্বাস্থ্যভল্টে স্বাগতম
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              মূল অ্যাকাউন্ট হোল্ডার (Self) প্রবেশ করার পর বাবা, মা, স্ত্রী/স্বামী এবং সন্তানদের প্রোফাইল যুক্ত করতে পারবেন।
            </p>

            {/* 1-Click Demo Login */}
            <div className="mt-6 p-4 rounded-xl bg-teal-50 border border-teal-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-teal-950">তাৎক্ষণিক পরীক্ষার জন্য ডেমো লগইন</p>
                  <p className="text-xs text-teal-800 mt-0.5">
                    ৪ জন ফ্যামিলি মেম্বার, প্রেসক্রিপশন, ল্যাব রিপোর্ট ও কল রুটিন প্রিলোড করা আছে
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleDemoLogin}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{loading ? 'প্রবেশ হচ্ছে...' : 'ডেমো লগইন'}</span>
                </button>
              </div>
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
              <span className="flex-1 h-px bg-slate-200" />
              <span>অথবা NID ও মোবাইল নম্বর দিয়ে প্রবেশ</span>
              <span className="flex-1 h-px bg-slate-200" />
            </div>

            {error && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleDirectLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="nid-input">
                  জাতীয় পরিচয়পত্র নম্বর (NID)
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="nid-input"
                    type="text"
                    value={nid}
                    onChange={(e) => setNid(e.target.value)}
                    placeholder="১০, ১৩ বা ১৭ ডিজিটের NID নম্বর"
                    className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="phone-input">
                  মোবাইল নম্বর
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="phone-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[46px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span>{loading ? 'প্রবেশ হচ্ছে...' : 'সরাসরি প্রবেশ করুন (OTP ছাড়াই)'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                মোবাইল OTP ভেরিফিকেশন আপাতত ঐচ্ছিক রাখা হয়েছে — এখন কোনো OTP ছাড়াই প্রবেশ করতে পারবেন।
              </p>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};
