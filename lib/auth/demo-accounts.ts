import type { Role } from "./roles";

// One synthetic account per role (two citizens, to show that one cannot see the other's deeds).
// Emails use the reserved .test domain, so they can never belong to a real person.
// Passwords are never written here: see DEMO_USER_PASSWORD in .env.local (`npm run users`).
export const DEMO_USERS: { email: string; name_bn: string; role: Role; owner_id?: number }[] = [
  // The first citizen is Anwar Hossain, holder of dag 141 (owner 20 in the seed): "who checked my land".
  { email: "citizen@demo.bhumisathi.test", name_bn: "আনোয়ার হোসেন (ডেমো নাগরিক)", role: "citizen", owner_id: 20 }, // prettier-ignore
  { email: "citizen2@demo.bhumisathi.test", name_bn: "কামরুল হাসান (ডেমো নাগরিক ২)", role: "citizen" }, // prettier-ignore
  { email: "officer@demo.bhumisathi.test", name_bn: "সাব-রেজিস্ট্রার (ডেমো কর্মকর্তা)", role: "officer" }, // prettier-ignore
  { email: "admin@demo.bhumisathi.test", name_bn: "ডেমো প্রশাসক", role: "admin" },
];
