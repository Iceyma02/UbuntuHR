import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV = [
  {
    label: "Main",
    items: [
      { to: "/dashboard",  icon: "⊞",  label: "Dashboard"   },
      { to: "/employees",  icon: "👥",  label: "Employees"   },
      { to: "/payroll",    icon: "💳",  label: "Payroll"     },
      { to: "/compliance", icon: "✓",   label: "Compliance", dot: true },
      { to: "/leave",      icon: "📅",  label: "Leave"       },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/payslips",   icon: "📄",  label: "Payslips"   },
      { to: "/analytics",  icon: "📊",  label: "Analytics"  },
    ],
  },
];

export default function Sidebar() {
  const { company, logout } = useAuth();
  const loc = useLocation();

  return (
    <aside style={{
      width: "var(--sidebar-w)",
      minWidth: "var(--sidebar-w)",
      background: "var(--surface)",
      borderRight: "1px solid var(--border2)",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "relative",
    }}>

      {/* Logo */}
      <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid var(--border2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: "linear-gradient(135deg,var(--gold),var(--gold-dim))",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: "#0D0F14",
          }}>Z</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>ZimHR</div>
            <div style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "1.5px", textTransform: "uppercase" }}>by MA TechHub</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
        {NAV.map(section => (
          <div key={section.label} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 9, letterSpacing: "1.8px", textTransform: "uppercase",
              color: "var(--muted)", padding: "0 8px", marginBottom: 6, fontWeight: 500,
            }}>
              {section.label}
            </div>
            {section.items.map(item => {
              const active = loc.pathname.startsWith(item.to);
              return (
                <NavLink key={item.to} to={item.to} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                    color: active ? "var(--gold)" : "var(--muted)",
                    background: active ? "rgba(201,168,76,0.1)" : "transparent",
                    border: `1px solid ${active ? "var(--border)" : "transparent"}`,
                    fontSize: 13, fontWeight: active ? 500 : 400,
                    marginBottom: 2, transition: "all 0.12s",
                  }}>
                    <span style={{ fontSize: 14, width: 16, textAlign: "center" }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.dot && <span className="notif-dot" />}
                  </div>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Company footer */}
      <div style={{ padding: "12px 10px", borderTop: "1px solid var(--border2)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px", background: "var(--card)",
          borderRadius: 8, border: "1px solid var(--border2)",
          marginBottom: 8,
        }}>
          <div style={{
            width: 24, height: 24,
            background: "linear-gradient(135deg,#4A9FE8,#9B7FE8)",
            borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700, color: "white", flexShrink: 0,
          }}>
            {(company?.name || "C").substring(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {company?.name || "Company"}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Harare · Admin</div>
          </div>
        </div>
        <button onClick={logout} style={{
          width: "100%", padding: "7px 10px",
          background: "transparent", border: "1px solid var(--border2)",
          borderRadius: 7, color: "var(--muted)", fontSize: 11,
          cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
          transition: "all 0.12s",
        }}
          onMouseOver={e => { e.target.style.color = "var(--red)"; e.target.style.borderColor = "rgba(255,92,92,0.3)"; }}
          onMouseOut={e => { e.target.style.color = "var(--muted)"; e.target.style.borderColor = "var(--border2)"; }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
