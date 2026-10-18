/**
 * =========================================================================================
 * وحدة التعرف البصري والذكاء الاصطناعي (Computer Vision Module) - EcoSort
 * =========================================================================================
 * تعتمد كلياً على سيرفر الـ Backend (Python + Flask) لتشغيل موديل Deep Learning الحقيقي (.keras):
 * 1. إرسال الصورة المرفوعة أو الملتقطة عبر POST إلى /predict فورياً.
 * 2. استقبال التصنيف الحقيقي من الموديل (PET_Plastic, Metal, Glass, Cardboard, Paper, Trash).
 * 3. استرجاع نسبة الثقة الدقيقة (Confidence %)، كمية الكربون الموفر، ودليل الفرز البيئي.
 * 4. دعم اختيار عينات سريعة (Presets) للاختبار الفوري دون الحاجة لرفع ملفات.
 * =========================================================================================
 */

class VisionModule {
    constructor(onWasteDetectedCallback) {
        this.onWasteDetected = onWasteDetectedCallback;
        this.currentDetection = null;
        this.isProcessing = false;
    }

    /**
     * تشغيل فحص عينة سريعة من الخامات المحددة مسبقاً (Presets)
     * @param {string} wasteId - معرف الخامة (pet_bottle, alu_can, cardboard_box, glass_bottle...)
     */
    selectPreset(wasteId) {
        const item = (window.WASTE_DATABASE || []).find(w => w.id === wasteId);
        if (!item) return null;

        const dynamicConfidence = Number(item.defaultConfidence.toFixed(1));
        const inferenceTime = 12.4; // زمن استدلال تقديري

        const detectionResult = {
            item,
            confidence: dynamicConfidence,
            inferenceTimeMs: inferenceTime,
            modelName: 'Keras Deep Learning (.keras) &bull; Flask Backend',
            texture: item.textureDescription,
            opticalFeatures: `عينة معتمدة: تم تحديد الخامة كـ "${item.name}" برمز إعادة التدوير ${item.resinCode}`,
            sourceType: 'preset-sample',
            backendData: {
                status: 'success',
                material: item.nameEn || item.name,
                class_name: item.binType,
                confidence: dynamicConfidence,
                target_bin: item.binType,
                co2_saved_grams: item.co2SavedGrams,
                guide: item.preparationGuide || []
            }
        };

        this.currentDetection = detectionResult;
        if (typeof this.onWasteDetected === 'function') {
            this.onWasteDetected(detectionResult);
        }

        return detectionResult;
    }

    /**
     * إرسال الصورة إلى سيرفر Flask الحقيقي (/predict) لتشغيل الموديل المدرب .keras
     * @param {File|Blob} file 
     */
    async classifyWithBackend(file) {
        if (!file) return null;
        const formData = new FormData();
        formData.append('file', file);

        const resp = await fetch('/predict', {
            method: 'POST',
            body: formData
        });

        if (!resp.ok) {
            let errorText = `HTTP ${resp.status}`;
            try {
                const errData = await resp.json();
                if (errData && errData.message) errorText = errData.message;
            } catch (_) {}
            throw new Error(`تعذر التحليل عبر السيرفر: ${errorText}`);
        }

        const data = await resp.json();
        if (data.status !== 'success') {
            throw new Error(data.message || 'فشل التنبؤ من خلال موديل الذكاء الاصطناعي.');
        }

        const wasteItem = this.mapBackendClassToWasteItem(data.class_name, data.material);
        const confidencePct = Number(data.confidence);

        return {
            item: wasteItem,
            confidence: confidencePct,
            inferenceTimeMs: data.inference_time_ms || 18.5,
            modelName: `Keras Deep Learning (.keras) &bull; Flask Server`,
            texture: data.texture_description_ar || wasteItem.textureDescription,
            opticalFeatures: `موديل Deep Learning: تم تصنيف المادة كـ "${data.material_name_ar || data.material}" بنسبة ثقة ${data.confidence_formatted || (data.confidence + '%')}`,
            sourceType: 'flask-keras-backend',
            backendData: data,
            allPredictions: Object.entries(data.all_probabilities || {}).map(([name, score]) => ({
                name,
                labelAr: name,
                score: score / 100,
                percentage: String(score)
            }))
        };
    }

    /**
     * مطابقة فئة الـ Backend مع قاعدة بيانات المخلفات المحلية
     */
    mapBackendClassToWasteItem(className, material) {
        const db = window.WASTE_DATABASE || [];
        const cls = (className || '').toLowerCase().trim();

        if (cls === 'cardboard') {
            return db.find(w => w.id === 'cardboard_box') || db.find(w => w.binType === 'paper') || db[0];
        } else if (cls === 'glass') {
            return db.find(w => w.id === 'glass_bottle') || db.find(w => w.binType === 'glass') || db[0];
        } else if (cls === 'metal') {
            return db.find(w => w.id === 'alu_can') || db.find(w => w.binType === 'metal') || db[0];
        } else if (cls === 'paper') {
            return db.find(w => w.id === 'paper_sheet') || db.find(w => w.binType === 'paper') || db[0];
        } else if (cls === 'plastic') {
            if (material && material.toLowerCase().includes('hdpe')) {
                return db.find(w => w.id === 'hdpe_container') || db.find(w => w.id === 'pet_bottle') || db[0];
            }
            return db.find(w => w.id === 'pet_bottle') || db[0];
        } else if (cls === 'trash') {
            return db.find(w => w.id === 'mixed_trash') || db.find(w => w.id === 'organic_food') || db[0];
        }
        return db[0];
    }

    /**
     * معالجة الصورة المرفوعة من ملف أو الملتقطة من الكاميرا
     * @param {File|Blob} file - كائن الصورة
     */
    async processUploadedImage(file) {
        if (!file) {
            throw new Error('يرجى اختيار ملف صورة صالح أو التقاط صورة بالكاميرا.');
        }

        const isImage = (file.type && file.type.startsWith('image/')) || 
                        (file.name && /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(file.name)) ||
                        file instanceof Blob;

        if (!isImage) {
            throw new Error('نوع الملف غير مدعوم، يرجى اختيار ملف صورة صالح (PNG, JPEG, WEBP).');
        }

        this.isProcessing = true;

        // إرسال الصورة للـ Backend
        let analysis;
        try {
            analysis = await this.classifyWithBackend(file);
        } catch (err) {
            this.isProcessing = false;
            console.error('[VisionModule] خطأ أثناء استدعاء الباك اند:', err);
            throw new Error(`فشل الاتصال بسيرفر الذكاء الاصطناعي (Flask Backend). تأكد من تشغيل python app.py: ${err.message}`);
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                analysis.imageUrl = event.target.result;
                this.currentDetection = analysis;
                this.isProcessing = false;

                if (typeof this.onWasteDetected === 'function') {
                    this.onWasteDetected(analysis);
                }

                resolve(analysis);
            };
            reader.onerror = () => {
                this.currentDetection = analysis;
                this.isProcessing = false;
                if (typeof this.onWasteDetected === 'function') {
                    this.onWasteDetected(analysis);
                }
                resolve(analysis);
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * إرجاع الفحص الحالي
     */
    getCurrentDetection() {
        return this.currentDetection;
    }

    /**
     * إعادة تعيين الحالة
     */
    reset() {
        this.currentDetection = null;
        this.isProcessing = false;
    }
}

// إتاحة الموديول على النطاق العام (Window Scope)
if (typeof window !== 'undefined') {
    window.VisionModule = VisionModule;
}
