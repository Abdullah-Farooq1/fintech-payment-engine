import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export const Layout = () => {
  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};