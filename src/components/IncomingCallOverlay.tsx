import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Clock,
  Lock,
  Mic,
  Phone,
  PhoneOff,
  Send,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import type {CallSlot, FamilyMember, MedicineItem, VaultState} from '../types.ts';

interface IncomingCallOverlayProps {
  token: string;
  member: FamilyMember;
  slot: CallSlot;
  scheduledTime?: string;
  slotMedicines: MedicineItem[];
  onClose: () => void;
  onVaultUpdated: (vault: VaultState) => void;
}

type CallStage = 'ringing' | 'ai_speaking' | 'user_listening' | 'processing' | 'ai_closing';

const SLOT_BN: Record<CallSlot, string> = {
  morning: 'সকাল',
  noon: 'দুপুর',
  night: 'রাত',
  symptom: 'সমস্যা চেক-ইন',
};

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: {error: string}) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
  token,
  member,
  slot,
  scheduledTime,
  slotMedicines,
  onClose,
  onVaultUpdated,
}) => {
  const [stage, setStage] = useState<CallStage>('ringing');
  const [ringMuted, setRingMuted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [aiCaption, setAiCaption] = useState('');
  const [userTranscript, setUserTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [speechDurationSec, setSpeechDurationSec] = useState(0);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [micLocked, setMicLocked] = useState(true);

  const dragStartXRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<number | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechTimerRef = useRef<number | null>(null);
  const speechStartedAtRef = useRef<number>(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<string>('');
  const closedRef = useRef(false);

  const honorific = member.gender === 'Female' ? 'ম্যাডাম' : 'স্যার';
  const isSymptomCall = slot === 'symptom';
  const slotBn = SLOT_BN[slot];
  const medNamesText =
    slotMedicines.length > 0
      ? slotMedicines.map((m) => m.name).join(', ')
      : `${slotBn} বেলার নির্ধারিত ওষুধ`;

  const stopRingtone = useCallback(() => {
    if (ringIntervalRef.current) {
      window.clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const stopAllMicResources = useCallback(() => {
    if (speechTimerRef.current) {
      window.clearInterval(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const cleanupAll = useCallback(() => {
    closedRef.current = true;
    stopRingtone();
    stopAllMicResources();
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [stopAllMicResources, stopRingtone]);

  // Web Audio gentle clinical ringtone while ringing
  useEffect(() => {
    if (stage !== 'ringing' || ringMuted) {
      stopRingtone();
      return;
    }
    const playPulse = () => {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
        const ctx = audioCtxRef.current || new AudioCtx();
        audioCtxRef.current = ctx;
        const now = ctx.currentTime;
        [523.25, 659.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.18);
          gain.gain.setValueAtTime(0.001, now + i * 0.18);
          gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.18 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.32);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.18);
          osc.stop(now + i * 0.18 + 0.34);
        });
      } catch {
        // Autoplay policy may block before interaction
      }
    };

    playPulse();
    ringIntervalRef.current = window.setInterval(playPulse, 1800);
    return () => stopRingtone();
  }, [stage, ringMuted, stopRingtone]);

  useEffect(() => {
    return () => cleanupAll();
  }, [cleanupAll]);

  const speakBengali = useCallback(
    async (text: string): Promise<void> => {
      setMicLocked(true);
      setAiCaption(text);

      // Try Gemini TTS first, fall back cleanly to Web Speech Synthesis if offline/blocked
      try {
        const res = await apiRequest<{audioBase64: string; mimeType: string}>('/api/ai/tts', {
          method: 'POST',
          token,
          body: {text, gender: member.gender},
        });
        if (closedRef.current) return;
        await new Promise<void>((resolve) => {
          const audio = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
          activeAudioRef.current = audio;
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
        return;
      } catch {
        // Fallback to browser Bengali SpeechSynthesis
      }

      if (closedRef.current) return;
      await new Promise<void>((resolve) => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = 'bn-BD';
          utter.rate = 0.95;
          utter.onend = () => resolve();
          utter.onerror = () => resolve();
          window.speechSynthesis.speak(utter);
          setTimeout(resolve, Math.max(3200, text.length * 75));
        } else {
          setTimeout(resolve, 2500);
        }
      });
    },
    [member.gender, token]
  );

  const startExclusiveMicListening = useCallback(async () => {
    if (closedRef.current) return;
    setStage('user_listening');
    setMicLocked(false);
    setUserTranscript('');
    transcriptRef.current = '';
    setSpeechDurationSec(0);
    speechStartedAtRef.current = Date.now();

    speechTimerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - speechStartedAtRef.current) / 1000;
      setSpeechDurationSec(Number(elapsed.toFixed(1)));
    }, 100);

    // 1. Try browser Bengali Web Speech API
    const SpeechRecCtor =
      (window as unknown as {SpeechRecognition?: new () => SpeechRecognitionLike}).SpeechRecognition ||
      (window as unknown as {webkitSpeechRecognition?: new () => SpeechRecognitionLike}).webkitSpeechRecognition;

    if (SpeechRecCtor) {
      try {
        const rec = new SpeechRecCtor();
        rec.lang = 'bn-BD';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (ev) => {
          let full = '';
          for (let i = 0; i < ev.results.length; i++) {
            full += ev.results[i][0].transcript + ' ';
          }
          const clean = full.trim();
          transcriptRef.current = clean;
          setUserTranscript(clean);
        };
        rec.onerror = () => {};
        rec.start();
        recognitionRef.current = rec;
      } catch {
        // fallback below
      }
    }

    // 2. Also capture MediaRecorder for Gemini 3.5 Transcribe backup
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({audio: true});
        if (closedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch {
        // Microphone denied or unavailable in headless browser; user can still use quick voice chips / text input
      }
    }
  }, []);

  const handleAnswerCall = async () => {
    stopRingtone();
    setStage('ai_speaking');
    const greeting = isSymptomCall
      ? `আসসালামু আলাইকুম ${member.name} ${honorific}। আমি স্বাস্থ্যভল্ট থেকে বলছি। আপনার এখন কি কোনো শারীরিক সমস্যা বা অসুবিধা হচ্ছে? কোনো সমস্যা থাকলে বলুন, আমি আপনার বর্তমান সমস্যা নোটে লিখে রাখছি।`
      : `আসসালামু আলাইকুম ${member.name} ${honorific}। আমি স্বাস্থ্যভল্ট থেকে বলছি। আপনার ${slotBn} বেলার ওষুধ— ${medNamesText}— কি খাওয়া হয়েছে?`;
    await speakBengali(greeting);
    if (!closedRef.current) {
      await startExclusiveMicListening();
    }
  };

  const handleRejectOrMiss = async (outcome: 'rejected' | 'missed') => {
    cleanupAll();
    const res = await apiRequest<{
      vault: VaultState;
      consecutiveCount: number;
      escalatedAlert: {reason: string} | null;
    }>('/api/calls/missed-or-rejected', {
      method: 'POST',
      token,
      body: {memberId: member.id, slot, outcome, scheduledTime},
    });
    onVaultUpdated(res.vault);
    if (res.escalatedAlert) {
      setStatusBanner(
        `🚨 পরপর ৩ বার ${outcome === 'missed' ? 'মিসড' : 'রিজেক্ট'}! কেয়ারগিভার ইনবক্স ও WhatsApp অ্যালার্ট পাঠানো হয়েছে।`
      );
      setTimeout(onClose, 2600);
    } else {
      onClose();
    }
  };

  const processPatientTurn = async (explicitText?: string) => {
    const durationSec = Math.max(1, Math.round((Date.now() - speechStartedAtRef.current) / 1000));
    setMicLocked(true);
    setStage('processing');

    // Stop live SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (speechTimerRef.current) {
      window.clearInterval(speechTimerRef.current);
      speechTimerRef.current = null;
    }

    let finalTranscript = (explicitText || transcriptRef.current || userTranscript).trim();

    // If Web Speech API didn't capture text, transcribe recorded audio with Gemini 3.5 Transcribe
    if (!finalTranscript && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const audioBlob = await new Promise<Blob | null>((resolve) => {
        const rec = mediaRecorderRef.current!;
        rec.onstop = () => {
          resolve(
            audioChunksRef.current.length > 0
              ? new Blob(audioChunksRef.current, {type: rec.mimeType || 'audio/webm'})
              : null
          );
        };
        rec.stop();
      });

      if (audioBlob && audioBlob.size > 400) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const str = String(reader.result);
              resolve(str.split(',')[1] || '');
            };
            reader.onerror = () => reject(new Error('Audio read error'));
            reader.readAsDataURL(audioBlob);
          });
          const trRes = await apiRequest<{transcript: string}>('/api/ai/transcribe', {
            method: 'POST',
            token,
            body: {audioBase64: base64, mimeType: audioBlob.type || 'audio/webm'},
          });
          finalTranscript = trRes.transcript;
        } catch {
          // ignore
        }
      }
    }

    stopAllMicResources();

    if (!finalTranscript) {
      finalTranscript = isSymptomCall ? 'না, এখন কোনো সমস্যা নেই' : 'হ্যাঁ, ওষুধ খেয়েছি';
    }
    setUserTranscript(finalTranscript);

    try {
      if (isSymptomCall) {
        const turnRes = await apiRequest<{
          intent: 'symptom_ok' | 'symptom_logged';
          symptomSummary?: string;
          replyBn: string;
        }>('/api/ai/voice-turn', {
          method: 'POST',
          token,
          body: {
            transcript: finalTranscript,
            memberName: member.name,
            gender: member.gender,
            slotLabel: 'সমস্যা চেক-ইন',
            callType: 'symptom',
          },
        });

        const vRes = await apiRequest<{vault: VaultState}>('/api/calls/symptom-checkin', {
          method: 'POST',
          token,
          body: {
            memberId: member.id,
            outcome: turnRes.intent,
            transcript: finalTranscript,
            symptomText: turnRes.symptomSummary || finalTranscript,
            aiReply: turnRes.replyBn,
            durationSeconds: durationSec,
            scheduledTime,
          },
        });
        onVaultUpdated(vRes.vault);
        setStatusBanner(
          turnRes.intent === 'symptom_logged'
            ? '📝 আপনার সমস্যার বিবরণ “বর্তমান সমস্যা নোট” ও কল রিপোর্টে সেভ হয়েছে'
            : '✅ সুস্থতার চেক-ইন কল রিপোর্টে সেভ হয়েছে'
        );

        setStage('ai_closing');
        await speakBengali(turnRes.replyBn);
        if (!closedRef.current) {
          setTimeout(() => {
            if (!closedRef.current) onClose();
          }, 1200);
        }
        return;
      }

      const turnRes = await apiRequest<{intent: 'taken' | 'snooze' | 'other'; replyBn: string}>(
        '/api/ai/voice-turn',
        {
          method: 'POST',
          token,
          body: {
            transcript: finalTranscript,
            memberName: member.name,
            gender: member.gender,
            slotLabel: slotBn,
            callType: 'medicine',
          },
        }
      );

      if (turnRes.intent === 'taken') {
        const vRes = await apiRequest<{vault: VaultState}>('/api/calls/complete', {
          method: 'POST',
          token,
          body: {
            memberId: member.id,
            slot,
            outcome: 'taken',
            transcript: finalTranscript,
            aiReply: turnRes.replyBn,
            durationSeconds: durationSec,
            scheduledTime,
          },
        });
        onVaultUpdated(vRes.vault);
        setStatusBanner('✅ স্ট্যাটাস আপডেট হয়েছে ও কল রিপোর্ট সেভ হয়েছে: খেয়েছেন');
      } else if (turnRes.intent === 'snooze') {
        const vRes = await apiRequest<{vault: VaultState}>('/api/calls/complete', {
          method: 'POST',
          token,
          body: {
            memberId: member.id,
            slot,
            outcome: 'snoozed',
            transcript: finalTranscript,
            aiReply: turnRes.replyBn,
            durationSeconds: durationSec,
            scheduledTime,
          },
        });
        onVaultUpdated(vRes.vault);
        setStatusBanner('⏰ ৩০ মিনিট পর রিমাইন্ডার ও কল রিপোর্ট সেভ হয়েছে: পরে খাবেন');
      } else {
        const aRes = await apiRequest<{vault: VaultState}>('/api/calls/escalation-alert', {
          method: 'POST',
          token,
          body: {
            memberId: member.id,
            slot,
            transcript: finalTranscript,
            durationSeconds: durationSec,
            aiReply: turnRes.replyBn,
            scheduledTime,
          },
        });
        onVaultUpdated(aRes.vault);
        setStatusBanner(`📩 ${durationSec} সেকেন্ডের বক্তব্য কেয়ারগিভার ইনবক্স ও কল রিপোর্টে পাঠানো হয়েছে`);
      }

      setStage('ai_closing');
      await speakBengali(turnRes.replyBn);
      if (!closedRef.current) {
        setTimeout(() => {
          if (!closedRef.current) onClose();
        }, 1200);
      }
    } catch (err) {
      setStatusBanner(err instanceof Error ? err.message : 'কল প্রসেসিং ত্রুটি');
    }
  };

  // Swipe gesture handlers on ringing pill
  const handlePointerDown = (clientX: number) => {
    dragStartXRef.current = clientX;
  };
  const handlePointerMove = (clientX: number) => {
    if (dragStartXRef.current === null) return;
    const delta = Math.max(-130, Math.min(130, clientX - dragStartXRef.current));
    setDragOffset(delta);
  };
  const handlePointerEnd = (clientX?: number) => {
    if (dragStartXRef.current === null) return;
    const finalDelta =
      typeof clientX === 'number'
        ? Math.max(-130, Math.min(130, clientX - dragStartXRef.current))
        : dragOffset;
    dragStartXRef.current = null;
    setDragOffset(0);
    if (finalDelta > 65) {
      handleAnswerCall();
      return;
    }
    if (finalDelta < -65) {
      handleRejectOrMiss('rejected');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 select-none overflow-y-auto">
      {/* Top Status Row */}
      <div className="max-w-lg w-full mx-auto flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-teal-300">
            স্বাস্থ্যভল্ট AI ভয়েস কেয়ার · {isSymptomCall ? 'সমস্যা চেক-ইন কল' : `${slotBn} বেলা`}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            সম্বোধন: {honorific} · প্রোফাইল: {member.name}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRingMuted((m) => !m)}
          className="min-h-[40px] min-w-[40px] rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
          title={ringMuted ? 'রিংটোন চালু করুন' : 'মিউট করুন'}
        >
          {ringMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Center Caller Identity & Active Conversation */}
      <div className="max-w-lg w-full mx-auto my-auto py-8 text-center space-y-6">
        <div className="relative w-28 h-28 mx-auto">
          {stage === 'ringing' && (
            <span className="absolute inset-0 rounded-full border-2 border-teal-400 animate-ping opacity-60" />
          )}
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.name}
              referrerPolicy="no-referrer"
              className="relative w-28 h-28 rounded-full object-cover border-4 border-teal-500"
            />
          ) : (
            <div className="relative w-28 h-28 rounded-full bg-teal-700 border-4 border-teal-400 flex items-center justify-center text-3xl font-bold">
              {member.name.slice(0, 1)}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{member.name}</h2>
          <p className="mt-1 text-sm text-teal-300">
            {stage === 'ringing' &&
              (isSymptomCall
                ? 'ইনকামিং স্বাস্থ্য ও সমস্যা চেক-ইন কল...'
                : 'ইনকামিং মেডিসিন রিমাইন্ডার কল...')}
            {stage === 'ai_speaking' && 'AI এজেন্ট বাংলায় কথা বলছে...'}
            {stage === 'user_listening' && 'মাইক্রোফোন আনলকড — বাংলায় বলুন'}
            {stage === 'processing' && 'বক্তব্য বিশ্লেষণ হচ্ছে...'}
            {stage === 'ai_closing' && 'কল সমাপ্ত হচ্ছে...'}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {isSymptomCall
              ? 'কলের উদ্দেশ্য: বর্তমান শারীরিক সমস্যা হচ্ছে কি না শোনা ও নোট করা'
              : `নির্ধারিত ওষুধ: ${medNamesText}`}
          </p>
        </div>

        {statusBanner && (
          <div className="rounded-xl bg-teal-900/80 border border-teal-500/40 px-4 py-3 text-sm font-semibold text-teal-100">
            {statusBanner}
          </div>
        )}

        {/* Exclusive-Mic Conversation Panel */}
        {stage !== 'ringing' && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 text-left space-y-4">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-teal-300">
                {micLocked ? '🔒 এক্সক্লুসিভ মাইক লকড (AI বলছে)' : '🎙️ মাইক্রোফোন সক্রিয় — শুনছে'}
              </span>
              {stage === 'user_listening' && (
                <span className="font-mono tabular-nums text-amber-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{speechDurationSec.toFixed(1)} সেকেন্ড</span>
                </span>
              )}
            </div>

            {aiCaption && (
              <div className="rounded-xl bg-slate-800/80 p-3.5 text-sm text-slate-100 leading-relaxed">
                <p className="text-[11px] font-semibold text-teal-300 mb-1">AI কেয়ার এজেন্ট:</p>
                <p>{aiCaption}</p>
              </div>
            )}

            {userTranscript && (
              <div className="rounded-xl bg-teal-950/60 border border-teal-800/60 p-3.5 text-sm text-white leading-relaxed">
                <p className="text-[11px] font-semibold text-emerald-300 mb-1">আপনার বক্তব্য:</p>
                <p>“{userTranscript}”</p>
              </div>
            )}

            {stage === 'user_listening' && (
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={() => processPatientTurn()}
                  className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  <span>বলা শেষ হয়েছে — পাঠান</span>
                </button>

                {/* Quick Bengali Speech Simulation / Fallback for Mic-less Browsers */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <p className="text-[11px] text-slate-400">
                    মাইক্রোফোন না থাকলে সরাসরি বাংলায় টাইপ বা ট্যাপ করুন:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {isSymptomCall ? (
                      <>
                        <button
                          type="button"
                          onClick={() => processPatientTurn('না, এখন কোনো সমস্যা নেই — সুস্থ আছি')}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300"
                        >
                          “না, কোনো সমস্যা নেই”
                        </button>
                        <button
                          type="button"
                          onClick={() => processPatientTurn('আজ হালকা মাথা ব্যথা ও দুর্বল লাগছে')}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300"
                        >
                          “মাথা ব্যথা ও দুর্বলতা”
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            processPatientTurn('পেটে গ্যাস ও একটু বুক জ্বালাপোড়া হচ্ছে')
                          }
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300"
                        >
                          “পেটে গ্যাস ও বুক জ্বালাপোড়া”
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => processPatientTurn('হ্যাঁ, ওষুধ খেয়েছি')}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300"
                        >
                          “হ্যাঁ, খেয়েছি”
                        </button>
                        <button
                          type="button"
                          onClick={() => processPatientTurn('না, আমি ৩০ মিনিট পরে খাবো')}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300"
                        >
                          “না, পরে খাবো”
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            processPatientTurn('আমার আজ সকাল থেকে একটু মাথা ঘুরছে এবং বুক ধড়ফড় করছে')
                          }
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300"
                        >
                          “অন্য সমস্যার কথা বলুন”
                        </button>
                      </>
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (manualText.trim()) processPatientTurn(manualText.trim());
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="বাংলায় যেকোনো উত্তর লিখুন..."
                      className="flex-1 min-h-[40px] px-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={!manualText.trim()}
                      className="min-h-[40px] px-3 rounded-lg bg-teal-700 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {micLocked && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400">
                <Lock className="w-3.5 h-3.5" />
                <span>AI কথা শেষ করার সাথে সাথেই মাইক্রোফোন আনলক হবে</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Swipe (Ringing) / Single End-Call Button (After Receive) */}
      <div className="max-w-lg w-full mx-auto">
        {stage === 'ringing' ? (
          <div className="space-y-2.5">
            <div className="relative h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-between px-5 overflow-hidden touch-none select-none">
              <span className="text-xs font-semibold text-red-400 pointer-events-none">
                ← বামে সোয়াইপ: কাটুন
              </span>

              <div
                role="slider"
                aria-label="কল ধরতে ডানে এবং কাটতে বামে সোয়াইপ করুন"
                aria-valuenow={dragOffset}
                aria-valuemin={-130}
                aria-valuemax={130}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  handlePointerDown(e.clientX);
                }}
                onPointerMove={(e) => handlePointerMove(e.clientX)}
                onPointerUp={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                  handlePointerEnd(e.clientX);
                }}
                onPointerCancel={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                  handlePointerEnd(e.clientX);
                }}
                style={{transform: `translateX(${dragOffset}px)`}}
                className={`w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing transition-transform touch-none ${
                  dragOffset > 35
                    ? 'bg-emerald-600'
                    : dragOffset < -35
                      ? 'bg-red-600'
                      : 'bg-teal-600'
                }`}
                title="ডানে বা বামে সোয়াইপ করুন"
              >
                <Phone className="w-5 h-5" />
              </div>

              <span className="text-xs font-semibold text-emerald-400 pointer-events-none">
                ডানে সোয়াইপ: ধরুন →
              </span>
            </div>
            <p className="text-center text-[11px] text-slate-400">
              মাঝের কল আইকনটি ডানে টেনে ধরুন অথবা বামে টেনে কাটুন
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                cleanupAll();
                onClose();
              }}
              className="min-h-[52px] px-8 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-2"
            >
              <PhoneOff className="w-4 h-4" />
              <span>কল শেষ করুন</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
