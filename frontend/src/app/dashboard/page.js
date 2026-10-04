"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, getToken, clearSession } from "../../../lib/api";
import AdminDashboard from "./AdminDashboard";
import FarmerDashboard from "./FarmerDashboard";
import ActorDashboard from "./ActorDashboard";

const ACTOR_ROLES = ["AGGREGATOR", "PROCESSOR", "LAB", "MANUFACTURER", "DISTRIBUTOR"];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    setUser(getUser());
    setChecked(true);
  }, [router]);

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  if (!checked) return null;

  return (
    <section>
      <div className="wrap">
        <div className="head rv in" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2>Welcome, {user?.name}</h2>
            <p>Signed in as {user?.role?.toLowerCase()} · {user?.email}</p>
          </div>
          <button className="cta ghost" onClick={handleLogout}>Log out</button>
        </div>

        {user?.role === "ADMIN" && <AdminDashboard />}
        {user?.role === "FARMER" && <FarmerDashboard />}
        {ACTOR_ROLES.includes(user?.role) && <ActorDashboard />}
      </div>
    </section>
  );
}