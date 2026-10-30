import { AuthProvider } from "../../lib/context/AuthContext";

// This route renders <Shell> itself, outside the (main) layout, so it needs its
// own AuthProvider — without it the topbar reads the empty default context and
// shows the visitor as logged out.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
