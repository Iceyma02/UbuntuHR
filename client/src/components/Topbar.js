import { useAuth } from "../context/AuthContext";

export default function Topbar({ title, actions }) {
  const { user } = useAuth();

  return (
    <div style={{
      height: "var(--topbar-h)",
      background: "var(--surface)",
      borderBottom: "1px solid var(--border2)",
      display: "flex",
      alignItems: "center",
      padding: "0 24px",
      gap: 16,
      flexShrink: 0,
    }}>
      <div style={{
        fontFamily: "'Syne',sans-serif",
        fontWeight: 700, fontSize: 16, color: "var(--text)",
        letterSpacing: "-0.2px",
      }}>
        {title}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {actions}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "4px 10px 4px 4px",
          background: "var(--card)", borderRadius: 8,
          border: "1px solid var(--border2)",
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: "linear-gradient(135deg,var(--gold),var(--gold-dim))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 10, color: "#0D0F14",
          }}>
            {user ? `${user.firstName?.[0]}${user.lastName?.[0]}` : "U"}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text)" }}>
              {user ? `${user.firstName} ${user.lastName}` : "User"}
            </div>
            <div style={{ fontSize: 9, color: "var(--muted)" }}>{user?.role?.replace("_", " ")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
