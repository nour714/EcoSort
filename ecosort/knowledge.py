# -*- coding: utf-8 -*-
"""
EcoSort Environmental Knowledge Base & Information Retrieval (IR)
"""

WASTE_KNOWLEDGE_BASE = {
    'cardboard': {
        'material': 'Cardboard',
        'material_name_ar': 'صندوق كرتون وأوراق تغليف',
        'material_name_en': 'Cardboard & Corrugated Box',
        'resin_code': '20 - PAP',
        'target_bin': 'paper',
        'bin_name_ar': 'الحاوية الزرقاء (ورق وكرتون)',
        'bin_name_en': 'Blue Bin (Paper & Cardboard)',
        'bin_color': '#2563eb',
        'co2_saved_grams': 140,
        'energy_saved': 'توفير 40% من الطاقة المستهلكة في صناعة الورق والكرتون الجديد.',
        'energy_saved_en': 'Saves 40% of energy required to manufacture virgin cardboard.',
        'water_saved_liters': 7.5,
        'guide': [
            'تفريغ الصندوق الكرتوني تماماً من أي شرائط لاصقة أو أكياس بلاستيكية داخلية.',
            'تفكيك الصندوق وطيه ليصبح مسطحاً لتوفير مساحة استيعابية داخل الحاوية.',
            'التأكد من جفاف الكرتون وعدم تلوثه بزيوت الأطعمة أو السوائل.',
            'إلقاؤه في الحاوية الزرقاء المخصصة للأوراق والكرتون.'
        ],
        'guide_en': [
            'Empty the box completely of any internal plastic wraps or tape.',
            'Flatten the box to maximize space utilization in the recycling bin.',
            'Ensure the cardboard is dry and free of greasy food residues.',
            'Deposit into the blue designated paper & cardboard bin.'
        ],
        'texture_description_ar': 'سطح ليفي مموج، بنية خلوية متعددة الطبقات، خفيف الوزن وقابل للطي.',
        'texture_description_en': 'Fibrous corrugated surface, multilayer structure, lightweight and foldable.'
    },
    'glass': {
        'material': 'Glass',
        'material_name_ar': 'زجاجات وعبوات زجاجية',
        'material_name_en': 'Glass Bottle / Container',
        'resin_code': '70 - GL',
        'target_bin': 'glass',
        'bin_name_ar': 'الحاوية الخضراء (زجاج)',
        'bin_name_en': 'Green Bin (Glass)',
        'bin_color': '#10b981',
        'co2_saved_grams': 110,
        'energy_saved': 'توفير 30% من طاقة أفران الصهر وتجنب انبعاثات غازات الاحتباس الحراري.',
        'energy_saved_en': 'Saves 30% furnace melting energy and cuts GHG emissions.',
        'water_saved_liters': 1.5,
        'guide': [
            'شطف العبوة الزجاجية سريعاً بالماء لإزالة أي بقايا سوائل أو مواد سكرية.',
            'نزع الأغطية المعدنية أو البلاستيكية وحفظها للحاويات المخصصة لها.',
            'عدم كسر الزجاج داخل الحاوية حرصاً على سلامة عمال النظافة والفرز.',
            'وضع العبوة بحرص داخل الحاوية الخضراء المخصصة للزجاج.'
        ],
        'guide_en': [
            'Rinse the glass bottle quickly to clear residue and sugars.',
            'Remove metallic or plastic caps and sort them separately.',
            'Do not break or shatter glass to protect maintenance workers.',
            'Carefully place into the green glass bin.'
        ],
        'texture_description_ar': 'سطح أملس شديد الصلابة، بارد الملمس، نفاذية ضوئية عالية ومقاومة للخدش.',
        'texture_description_en': 'Smooth, rigid, cool surface with high optical clarity and scratch resistance.'
    },
    'metal': {
        'material': 'Metal',
        'material_name_ar': 'علبة كانز ألومنيوم ومعادن',
        'material_name_en': 'Aluminum Can & Metals',
        'resin_code': '41 - ALU',
        'target_bin': 'metal',
        'bin_name_ar': 'الحاوية الرمادية/الزرقاء (معادن وكانز)',
        'bin_name_en': 'Metal & Cans Bin',
        'bin_color': '#64748b',
        'co2_saved_grams': 175,
        'energy_saved': 'توفير 95% من الطاقة الكهربائية الهائلة اللازمة لاستخلاص الألومنيوم الجديد!',
        'energy_saved_en': 'Saves 95% of electrical energy required for virgin bauxite smelting!',
        'water_saved_liters': 5.2,
        'guide': [
            'التأكد التام من تفريغ كافة السوائل والعصائر من داخل العلبة.',
            'شطف العلبة سريعاً لمنع جذب الحشرات وانبعاث الروائح في نقاط التجميع.',
            'سحق العلبة عمودياً أو أفقياً لتقليص حجمها بنسبة 80% وتسهيل النقل.',
            'ترك لسان الفتح (Tab) ملتصقاً بالعلبة ولا تفصله حتى لا يضيع أثناء الفرز.'
        ],
        'guide_en': [
            'Completely empty all liquid contents from the can.',
            'Rinse briefly to avoid insects and odor in collection points.',
            'Crush the can to reduce volume by 80% and optimize space.',
            'Keep opening tab attached to the can to prevent separation during magnetic sorting.'
        ],
        'texture_description_ar': 'معدني بارد، أسطواني رفيع، خفيف الوزن مع رنين صوتي مميز عند النقر.',
        'texture_description_en': 'Cold metallic finish, thin cylindrical wall, lightweight with resonant chime.'
    },
    'paper': {
        'material': 'Paper',
        'material_name_ar': 'أوراق ومطبوعات جامعية',
        'material_name_en': 'Paper, Notes & Documents',
        'resin_code': '22 - PAP',
        'target_bin': 'paper',
        'bin_name_ar': 'الحاوية الزرقاء (ورق ومستندات)',
        'bin_name_en': 'Blue Bin (Paper)',
        'bin_color': '#3b82f6',
        'co2_saved_grams': 60,
        'energy_saved': 'حماية الأشجار وتوفير 60% من المياه المستخدمة في صناعة لب الورق البكر.',
        'energy_saved_en': 'Preserves trees and cuts fresh pulp water consumption by 60%.',
        'water_saved_liters': 4.0,
        'guide': [
            'إزالة الدبابيس المعدنية أو المشابك البلاستيكية أو الأغلفة الحرارية.',
            'فرز الأوراق غير الممزقة وحفظها في مجموعات مستوية لسهولة الرزم.',
            'تجنب خلط الأوراق المتسخة ببقع الزيوت أو المشروبات مع الورق النظيف.',
            'إيداعها مباشرة في الحاوية الزرقاء المخصصة للورق.'
        ],
        'guide_en': [
            'Remove metallic staples, plastic binders, or thermal laminations.',
            'Stack flat sheets together to facilitate bailing and transport.',
            'Do not mix greasy food wrappers with clean document paper.',
            'Deposit neatly inside the blue paper recycling bin.'
        ],
        'texture_description_ar': 'ملمس ناعم ورقي، خفيف الوزن ومرن، أبيض أو مطبوع مع حواف حادة عند الثني.',
        'texture_description_en': 'Smooth flexible fibrous sheet, lightweight, white/printed with clean crease.'
    },
    'plastic': {
        'material': 'PET_Plastic',
        'material_name_ar': 'زجاجات وعبوات بلاستيك',
        'material_name_en': 'Plastic Bottle / Container',
        'resin_code': '01 - PET',
        'target_bin': 'plastic',
        'bin_name_ar': 'الحاوية الصفراء (بلاستيك)',
        'bin_name_en': 'Yellow Bin (Plastics)',
        'bin_color': '#eab308',
        'co2_saved_grams': 85,
        'energy_saved': 'توفير طاقة تعادل تشغيل مصباح موفر لمدة 6 ساعات لكل زجاجة.',
        'energy_saved_en': 'Saves enough energy to power an LED bulb for 6 hours per bottle.',
        'water_saved_liters': 2.1,
        'guide': [
            'تفريغ أي قطرات ماء أو مشروبات متبقية داخل الزجاجة تماماً.',
            'ضغط الزجاجة باليد لطرد الهواء وتقليص حجمها لتوفير المساحة بالحاوية.',
            'إعادة ربط الغطاء بإحكام حتى لا يفلت أثناء النقل وإعادة التدوير.',
            'إلقاء الزجاجة في الحاوية الصفراء المخصصة للمخلفات البلاستيكية.'
        ],
        'guide_en': [
            'Completely drain any residual liquids or beverages.',
            'Crush the bottle flat to expel air and save bin volume.',
            'Screw the plastic cap back on tightly so it stays with the bottle.',
            'Drop into the designated yellow plastic recycling bin.'
        ],
        'texture_description_ar': 'بلاستيك شفاف أو شبه شفاف، مرن نسبيًا، ملمس أملس مع لمعان خفيف وصوت طقطقة عند الضغط.',
        'texture_description_en': 'Transparent or semi-translucent polymer, smooth finish with elastic deformation.'
    },
    'trash': {
        'material': 'General_Trash',
        'material_name_ar': 'مخلفات عامة / غير قابلة للتدوير المباشر',
        'material_name_en': 'Non-Recyclable General Waste',
        'resin_code': '07 - OTHER',
        'target_bin': 'trash',
        'bin_name_ar': 'الحاوية السوداء/الرمادية (مخلفات عامة)',
        'bin_name_en': 'Black/Grey Bin (General Trash)',
        'bin_color': '#475569',
        'co2_saved_grams': 15,
        'energy_saved': 'تحويل المخلفات للمدفن الصحي الآمن لمنع انبعاث غاز الميثان في الجو.',
        'energy_saved_en': 'Diverts non-recyclables to controlled sanitary containment.',
        'water_saved_liters': 0.5,
        'guide': [
            'وضع المخلفات داخل كيس محكم الإغلاق قبل رميها.',
            'التأكد من خلوها من أي بطاريات تالفة أو مخلفات كيميائية أو إلكترونية خطرة.',
            'إلقاؤها في حاوية المخلفات العامة غير القابلة للتدوير.'
        ],
        'guide_en': [
            'Seal waste tightly inside a trash bag.',
            'Ensure no dead batteries, electronics, or hazardous chemicals are enclosed.',
            'Dispose in the grey/black general waste bin.'
        ],
        'texture_description_ar': 'مخلفات غير متجانسة مركبة أو رطبة غير صالحة للتدوير الميكانيكي المباشر.',
        'texture_description_en': 'Heterogeneous composite or contaminated refuse unsuitable for direct recycling.'
    }
}
