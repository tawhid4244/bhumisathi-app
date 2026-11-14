# How to test voice by hand (Chrome)

Automated tests use a fake speech engine. Before a demo, test the real microphone once on the
device you will present with.

## Where voice works

| Browser | Speech → text (mic) | Text → speech (reply) |
| --- | --- | --- |
| Chrome / Edge on Windows, Mac, Android | Yes (Google's speech service; needs internet) | Yes; a **Bangla** voice depends on the device |
| Firefox | No mic button (not supported); typing works | Yes |
| Safari / iPhone | Partly; test before relying on it | Yes |

- The microphone only works on `https://` pages or on `http://localhost`.
- **Bangla speech output:** Android phones with "Google Bangla" text-to-speech installed read answers
  in Bangla. Many Windows PCs have no Bangla voice; Sathi then uses the default voice, which reads
  Bangla text badly. For the demo, use an Android phone (Chrome) or install a Bangla voice
  (Windows Settings → Time & language → Speech → Add voices → Bangla, if offered).

## Steps

1. Start the app: `npm.cmd run dev` and open `http://localhost:3000/chat` in **Chrome**.
   (On a phone, use the deployed https link from task 19.)
2. Make sure **বাংলা** is selected.
3. Tap the **microphone** button next to "পাঠান". Chrome asks for microphone permission the first
   time: choose **Allow**. The button turns red and shows "শুনছি… বাংলায় বলুন".
4. Say clearly: **"একশো পঁয়তাল্লিশ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও"**
   (or "১৪৫ নম্বর দাগ…"; Chrome usually writes the number as digits).
5. Expected: a green card shows **আপনি বললেন: "…"** and **"আপনি কি ১৪৫ নম্বর দাগ বলেছেন? ঠিক আছে?"**,
   and Sathi says this question aloud.
6. Tap **হ্যাঁ, পাঠান**. Expected: badges "দাগ খোঁজা হয়েছে", "জমি যাচাই করা হয়েছে", the answer
   **সবুজ**, a green chip linking to the report, and the answer is read aloud.
7. Tap **না, ঠিক করি** in a second try: the heard text moves into the text box to correct by hand.
8. Ask without numbers, e.g. **"নামজারি করতে কত খরচ"**: it is sent straight away (nothing to
   read back) and the answer cites its source.
9. Tap **▶ শুনুন** under any answer to hear it again.

## If something goes wrong

| What you see | Why / what to do |
| --- | --- |
| No microphone button | Browser has no speech recognition (e.g. Firefox). Use Chrome. |
| "মাইক্রোফোন চালু করতে ব্রাউজারে অনুমতি দিন" | Permission was blocked: click the lock icon in the address bar → Microphone → Allow → reload. |
| "কথা বোঝা যায়নি" | Noise or silence. Speak closer, after the button turns red. |
| Numbers heard wrongly | That is exactly what the read-back is for: tap "না, ঠিক করি" and fix the text. |
| Answer spoken in a strange accent | No Bangla voice on this device (see above). The text answer is still correct. |
