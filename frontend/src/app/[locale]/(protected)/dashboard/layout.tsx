import NavBar from "./NavBar";

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 h-[88vh]">
        {/* Sidebar for large screens */}
        <aside className="flex-row lg:flex lg:flex-col items-center px-4 border-r-2 lg:col-span-1 ">
          <NavBar />
        </aside>

        

        {/* Main content */}
        <section className="col-span-1 lg:col-span-2 flex flex-col items-center px-4 overflow-y-auto">
          {children}
        </section>
      </div>
    </div>
  );
}