"use client";
import { useState, useRef, useEffect } from "react";
import { MdKeyboardArrowDown } from "react-icons/md";
import { useDirection } from "@/components/DirectionProvider";

interface Option {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  variant?: 'default' | 'light';
}

export default function CustomDropdown({
  options,
  value,
  onChange,
  placeholder,
  className = "",
  variant = 'default'
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

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef} dir={direction}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 rounded-lg focus:ring-2 focus:border-[#3277AE] transition-all duration-200 hover:border-[#3277AE] ${
          variant === 'light' 
            ? 'bg-gray-50 border border-gray-300 hover:bg-gray-100' 
            : 'bg-white border border-gray-300 hover:bg-gray-50'
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
              onClick={() => handleSelect(option.value)}
              className={`w-full px-4 py-3 text-start hover:bg-gray-100 hover:text-gray-900 transition-all duration-150 ${
                option.value === value
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-900"
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