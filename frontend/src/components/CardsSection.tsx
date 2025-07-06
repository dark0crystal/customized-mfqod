import Image from "next/image";
import img1 from "../../public/img1.jpeg"
import img2 from "../../public/img2.jpeg";
import img3 from "../../public/img3.jpeg";
import img4 from "../../public/img4.jpeg";
import { getTranslations } from "next-intl/server";

export default async function CardsSection() {
  const t = await getTranslations("cards")


  const cards = [{name:`${t("name1")}`,item:`${t("item1")}`, image: img1},
                 {name:`${t("name2")}`,item:`${t("item2")}`, image: img2},
                 {name:`${t("name3")}`,item:`${t("item3")}`, image: img3},
                 {name:`${t("name4")}`,item:`${t("item4")}`, image: img4}
  ]

  return (
    <div className="h-[50vh] w-full p-10 ">
      <div className="h-full w-full rounded-3xl relative flex flex-col justify-center">
        {/* SVG Lines */}
        <svg
          className="absolute left-0 w-full z-0"
          viewBox="0 0 1000 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="lineGradient3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4caf50" />
              <stop offset="50%" stopColor="#ff9800" />
              <stop offset="100%" stopColor="#2196f3" />
            </linearGradient>
          </defs>
          <path
            fill="none"
            stroke="url(#lineGradient3)"
            strokeWidth="6"
            d="M0,140 C150,80 300,200 450,150 C650,50 700,250 1000,150"
          />
        </svg>
        <svg
          className="absolute bottom-28 left-0 w-full z-0"
          viewBox="0 0 1000 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4caf50" />
              <stop offset="50%" stopColor="#ffeb3b" />
              <stop offset="100%" stopColor="#f44336" />
            </linearGradient>
          </defs>
          <path
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="7"
            d="M0,150 C150,50 300,250 500,150 C650,50 850,250 1000,150"
          />
        </svg>
        <svg
          className="absolute left-0 w-full z-0"
          viewBox="0 0 1000 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="lineGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e91e63" />
              <stop offset="50%" stopColor="#2196f3" />
              <stop offset="100%" stopColor="#9c27b0" />
            </linearGradient>
          </defs>
          <path
            fill="none"
            stroke="url(#lineGradient2)"
            strokeWidth="5"
            d="M0,150 C150,50 300,250 500,150 C650,50 850,250 1000,150"
          />
        </svg>

        {/* Cards */}
        <div className="flex justify-evenly items-center relative z-20">
          {cards.map((card, index) => (
            <div
              key={index}
              className={`w-[160px] h-[190px] rounded-2xl bg-white/30 backdrop-blur-lg shadow-lg border border-white/20 flex flex-col items-center justify-center p-4 ${
                index % 2 === 0 ? "rotate-6" : "-rotate-6"
              }`}
            >
              <div className="w-[90px] h-[90px] rounded-full overflow-hidden border-4 border-white shadow-md">
                <Image
                  src={card.image}
                  alt={`Profile ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="mt-4 text-lg font-semibold text-black/55">{card.item}</p>
              <p className="text-sm text-black/55">{card.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}