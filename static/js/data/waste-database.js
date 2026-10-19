/**
 * EcoSort - قاعدة بيانات تصنيف المخلفات وإرشادات التدوير والأثر البيئي (ثنائية اللغة AR/EN)
 * تدعم مجالي:
 * 1. Computer Vision (CV): خامات المخلفات، نسب الثقة، الخصائص البصرية والملمس
 * 2. Information Retrieval (IR): الكلمات المفتاحية، الفهرسة، إرشادات المعالجة، وحساب انبعاثات الكربون
 */

const WASTE_DATABASE = [
    {
        id: 'pet_bottle',
        name: 'زجاجة بلاستيك شفافة (PET)',
        nameEn: 'Transparent Plastic Bottle (PET)',
        category: 'بلاستيك',
        categoryEn: 'Plastic',
        resinCode: '1 - PETE',
        resinName: 'بولي إيثيلين تيريفثاليت',
        binType: 'plastic',
        binColorName: 'الصفراء (بلاستيك)',
        binColorNameEn: 'Yellow (Plastic)',
        binColorHex: '#eab308',
        defaultConfidence: 96.8,
        textureDescription: 'سطح أملس شديد الشفافية، مرونة جيدة، قاع مقعر مع نقطة حقن دائرية مميزة، خفيف الوزن.',
        textureDescriptionEn: 'Smooth, highly transparent surface, good elasticity, concave base with circular injection gate, lightweight.',
        opticalFeatures: 'نفاذية ضوئية عالية (شفافية > 90%)، مقاومة عالية للكسر، انحناءات اسطوانية مرنة.',
        opticalFeaturesEn: 'High optical clarity (>90% transmission), crack-resistant, flexible cylindrical profile.',
        properHandling: [
            'تفريغ أي سوائل متبقية وشطف العبوة بالماء لإزالة السكريات أو الرواسب.',
            'نزع الغطاء البلاستيكي وحلقة العنق (عادة ما تكون من مادة PP أو HDPE مختلفة).',
            'ضغط الزجاجة بقبضة اليد لتفريغ الهواء وتقليل حجمها بنسبة 70% داخل الحاوية.',
            'إلقاء الزجاجة في الحاوية الصفراء المخصصة للبلاستيك.'
        ],
        properHandlingEn: [
            'Empty any residual liquids and rinse briefly with water to remove sugars.',
            'Remove the plastic cap and neck ring (usually different PP or HDPE polymer).',
            'Crush the bottle firmly to expel air and compress volume by 70%.',
            'Dispose directly into the yellow plastic recycling container.'
        ],
        carbonSavingsGrams: 85,
        energySavings: 'توفير طاقة تشغيل مصباح LED بقوة 15 وات لمدة 3 ساعات ونصف.',
        energySavingsEn: 'Powers a 15W LED lamp for 3.5 continuous hours.',
        waterSavingsLiters: 2.1,
        metricSource: 'Approximate estimates (EPA WARM / LCA)',
        metricSourceAr: 'تقديرات تقريبية مستندة إلى دراسات تقييم دورة الحياة (LCA)',
        rawMaterialSavings: 'توفير 0.06 لتر من النفط الخام المستخدم في تصنيع البلاستيك البكر.',
        sustainabilityTip: 'إعادة تدوير زجاجات PET تنتج ألياف بوليستر تستخدم في صناعة الملابس الرياضية والأقمشة الصديقة للبيئة.',
        sustainabilityTipEn: 'Recycled PET flakes are extruded into polyester fibers used in sustainable athletic wear.',
        keywords: [
            'بلاستيك', 'زجاجة', 'مياه', 'مياه معدنية', 'عصير', 'قارورة', 'شفاف', 
            'pet', 'pete', 'بولي ايثيلين', 'غطاء', 'كانزات بلاستيك', 'مشروب'
        ],
        iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4v3h-4z"/><path d="M9 5h6l1 3v12a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8l1-3z"/><path d="M8 12h8"/><path d="M8 16h8"/></svg>`
    },
    {
        id: 'hdpe_container',
        name: 'عبوة منظف / شامبو (HDPE)',
        nameEn: 'Detergent / Shampoo Bottle (HDPE)',
        category: 'بلاستيك عالي الكثافة',
        categoryEn: 'High-Density Polyethylene',
        resinCode: '2 - HDPE',
        resinName: 'بولي إيثيلين عالي الكثافة',
        binType: 'plastic',
        binColorName: 'الصفراء (بلاستيك وبوليمرات)',
        binColorNameEn: 'Yellow (Polymers & Plastic)',
        binColorHex: '#eab308',
        defaultConfidence: 94.2,
        textureDescription: 'ملمس شمعي غير لماع، بنية صلبة غير قابلة للكسر بسهولة، لون معتم أو نصف شفاف، سميك الجدار.',
        textureDescriptionEn: 'Matte waxy texture, rigid and durable structure, opaque or translucent body, thick container walls.',
        opticalFeatures: 'معتم أو ملوّن، يظهر خط لحام واضح يمتد بطول قاع العبوة نتيجة التشكيل بالنفخ.',
        opticalFeaturesEn: 'Opaque or colored body with visible mold seam line extending along the base.',
        properHandling: [
            'شطف العبوة جيداً بالماء الدافئ لإزالة أي بقايا صابون أو مواد كيميائية مركزة.',
            'إزالة المضخة الضاغطة (Pump Dispenser) لاحتوائها على زنبرك معدني غير قابل للفرز البلاستيكي.',
            'التأكد من جفاف العبوة قبل التخلص منها في الحاوية.',
            'وضعها مباشرة في حاوية البلاستيك والبوليمرات.'
        ],
        properHandlingEn: [
            'Rinse thoroughly with warm water to remove soap or concentrated chemical residue.',
            'Remove pump dispenser containing metal springs unsuitable for polymer shredders.',
            'Ensure container is drained and dry before placing in the bin.',
            'Dispose directly into the yellow recycling bin for polymers and plastic.'
        ],
        carbonSavingsGrams: 120,
        energySavings: 'توفير 60% من الطاقة الحرارية والكهربائية المطلوبة لإنتاج بوليمر HDPE جديد.',
        energySavingsEn: 'Saves 60% of thermal and electrical energy required for virgin HDPE synthesis.',
        waterSavingsLiters: 4.1,
        rawMaterialSavings: 'تقليل استهلاك الوقود الأحفوري وحماية البيئة المائية من التلوث البوليمري.',
        sustainabilityTip: 'تُعاد معالجة خامة HDPE لتصنيع أنابيب الري الزراعي، مقاعد الحدائق، وحاويات القمامة الكبيرة.',
        sustainabilityTipEn: 'Recycled HDPE is remanufactured into agricultural irrigation pipes, outdoor benches, and commercial carts.',
        keywords: [
            'شامبو', 'منظف', 'صابون', 'hdpe', 'بلاستيك معتم', 'جركن', 'عبوة حليب', 
            'بولي ايثيلين عالي الكثافة', 'كلور', 'مطهر', 'شاور'
        ],
        iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="7" width="12" height="15" rx="3"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/><path d="M12 11v4"/></svg>`
    },
    {
        id: 'alu_can',
        name: 'علبة كانز ألومنيوم (Aluminum Can)',
        nameEn: 'Aluminum Beverage Can',
        category: 'معادن',
        categoryEn: 'Metals & Cans',
        resinCode: '41 - ALU',
        resinName: 'ألومنيوم قابل لإعادة الصهر اللانهائي',
        binType: 'metal',
        binColorName: 'الزرقاء (معادن وكانز)',
        binColorNameEn: 'Blue (Metals & Cans)',
        binColorHex: '#3b82f6',
        defaultConfidence: 98.5,
        textureDescription: 'معدني بارد، أسطواني رفيع، خفيف الوزن للغاية، رنين صوتي مميز عند النقر، سطح أملس مطبوع.',
        textureDescriptionEn: 'Cool metallic sheen, thin lightweight cylindrical aluminum, distinct acoustic ping, printed exterior.',
        opticalFeatures: 'انعكاس معدني برّاق، أسطح ملونة بأحبار صناعية سريعة الجفاف، فوهة علوية ذات حلقة سحب كبس.',
        opticalFeaturesEn: 'High specular reflection, cylindrical drawn body with scored top stay-on tab.',
        properHandling: [
            'التأكد التام من تفريغ كافة السوائل والعصائر من الداخل.',
            'شطفها سريعاً لمنع اجتذاب الحشرات في نقاط التجميع.',
            'سحق العلبة عمودياً أو أفقياً لتقليص حجمها بنسبة 80% وتسهيل نقلها.',
            'ترك لسان الفتح (Tab) ملتصقاً بالعلبة ولا تفصله حتى لا يضيع أثناء الفرز المغناطيسي.'
        ],
        properHandlingEn: [
            'Ensure all liquids and soda residue are completely drained.',
            'Rinse quickly to prevent insect attraction at collection points.',
            'Crush the can to reduce volume by 80% and facilitate transportation.',
            'Keep the pull-tab attached to the lid so it is not lost in magnetic separation.'
        ],
        carbonSavingsGrams: 175,
        energySavings: 'توفير 95% من الطاقة الكهربائية الهائلة اللازمة لاستخلاص الألومنيوم من خام البوكسيت!',
        energySavingsEn: 'Saves 95% of the massive electricity needed to refine aluminum from raw bauxite ore!',
        waterSavingsLiters: 5.2,
        metricSource: 'Approximate estimates (EPA WARM / LCA)',
        metricSourceAr: 'تقديرات تقريبية مستندة إلى دراسات تقييم دورة الحياة (LCA)',
        rawMaterialSavings: 'صهر علبة واحدة يوفر طاقة تكفي لتشغيل تلفزيون لمدة 3 ساعات كاملة.',
        sustainabilityTip: 'الألومنيوم معدن مستدام 100% يمكن إعادة تدويره لعدد لا نهائي من المرات دون أن يفقد ذرة واحدة من جودته!',
        sustainabilityTipEn: 'Aluminum is 100% infinitely recyclable without losing any structural quality.',
        keywords: [
            'كانز', 'علبة', 'الومنيوم', 'معدن', 'مشروب غازي', 'بيبسي', 'كولا', 'صودا', 
            'alu', 'aluminum', 'قصدير', 'سفن', 'معدني'
        ],
        iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="2"/><ellipse cx="12" cy="5" rx="5" ry="2"/><line x1="7" y1="9" x2="17" y2="9"/></svg>`
    },
    {
        id: 'cardboard_box',
        name: 'صندوق كرتون وأوراق تغليف (Cardboard)',
        nameEn: 'Cardboard & Packaging Box',
        category: 'ورق وكرتون',
        categoryEn: 'Paper & Cardboard',
        resinCode: '20 - PAP',
        resinName: 'ألياف السليلوز والكرتون المضلع',
        binType: 'paper',
        binColorName: 'الزرقاء (ورق وكرتون)',
        binColorNameEn: 'Blue (Paper & Cardboard)',
        binColorHex: '#2563eb',
        defaultConfidence: 93.4,
        textureDescription: 'سطح ليفي خشن الملمس، جاف، بنية كرتونية مضلعة (طبقة متموجة بين لوحين مستويين).',
        textureDescriptionEn: 'Fibrous matte texture, dry, corrugated fluted layer sandwiched between flat liners.',
        opticalFeatures: 'غير عاكس للضوء، لون بني أو أبيض طبيعي، مسامي، امتصاص سريع للرطوبة.',
        opticalFeaturesEn: 'Non-reflective brown/white bleached fiber surface, porous, visible multi-ply edges.',
        properHandling: [
            'نزع أي أشرطة لاصقة بلاستيكية (سلوتيب) أو دبابيس معدنية كبيرة.',
            'طي الصندوق وفرده ليكون مسطحاً تماماً (Flattening) لتوفير المساحة في الحاوية.',
            'التأكد الصارم من عدم تلوث الكرتون بالزيوت أو بقايا الطعام (مثل علب البيتزا المشبعة بالدهن).',
            'إلقاؤه في الحاوية الجافة المخصصة للورق والكرتون.'
        ],
        properHandlingEn: [
            'Remove plastic packing tapes and heavy metal staples.',
            'Flatten the box completely to maximize storage space in the bin.',
            'Strictly ensure cardboard is free from grease, oils, or food contamination.',
            'Deposit into the dry blue container designated for paper and cardboard.'
        ],
        carbonSavingsGrams: 140,
        energySavings: 'توفير 4000 كيلووات/ساعة من الكهرباء لكل طن ورق وكرتون معاد تدويره.',
        energySavingsEn: 'Saves 4,000 kWh of electricity per ton of recycled paperboard.',
        waterSavingsLiters: 7.5,
        metricSource: 'Approximate estimates (EPA WARM / LCA)',
        metricSourceAr: 'تقديرات تقريبية مستندة إلى دراسات تقييم دورة الحياة (LCA)',
        rawMaterialSavings: 'إعادة تدوير طن كرتون ينقذ 17 شجرة ويمنع استهلاك 26,000 لتر من المياه النقية.',
        sustainabilityTip: 'ألياف السليلوز في الورق يمكن إعادة تدويرها حتى 7 دورات متتالية لإنتاج كراتين بيض وكرتون جديد.',
        sustainabilityTipEn: 'Cellulose fibers can be repulped up to 7 consecutive cycles into egg cartons and packaging boxes.',
        keywords: [
            'كرتون', 'صندوق', 'ورق', 'اوراق', 'تغليف', 'شحن', 'طرد', 'كتب', 'مذكرات', 
            'pap', 'ورقي', 'جرائد', 'مجلات'
        ],
        iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`
    },
    {
        id: 'organic_food',
        name: 'مخلفات عضوية وبقايا طعام (Organic Waste)',
        nameEn: 'Organic Food Waste',
        category: 'عضوي',
        categoryEn: 'Organic / Biodegradable',
        resinCode: 'BIO - 00',
        resinName: 'مواد عضوية قابلة للتحلل الحيوي',
        binType: 'organic',
        binColorName: 'البنية (مخلفات عضوية)',
        binColorNameEn: 'Brown (Organic Waste)',
        binColorHex: '#854d0e',
        defaultConfidence: 91.5,
        textureDescription: 'قوام رطب لين، قابل للتفتت، درجات ألوان ترابية وطبيعية متنوعة، غير متجانس.',
        textureDescriptionEn: 'Moist, soft crumbly texture, natural earthy tones, biodegradable plant and food scraps.',
        opticalFeatures: 'مظهر عضوي طبيعي، يحتوي على رطوبة سطحية ونسب ألياف نباتية ونشوية.',
        opticalFeaturesEn: 'Natural non-uniform biological texture with visible moisture reflection.',
        properHandling: [
            'فصل بقايا الطعام عن أي أكياس بلاستيكية، أطباق فوم، أو مناديل مبللة كيميائية.',
            'تصفية السوائل والزيوت الزائدة قدر الإمكان.',
            'وضعها في الحاوية المخصصة للمخلفات العضوية في المطعم المركزي أو كلية الزراعة.',
            'تجنب تركها مكشوفة لفترات طويلة لتفادي الروائح الكريهة وجذب الحشرات.'
        ],
        properHandlingEn: [
            'Separate food leftovers from plastic bags, foam containers, or chemical wipes.',
            'Drain excess liquids and oils as much as possible.',
            'Dispose into the organic compost container at Cafeteria or Faculty of Agriculture.',
            'Avoid leaving open for long periods to prevent odors and insects.'
        ],
        carbonSavingsGrams: 150,
        energySavings: 'إنتاج سماد عضوي نباتي (Compost) غني بالنيتروجين، وتقليل انبعاثات الميثان بنسبة 70%.',
        energySavingsEn: 'Generates nitrogen-rich natural compost and cuts landfill methane by 70%.',
        waterSavingsLiters: 1.5,
        rawMaterialSavings: 'تحويل المخلفات لطاقة حيوية (Biogas) وسماد عالي القيمة لمزارع كلية الزراعة بالجامعة.',
        sustainabilityTip: 'مزارع كلية الزراعة بجامعة كفر الشيخ تعتمد على تدوير المخلفات العضوية لإنتاج أسمدة طبيعية للمشاتل.',
        sustainabilityTipEn: 'Kafrelsheikh Faculty of Agriculture farms recycle organic scraps into compost for university nurseries.',
        keywords: [
            'طعام', 'اكل', 'بقايا', 'عضوي', 'تفاح', 'قشر', 'خضار', 'فاكهة', 'خبز', 
            'مطعم', 'ساندوتش', 'وجبة', 'كومبوست', 'زراعي'
        ],
        iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 0-10 10c0 4.4 2.8 8.1 6.8 9.4.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.7-1.4-2.2-.2-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.4-1.3.1-2.7 0 0 .9-.3 2.8 1a9.6 9.6 0 0 1 5.1 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.3 4.8-4.6 5 .4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5 4-1.3 6.8-5 6.8-9.4A10 10 0 0 0 12 2z"/></svg>`
    },
    {
        id: 'e_waste',
        name: 'مخلفات إلكترونية وبطاريات (E-Waste)',
        nameEn: 'Electronic Waste & Batteries',
        category: 'إلكترونيات ونفايات خطرة',
        categoryEn: 'Electronics & Hazardous',
        resinCode: 'E-WASTE',
        resinName: 'دوائر مطبوعة وبطاريات ليثيوم ومعادن ثقيلة',
        binType: 'ewaste',
        binColorName: 'الحمراء (نفايات إلكترونية خاصة)',
        binColorNameEn: 'Red (Specialized E-Waste)',
        binColorHex: '#ef4444',
        defaultConfidence: 97.2,
        textureDescription: 'معدني معزول، صلب، دوائر نحاسية مذهبة، رقائق سليكونية، أقطاب بطاريات محكمة الغلق.',
        textureDescriptionEn: 'Insulated metal, rigid printed circuit boards, gold-plated contacts, silicon chips, lithium cells.',
        opticalFeatures: 'مسارات موصلة على لوحات PCB خضراء أو زرقاء، لحام قصديري، أسطح بوليمرية مقاومة للهب.',
        opticalFeaturesEn: 'Conductive copper traces on green/blue PCBs, solder joints, flame-retardant enclosures.',
        properHandling: [
            'عزل أقطاب البطاريات بشريط لاصق عازل لتفادي أي ماس كهربائي ناتج عن التلامس.',
            'حظر رميها تماماً مع القمامة المنزلية أو البلاستيك العادي لاحتوائها على الرصاص والكادميوم.',
            'عدم محاولة كسر البطاريات أو حرقها تحت أي ظرف منعاً للاشتعال أو التسرب الكيميائي.',
            'تسليمها في نقاط التجميع المعتمدة في كليتي الهندسة والذكاء الاصطناعي.'
        ],
        properHandlingEn: [
            'Tape battery terminals with electrical tape to prevent accidental short circuits.',
            'Never dispose with municipal trash or plastics due to heavy lead and cadmium content.',
            'Do not attempt to puncture, disassemble, or incinerate batteries under any circumstance.',
            'Deliver directly to authorized e-waste points at Faculties of Engineering and AI.'
        ],
        carbonSavingsGrams: 350,
        energySavings: 'استخلاص الذهب والنحاس والليثيوم النقي يوفر 80% من طاقة التعدين التقليدي.',
        energySavingsEn: 'Extracting gold, copper, and lithium saves 80% of energy vs virgin mining.',
        waterSavingsLiters: 15.0,
        rawMaterialSavings: 'منع تسرب المعادن الثقيلة السامة إلى المياه الجوفية وشبكات الصرف الزراعي.',
        sustainabilityTip: 'طن واحد من اللوحات الإلكترونية يحتوي على ذهب نقي يفوق ما يمكن استخراجه من 15 طناً من خام الذهب الخام!',
        sustainabilityTipEn: 'One ton of printed circuit boards yields more pure gold than 15 tons of raw mined ore!',
        keywords: [
            'بطارية', 'موبايل', 'شاحن', 'كابل', 'سلك', 'لابتوب', 'بوردة', 'فلاشة', 
            'ماوس', 'الكتروني', 'هاتف', 'كهرباء', 'حاسب', 'رامات', 'معالج'
        ],
        iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="15" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`
    },
    {
        id: 'glass_bottle',
        name: 'زجاجات وعبوات زجاجية (Glass)',
        nameEn: 'Glass Bottles & Containers',
        category: 'زجاج',
        categoryEn: 'Glass',
        resinCode: '70 - GL',
        resinName: 'زجاج صودا جير أو بوروسيليكات قابل لإعادة الصهر اللانهائي',
        binType: 'glass',
        binColorName: 'الخضراء (زجاج معملي ودوائي)',
        binColorNameEn: 'Green (Lab & Beverage Glass)',
        binColorHex: '#059669',
        defaultConfidence: 96.5,
        textureDescription: 'شديد الصلابة، أملس، بارد، قابل للكسر، خامل كيميائياً وغير نفاذ للسوائل إطلاقاً.',
        textureDescriptionEn: 'Rigid, smooth, cold to touch, brittle, chemically inert, and completely impermeable.',
        opticalFeatures: 'نفاذية وشفافية ضوئية، بريق عاكس، أسطح أسطوانية ملساء خالية من المسام.',
        opticalFeaturesEn: 'High optical refraction, glossy specular highlight, pore-free molded walls.',
        properHandling: [
            'شطف القارورة بالماء للتخلص من أي سوائل أو محاليل متبقية.',
            'نزع أي أغطية معدنية أو بلاستيكية منفصلة.',
            'التأكد التام من خلو الزجاج من الكسور الحادة أثناء نقله.',
            'إلقاؤها في حاوية الزجاج المخصصة بكليتي العلوم والصيدلة.'
        ],
        properHandlingEn: [
            'Rinse the bottle with clean water to remove syrup or chemical solutions.',
            'Remove any separate metal crown caps or plastic lids.',
            'Ensure safe handling without shattering glass during transport.',
            'Place into the green glass container at Faculties of Science and Pharmacy.'
        ],
        carbonSavingsGrams: 110,
        energySavings: 'توفير 30% من طاقة أفران الصهر وتجنب استهلاك رمال السيليكا البكر.',
        energySavingsEn: 'Saves 30% of furnace heating energy and avoids virgin silica sand extraction.',
        waterSavingsLiters: 1.5,
        metricSource: 'Approximate estimates (EPA WARM / LCA)',
        metricSourceAr: 'تقديرات تقريبية مستندة إلى دراسات تقييم دورة الحياة (LCA)',
        rawMaterialSavings: 'صهر 1 طن زجاج يوفر 1.2 طن من المواد الخام الطبيعية ويمنع انبعاثات الكربون.',
        sustainabilityTip: 'الزجاج مادة طبيعية مستدامة 100% ويعاد تدويره بلا نهاية دون أي تدهور في الجودة.',
        sustainabilityTipEn: 'Glass is 100% infinitely recyclable without any loss in purity, strength, or clarity.',
        keywords: [
            'زجاج', 'قارورة', 'معمل', 'كيمياء', 'دورق', 'كوب', 'انبوب', 'اختبار', 'برطمان', 'glass'
        ],
        iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2h8v4H8z"/><path d="M9 6v3a4 4 0 0 1-1 2.8L5 15.5A4 4 0 0 0 4 18.5V20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5a4 4 0 0 0-1-3l-3-3.7A4 4 0 0 1 15 9V6"/></svg>`
    },
    {
        id: 'paper_sheet',
        name: 'أوراق ومستندات دراسية (Paper)',
        nameEn: 'Study Papers & Office Documents',
        category: 'ورق ومطبوعات',
        categoryEn: 'Paper & Documents',
        resinCode: '22 - PAP',
        resinName: 'ألياف سليلوز بيضاء نقية قابلة لإعادة التدوير',
        binType: 'paper',
        binColorName: 'الزرقاء (ورق وكرتون)',
        binColorNameEn: 'Blue (Paper & Cardboard)',
        binColorHex: '#2563eb',
        defaultConfidence: 94.0,
        textureDescription: 'أوراق مسطحة ناعمة الملمس، مرنة وخفيفة، جافة تماماً وقابلة للثني والكتابة.',
        textureDescriptionEn: 'Smooth flat cellulose sheets, lightweight and flexible, dry and writable.',
        opticalFeatures: 'سطح غير عاكس، لون أبيض أو مطبوع، كثافة ورق طباعة 70-80 جم/م².',
        opticalFeaturesEn: 'Matte diffuse surface, white or printed text, 70-80 g/m² document weight.',
        properHandling: [
            'نزع أي دبابيس معدنية، مشابك أو أشرطة لاصقة.',
            'التأكد من عدم تلوث الأوراق بالسوائل أو المأكولات.',
            'تجميع الأوراق مسطحة لتوفير المساحة في الحاوية.',
            'وضعها مباشرة في حاوية الأوراق والكرتون المخصصة في الكليات والمكتبة.'
        ],
        properHandlingEn: [
            'Remove metal staples, paper clips, and plastic binder spirals.',
            'Ensure papers are dry and free from coffee, food, or oil stains.',
            'Stack sheets flat to preserve space inside the collection bin.',
            'Deposit into the paper & cardboard bin located in faculties and library.'
        ],
        carbonSavingsGrams: 60,
        energySavings: 'توفير 65% من الطاقة الكهربائية المطلوبة لإنتاج ورق جديد من لحاء الأشجار.',
        energySavingsEn: 'Saves 65% of electrical energy required to mill virgin wood pulp.',
        waterSavingsLiters: 4.0,
        metricSource: 'Approximate estimates (EPA WARM / LCA)',
        metricSourceAr: 'تقديرات تقريبية مستندة إلى دراسات تقييم دورة الحياة (LCA)',
        rawMaterialSavings: 'تدوير طن ورق يحمي 17 شجرة معمرة ويوفر 26,000 لتر من المياه النقية.',
        sustainabilityTip: 'فرز أوراق المحاضرات والامتحانات يدعم مبادرة الحرم الأخضر لإنتاج دفاتر وكرتون معاد تدويره.',
        sustainabilityTipEn: 'Recycling exam sheets and notebooks supports the Green Campus eco-station initiative.',
        keywords: [
            'ورق', 'مذكرة', 'اوراق', 'كتاب', 'مستندات', 'طباعة', 'دفتر', 'امتحان', 'تقرير', 'paper'
        ],
        iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
    },
    {
        id: 'mixed_trash',
        name: 'مخلفات عامة ومختلطة (Mixed Trash)',
        nameEn: 'Mixed General Trash',
        category: 'مخلفات عامة',
        categoryEn: 'General Waste',
        resinCode: 'TRASH - 07',
        resinName: 'مواد مختلطة أو غير قابلة لإعادة التدوير المباشر',
        binType: 'trash',
        binColorName: 'الرمادية (مخلفات عامة)',
        binColorNameEn: 'Gray (General Waste)',
        binColorHex: '#475569',
        defaultConfidence: 91.0,
        textureDescription: 'مزيج متعدد الخامات، أغلفة رقائق مركبة، أو مناديل ومخلفات استهلاكية غير مصنفة.',
        textureDescriptionEn: 'Multi-layer composite snack pouches, soiled tissues, unsegregated consumer items.',
        opticalFeatures: 'تباين لوني واسع، غياب التجانس الهندسي أو البوليمري النقي.',
        opticalFeaturesEn: 'Heterogeneous color and shape, non-uniform composite structure.',
        properHandling: [
            'التأكد من عدم وجود مواد قابلة للتدوير المنفصل كالمعادن أو الزجاج النظيف.',
            'إحكام إغلاق الكيس لمنع تناثر المخلفات في الحرم الجامعي.',
            'إلقاؤها في حاوية المخلفات العامة أو سلة المهملات غير القابلة للتدوير.'
        ],
        properHandlingEn: [
            'Verify no recyclable items like clean cans or glass are mixed in.',
            'Seal tightly to prevent littering in campus open courtyards.',
            'Place into the general waste bin or non-recyclable campus container.'
        ],
        carbonSavingsGrams: 15,
        energySavings: 'فرز القمامة العامة يمنع تلوث شحنات التدوير المنفصلة بنسبة 100%.',
        energySavingsEn: 'Proper segregation prevents 100% of clean recyclable batch contamination.',
        waterSavingsLiters: 0.5,
        metricSource: 'Approximate estimates (EPA WARM / LCA)',
        metricSourceAr: 'تقديرات تقريبية مستندة إلى دراسات تقييم دورة الحياة (LCA)',
        rawMaterialSavings: 'تقليل حجم النفايات الموجهة للمدافن الصحية عبر العزل المبكر.',
        sustainabilityTip: 'تقليل استخدام المنتجات أحادية الاستعمال هو الحل الأمثل للحد من المخلفات المختلطة.',
        sustainabilityTipEn: 'Carrying reusable tumblers and cloth bags drastically reduces mixed campus waste.',
        keywords: [
            'قمامة', 'زبالة', 'مخلفات', 'مختلط', 'عام', 'trash', 'waste', 'مناديل', 'اكياس شيبسي'
        ],
        iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
    },
    {
        id: 'generic_plastic',
        name: 'بلاستيك وبوليمرات عامة',
        nameEn: 'General Plastic & Polymers',
        category: 'بلاستيك',
        categoryEn: 'Plastic',
        resinCode: null,
        resinName: null,
        binType: 'plastic',
        binColorName: 'الصفراء (بلاستيك وبوليمرات)',
        binColorNameEn: 'Yellow (Plastic & Polymers)',
        binColorHex: '#eab308',
        defaultConfidence: 94.0,
        textureDescription: 'بوليمرات صناعية مختلفة، مرنة أو صلبة، خفيفة الوزن مع مقاومة جيدة للتآكل.',
        textureDescriptionEn: 'Various industrial polymers, flexible or rigid, lightweight with good durability.',
        opticalFeatures: 'شفاف أو معتم أو ملون، ملمس أملس مع استجابة مرنة عند الضغط.',
        opticalFeaturesEn: 'Transparent, opaque, or colored, smooth finish with elastic response.',
        properHandling: [
            'تفريغ أي محتويات أو سوائل متبقية داخل العبوة البلاستيكية.',
            'ضغط العبوة باليد لطرد الهواء وتقليص حجمها لتوفير المساحة بالحاوية.',
            'إلقاؤها في الحاوية الصفراء المخصصة للمخلفات البلاستيكية.'
        ],
        properHandlingEn: [
            'Empty any residual liquids or contents completely.',
            'Crush the plastic item flat to expel air and save bin volume.',
            'Deposit into the designated yellow plastic recycling bin.'
        ],
        carbonSavingsGrams: 85,
        energySavings: 'توفير طاقة تعادل تشغيل مصباح موفر لمدة 6 ساعات لكل عبوة.',
        energySavingsEn: 'Saves enough energy to power an LED bulb for 6 hours per container.',
        waterSavingsLiters: 2.1,
        metricSource: 'Approximate estimates (EPA WARM / LCA)',
        metricSourceAr: 'تقديرات تقريبية مستندة إلى دراسات تقييم دورة الحياة (LCA)',
        rawMaterialSavings: 'توفير النفط الخام والغاز الطبيعي المستخدم في إنتاج البوليمرات البكر.',
        sustainabilityTip: 'إعادة تدوير البلاستيك تمنع تراكمه لمئات السنين في المكبات وتدعم الاقتصاد الدائري.',
        sustainabilityTipEn: 'Plastic recycling diverts non-biodegradable waste from landfills and supports the circular economy.',
        keywords: ['بلاستيك', 'بوليمر', 'plastic', 'علبة بلاستيك', 'مخلفات بلاستيكية', 'بلاستيك عام'],
        iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4v3h-4z"/><path d="M9 5h6l1 3v12a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8l1-3z"/><path d="M8 12h8"/><path d="M8 16h8"/></svg>`
    }
];

// قاعدة بيانات استرجاع المعلومات الموسعة (IR Expanded Catalog) للبحث الذكي السريع
const IR_EXPANDED_CATALOG = [
    ...WASTE_DATABASE,
    {
        id: 'plastic_bag',
        name: 'أكياس التسوق وأغلفة النايلون (LDPE)',
        nameEn: 'Plastic Shopping Bags & Wrap (LDPE)',
        category: 'بلاستيك مرن',
        categoryEn: 'Flexible Plastic',
        binType: 'plastic',
        binColorName: 'الصفراء (بلاستيك)',
        binColorNameEn: 'Yellow (Plastic)',
        binColorHex: '#eab308',
        defaultConfidence: 89.0,
        textureDescription: 'رقيق، فائق المرونة، يمتط بالشد، خفيف الوزن للغاية.',
        textureDescriptionEn: 'Thin, stretchable low-density polyethylene film, ultra lightweight.',
        properHandling: [
            'تفريغ الكيس تماماً من الإيصالات والمخلفات الغذائية.',
            'تجميعه مع أكياس مماثلة وضغطه لتقليل الحجم الهوائي.',
            'إلقاؤه في الحاوية الصفراء.'
        ],
        properHandlingEn: [
            'Empty paper receipts and any food scraps from the bag.',
            'Bundle multiple clean plastic bags together and compress.',
            'Deposit into the yellow plastic bin.'
        ],
        carbonSavingsGrams: 45,
        energySavings: 'منع تطاير البلاستيك في البيئة وحماية الحياة الفطرية ونظم الري بالدلتا.',
        energySavingsEn: 'Prevents environmental dispersion and protects agricultural waterways.',
        keywords: ['كيس', 'اكياس', 'شنطة', 'نايلون', 'سوبرماركت', 'بلاستيك خفيف', 'ldpe', 'غلاف']
    },
    {
        id: 'coffee_paper_cup',
        name: 'أكواب القهوة والمشروبات الورقية المبطنة',
        nameEn: 'Disposable Lined Paper Coffee Cups',
        category: 'مركب (ورق وبلاستيك)',
        categoryEn: 'Composite Paper Cup',
        binType: 'paper',
        binColorName: 'الزرقاء (الورق) بعد فصل الغطاء',
        binColorNameEn: 'Blue (Paper) after removing lid',
        binColorHex: '#2563eb',
        defaultConfidence: 91.0,
        textureDescription: 'ورق مقوى من الخارج مع طبقة بطانة بولي إيثيلين داخلية رقيقة عازلة للحرارة.',
        textureDescriptionEn: 'Outer paperboard lined with a thin internal polyethylene waterproof film.',
        properHandling: [
            'فصل الغطاء البلاستيكي الشفاف وإلقاؤه في حاوية البلاستيك.',
            'تفريغ أي مشروب متبق وشطف الكوب بخفة.',
            'إلقاء الكوب الورقي في الحاوية المخصصة للورق المعالج.'
        ],
        properHandlingEn: [
            'Separate the plastic lid and toss into the yellow plastic bin.',
            'Empty residual coffee or tea and rinse lightly.',
            'Place into the designated paper container.'
        ],
        carbonSavingsGrams: 55,
        energySavings: 'توفير استهلاك أشجار الغابات وتصنيع كراتين البيض من الألياف المعالجة.',
        energySavingsEn: 'Conserves forest timber and enables recycled fiber manufacturing.',
        waterSavingsLiters: 4.0,
        metricSource: 'Approximate estimates (EPA WARM / LCA)',
        metricSourceAr: 'تقديرات تقريبية مستندة إلى دراسات تقييم دورة الحياة (LCA)',
        keywords: ['كوب', 'قهوة', 'شاي', 'كاسات', 'ورقي', 'نسكافيه', 'كافيه', 'كوباية']
    }
];

window.WASTE_DATABASE = WASTE_DATABASE;
window.IR_EXPANDED_CATALOG = IR_EXPANDED_CATALOG;
