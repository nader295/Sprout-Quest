const fs = require('fs');
const path = require('path');

const i18nDir = path.join(__dirname, '../lib/i18n/translations');
const files = fs.readdirSync(i18nDir).filter(f => f.endsWith('.ts'));

const translations = {
  ar: {
    "upload.step.detailsDesc": "أضف معلومات تفصيلية عن منشورك",
    "upload.moduleIdHint": "معرف فريد للموديول (مثال: com.developer.module)",
    "upload.versionHint": "مثال: v4.2.1",
    "upload.descEdit": "تعديل",
    "upload.descPreview": "معاينة",
    "upload.optional": "(اختياري)",
    "upload.addBtn": "إضافة",
    "upload.suggestions": "اقتراحات:",
    "upload.step.infoDesc": "حدد الجهاز المستهدف وإصدار Android",
    "upload.changelogTemplates.newUpdate": "تحديث جديد",
    "upload.changelogTemplates.bugFixes": "إصلاح أخطاء",
    "upload.changelogTemplates.initialRelease": "إصدار أولي",
    "upload.worksWithAll": "يعمل مع الكل"
  },
  en: {
    "upload.step.detailsDesc": "Add detailed information about your post",
    "upload.moduleIdHint": "Unique module identifier (e.g., com.developer.module)",
    "upload.versionHint": "Example: v4.2.1",
    "upload.descEdit": "Edit",
    "upload.descPreview": "Preview",
    "upload.optional": "(Optional)",
    "upload.addBtn": "Add",
    "upload.suggestions": "Suggestions:",
    "upload.step.infoDesc": "Select the target device and Android version",
    "upload.changelogTemplates.newUpdate": "New Update",
    "upload.changelogTemplates.bugFixes": "Bug Fixes",
    "upload.changelogTemplates.initialRelease": "Initial Release",
    "upload.worksWithAll": "Works with all"
  },
  // (Using English for other locales as fallback, since the script already ran and fell back to en, I'll just keep en fallback here)
};

files.forEach(file => {
  const filePath = path.join(i18nDir, file);
  const langCode = file.replace('.ts', '');
  
  const langTrans = translations[langCode] || translations['en'];
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find the last closing brace that belongs to the object
  // A robust way: find `} as const;` or `};` or `}\n\nexport default`
  
  let match = content.match(/}(\s*as const)?\s*;/);
  if (!match) {
    match = content.match(/}(\s*)export default/);
  }
  
  if (match) {
    const lastBraceIndex = match.index;
    let toAdd = '\n  // Added missing translations 2\n';
    let added = false;
    for (const [key, value] of Object.entries(langTrans)) {
      if (!content.includes(`"${key}"`)) {
        toAdd += `  "${key}": "${value.replace(/"/g, '\\"')}",\n`;
        added = true;
      }
    }
    
    if (added) {
      content = content.slice(0, lastBraceIndex) + toAdd + content.slice(lastBraceIndex);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}`);
    } else {
      console.log(`Skipped ${file} (already added)`);
    }
  }
});
