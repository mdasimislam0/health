import React, {useState} from 'react';
import {Download, Share, Smartphone, WifiOff, X} from 'lucide-react';
import {useOnlineStatus, usePWAInstall} from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC<{compact?: boolean}> = ({compact = false}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-teal-700/20 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
          compact ? 'min-h-[40px] px-3 py-1.5 text-xs font-semibold' : 'min-h-[44px] px-4 py-2 text-sm font-semibold'
        }`}
        title="অ্যাপ হিসেবে ইনস্টল করুন"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>অ্যাপ ইনস্টল</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">ডিভাইসে স্বাস্থ্যভল্ট ইনস্টল করুন</h3>
                  <p className="text-xs text-slate-500">Android, iOS ও কম্পিউটারের জন্য PWA গাইড</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-700 leading-relaxed">
              {isIOS ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                  <p className="font-semibold text-slate-900">iPhone / iPad (Safari):</p>
                  <p className="flex items-center gap-2">
                    ১. নিচের <Share className="w-4 h-4 text-teal-700 inline" /> <strong>Share</strong> বাটনে ট্যাপ করুন।
                  </p>
                  <p>২. নিচে স্ক্রল করে <strong>Add to Home Screen</strong> নির্বাচন করে <strong>Add</strong> চাপুন।</p>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                  <p className="font-semibold text-slate-900">Android / Desktop (Chrome / Edge):</p>
                  <p>১. ব্রাউজারের অ্যাড্রেস বারের ডানদিকে থাকা <strong>Install App</strong> আইকনে ক্লিক করুন, অথবা মেনু (⋮) থেকে <strong>Add to Home screen / Install ShasthyaVault</strong> চাপুন।</p>
                  <p className="text-xs text-slate-500">একবার ইনস্টল করলে হোম স্ক্রিন থেকেই অফলাইন ক্যাশসহ সরাসরি অ্যাপ হিসেবে চালু হবে।</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors"
            >
              বুঝেছি
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>অফলাইন মোড — ক্যাশ করা স্বাস্থ্য তথ্য প্রদর্শিত হচ্ছে</span>
    </div>
  );
};
