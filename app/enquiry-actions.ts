"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { str } from "@/lib/util";

const back = (key: "ok" | "err", text: string) => `/?${key}=${encodeURIComponent(text)}#admissions`;

// Public form on the home page. Every enquiry lands in the admin's Enquiries list as "New".
export async function createEnquiry(fd: FormData) {
  if (str(fd, "website")) redirect(back("ok", "Thank you. We will call you soon.")); // bots fill the hidden field
  const guardian = str(fd, "guardian_name").slice(0, 100);
  const phone = str(fd, "phone").replace(/[\s-]/g, "").replace(/^(\+91|0)/, "");
  if (!guardian) redirect(back("err", "Please enter your name."));
  if (!/^[6-9]\d{9}$/.test(phone)) redirect(back("err", "Please enter a 10-digit mobile number."));
  const level = ["6", "7", "8", "9", "10"].includes(str(fd, "class_level")) ? `Class ${str(fd, "class_level")}` : "";
  // The same number again within a day is treated as a repeat, not a new enquiry.
  const [dup] = await sql`select id from enquiries where phone = ${phone} and created_at > now() - interval '1 day'`;
  if (!dup)
    await sql`
      insert into enquiries (guardian_name, student_name, class_level, phone, message, source)
      values (${guardian}, ${str(fd, "student_name").slice(0, 100)}, ${level}, ${phone},
        ${str(fd, "message").slice(0, 1000)}, ${str(fd, "source").slice(0, 40) || "website"})`;
  revalidatePath("/admin/enquiries");
  redirect(back("ok", "Thank you. We will call you within one working day."));
}
