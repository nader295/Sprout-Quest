export type CreatorTranslation = {
  languageName: string;
  heroTitle: string;
  heroSubtitle: string;
  
  synergyTitle: string;
  synergyDesc: string;
  
  pillar1Title: string;
  pillar1Desc: string;
  
  pillar2Title: string;
  pillar2Desc: string;
  
  pillar3Title: string;
  pillar3Desc: string;
  
  pillar4Title: string;
  pillar4Desc: string;

  workflowTitle: string;
  workflowOldTitle: string;
  workflowOldDesc: string;
  workflowRomxTitle: string;
  workflowRomxDesc: string;

  howItWorksTitle: string;
  howItWorksStep1Title: string;
  howItWorksStep1Desc: string;
  howItWorksStep2Title: string;
  howItWorksStep2Desc: string;
  howItWorksStep3Title: string;
  howItWorksStep3Desc: string;

  faqTitle: string;
  faq1Q: string;
  faq1A: string;
  faq2Q: string;
  faq2A: string;
  faq3Q: string;
  faq3A: string;
  
  ctaTitle: string;
  ctaDesc: string;
  ctaButton: string;
};

export const creatorTranslations: Record<string, CreatorTranslation> = {
  en: {
    languageName: "English",
    heroTitle: "Elevate Your Android Development",
    heroSubtitle: "Stop relying on chaotic chats for your releases. RomX provides your Custom ROMs a beautiful, trackable landing page with deep analytics and real community recognition.",
    
    synergyTitle: "Enhance Your Telegram, Don't Replace It",
    synergyDesc: "We know you've built a loyal audience on your Telegram channel. Keep it that way. You don't need to start over; simply drop a trackable RomX link instead of a raw Mega or GDrive link in your channel posts.",
    
    pillar1Title: "Smart Links & Analytics",
    pillar1Desc: "Stop guessing your true reach. Give your users a premium landing page to your files, while you track real-time unique downloads, pageviews, and traffic sources.",
    pillar2Title: "Quality Community Feedback",
    pillar2Desc: "Important bug reports get buried instantly in Telegram. Give your users a dedicated, structured comment and review section for each specific build.",
    pillar3Title: "Leaderboards & Legacy",
    pillar3Desc: "Your time has immense value. Earn the 'Verified Developer' badge, climb global contributor ranks, and build a lasting reputation in the Android modding scene.",
    pillar4Title: "Community-First Sustainability (Soon)",
    pillar4Desc: "We built RomX for the love of the community, not profit. To keep the platform running without malicious ad-shorteners, we'll introduce clean, transparent ad-sharing to simply honor and give back to your hard work.",

    workflowTitle: "The Workflow Evolution",
    workflowOldTitle: "The Raw Text Way",
    workflowOldDesc: "Pasting raw GDrive/Mega links in Telegram. Links get lost. Zero analytics on who downloaded it. Users get confused or lose track.",
    workflowRomxTitle: "The RomX Standard",
    workflowRomxDesc: "One permanent, trackable smart link per release. Instant analytics dashboard. A beautiful portfolio page automatically collecting your work.",

    howItWorksTitle: "How It Works (In 3 Simple Steps)",
    howItWorksStep1Title: "1. Paste Your Cloud Link",
    howItWorksStep1Desc: "Upload your ROM to Mega, Google Drive, or wherever you like. Just grab the link.",
    howItWorksStep2Title: "2. Generate Your Landing Page",
    howItWorksStep2Desc: "Create a RomX post, paste your link, and we'll instantly generate a premium, trackable page for your release.",
    howItWorksStep3Title: "3. Share & Analyze",
    howItWorksStep3Desc: "Share your new short RomX link on your Telegram channel and watch the analytics roll in.",

    faqTitle: "Frequently Asked Questions",
    faq1Q: "Do you host our large ROM files?",
    faq1A: "No! We do not have servers to store massive files. You upload to your preferred free cloud (like Mega or GDrive), and we simply provide a beautiful, trackable 'Smart Link' gateway to it.",
    faq2Q: "Do I have to leave Telegram or my groups?",
    faq2A: "Absolutely not. RomX is designed to work WITH your existing channels. You just use your RomX link instead of the direct download link when posting.",
    faq3Q: "How does the 'Monetization' or 'Rewards' actually work?",
    faq3A: "We aren't paying you out of pocket. RomX displays clean, safe ads to sustain the servers. As a verified developer, the ad revenue generated on your specific landing pages is simply shared with you as a sign of respect for the traffic you bring.",

    ctaTitle: "Join the Elite Roster",
    ctaDesc: "Start professionalizing your releases today and take control of your audience.",
    ctaButton: "Get Started Now"
  },
  ar: {
    languageName: "العربية",
    heroTitle: "ارتقِ بتجربتك كمطور أندرويد",
    heroSubtitle: "توقف عن الاعتماد على مجموعات الدردشة العشوائية لنشر إبداعاتك. منصة RomX توفر لروماتك وتعديلاتك صفحة هبوط أنيقة، مع تحليلات دقيقة وتقدير حقيقي لجهودك.",
    
    synergyTitle: "عزز تواجدك على تليجرام، لا تستبدله",
    synergyDesc: "نحن نعلم أنك بنيت جمهورك المخلص عبر قناتك على تليجرام، ولست بحاجة للبدء من جديد! كل ما عليك هو نشر الرابط الذكي من RomX بدلاً من وضع رابط Mega أو GDrive مباشرة في منشورك، ودعنا نتكفل بالباقي.",
    
    pillar1Title: "روابط ذكية وتحليلات مرئية",
    pillar1Desc: "تتبع قوة وصولك الحقيقية. امنح زوارك صفحة تحميل احترافية راقية لملفاتك، بينما تراقب أنت عدد التحميلات والمشاهدات ومصادر الزيارة لحظة بلحظة.",
    pillar2Title: "تعليقات منظمة وبنّاءة",
    pillar2Desc: "تقارير الأخطاء المهمة تضيع بلحظات في زحام مجموعات تليجرام. وفر لمتابعيك قسماً منظماً ومخصصاً للإبلاغ عن المشاكل ومناقشة تفاصيل كل روم بشكل هادئ.",
    pillar3Title: "قائمة المتصدرين وصناعة الإرث",
    pillar3Desc: "وقتك له قيمة عظيمة عندنا. احصل على شارة 'مطور موثوق'، وتصدر قوائم المطورين العالمية، واجعل أعمالك محفورة في تاريخ الأندرويد للأبد.",
    pillar4Title: "شراكة مجتمعية مستدامة (قريباً)",
    pillar4Desc: "لقد بنينا RomX حباً وتقديراً لمجتمع المطورين وليس كأداة ربحية. ولضمان استمرارية الخوادم بدون إعلانات خبيثة، سنطرح نظاماً نزيهاً لمشاركة أرباح الإعلانات التي تتولد من صفحاتك كعربون شكر وتضحية لجهودك وسهرك.",

    workflowTitle: "تطور أسلوب العمل",
    workflowOldTitle: "طريقة روابط تليجرام المباشرة",
    workflowOldDesc: "لصق رابط موقع الرفع مباشرة في القناة. الرابط يضيع في الزحام، ولا توجد لديك أي فكرة عن عدد من قام بالتحميل الفعلي أو من أين جاؤوا.",
    workflowRomxTitle: "معيار RomX الجديد",
    workflowRomxDesc: "رابط ذكي واحترافي لكل إصدار ترفعه، ولوحة تحكم تعطيك إحصائيات فورية، وملف شخصي متكامل يعرض جميع أعمالك ليراها الجميع.",

    howItWorksTitle: "كيف تعمل المنصة؟ (في 3 خطوات)",
    howItWorksStep1Title: "1. انسخ رابط الرفع الخاص بك",
    howItWorksStep1Desc: "قم برفع ملف الروم كالمعتاد على Mega أو Google Drive أو أي موقع تفضله، فقط انسخ الرابط.",
    howItWorksStep2Title: "2. أنشئ صفحة الهبوط",
    howItWorksStep2Desc: "أضف منشورك في RomX وضع الرابط الذي نسخته، وسنقوم تلقائياً بتوليد صفحة احترافية بكامل التفاصيل.",
    howItWorksStep3Title: "3. شارك وحلل",
    howItWorksStep3Desc: "الآن شارك الرابط القصير والأنف الذي أعطته لك RomX في قناتك على تليجرام، واستمتع بمراقبة الإحصائيات.",

    faqTitle: "الأسئلة الشائعة",
    faq1Q: "هل تقومون باستضافة ملفات الروم الضخمة لديكم؟",
    faq1A: "لا إطلاقاً! نحن لا نملك سيرفرات لتخزين الملفات، أنت من تختار أين ترفع ملفاتك (مثل Mega). نحن فقط نوفر لك 'رابطاً ذكياً' وصفحة هبوط احترافية توجه المستخدم لتحميل ملفك.",
    faq2Q: "هل سيجبرني هذا على التخلي عن قناتي في تليجرام؟",
    faq2A: "بالتأكيد لا. منصة RomX صُممت لتتكامل مع تليجرام وليس لسرقة جمهورك. أنت ستستخدم رابط RomX داخل قناتك بدلاً من الروابط التقليدية العارية.",
    faq3Q: "كيف تعمل 'المكافآت' أو الأرباح؟ هل تدفعون من جيوبكم؟",
    faq3A: "نحن لا ندفع من جيوبنا ولا ندّعي ذلك. منصة RomX تعرض إعلانات نظيفة وآمنة لتغطية تكاليف الخوادم. كمطور موثوق، نحن ببساطة نشارك معك أرباح هذه الإعلانات التي جلبها الزوار إلى صفحتك الخاصة تقديراً واحتراماً منا لما تقدمه للمجتمع.",

    ctaTitle: "انضم إلى نخبة المطورين",
    ctaDesc: "ابدأ في تحويل إصداراتك إلى مستوى احترافي اليوم، واستعد السيطرة على إنجازاتك.",
    ctaButton: "ابدأ الآن مجاناً"
  },
  ru: {
    languageName: "Русский",
    heroTitle: "Развивайте свою разработку на Android",
    heroSubtitle: "Хватит полагаться на хаотичные чаты. RomX предоставляет вашим Custom ROM красивую целевую страницу с глубокой аналитикой.",
    synergyTitle: "Улучшите свой Telegram, не заменяя его",
    synergyDesc: "Мы знаем, что вы создали лояльную аудиторию в Telegram. Просто укажите ссылку RomX вместо прямой ссылки Mega или GDrive в своем канале.",
    pillar1Title: "Умные ссылки и аналитика",
    pillar1Desc: "Отслеживайте просмотры в реальном времени, уникальные загрузки и источники трафика для каждого релиза вашей прошивки.",
    pillar2Title: "Качественная обратная связь",
    pillar2Desc: "Предоставьте своим пользователям выделенный раздел комментариев для обзоров и отчетов об ошибках для каждой конкретной сборки.",
    pillar3Title: "Таблицы лидеров и наследие",
    pillar3Desc: "Заработайте значок «Проверенный разработчик», поднимитесь в рейтингах участников и создайте прочную репутацию в сообществе.",
    pillar4Title: "Честное партнерство (Скоро)",
    pillar4Desc: "Мы делимся доходом от чистой рекламы, чтобы поддержать платформу и выразить благодарность за ваш тяжелый труд.",
    workflowTitle: "Эволюция рабочего процесса",
    workflowOldTitle: "Обычный способ",
    workflowOldDesc: "Прямые ссылки теряются в чатах. Никакой аналитики по загрузкам.",
    workflowRomxTitle: "Стандарт RomX",
    workflowRomxDesc: "Одна умная ссылка. Мгновенная информационная панель аналитики. Красивое портфолио.",
    howItWorksTitle: "Как это работает",
    howItWorksStep1Title: "1. Вставьте свою ссылку",
    howItWorksStep1Desc: "Загрузите файл на Mega или GDrive. Возьмите ссылку.",
    howItWorksStep2Title: "2. Создайте страницу",
    howItWorksStep2Desc: "Мы мгновенно создадим премиальную целевую страницу для вашего релиза.",
    howItWorksStep3Title: "3. Делитесь и анализируйте",
    howItWorksStep3Desc: "Поделитесь новой короткой ссылкой RomX в своем Telegram и наблюдайте за аналитикой.",
    faqTitle: "Часто задаваемые вопросы",
    faq1Q: "Вы размещаете наши большие файлы ROM?",
    faq1A: "Нет! Вы размещаете их в своем облаке. Мы предоставляем только аналитику и умную ссылку.",
    faq2Q: "Должен ли я покинуть свой Telegram?",
    faq2A: "Нет, вы просто используете ссылку RomX в своем Telegram-канале.",
    faq3Q: "Как работает монетизация?",
    faq3A: "Мы просто делимся с вами доходом от рекламы, генерируемым на ваших целевых страницах.",
    ctaTitle: "Присоединяйтесь к элите",
    ctaDesc: "Начните профессионализировать свои релизы уже сегодня.",
    ctaButton: "Начать сейчас"
  },
  es: {
    languageName: "Español",
    heroTitle: "Eleva tu desarrollo en Android",
    heroSubtitle: "Deja de depender de chats caóticos. RomX proporciona a tus Custom ROMs una página de destino hermosa y rastreable con análisis profundos.",
    synergyTitle: "Mejora tu Telegram, No lo Reemplaces",
    synergyDesc: "Simplemente incluye un enlace de RomX en lugar de un enlace directo de Mega o GDrive en las publicaciones de tu canal de Telegram.",
    pillar1Title: "Enlaces Inteligentes y Análisis",
    pillar1Desc: "Rastrea las descargas únicas en tiempo real, las visitas a la página y las fuentes de tráfico para cada lanzamiento.",
    pillar2Title: "Comentarios de Calidad",
    pillar2Desc: "Brinda a tus usuarios una sección de comentarios dedicada para cada versión específica y evita perder informes de errores en Telegram.",
    pillar3Title: "Clasificación y Legado",
    pillar3Desc: "Obtén la insignia de 'Desarrollador Verificado', sube en las clasificaciones globales y construye una reputación duradera.",
    pillar4Title: "Sostenibilidad Comunitaria (Próximamente)",
    pillar4Desc: "Compartimos los ingresos generados por anuncios limpios para sostener la plataforma y agradecer tu esfuerzo inmenso.",
    workflowTitle: "La Evolución del Trabajo",
    workflowOldTitle: "El Método Clásico",
    workflowOldDesc: "Pegar enlaces directos en Telegram sin saber cuántas personas lo descargan realmente.",
    workflowRomxTitle: "El Estándar RomX",
    workflowRomxDesc: "Un enlace inteligente y permanente. Panel de análisis instantáneo. Un portafolio hermoso.",
    howItWorksTitle: "Cómo Funciona",
    howItWorksStep1Title: "1. Pega tu Enlace",
    howItWorksStep1Desc: "Sube tu ROM a Mega o GDrive y copia el enlace.",
    howItWorksStep2Title: "2. Genera tu Página",
    howItWorksStep2Desc: "Generamos al instante una página de destino premium para tu lanzamiento.",
    howItWorksStep3Title: "3. Comparte y Analiza",
    howItWorksStep3Desc: "Comparte tu enlace corto de RomX en Telegram y observa los análisis.",
    faqTitle: "Preguntas Frecuentes",
    faq1Q: "¿Ustedes alojan nuestros archivos ROM?",
    faq1A: "¡No! Tú los subes a tu nube preferida. Solo proporcionamos la página de destino inteligente.",
    faq2Q: "¿Tengo que dejar Telegram?",
    faq2A: "Absolutamente no. RomX está diseñado para usarse EN tu canal de Telegram.",
    faq3Q: "¿Cómo funciona la monetización?",
    faq3A: "Simplemente compartimos los ingresos publicitarios generados en tus páginas para retribuir a la comunidad.",
    ctaTitle: "Únete a la Élite",
    ctaDesc: "Comienza a profesionalizar tus lanzamientos hoy mismo.",
    ctaButton: "Empezar Ahora"
  },
  id: {
    languageName: "Bahasa Indonesia",
    heroTitle: "Tingkatkan Pengembangan Android Anda",
    heroSubtitle: "Berhenti mengandalkan obrolan yang kacau. RomX memberikan ROM Kustom Anda halaman landas yang indah dengan analitik mendalam.",
    synergyTitle: "Tingkatkan Telegram Anda, Jangan Menggantinya",
    synergyDesc: "Cukup jatuhkan tautan RomX yang dapat dilacakalih-alih tautan Mega atau GDrive mentah di postingan saluran Telegram Anda.",
    pillar1Title: "Tautan Cerdas & Analitik",
    pillar1Desc: "Lacak unduhan unik waktu nyata, tampilan halaman, dan sumber lalu lintas untuk setiap rilis.",
    pillar2Title: "Umpan Balik Berkualitas",
    pillar2Desc: "Beri pengguna Anda bagian umpan balik terstruktur agar laporan bug tidak terkubur di grup Telegram.",
    pillar3Title: "Papan Peringkat & Reputasi",
    pillar3Desc: "Dapatkan lencana 'Pengembang Terverifikasi' dan bangun reputasi Anda di komunitas modding Android.",
    pillar4Title: "Keberlanjutan Komunitas (Segera)",
    pillar4Desc: "Kami membagikan pendapatan dari iklan bersih untuk mendukung platform dan menghargai kerja keras Anda.",
    workflowTitle: "Evolusi Alur Kerja",
    workflowOldTitle: "Cara Lama",
    workflowOldDesc: "Menempelkan tautan langsung di Telegram. Tautan hilang. Nol analitik.",
    workflowRomxTitle: "Standar RomX",
    workflowRomxDesc: "Satu tautan pintar yang permanen. Dasbor analitik seketika. Halaman portofolio cantik.",
    howItWorksTitle: "Cara Kerjanya",
    howItWorksStep1Title: "1. Tempel Tautan Anda",
    howItWorksStep1Desc: "Unggah file Anda ke Mega/GDrive dan salin tautannya.",
    howItWorksStep2Title: "2. Hasilkan Halaman Anda",
    howItWorksStep2Desc: "Kami membuat halaman landas premium untuk rilis Anda secara instan.",
    howItWorksStep3Title: "3. Bagikan & Analisis",
    howItWorksStep3Desc: "Bagikan tautan RomX Anda di Telegram dan pantau unduhannya.",
    faqTitle: "Pertanyaan yang Sering Diajukan",
    faq1Q: "Apakah Anda menyimpan file ROM besar?",
    faq1A: "Tidak! Anda menyimpannya di cloud pilihan Anda. Kami hanya membuat tautan cerdas.",
    faq2Q: "Haruskah saya meninggalkan Telegram?",
    faq2A: "Tentu saja tidak. RomX dibuat khusus untuk dibagikan DI Telegram Anda.",
    faq3Q: "Bagaimana sistem pendapatan bekerja?",
    faq3A: "Kami membagikan sebagian pendapatan dari tayangan iklan yang aman di halaman Anda.",
    ctaTitle: "Bergabung bersama Pengembang Elite",
    ctaDesc: "Mulai profesionalkan rilis Anda hari ini.",
    ctaButton: "Mulai Sekarang"
  }
};
