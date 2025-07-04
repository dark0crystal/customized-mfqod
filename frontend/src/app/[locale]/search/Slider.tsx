"use client"
import React, { useState } from "react";

const SliderBar = ({ orgName }:any) => {
  const [currentName, setCurrentName] = useState(orgName[0]); // Set initial name

  const handleClick = (name:string) => {
    setCurrentName(name);
  };

  return (
    <div className="flex items-center bottom-0 fixed z-40 w-screen h-[10vh] bg-slate-300">
      <div
        className="flex overflow-x-auto scrollbar-none w-full px-4 snap-x snap-mandatory"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {orgName.map((name:string, index:any) => (
          <button
            key={index}
            onClick={() => handleClick(name)}
            className={`snap-center whitespace-nowrap bg-violet-300 rounded-full m-2 p-3 text-sm transition-transform duration-300 ${
              currentName === name ? "scale-125 bg-violet-500 text-white" : ""
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SliderBar;