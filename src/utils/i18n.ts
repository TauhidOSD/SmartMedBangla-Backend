/**
 * Response-message localisation. The frontend sends `x-lang: bn|en`; API clients without
 * the header get English. Messages are written in English in the code and translated here,
 * so controllers and services stay readable.
 */
import type { Request } from "express";

export type Lang = "bn" | "en";

/** Text that differs per language – used for notifications stored for a specific user. */
export type Localized = string | { en: string; bn: string };

export const pick = (text: Localized, lang: Lang) => (typeof text === "string" ? text : text[lang]);

export function langOf(req?: Pick<Request, "headers">): Lang {
  const header = req?.headers["x-lang"];
  const value = Array.isArray(header) ? header[0] : header;
  return value === "bn" ? "bn" : "en";
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const bnNum = (v: string | number) => String(v).replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);

const EXACT: Record<string, string> = {
  OK: "ঠিক আছে",
  "Something went wrong. Please try again.": "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।",
  "Authentication required": "লগইন করা প্রয়োজন",
  "You do not have permission to perform this action": "এই কাজটি করার অনুমতি আপনার নেই",
  "Too many requests, please try again later": "অনেকবার চেষ্টা করা হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন",
  "Too many requests, please slow down.": "অনেক বেশি অনুরোধ, একটু ধীরে চেষ্টা করুন।",
  "Too many attempts. Please try again in 15 minutes.": "অনেকবার চেষ্টা করা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।",
  "You are using AI features too quickly. Please wait a minute.": "খুব দ্রুত এআই ব্যবহার করছেন। এক মিনিট অপেক্ষা করুন।",
  "Malformed JSON body": "অনুরোধের তথ্য সঠিক নয়",
  "Image is too large (max 8 MB)": "ছবিটি অনেক বড় (সর্বোচ্চ ৮ MB)",
  "A record with this value already exists": "এই তথ্য আগে থেকেই আছে",
  "Record not found": "তথ্য পাওয়া যায়নি",
  "Related record does not exist": "সংশ্লিষ্ট তথ্য পাওয়া যায়নি",
  "Validation failed": "তথ্য সঠিক নয়",
  "Resource not found": "পাওয়া যায়নি",
  "Upgrade required": "আপগ্রেড প্রয়োজন",
  "Service temporarily unavailable": "সার্ভিস সাময়িকভাবে বন্ধ আছে",

  // Auth
  "Account created. We sent a 6-digit code to your email.": "অ্যাকাউন্ট তৈরি হয়েছে। আপনার ইমেইলে ৬ সংখ্যার কোড পাঠানো হয়েছে।",
  "An account with this email already exists": "এই ইমেইলে আগে থেকেই একটি অ্যাকাউন্ট আছে",
  "Invalid email or password": "ইমেইল বা পাসওয়ার্ড সঠিক নয়",
  "Logged in successfully": "সফলভাবে লগইন হয়েছে",
  "Logged out": "লগআউট হয়েছে",
  "Token refreshed": "সেশন নবায়ন হয়েছে",
  "No refresh token": "সেশন পাওয়া যায়নি",
  "Session expired": "সেশনের মেয়াদ শেষ",
  "Session expired. Please log in again.": "সেশনের মেয়াদ শেষ। আবার লগইন করুন।",
  "Session is no longer valid": "সেশনটি আর বৈধ নয়",
  "Invalid authentication token": "লগইন তথ্য সঠিক নয়",
  "Session not found": "সেশন পাওয়া যায়নি",
  "Session revoked": "সেশন বাতিল করা হয়েছে",
  "Email verified successfully": "ইমেইল সফলভাবে যাচাই হয়েছে",
  "Incorrect code": "কোডটি সঠিক নয়",
  "Code expired. Please request a new one.": "কোডের মেয়াদ শেষ। নতুন কোড চান।",
  "Too many wrong attempts. Please request a new code.": "অনেকবার ভুল কোড দেওয়া হয়েছে। নতুন কোড চান।",
  "If the account exists, a new code has been sent.": "অ্যাকাউন্ট থাকলে নতুন কোড পাঠানো হয়েছে।",
  "If an account exists for this email, a reset code has been sent.": "এই ইমেইলে অ্যাকাউন্ট থাকলে রিসেট কোড পাঠানো হয়েছে।",
  "Password updated. Please log in with your new password.": "পাসওয়ার্ড পরিবর্তন হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।",
  "Password changed. Other devices have been logged out.": "পাসওয়ার্ড পরিবর্তন হয়েছে। অন্য ডিভাইস থেকে লগআউট করা হয়েছে।",
  "Current password is incorrect": "বর্তমান পাসওয়ার্ড সঠিক নয়",
  "Please verify your email address first": "আগে আপনার ইমেইল যাচাই করুন",
  "Your account has been suspended. Contact support.": "আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে। সাপোর্টে যোগাযোগ করুন।",
  "Your account has been suspended.": "আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে।",

  // Users / profile
  "Profile updated": "প্রোফাইল আপডেট হয়েছে",
  "Preferences saved": "পছন্দ সংরক্ষণ হয়েছে",
  "Photo updated": "ছবি পরিবর্তন হয়েছে",
  "Please choose an image": "একটি ছবি বেছে নিন",
  "Share link created": "শেয়ার লিংক তৈরি হয়েছে",
  "Share link disabled": "শেয়ার লিংক বন্ধ করা হয়েছে",
  "This share link is invalid or has expired": "লিংকটি সঠিক নয় বা মেয়াদ শেষ হয়ে গেছে",
  "Your account has been deleted": "আপনার অ্যাকাউন্ট মুছে ফেলা হয়েছে",
  "Password is incorrect": "পাসওয়ার্ড সঠিক নয়",
  "Admin accounts cannot be self-deleted": "অ্যাডমিন অ্যাকাউন্ট নিজে মোছা যায় না",
  "User not found": "ইউজার পাওয়া যায়নি",
  "Patient not found": "রোগী পাওয়া যায়নি",
  "patientId query parameter is required": "রোগী নির্বাচন করা হয়নি",
  "You are not a caregiver for this patient": "আপনি এই রোগীর কেয়ারগিভার নন",

  // Prescriptions
  "Please attach a prescription photo": "প্রেসক্রিপশনের ছবি দিন",
  "Prescription read successfully. Please review the medicines.": "প্রেসক্রিপশন পড়া হয়েছে। ওষুধগুলো মিলিয়ে দেখুন।",
  "Prescription saved": "প্রেসক্রিপশন সংরক্ষণ হয়েছে",
  "Prescription not found": "প্রেসক্রিপশন পাওয়া যায়নি",
  "Prescription updated": "প্রেসক্রিপশন আপডেট হয়েছে",
  "Prescription verified. Reminders are now active.": "প্রেসক্রিপশন নিশ্চিত হয়েছে। রিমাইন্ডার চালু হয়েছে।",
  "Prescription re-processed": "প্রেসক্রিপশন আবার পড়া হয়েছে",
  "Prescription deleted": "প্রেসক্রিপশন মুছে ফেলা হয়েছে",
  "Prescription removed": "প্রেসক্রিপশন সরানো হয়েছে",
  "A verified prescription cannot be re-processed": "নিশ্চিত করা প্রেসক্রিপশন আবার পড়া যায় না",
  "This prescription is already verified": "এই প্রেসক্রিপশন আগেই নিশ্চিত করা হয়েছে",
  "This prescription is still being processed": "প্রেসক্রিপশনটি এখনো পড়া হচ্ছে",
  "Could not load the prescription image": "প্রেসক্রিপশনের ছবি লোড করা যায়নি",
  "This image does not look like a prescription. Please upload a clear photo of the prescription.":
    "ছবিটি প্রেসক্রিপশন বলে মনে হচ্ছে না। প্রেসক্রিপশনের পরিষ্কার একটি ছবি দিন।",
  "AI processing failed. You can retry or add medicines manually.": "এআই পড়তে পারেনি। আবার চেষ্টা করুন বা নিজে ওষুধ যোগ করুন।",

  // Medicines & doses
  "Medicine added": "ওষুধ যোগ হয়েছে",
  "Medicine updated": "ওষুধ আপডেট হয়েছে",
  "Medicine deleted": "ওষুধ মুছে ফেলা হয়েছে",
  "Medicine not found": "ওষুধ পাওয়া যায়নি",
  "Dose not found": "ডোজ পাওয়া যায়নি",
  "Great! Dose marked as taken.": "দারুণ! ওষুধ খাওয়া হিসেবে চিহ্নিত হয়েছে।",
  "Dose skipped": "ডোজটি এড়িয়ে যাওয়া হয়েছে",
  "Dose reset": "ডোজ আগের অবস্থায় ফেরানো হয়েছে",
  "You can only mark a dose up to 2 hours before its time": "ওষুধের সময়ের ২ ঘণ্টা আগে থেকে চিহ্নিত করা যায়",
  "Doses older than 48 hours can no longer be changed": "৪৮ ঘণ্টার বেশি পুরনো ডোজ আর বদলানো যায় না",
  "Date range cannot exceed 3 months": "সময়সীমা ৩ মাসের বেশি হতে পারে না",

  // Cabinet
  "Please attach a photo of the medicine strip": "ওষুধের পাতার ছবি দিন",
  "Expiry date detected. Please confirm the details.": "মেয়াদ পাওয়া গেছে। তথ্যগুলো নিশ্চিত করুন।",
  "We could not read the expiry date. Please enter it manually.": "মেয়াদ পড়া যায়নি। নিজে লিখে দিন।",
  "Added to your medicine cabinet": "ওষুধের বাক্সে যোগ হয়েছে",
  "Item updated": "আপডেট হয়েছে",
  "Item removed": "সরানো হয়েছে",
  "Item not found": "পাওয়া যায়নি",

  // Care
  "You cannot invite yourself": "নিজেকে আমন্ত্রণ জানানো যায় না",
  "This email belongs to a patient or admin account. Ask them to sign up as a caregiver.":
    "এই ইমেইলটি রোগী বা অ্যাডমিন অ্যাকাউন্টের। তাকে কেয়ারগিভার হিসেবে অ্যাকাউন্ট খুলতে বলুন।",
  "Caregiver access removed": "কেয়ারগিভারের অ্যাক্সেস সরানো হয়েছে",
  "Caregiver link not found": "কেয়ারগিভার পাওয়া যায়নি",
  "Invitation not found": "আমন্ত্রণ পাওয়া যায়নি",
  "Invitation accepted": "আমন্ত্রণ গ্রহণ করেছেন",
  "Invitation declined": "আমন্ত্রণ প্রত্যাখ্যান করেছেন",
  "You have reached the caregiver limit.": "কেয়ারগিভারের সীমা পূর্ণ হয়েছে।",

  // Notifications
  "Marked as read": "পঠিত হিসেবে চিহ্নিত",
  "Notification deleted": "নোটিফিকেশন মুছে ফেলা হয়েছে",
  "Notification not found": "নোটিফিকেশন পাওয়া যায়নি",
  "Browser notifications enabled": "ব্রাউজার নোটিফিকেশন চালু হয়েছে",
  "Browser notifications disabled": "ব্রাউজার নোটিফিকেশন বন্ধ হয়েছে",

  // AI
  "AI features are not configured on the server.": "সার্ভারে এআই চালু করা হয়নি।",
  "Our AI assistant is busy right now. Please try again in a moment.": "এআই সহকারী এখন ব্যস্ত। একটু পর আবার চেষ্টা করুন।",
  "The AI could not understand the response. Please try again.": "এআই এর উত্তর বোঝা যায়নি। আবার চেষ্টা করুন।",
  "Add at least one medicine to check": "যাচাই করতে অন্তত একটি ওষুধ দিন",
  "Not enough dose history yet. Insights appear after a few days of reminders.": "এখনো যথেষ্ট তথ্য নেই। কয়েকদিন রিমাইন্ডার চলার পর রিপোর্ট দেখা যাবে।",
  "Conversation cleared": "কথোপকথন মুছে ফেলা হয়েছে",
  "Enter a medicine name": "ওষুধের নাম লিখুন",
  "Type a message": "বার্তা লিখুন",

  // Uploads
  "Only JPG, PNG, WEBP or HEIC images are allowed": "শুধু JPG, PNG, WEBP বা HEIC ছবি দেওয়া যাবে",
  "Image storage is not configured on the server": "সার্ভারে ছবি সংরক্ষণ চালু করা হয়নি",
  "Could not upload image. Please try again.": "ছবি আপলোড করা যায়নি। আবার চেষ্টা করুন।",

  // Payments
  "Online payment is not configured yet": "অনলাইন পেমেন্ট এখনো চালু হয়নি",
  "Unknown plan": "প্ল্যানটি সঠিক নয়",
  "Redirecting to payment gateway": "পেমেন্ট পেজে নেওয়া হচ্ছে",
  "Payment gateway is not responding. Please try again.": "পেমেন্ট গেটওয়ে সাড়া দিচ্ছে না। আবার চেষ্টা করুন।",
  "Payment not found": "পেমেন্ট পাওয়া যায়নি",
  "Payment could not be verified": "পেমেন্ট যাচাই করা যায়নি",
  "Missing validation id": "যাচাই তথ্য পাওয়া যায়নি",

  // Admin
  "User updated": "ইউজার আপডেট হয়েছে",
  "User deleted": "ইউজার মুছে ফেলা হয়েছে",
  "You cannot change your own role or status": "নিজের ভূমিকা বা অবস্থা বদলানো যায় না",
  "You cannot delete your own account": "নিজের অ্যাকাউন্ট মোছা যায় না",
  "Nothing to update": "পরিবর্তনের কিছু নেই",

  // Doctor / pharmacy prescriptions
  "Prescription created": "প্রেসক্রিপশন তৈরি হয়েছে",
  "Prescription code not found": "প্রেসক্রিপশন কোড পাওয়া যায়নি",
  "This prescription has already been added to another account": "এই প্রেসক্রিপশন আগেই অন্য অ্যাকাউন্টে যোগ হয়েছে",
  "This prescription code has expired": "এই প্রেসক্রিপশন কোডের মেয়াদ শেষ",
  "Only patient accounts can add a prescription": "শুধু রোগীর অ্যাকাউন্টে প্রেসক্রিপশন যোগ করা যায়",
  "This prescription is already in your account": "এই প্রেসক্রিপশন আগেই আপনার অ্যাকাউন্টে আছে",
  "Prescription added to your account": "প্রেসক্রিপশন আপনার অ্যাকাউন্টে যোগ হয়েছে",
  "A prescription that a patient has already added cannot be deleted": "রোগী যোগ করে ফেলেছেন এমন প্রেসক্রিপশন মোছা যায় না",
  "This prescription has already been added to a patient's account": "এই প্রেসক্রিপশন আগেই রোগীর অ্যাকাউন্টে যোগ হয়েছে",
  "Added to the patient's SmartMed account": "রোগীর স্মার্টমেড অ্যাকাউন্টে যোগ হয়েছে",
  "Prescription link sent by email": "প্রেসক্রিপশনের লিংক ইমেইলে পাঠানো হয়েছে",
  "This prescription has no photo to read": "এই প্রেসক্রিপশনে পড়ার মতো কোনো ছবি নেই",
  "Add at least one medicine": "অন্তত একটি ওষুধ যোগ করুন",
  "Patient name is required": "রোগীর নাম দিন",
  "Invalid prescription code": "প্রেসক্রিপশন কোডটি সঠিক নয়",
  "Hospital or chamber name is required": "হাসপাতাল বা চেম্বারের নাম দিন",
  "Pharmacy name is required": "ফার্মেসির নাম দিন",
  "BMDC registration number is required": "BMDC রেজিস্ট্রেশন নম্বর দিন",
  "Drug licence number is required": "ড্রাগ লাইসেন্স নম্বর দিন",

  // SMS / voice alerts
  "Test alert sent": "পরীক্ষামূলক বার্তা পাঠানো হয়েছে",
  "SMS provider is not configured – the message was only logged on the server": "SMS সার্ভিস এখনো চালু হয়নি — বার্তাটি শুধু সার্ভারে লগ হয়েছে",
  "Add a valid mobile number first": "আগে একটি সঠিক মোবাইল নম্বর দিন",
  "Alert settings saved": "সতর্কবার্তার সেটিং সংরক্ষণ হয়েছে",

  // Common validation messages
  "Enter a valid email address": "সঠিক ইমেইল দিন",
  "Password must be at least 8 characters": "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে",
  "Password must contain a letter": "পাসওয়ার্ডে অন্তত একটি অক্ষর থাকতে হবে",
  "Password must contain a number": "পাসওয়ার্ডে অন্তত একটি সংখ্যা থাকতে হবে",
  "Password is required": "পাসওয়ার্ড দিন",
  "Name is too short": "নাম খুব ছোট",
  "Code must be 6 digits": "কোড ৬ সংখ্যার হতে হবে",
  "Enter a valid phone number": "সঠিক ফোন নম্বর দিন",
  "Medicine name is required": "ওষুধের নাম দিন",
  "Time must be in HH:mm format": "সময় সঠিক নয়",
  "Expiry date is required": "মেয়াদ শেষের তারিখ দিন",
};

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Account temporarily locked after too many failed attempts\. Try again in (\d+) minute\(s\)\.$/, (m) => `অনেকবার ভুল চেষ্টার কারণে অ্যাকাউন্ট সাময়িক বন্ধ। ${bnNum(m[1]!)} মিনিট পর আবার চেষ্টা করুন।`],
  [/^Please wait (\d+) seconds before requesting another code\.$/, (m) => `নতুন কোড চাওয়ার আগে ${bnNum(m[1]!)} সেকেন্ড অপেক্ষা করুন।`],
  [/^(\d+) notification\(s\) marked as read$/, (m) => `${bnNum(m[1]!)}টি নোটিফিকেশন পঠিত হয়েছে`],
  [/^Logged out from (\d+) other device\(s\)$/, (m) => `${bnNum(m[1]!)}টি অন্য ডিভাইস থেকে লগআউট হয়েছে`],
  [/^(\d+) session\(s\) revoked$/, (m) => `${bnNum(m[1]!)}টি সেশন বাতিল হয়েছে`],
  [/^Announcement sent to (\d+) user\(s\)$/, (m) => `${bnNum(m[1]!)} জন ইউজারকে ঘোষণা পাঠানো হয়েছে`],
  [/^Invitation sent to (.+)$/, (m) => `${m[1]} ঠিকানায় আমন্ত্রণ পাঠানো হয়েছে`],
  [/^You have used all (\d+) free AI scans this month\. Upgrade to Premium for unlimited scans\.$/, (m) => `এই মাসের ${bnNum(m[1]!)}টি ফ্রি এআই স্ক্যান শেষ। আনলিমিটেড স্ক্যানের জন্য প্রিমিয়াম নিন।`],
  [/^Free plan supports (\d+) caregivers\. Upgrade to Premium to add more\.$/, (m) => `ফ্রি প্ল্যানে ${bnNum(m[1]!)} জন কেয়ারগিভার যোগ করা যায়। আরও যোগ করতে প্রিমিয়াম নিন।`],
  [/^Route not found: (.+)$/, (m) => `পাওয়া যায়নি: ${m[1]}`],
];

/** Translates a known English message; unknown messages are returned unchanged. */
export function translate(message: string, lang: Lang): string {
  if (lang === "en" || !message) return message;
  const exact = EXACT[message];
  if (exact) return exact;
  for (const [re, fn] of PATTERNS) {
    const m = message.match(re);
    if (m) return fn(m);
  }
  return message;
}
