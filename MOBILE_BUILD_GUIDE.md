# 📱 মোবাইল থেকে APK বিল্ড গাইড (কম্পিউটার ছাড়াই)

> **TradeStamp** অ্যাপের APK ফাইল শুধুমাত্র মোবাইল দিয়ে বিল্ড করার সম্পূর্ণ গাইড।

---

## 🔴 গুরুত্বপূর্ণ: প্রথমে কোড GitHub-এ আপলোড করতে হবে

মোবাইল থেকে APK বিল্ড করার আগে আপনার সোর্স কোড GitHub-এ থাকা **মাস্ট**। নিচের যেকোনো একটি উপায়ে করতে পারেন:

### উপায় A: GitHub Mobile App দিয়ে (সহজ)
১. Play Store থেকে **GitHub** অ্যাপ ইন্সটল করুন
২. নতুন রিপোজিটরি তৈরি করুন: `TradeStamp`
৩. `+` বাটন চাপুন → "Upload files" → আপনার প্রজেক্টের সব ফাইল আপলোড করুন

### উপায় B: মোবাইল ব্রাউজার দিয়ে
১. [github.com](https://github.com) এ যান
২. `New Repository` → `TradeStamp` নাম দিন
৩. "Uploading an existing file" → সব ফাইল আপলোড করুন

---

## 🚀 উপায় ১: EAS Cloud Build (সবচেয়ে সহজ — শুধু ব্রাউজারে)

**সুবিধা:** Expo-র সার্ভারে বিল্ড হয়, আপনার ফোনে কিছু ইন্সটল করতে হয় না।

### ধাপ ১: Expo অ্যাকাউন্ট তৈরি
১. মোবাইল ব্রাউজারে যান: [expo.dev/signup](https://expo.dev/signup)
২. GitHub দিয়ে সাইন আপ করুন

### ধাপ ২: EXPO_TOKEN তৈরি
১. [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) এ যান
২. "Create Token" → নাম দিন: `github-actions`
৩. টোকেনটি কপি করে রাখুন (শুধু একবারই দেখা যাবে)

### ধাপ ৩: GitHub Secret সেটআপ
১. মোবাইল ব্রাউজারে GitHub-এ যান
২. আপনার `TradeStamp` রিপো → `Settings` → `Secrets and variables` → `Actions`
৩. `New repository secret`:
   - Name: `EXPO_TOKEN`
   - Value: (যে টোকেন কপি করেছিলেন)

### ধাপ ৪: Build ট্রিগার করুন
১. রিপোর `Actions` ট্যাবে যান
২. "Build Android APK" workflow এ ক্লিক করুন
৩. "Run workflow" → `preview` সিলেক্ট → "Run workflow"

### ধাপ ৫: APK ডাউনলোড
- ১০-১৫ মিনিট পর workflow সবুজ ✅ চিহ্ন দেখাবে
- `Artifacts` সেকশনে `.apk` ফাইল ডাউনলোড করুন

---

## 🚀 উপায় ২: GitHub Actions Direct Build (Expo অ্যাকাউন্ট ছাড়াই)

**সুবিধা:** Expo অ্যাকাউন্ট বা টোকেন দরকার নেই।

### ধাপ ১: Workflow চালু করুন
১. GitHub রিপোতে `Actions` ট্যাবে যান
২. "Build Android APK (No Expo Account Needed)" এ ক্লিক করুন
৩. "Run workflow" → "Run workflow"

### ধাপ ২: APK ডাউনলোড
- ১৫-২০ মিনিট পর `Artifacts` থেকে `app-release.apk` ডাউনলোড করুন

---

## 🚀 উপায় ৩: Cloud IDE ব্যবহার (পুরো কম্পিউটারের মতো)

**সুবিধা:** মোবাইল ব্রাউজারেই একটি সম্পূর্ণ Linux কম্পিউটার পাবেন।

### GitHub Codespaces (ফ্রি ৬০ ঘণ্টা/মাস)
১. [github.com/codespaces](https://github.com/codespaces) এ যান
২. `TradeStamp` রিপোজিটরি সিলেক্ট করুন
৩. "Create codespace on main"
৪. ব্রাউজারে VS Code খুলবে → টার্মিনালে কমান্ড রান করুন:
   ```bash
   eas build --platform android --profile preview
   ```

### Gitpod (ফ্রি ৫০ ঘণ্টা/মাস)
১. [gitpod.io](https://gitpod.io) এ যান
২. GitHub দিয়ে লগইন → `TradeStamp` রিপো ওপেন করুন
৩. টার্মিনালে সেইম কমান্ড রান করুন

---

## 📋 প্রজেক্ট ফাইল তালিকা (GitHub-এ আপলোড করুন)

নিচের সব ফাইল আপলোড করতে হবে:

```
├── app.json                  ✅ EAS/Build কনফিগ
├── eas.json                  ✅ EAS Build প্রোফাইল
├── package.json              ✅ ডিপেন্ডেন্সি
├── babel.config.js           ✅ Babel কনফিগ
├── metro.config.js           ✅ Metro কনফিগ
├── tailwind.config.js        ✅ Tailwind কনফিগ
├── components.json           ✅ UI Components কনফিগ
├── nativewind-env.d.ts       ✅ TypeScript types
├── src/                      ✅ সোর্স কোড
│   ├── app/                  ✅ স্ক্রিনস
│   ├── client/               ✅ Supabase Client
│   ├── components/           ✅ UI Components
│   └── lib/                  ✅ Storage, i18n, Store
├── assets/                   ✅ আইকন, ইমেজ
│   ├── icon.png
│   ├── adaptive-icon.png
│   └── favicon.png
└── .github/workflows/        ✅ Auto-build workflows
    ├── build-apk.yml
    └── build-apk-direct.yml
```

---

## ⚡ দ্রুত চেকলিস্ট

| কাজ | স্ট্যাটাস |
|-----|-----------|
| কোড GitHub-এ আপলোড | ⬜ করুন |
| Expo অ্যাকাউন্ট (উপায় ১ এর জন্য) | ⬜ তৈরি করুন |
| EXPO_TOKEN GitHub Secret-এ যোগ | ⬜ করুন |
| Actions থেকে Build ট্রিগার | ⬜ করুন |
| APK ডাউনলোড | ⬜ করুন |

---

## 💡 টিপস

- **Build সময়:** সাধারণত ১০-২০ মিনিট লাগে
- **ফ্রি লিমিট:** GitHub Actions = ২০০০ মিনিট/মাস (ফ্রি অ্যাকাউন্টে)
- **Expo EAS:** প্রতি মাসে কিছু ফ্রি build ক্রেডিট পাবেন
- **APK শেয়ার:** বন্ধুকে পাঠাতে WhatsApp/Telegram/Email ব্যবহার করুন

---

**প্রস্তুত!** উপরের যেকোনো একটি উপায় অনুসরণ করলেই মোবাইল থেকে সরাসরি APK পেয়ে যাবেন। 🎉
