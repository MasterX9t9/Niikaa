import React, { useState, useRef, useEffect } from 'react';
import { IconChevronRight } from './Icons';

interface CustomSelectProps {
  label?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ label, value, options, onChange, placeholder, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && <label className="block text-sm font-bold text-gray-900 dark:text-white">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-4 py-3.5 rounded-xl border flex items-center justify-between transition-all bg-white dark:bg-gray-900 text-left ${
            isOpen 
              ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg' 
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {icon && <span className="text-gray-500 dark:text-gray-400">{icon}</span>}
            <span className={`block truncate ${!value && placeholder ? 'text-gray-400' : 'text-gray-900 dark:text-white font-medium'}`}>
              {value || placeholder}
            </span>
          </div>
          <IconChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? '-rotate-90' : 'rotate-90'}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 max-h-64 overflow-y-auto animate-slide-up scrollbar-thin">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between ${
                  value === option 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold' 
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {option}
                {value === option && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};