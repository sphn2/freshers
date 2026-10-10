"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck, X } from "lucide-react";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  submitting?: boolean;
}

export const FRESHERS_RULES = [
  "All the First & second year students are requested to be in campus by 9 AM sharp. After 9 AM, entry is strictly prohibited.",
  "All the students who are a part of the fresher party should wear their I.D cards and carry fresher party passes.",
  "Water bottles are strictly not allowed in the campus.",
  "Once the students enter the campus, they will not be allowed to leave the campus before 4 p.m.",
  "If any student leaves due to any reason, he or she will not be allowed entry again into the campus.",
  "The students should not bring any type of unwanted things and create nuisance during the event.",
  "Cooperate with coordinators.",
  "Strict action will be initiated against students who misbehave or cause indiscipline.",
];

export default function RulesModal({ isOpen, onClose, onConfirm, submitting = false }: RulesModalProps) {
  const [accepted, setAccepted] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!accepted || submitting) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-amber-300/40 bg-[#faf8f5] shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="relative border-b border-amber-200/60 bg-gradient-to-r from-[#17221e] via-[#1f302b] to-[#17221e] p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-md shadow-sm">
              <img src="/college_logo.png" alt="Sphoorthy Engineering College" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-amber-200">Rules & Regulations</h3>
              <p className="text-[10px] uppercase tracking-widest text-slate-300">FRESHER'S PARTY · UDBHAV '26</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Important Notice for All Students</p>
              <p className="mt-0.5 leading-relaxed text-amber-800">
                This is to inform the students that they should abide by the following rules during the fresher's party. Please read each rule carefully before proceeding to payment.
              </p>
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1.5">
              Official Campus Guidelines & Regulations
            </h4>
            <ol className="space-y-2.5 text-xs text-slate-700 font-medium">
              {FRESHERS_RULES.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-3 rounded-md bg-white p-3 border border-slate-200 shadow-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#17221e] text-[11px] font-bold text-amber-300">
                    {idx + 1}
                  </span>
                  <span className="mt-0.5 leading-relaxed font-semibold text-slate-800">{rule}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Agreement Checkbox */}
          <div className="mt-4 rounded-xl border-2 border-amber-400/80 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 shadow-inner">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                disabled={submitting}
                className="mt-1 h-5 w-5 rounded border-amber-400 text-amber-600 focus:ring-amber-500 accent-[#d3a52b]"
              />
              <span className="text-xs font-bold text-slate-900 leading-relaxed">
                I HAVE READ, UNDERSTOOD, AND AGREE TO ABIDE BY ALL THE ABOVE RULES & REGULATIONS AND THE{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-pink-700 underline hover:text-pink-900 inline-flex items-center gap-0.5">
                  PRIVACY POLICY <ExternalLink className="h-3 w-3" />
                </a>{" "}
                FOR THE FRESHER'S PARTY.
              </span>
            </label>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="border-t border-slate-200 bg-slate-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto px-5 py-2.5 rounded border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!accepted || submitting}
            className={`w-full sm:w-auto px-7 py-3 rounded text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all ${
              accepted && !submitting
                ? "bg-[#d3a52b] text-[#1c211b] hover:bg-[#e4bd51] hover:scale-[1.02]"
                : "bg-slate-300 text-slate-500 cursor-not-allowed"
            }`}
          >
            {submitting ? (
              <span>Securing Booking...</span>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>I AGREE & PROCEED TO PAYMENT</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
