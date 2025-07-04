"use client"
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
// import { useRouter } from "next/navigation";
import DisplayPosts from "./DisplayPosts";
import DataProvider from "@/app/storage";
import Footer from "@/components/Footer";
import Image from "next/image";
// import ad from "../../../../public/ad.png";
// import bg11 from "../../../../public/bg11.jpg";
import bg12 from "../../../../public/bg12.jpeg";
import { FaSearch } from "react-icons/fa";
import { RiLoader2Line } from "react-icons/ri";
import { useTranslations } from "next-intl";

const schema = z.object({
  item: z.string().min(1, { message: "The Field is required!" }),
  place: z.string().min(1, { message: "Please select a place" }),
});

type FormFields = z.infer<typeof schema>;

export default function Search() {
  const [items, setItems] = useState<any[]>([]);
  const [currentName, setCurrentName] = useState<string>();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false); // Loading state

  const { orgNames } = DataProvider();
  const t = useTranslations("search");

  const handleClick = async (name: string) => {
    setCurrentName(name);
    setShow(false);
    await fetchItemByPlace(name);
  };

  const handleShow = () => {
    setShow(!show);
  };

  const fetchItems = async (item: string, place: string) => {
    setLoading(true); // Start loading
    try {
      const response = await fetch(`/api/get-items?item=${item}&orgName=${place}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      } else {
        console.error("Failed to fetch items");
      }
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false); // Stop loading
    }
  };

  const fetchItemByPlace = async (place: string) => {
    setLoading(true); // Start loading
    try {
      const response = await fetch(`/api/get-items-by-place?orgName=${place}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      } else {
        console.error("Failed to fetch items");
      }
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false); // Stop loading
    }
  };

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormFields>({
    resolver: zodResolver(schema),
  });

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    setLoading(true); // Start loading
    console.log(data);
    await fetchItems(data.item, data.place);
    reset();
    setLoading(false); // Stop loading
  };

  return (
    <div className="relative lg:grid lg:grid-cols-12 lg:h-[88vh]">
      {/* Left Section */}
      <div className="hidden lg:col-span-2 lg:flex flex-col items-center overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {orgNames.map((org, index: any) => (
            <button
              key={index}
              onClick={() => handleClick(org.key)}
              className={`p-3 rounded-full transition-transform duration-300 text-sm ${
                currentName === org.key
                  ? "bg-blue-100 border border-blue-400 p-3 rounded-md scale-110"
                  : "bg-white border border-blue-200 p-3 rounded-md"
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>
      </div>

      {/* For mobile and ipad view */}
      <div className="z-40 fixed bottom-8 right-6 lg:hidden">
        {show && (
          <div className="relative flex flex-col gap-2">
            {orgNames.map((org, index: any) => (
              <button
                key={index}
                onClick={() => handleClick(org.key)}
                className={`px-3 py-2 rounded-full transition-transform duration-300 text-sm ${
                  currentName === org.key
                    ? "bg-blue-200 border border-blue-500 rounded-md scale-105"
                    : "bg-white border border-blue-200 rounded-md"
                }`}
              >
                {org.name}
              </button>
            ))}
          </div>
        )}
        <button
          className="text-white border-2 bg-blue-500 py-3 px-4 rounded-md mt-2 text-lg font-semibold"
          onClick={handleShow}
        >
          {t("filter")}
        </button>
      </div>

      {/* Center Section */}
      <div className="col-span-12 lg:col-span-8 flex flex-col items-center p-4 overflow-y-auto w-full h-full">
        <div className="relative z-20 w-full flex items-center min-h-[30vh] justify-center">
          <div className="absolute -z-10 w-full rounded-xl overflow-hidden h-full">
            <Image
              src={bg12}
              alt="search bg image"
              fill
              objectFit="cover"
            />
          </div>
          {/* Blur background on top of image */}
          <div className="absolute z-10 bg-white/40 w-full h-full rounded-xl" />

          <div className="lg:absolute lg:bottom-12 w-full flex justify-center z-20">
            <form onSubmit={handleSubmit(onSubmit)} className="flex lg:flex-row flex-col gap-2 w-fit max-w-md">
              <div>
                <input
                  id="item"
                  {...register("item")}
                  type="text"
                  placeholder="هيش مغيّب ؟"
                  className="w-full p-3 border bg-slate-50 text-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.item && <p className="mt-2 text-xs text-red-500">{errors.item.message}</p>}
              </div>
              <div>
                <select
                  id="place"
                  {...register("place")}
                  defaultValue=""
                  className="w-full p-3 border bg-slate-50 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>هين تدرس؟</option>
                  {orgNames.map((org, index: any) => (
                    <option key={index} value={org.key}>{org.name}</option>
                  ))}
                </select>
                {errors.place && <p className="mt-2 text-xs text-red-500">{errors.place.message}</p>}
              </div>
              <button
                type="submit"
                disabled={isSubmitting || loading} // Disable button during loading or submitting
                className="w-full lg:w-fit lg:h-fit p-3 bg-blue-600/90 text-white font-semibold rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-400"
              >
                {loading ? <RiLoader2Line size={26} className="animate-spin" /> : <FaSearch size={26} />}
              </button>
            </form>
          </div>
        </div>

        <div className="w-full mt-6">
          {loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : (
            <DisplayPosts items={items} />
          )}
          <Footer />
        </div>
      </div>

      {/* Right Section */}
      <div className="hidden lg:col-span-2 p-4 lg:flex flex-col justify-center items-center">
        {/* <div className="relative h-full w-full rounded-2xl overflow-hidden">
          <Image alt="ad" src={ad} fill objectFit="cover"/>
         <div className="absolute bottom-0 bg-gray-300/20 text-center w-full rounded-t-2xl h-10"> 
            <h1 className="text-lg text-white  font-normal">Fake Sponsorship</h1>
          </div>
         </div> */}
      </div>
    </div>
  );
}