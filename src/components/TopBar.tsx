import React, {useState} from 'react';
import {
  Bell,
  ChevronDown,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PhoneCall,
  Pill,
  Settings,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';
import type {FamilyMember} from '../types.ts';
import {PWAInstallButton} from './PWAInstallButton.tsx';

export type ActiveTab =
  | 'dashboard'
  | 'history'
  | 'routine'
  | 'records'
  | 'voice'
  | 'inbox'
  | 'emergency';

interface TopBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onToggleNotifications: () => void;
  members: FamilyMember[];
  activeMember: FamilyMember;
  onSelectMember: (id: string) => void;
  onOpenAddMember: () => void;
  onOpenEditMember: (member: FamilyMember) => void;
  unreadAlertCount: number;
  onLogout: () => void;
}

const CORE_NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'routine', label: 'ওষুধ রুটিন', mobileLabel: 'রুটিন', icon: Pill},
  {id: 'records', label: 'প্রেসক্রিপশন ও টেস্ট', mobileLabel: 'রেকর্ড', icon: FileText},
  {id: 'voice', label: 'ভয়েস কল এজেন্ট', mobileLabel: 'কল', icon: PhoneCall},
  {id: 'emergency', label: 'ইমার্জেন্সি কার্ড', mobileLabel: 'ইমার্জেন্সি', icon: ShieldAlert},
];

const RELATION_BN: Record<string, string> = {
  Self: 'নিজে',
  Father: 'বাবা',
  Mother: 'মা',
  Spouse: 'স্ত্রী/স্বামী',
  Child: 'সন্তান',
  Other: 'অন্যান্য',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  onToggleNotifications,
  members,
  activeMember,
  onSelectMember,
  onOpenAddMember,
  onOpenEditMember,
  unreadAlertCount,
  onLogout,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);

  return (
    <>
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-3 md:gap-6">
          {/* Zone 1: Top-Left Hamburger Menu (Dashboard) + Single-line Brand Wordmark */}
          <div className="relative flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setHamburgerOpen((prev) => !prev);
              }}
              aria-label="ড্যাশবোর্ড ও মেনু"
              aria-expanded={hamburgerOpen}
              className={`min-h-[40px] min-w-[40px] rounded-xl border flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                activeTab === 'dashboard' || activeTab === 'history' || hamburgerOpen
                  ? 'bg-teal-50 border-teal-700/40 text-teal-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {hamburgerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setHamburgerOpen(false);
                onTabChange('routine');
              }}
              className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded-md"
            >
              <span className="w-7 h-7 rounded-lg bg-teal-700 text-white flex items-center justify-center text-xs font-bold">
                স্বা
              </span>
              <span>স্বাস্থ্যভল্ট</span>
            </button>

            {hamburgerOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setHamburgerOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute left-0 top-12 z-50 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 space-y-1.5">
                  <div className="px-3 py-1.5 border-b border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-500">মেনু</p>
                  </div>

                  {/* ড্যাশবোর্ড */}
                  <button
                    type="button"
                    onClick={() => {
                      onTabChange('dashboard');
                      setHamburgerOpen(false);
                    }}
                    className={`w-full min-h-[46px] px-3 py-2.5 rounded-xl text-left flex items-start gap-3 transition-colors ${
                      activeTab === 'dashboard'
                        ? 'bg-teal-700 text-white'
                        : 'bg-teal-50/70 text-slate-900 hover:bg-teal-100/70'
                    }`}
                  >
                    <LayoutDashboard
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        activeTab === 'dashboard' ? 'text-white' : 'text-teal-700'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-bold leading-tight">ড্যাশবোর্ড</p>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          activeTab === 'dashboard' ? 'text-teal-100' : 'text-slate-600'
                        }`}
                      >
                        পারিবারিক প্রোফাইল ড্যাশবোর্ড ও মনিটরিং
                      </p>
                    </div>
                  </button>

                  {/* হিস্ট্রি */}
                  <button
                    type="button"
                    onClick={() => {
                      onTabChange('history');
                      setHamburgerOpen(false);
                    }}
                    className={`w-full min-h-[46px] px-3 py-2.5 rounded-xl text-left flex items-start gap-3 transition-colors ${
                      activeTab === 'history'
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-50 text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <History
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        activeTab === 'history' ? 'text-white' : 'text-teal-700'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-bold leading-tight">হিস্ট্রি</p>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          activeTab === 'history' ? 'text-teal-100' : 'text-slate-600'
                        }`}
                      >
                        তারিখভিত্তিক ডাক্তার ভিজিট ও টেস্ট টাইমলাইন
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Zone 2: 4 Core Single-Line Nav Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="প্রধান নেভিগেশন">
            {CORE_NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`relative py-1.5 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded ${
                    isActive
                      ? 'text-teal-800 border-b-2 border-teal-700'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Notification Bell + Family Profile Switcher */}
          <div className="relative shrink-0 flex items-center gap-2">
            <div className="hidden sm:block">
              <PWAInstallButton compact />
            </div>

            {/* Notification Bell Right Next to Profile (Toggles Open/Close) */}
            <button
              type="button"
              onClick={() => {
                setHamburgerOpen(false);
                setMenuOpen(false);
                onToggleNotifications();
              }}
              aria-label="নোটিফিকেশন ও কেয়ারগিভার ইনবক্স"
              aria-pressed={activeTab === 'inbox'}
              title={
                activeTab === 'inbox'
                  ? 'নোটিফিকেশন বন্ধ করুন'
                  : 'নোটিফিকেশন ও কেয়ারগিভার ইনবক্স'
              }
              className={`relative min-h-[40px] min-w-[40px] rounded-xl border flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                activeTab === 'inbox'
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadAlertCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-mono tabular-nums">
                  {unreadAlertCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setHamburgerOpen(false);
                setMenuOpen((prev) => !prev);
              }}
              className="min-h-[40px] pl-2 pr-2.5 sm:pr-3 py-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              aria-expanded={menuOpen}
            >
              {activeMember.avatarUrl ? (
                <img
                  src={activeMember.avatarUrl}
                  alt={activeMember.name}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-teal-700 text-white text-xs font-bold flex items-center justify-center">
                  {activeMember.name.slice(0, 1)}
                </span>
              )}
              <span className="hidden sm:inline text-sm font-semibold text-slate-900 max-w-[120px] truncate">
                {activeMember.name}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl p-2">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-500">ফ্যামিলি ভল্ট প্রোফাইল সুইচ</p>
                  </div>

                  <div className="py-1 max-h-64 overflow-y-auto">
                    {members.map((m) => {
                      const selected = m.id === activeMember.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 transition-colors ${
                            selected ? 'bg-teal-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectMember(m.id);
                              setMenuOpen(false);
                            }}
                            className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                          >
                            {m.avatarUrl ? (
                              <img
                                src={m.avatarUrl}
                                alt={m.name}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200"
                              />
                            ) : (
                              <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                                {m.name.slice(0, 1)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {RELATION_BN[m.relation] || m.relation} · {m.age} বছর ·{' '}
                                {m.gender === 'Female' ? 'ম্যাডাম' : 'স্যার'}
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              onOpenEditMember(m);
                            }}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"
                            title="প্রোফাইল এডিট করুন"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 mt-1 border-t border-slate-100 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenAddMember();
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl text-sm font-semibold text-teal-800 hover:bg-teal-50 flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>নতুন সদস্য যুক্ত করুন</span>
                    </button>

                    <div className="sm:hidden px-1 py-1">
                      <PWAInstallButton compact />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl text-sm font-semibold text-red-700 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>লগ আউট</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Thumb-Zone Bottom Tab Bar */}
      <nav
        className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
        aria-label="মোবাইল নেভিগেশন"
      >
        <div className="grid grid-cols-4 h-16">
          {CORE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`relative flex flex-col items-center justify-center min-h-[44px] transition-colors ${
                  isActive ? 'text-teal-700' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-semibold mt-1 whitespace-nowrap">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
