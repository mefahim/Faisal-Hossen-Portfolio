import type { ReactNode } from "react";
import { RoomShell } from "./RoomShell";
import "./room.css";

export const metadata = { title: "Faisal’s Room — Private Control Center", robots: { index: false, follow: false } };
export default function FaisalsRoomLayout({ children }: { children: ReactNode }) {
  return <RoomShell>{children}</RoomShell>;
}
