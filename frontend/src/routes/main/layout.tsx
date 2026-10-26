import "./globals.css";
import { Outlet } from "react-router";
import NavBar from "@/components/navbar/Navbar";

export default function MainLayout() {
  return (
    <>
      <title>مفقود | MFQOD</title>
      <div className="absolute top-0 z-[-2] h-screen w-screen bg-white bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(70,130,180,0.3),rgba(255,255,255,0))]"></div>
      <NavBar />
      <Outlet />
    </>
  );
}
