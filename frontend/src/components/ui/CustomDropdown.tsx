"use client";
import { useState, useRef, useEffect } from "react";
import { MdKeyboardArrowDown } from "react-icons/md";
import { useDirection } from "@/components/DirectionProvider";

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  variant?: 'default' | 'light';
  disabled?: boolean;
}

export default function CustomDropdown({
  options,
  value,
  onChange,
  placeholder,
  className = "",
  variant = 'default',
  disabled = false
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { direction, isRTL } = useDirection();

  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  const handleSelect = (optionValue: string) => {
    if (disabled) return;
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef} dir={direction}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 rounded-lg focus:ring-2 focus:border-[#3277AE] transition-all duration-200 ${
          disabled
            ? 'bg-gray-100 border border-gray-300 cursor-not-allowed opacity-60'
            : variant === 'light' 
            ? 'bg-gray-50 border border-gray-300 hover:bg-gray-100 hover:border-[#3277AE]' 
            : 'bg-white border border-gray-300 hover:bg-gray-50 hover:border-[#3277AE]'
        }`}
        style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties}
      >
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className={`text-start ${selectedOption ? "text-gray-900" : "text-gray-500"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <MdKeyboardArrowDown 
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`} 
          />
        </div>
      </button>

      {isOpen && (
        <div className={`absolute z-50 w-full mt-1 border rounded-lg shadow-md max-h-60 overflow-y-auto ${
          variant === 'light' 
            ? 'bg-gray-50 border-gray-300' 
            : 'bg-white border-gray-300'
        }`}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => !option.disabled && handleSelect(option.value)}
              disabled={option.disabled}
              className={`w-full px-4 py-3 text-start transition-all duration-150 ${
                option.disabled
                  ? "text-gray-400 bg-gray-50 cursor-not-allowed"
                  : option.value === value
                  ? "bg-gray-100 text-gray-900 font-medium hover:bg-gray-100"
                  : "text-gray-900 hover:bg-gray-100 hover:text-gray-900"
              } ${
                option === options[0] ? "rounded-t-lg" : ""
              } ${
                option === options[options.length - 1] ? "rounded-b-lg" : ""
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}