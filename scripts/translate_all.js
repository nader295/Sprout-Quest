const fs = require("fs");
const path = require("path");

const translationsDir = "c:/Users/Admin/Desktop/New folder (4)/lib/i18n/translations";

const langs = [
  "en", "ar", "es", "fr", "de", "pt", "ru", "zh", "ja", "ko", 
  "hi", "tr", "id", "pl", "it", "nl", "th", "vi", "uk", "fa",
];

async function translateText(text, targetLang) {
  if (targetLang === "en" && /^[a-zA-Z\s.,!?_/\-]+$/.test(text)) return text;
  
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data[0].map(item => item[0]).join("");
  } catch (e) {
    console.error("Translation fail:", text, targetLang, e);
    return text;
  }
}

async function run() {
  const enTsPath = path.join(translationsDir, "en.ts");
  let enContent = fs.readFileSync(enTsPath, "utf8");
  
  const newKeys = {
    // page.tsx
    "upload.stepTitle": "الخطوة {step} من {total}",
    "upload.stepReviewButton": "مراجعة",
    "upload.err.kernelTypeRequired": "Choose kernel type",
    "upload.err.kernelMajorRequired": "Choose Kernel Version",
    "upload.err.variantsRequired": "Complete all variants",

    // step-device.tsx
    "upload.kernelSettings": "إعدادات الكيرنل",
    "upload.specificDevice": "لجهاز محدد",
    "upload.universalFlashable": "Universal Flashable",
    "upload.supportedTargetsHint": "اختياري - أسماء أو أكواد الأجهزة المدعومة",
    "upload.moduleSettings": "إعدادات الموديول",
    "upload.moduleScope": "نطاق الموديول",
    "upload.moduleScopeHint": "حدد إن كان الموديول عام أم لجهاز معين",
    "upload.scopeUniversal": "عام",
    "upload.scopeUniversalDesc": "جميع الأجهزة",
    "upload.scopeAndroid": "Android محدد",
    "upload.scopeAndroidDesc": "إصدار معين",
    "upload.scopeDevice": "جهاز محدد",
    "upload.scopeDeviceDesc": "كود معين",
    "upload.scopeSoc": "معالج محدد",
    "upload.scopeSocDesc": "Snapdragon, etc",
    "upload.gsiWorksOnAny": "GSI works on any Treble device — no need to link a specific device",

    // step-type.tsx
    "upload.type.rom.tip": "الأكثر طلباً - مثالي للرومات المعدلة",
    "upload.type.kernel.tip": "للمطورين - كيرنل محسّن للأداء",
    "upload.type.module.tip": "موديولات Magisk, KSU, APatch",
    "upload.type.gsi.tip": "صورة عامة لجميع أجهزة Treble",
    "upload.quickTip": "نصيحة سريعة",
    "upload.quickTipDesc": "اختر النوع المناسب لمحتواك. كل نوع له خيارات وإعدادات مخصصة تناسبه.",

    // step-details.tsx
    "upload.basicInfo": "معلومات أساسية",
    "upload.preview": "معاينة",
    "upload.edit": "تعديل",
    "upload.descNoDesc": "لا يوجد وصف بعد...",
    "upload.descRemaining": "{n} حرف متبقي للحد الأدنى",
    "upload.descExcellent": "وصف ممتاز!",

    // step-media.tsx
    "upload.replace": "استبدال",
    "upload.delete": "حذف",
    "upload.droppingImage": "أفلت الصورة هنا",
    "upload.dragImageOrClick": "اسحب صورة أو اضغط للاختيار",
    "upload.coverTip": "صورة الغلاف هي أول ما يراه المستخدم. استخدم صورة جذابة بجودة عالية تعبر عن محتواك.",
    "upload.reorder": "ترتيب",
    "upload.done": "تم",
    "upload.addImages": "إضافة صور",
    "upload.ssRemaining": "{n} متبقية",
    "upload.dragImagesOrClick": "اسحب صوراً أو اضغط للاختيار",
    "upload.screenshotsTip": "أضف لقطات شاشة توضح واجهة المستخدم والميزات الرئيسية. يمكنك إعادة ترتيبها بعد الإضافة.",

    // step-links.tsx
    "upload.gsiConfig": "GSI Configuration",
    "upload.gsiConfigDesc": "إعدادات الصورة العامة",
    "upload.singleLink": "رابط واحد",
    "upload.multiLink": "نسخ متعددة",
    "upload.quickTemplates": "قوالب سريعة",
    "upload.addNewVariant": "إضافة نسخة جديدة",
    "upload.variantName": "اسم النسخة",
    "upload.linkInvalid": "⚠ رابط غير صالح",
    "upload.linkvertiseEnable": "تفعيل إعلان Linkvertise",
    "upload.linkvertiseDescOn": "✅ سيظهر تنبيه للمستخدم قبل التحميل",
    "upload.linkvertiseDescOff": "تحميل مباشر بدون إعلان",
    "upload.linkvertiseTip": "💡 عند الضغط على التحميل، يظهر للمستخدم modal تأكيد ثم يُوجَّه عبر Linkvertise.",
    "upload.choosePlatform": "اختر المنصة",
    "upload.addChannel": "إضافة قناة",
    "upload.donationPlatform": "اختر منصة الدعم",
    "upload.addDonationLink": "إضافة رابط دعم",
    "upload.sourceCode": "Source Code / GitHub",
    "upload.xdaThread": "XDA Thread",
    "upload.telegramGroup": "Telegram Channel / Group",

    // step-review.tsx
    "upload.projectName": "اسم المشروع",
    "upload.deviceCode": "كود الجهاز",
    "upload.unspecified": "غير محدد",
    "upload.postPreview": "معاينة المنشور",
    "upload.checklist": "قائمة التحقق",
    "upload.required": "مطلوب",
    "upload.optionalInfo": "اختياري ({n}/{total})",
    "upload.visibilityTips": "نصائح للظهور الأفضل",
    "upload.visibilityTip1Yes": "✓ صورة الغلاف موجودة",
    "upload.visibilityTip1No": "أضف صورة الغلاف",
    "upload.visibilityTip2Yes": "✓ التاقات كافية",
    "upload.visibilityTip2No": "أضف تاق",
    "upload.visibilityTip3Yes": "✓ الوصف مفصل",
    "upload.visibilityTip3No": "اكتب وصفاً أطول (200+ حرف)",
  };

  const endRegex = /};\s*export\s+default\s+en;/;
  const match = enContent.match(endRegex);
  if (match) {
    let appendStr = "";
    for (const [key, value] of Object.entries(newKeys)) {
      if (!enContent.includes('"' + key + '":')) {
        appendStr += '  "' + key + '": "' + value.replace(/"/g, '\\"') + '",\n';
      }
    }
    enContent = enContent.replace(endRegex, appendStr + "};\nexport default en;");
    fs.writeFileSync(enTsPath, enContent);
  }

  // Reload en.ts to get all keys
  const lines = fs.readFileSync(enTsPath, "utf8").split("\n");
  const allEnKeys = {};
  for (const line of lines) {
    const m = line.match(/^\s*"([^"]+)"\s*:\s*"([^"]+)"/);
    if (m) allEnKeys[m[1]] = m[2];
  }

  for (const lang of langs) {
    if (lang === "en") continue;
    
    const langPath = path.join(translationsDir, lang + ".ts");
    let langContent = "";
    if (fs.existsSync(langPath)) {
      langContent = fs.readFileSync(langPath, "utf8");
    } else {
      langContent = "const " + lang + " = {\n};\nexport default " + lang + ";\n";
    }

    const missingKeys = {};
    for (const [k, v] of Object.entries(allEnKeys)) {
      if (!langContent.includes('"' + k + '":')) {
        missingKeys[k] = v;
      }
    }

    const keysCount = Object.keys(missingKeys).length;
    if (keysCount === 0) continue;
    
    console.log("[" + lang + "] Translating " + keysCount + " missing keys...");
    
    let appendStr = "";
    let count = 0;
    for (const [k, v] of Object.entries(missingKeys)) {
      let prepText = v.replace(/\{([^}]+)\}/g, "___$1___");
      let trans = await translateText(prepText, lang);
      trans = trans.replace(/___([^_]+)___/g, "{$1}").replace(/"/g, '\\"');
      
      appendStr += '  "' + k + '": "' + trans + '",\n';
      
      count++;
      if (count % 30 === 0) {
        console.log("[" + lang + "] Translated " + count + "/" + keysCount + "...");
      }
    }
    
    const regToReplace = new RegExp("};\\s*export\\s+default\\s+" + lang + ";");
    langContent = langContent.replace(regToReplace, appendStr + "};\nexport default " + lang + ";");
    fs.writeFileSync(langPath, langContent);
    console.log("[" + lang + "] Done!");
  }
}

run().catch(console.error);
