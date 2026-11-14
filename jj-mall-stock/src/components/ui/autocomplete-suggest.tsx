'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface AutocompleteSuggestProps {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  helpText?: string;
  direction?: 'down' | 'up';
}

export default function AutocompleteSuggest({
  label,
  required = false,
  value,
  onChange,
  suggestions = [],
  placeholder = '',
  className = '',
  inputClassName = '',
  name,
  id,
  disabled = false,
  helpText,
  direction = 'down',
}: AutocompleteSuggestProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input value
  const filteredSuggestions = React.useMemo(() => {
    const trimmed = (value || '').trim().toLowerCase();
    const cleanList = Array.from(
      new Set(suggestions.map((s) => (s || '').trim()).filter(Boolean))
    );

    if (!trimmed) {
      return cleanList.slice(0, 15);
    }

    return cleanList
      .filter((item) => item.toLowerCase().includes(trimmed))
      .slice(0, 15);
  }, [suggestions, value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (item: string) => {
    onChange(item);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (filteredSuggestions.length > 0) {
          setIsOpen(true);
        }
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
        e.preventDefault();
        e.stopPropagation();
        handleSelect(filteredSuggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Helper to render matched text with bold highlight
  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.trim().toLowerCase() ? (
            <strong key={i} className="text-emerald-700 bg-emerald-100 font-semibold px-0.5 rounded">
              {part}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  // Only show dropdown when open AND there are matching suggestions
  // When writing a new word (no matches), do not show any box below
  const showDropdown = isOpen && filteredSuggestions.length > 0;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between"
        >
          <span>
            {label} {required && <span className="text-red-500">*</span>}
          </span>
          {helpText && (
            <span className="text-[10px] text-slate-400 font-normal">{helpText}</span>
          )}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            if (filteredSuggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full px-3 py-2 pr-8 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all ${inputClassName}`}
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (!disabled && filteredSuggestions.length > 0) {
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              showDropdown ? 'rotate-180 text-emerald-600' : ''
            }`}
          />
        </button>
      </div>

      {/* Dropdown Menu: shows only if there are matching suggestions */}
      {showDropdown && (
        <div
          className={`absolute left-0 right-0 ${
            direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 max-h-40 overflow-y-auto animate-in fade-in duration-100`}
        >
          {filteredSuggestions.map((item, idx) => {
            const isSelected = item.toLowerCase() === (value || '').trim().toLowerCase();
            const isHighlighted = idx === highlightedIndex;

            return (
              <button
                key={`${item}-${idx}`}
                type="button"
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => handleSelect(item)}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  isHighlighted
                    ? 'bg-emerald-50 text-emerald-900 font-medium'
                    : isSelected
                    ? 'bg-emerald-50/50 text-emerald-800 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">
                  {renderHighlightedText(item, value)}
                </span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
