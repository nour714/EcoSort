# 🧠 EcoSort — خط أنابيب تدريب موديل الذكاء الاصطناعي (Transfer Learning)

يوفر هذا المجلد خط أنابيب كامل وقابل لإعادة الإنتاج لتدريب نماذج تصنيف المخلفات باستخدام **التعلم الانتقالي (Transfer Learning)** ونماذج الرؤية الحاسوبية الحديثة (**MobileNetV2** و **EfficientNetB0**).

---

## 🎯 الميزات التقنية لموديل التدريب

1. **طبقة تطبيع مدمجة (Self-Contained Preprocessing)**:
   - يتضمن الموديل طبقة `Rescaling` مدمجة داخلياً تحول الإدخال من نطاق `[0, 255]` إلى `[-1, 1]` لـ MobileNetV2.
   - هذا يضمن تشغيل الموديل في أي بيئة إنتاجية (Backend أو Edge أو Browser) دون الاعتماد على كود تطبيع خارجي.

2. **تعزيز البيانات أثناء التدريب (Data Augmentation)**:
   - `RandomFlip`: تقليب أفقي ورأسي لمحاكاة زوايا الالتقاط المختلفة.
   - `RandomRotation`: تدوير عشوائي بنسبة ±15%.
   - `RandomZoom`: تكبير وتصغير عشوائي بنسبة ±15%.
   - `RandomContrast`: تغيير التباين الضوئي لمحاكاة ظروف الإضاءة الواقعية بالحرم الجامعي.

3. **تدريب على مرحلتين (Two-Stage Training)**:
   - **المرحلة 1 (Feature Extraction)**: تجميد أوزان الشبكة الأساسية (Frozen Backbone) وتدريب رأس التصنيف فقط (Dense Layers + Dropout) بمعدل تعلم `1e-3`.
   - **المرحلة 2 (Fine-Tuning)**: إلغاء تجميد آخر 30 طبقة من الشبكة الأساسية وتدريبها بمعدل تعلم منخفض جداً `1e-5` لضبط الخصائص الدقيقة للمخلفات.

4. **معالجة عدم توازن الفئات (Class Weighting)**:
   - حساب أوتوماتيكي لأوزان الفئات عبر `compute_class_weight` لمعادلة الفئات ذات العينات الأقل مثل (Trash) مقارنة بالفئات الأكبر.

5. **تقسيم صارم للبيانات (Data Splits)**:
   - **70%** للتدريب (Training).
   - **15%** للتحقق وضبط الـ Hyperparameters (Validation).
   - **15%** للاختبار النهائي المستقل (Holdout Test Split).

---

## 📥 تجهيز البيانات (TrashNet Dataset)

قم بتنزيل مجموعة بيانات TrashNet من الرابط المعتمد:
```bash
# قم بفك الضغط داخل مجلد data/ بحيث يكون الهيكل كالتالي:
data/
└── dataset-resized/
    ├── cardboard/
    ├── glass/
    ├── metal/
    ├── paper/
    ├── plastic/
    └── trash/
```

---

## 🚀 تشغيل التدريب

### 1. تدريب موديل MobileNetV2 (الموصى به للإنتاج وخفة الوزن)
```bash
python training/train_transfer.py \
    --data-dir data/dataset-resized \
    --model-type mobilenetv2 \
    --epochs-stage1 15 \
    --epochs-stage2 15 \
    --batch-size 32 \
    --output-dir training/output
```

### 2. تدريب موديل EfficientNetB0 (دقة أعلى)
```bash
python training/train_transfer.py \
    --data-dir data/dataset-resized \
    --model-type efficientnetb0 \
    --epochs-stage1 15 \
    --epochs-stage2 15 \
    --batch-size 32 \
    --output-dir training/output_effnet
```

---

## 📦 المخرجات والدمج بالـ Backend

عند اكتمال التدريب، سيتم إنشاء الملفات التالية في مجلد `--output-dir`:
1. `model.keras`: ملف الموديل النهائي المدرب والمختبر.
2. `labels.json`: قائمة الفئات الست مرتبة.
3. `test_evaluation.json`: تقرير الأداء الشامل (Accuracy, F1-Score, Confusion Matrix) على بيانات الاختبار المستقلة.

### لنقل الموديل الجديد إلى سيرفر Flask:
```bash
cp training/output/model.keras ./model.keras
```
ثم أعد تشغيل السيرفر:
```bash
python app.py
```
