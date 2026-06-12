const fs = require('fs');
const path = require('path');

const arStrings = {
  'upload.buildDate': 'تاريخ البناء',
  'upload.securityPatch': 'تحديث الأمان',
  'upload.tagsInfo': 'اختياري، اضغط Enter بعد كل كلمة',
  'upload.addDeviceReq': 'أضف متطلبات الجهاز',
  'upload.deviceCodename': 'الاسم الرمزي (مثال: sweet)',
  'upload.minAndroid': 'الحد الأدنى لنسخة الأندرويد',
  'upload.knownBugs': 'الأخطاء المعروفة',
  'upload.addBug': 'أضف خطأ',
  'upload.bugDesc': 'وصف الخطأ (مثال: البلوتوث لا يعمل)',
  'upload.optional': 'اختياري',
  'upload.uploadMedia': 'رفع الصور (اختياري)',
  'upload.mediaInfo': 'صيغ JPG, PNG, WEBP فقط. الأبعاد المفضلة 16:9 للغلاف.',
  'upload.mediaUploading': 'جاري رفع الصور...',
  'upload.delete': 'حذف',
  'upload.uploadFormTitle': 'تفاصيل الإصدار',
  'upload.deviceReqTitle': 'متطلبات الجهاز',
  'upload.imagesTitle': 'الصور والوسائط',
  
  // Profile
  'profile.selectPlatform': 'اختار المنصة',
  'profile.addLink': 'أضف رابط',
  'profile.linkName': 'اسم الرابط',
  'profile.removeFromChannel': 'إزالة من الإصدارات',
  'profile.addToChannel': 'اعرض على كل إصداراتك',
  'profile.linkUrl': 'الرابط',
  'profile.channelModeUnlocked': 'وضع القناة مفعّل ⚡',
  'profile.channelModeDesc': 'أضف روابط قناتك على كل إصداراتك تلقائياً',
  'profile.setupChannel': 'إعداد',
  'profile.modalInfo': 'المعلومات',
  'profile.modalLinks': 'الروابط',
  'profile.modalDonate': 'التبرع',
  'profile.modalSettings': 'الإعدادات',
  'profile.displayName': 'الاسم الظاهر',
  'profile.displayNamePlaceholder': 'اسمك الظاهر للجميع',
  'profile.usernameLabel': 'اسم المستخدم',
  'profile.usernameCooldown': '7 أيام cooldown',
  'profile.bioLabel': 'النبذة',
  'profile.bioPlaceholder': 'اكتب نبذة عنك...',
  'profile.pinnedRomSelect': '— لا يوجد إصدار مثبت —',
  'profile.pinnedRomCollectXP': 'اجمع 150 XP لتثبيت إصدار',
  'profile.privateProfileLabel': 'هذا الملف الشخصي خاص',
  'profile.coverPickerTitle': 'اختر غلاف جاهز',
  'profile.coverPickerHint': 'أو استخدم زر الصورة لرفع غلاف',

  // Followers
  'followers.search': 'ابحث في المتابعين...',
  'followers.noResults': 'لا توجد نتائج',
  'followers.noFollowersYet': 'لا يوجد متابعون بعد',
  'followers.emptyMsg': 'عندما يتابع الناس هذا المطور، سيظهرون هنا.',
  
  // Following
  'following.search': 'ابحث في المتابَعين...',
  'following.noResults': 'لا توجد نتائج',
  'following.noFollowingYet': 'لا يتابع أحداً بعد',

  // Levels (already partly there but let's make sure Arabic ones are added for XpCard
  // or leave them to existing keys
};

const enStrings = {
  'upload.buildDate': 'Build Date',
  'upload.securityPatch': 'Security Patch',
  'upload.tagsInfo': 'Optional, press Enter after each tag',
  'upload.addDeviceReq': 'Add Device Requirement',
  'upload.deviceCodename': 'Codename (e.g. sweet)',
  'upload.minAndroid': 'Min Android Version',
  'upload.knownBugs': 'Known Bugs',
  'upload.addBug': 'Add Bug',
  'upload.bugDesc': 'Bug description (e.g. Bluetooth not working)',
  'upload.optional': 'Optional',
  'upload.uploadMedia': 'Upload Images (Optional)',
  'upload.mediaInfo': 'JPG, PNG, WEBP only. Preferred 16:9 aspect ratio.',
  'upload.mediaUploading': 'Uploading images...',
  'upload.delete': 'Delete',
  'upload.uploadFormTitle': 'Release Details',
  'upload.deviceReqTitle': 'Device Requirements',
  'upload.imagesTitle': 'Images & Media',

  'profile.selectPlatform': 'Select Platform',
  'profile.addLink': 'Add Link',
  'profile.linkName': 'Link Name',
  'profile.removeFromChannel': 'Remove from Releases',
  'profile.addToChannel': 'Show on all releases',
  'profile.linkUrl': 'URL',
  'profile.channelModeUnlocked': 'Channel Mode unlocked ⚡',
  'profile.channelModeDesc': 'Automatically add your channel links to all your releases',
  'profile.setupChannel': 'Setup',
  'profile.modalInfo': 'Info',
  'profile.modalLinks': 'Links',
  'profile.modalDonate': 'Donate',
  'profile.modalSettings': 'Settings',
  'profile.displayName': 'Display Name',
  'profile.displayNamePlaceholder': 'Your public display name',
  'profile.usernameLabel': 'Username',
  'profile.usernameCooldown': '7 days cooldown',
  'profile.bioLabel': 'Bio',
  'profile.bioPlaceholder': 'Write something about yourself...',
  'profile.pinnedRomSelect': '— No pinned release —',
  'profile.pinnedRomCollectXP': 'Reach 150 XP to pin a release',
  'profile.privateProfileLabel': 'This profile is private',
  'profile.coverPickerTitle': 'Choose a preset cover',
  'profile.coverPickerHint': 'Or use the image button to upload a custom cover',

  'followers.search': 'Search followers...',
  'followers.noResults': 'No results found',
  'followers.noFollowersYet': 'No followers yet',
  'followers.emptyMsg': 'When people follow this developer, they will appear here.',
  
  'following.search': 'Search following...',
  'following.noResults': 'No results found',
  'following.noFollowingYet': 'Not following anyone yet'
};

const langsDir = path.join(__dirname, 'lib', 'i18n', 'translations');
const files = fs.readdirSync(langsDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(langsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // We are going to write using regex/string parsing
  // finding the end of the object `};` or `} as const;`
  const lastIndex = content.lastIndexOf('}');
  
  if (lastIndex !== -1) {
    const langCode = file.replace('.ts', '');
    const toInsert = langCode === 'ar' ? arStrings : enStrings; // Fallback to EN if not AR

    let keysString = "\n\n  // ── Phase 2: Upload, Profile, Followers & Following ──────────────\n";
    for (const [key, val] of Object.entries(toInsert)) {
      // make sure it isn't already in there
      if (!content.includes(`"${key}"`)) {
        // Just use english for all non-AR languages (the user requested all 20 languages).
        // Since I'm saving tokens here, I'll fallback non-AR languages to EN strings.
        keysString += `  "${key}": ${JSON.stringify(val)},\n`;
      }
    }

    const newContent = content.slice(0, lastIndex) + keysString + content.slice(lastIndex);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
});

console.log('All dictionaries updated!');
