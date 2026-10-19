/**
 * =========================================================================================
 * وحدة التعرف البصري والذكاء الاصطناعي (Computer Vision Module) - EcoSort
 * =========================================================================================
 * تعتمد كلياً على سيرفر الـ Backend (Python + Flask) لتشغيل موديل Deep Learning الحقيقي (.keras):
 * 1. تصغير الصورة على جهة العميل (Client-Side Downscale <= 1024px) لتسريع الرفع وتقليل استهلاك الذاكرة.
 * 2. احترام اتجاه EXIF الأصلي من كاميرات الموبايل عبر createImageBitmap / Canvas.
 * 3. إرسال الصورة المرفوعة أو الملتقطة عبر POST إلى /predict فورياً.
 * 4. استقبال التصنيف الحقيقي وهامش الثقة (Confidence Gating: confident / uncertain / rejected).
 * 5. استرجاع أعلى 3 احتمالات بديلة (Top-3) مع نسبها المئوية.
 * 6. فحص تحذيرات جودة الصورة (غبشة، إضاءة منخفضة، سطوع زائد).
 * 7. دعم اختيار عينات سريعة (Presets) للاختبار الفوري مع توضيح صريح أنها عينات مرجعية (Demo).
 * =========================================================================================
 */

class VisionModule {
    constructor(onWasteDetectedCallback) {
        this.onWasteDetected = onWasteDetectedCallback;
        this.currentDetection = null;
        this.isProcessing = false;
    }

    /**
     * تصغير وضبط الصورة على جهة العميل قبل الرفع لتسريع النقل وتجنب استهلاك الذاكرة
     * مع احترام توجيه EXIF
     * @param {File|Blob} file 
     * @param {number} maxDimension 
     * @param {number} quality 
     * @returns {Promise<File|Blob>}
     */
    async downscaleImage(file, maxDimension = 1024, quality = 0.90) {
        if (!file || !(file instanceof Blob)) return file;

        // إذا كان الملف صغير الحجم بالفعل (< 150KB)، لا داعي لإعادة ضغطه
        if (file.size && file.size < 150 * 1024) {
            return file;
        }

        try {
            let bitmap = null;
            if (typeof createImageBitmap === 'function') {
                try {
                    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
                } catch (_) {
                    bitmap = await createImageBitmap(file);
                }
            }

            if (bitmap) {
                let { width, height } = bitmap;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bitmap, 0, 0, width, height);
                if (typeof bitmap.close === 'function') {
                    bitmap.close();
                }

                return await new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const originalName = file.name || 'capture.jpg';
                            const newName = originalName.replace(/\.[^.]+$/, '') + '.jpg';
                            resolve(new File([blob], newName, { type: 'image/jpeg' }));
                        } else {
                            resolve(file);
                        }
                    }, 'image/jpeg', quality);
                });
            }
        } catch (err) {
            console.warn('[VisionModule] تعذّر تصغير الصورة على جهة العميل، سيتم إرسال الملف الأصلي:', err);
        }

        return file;
    }

    /**
     * تشغيل فحص عينة سريعة من الخامات المحددة مسبقاً (Presets / Manual Selection)
     * ملاحظة أكاديمية: لا يتم فبركة نسبة ثقة أو زمن استدلال؛ يتم التوضيح أنها عينة مرجعية معتمدة.
     * @param {string} wasteId - معرف الخامة (pet_bottle, alu_can, cardboard_box, glass_bottle...)
     */
    selectPreset(wasteId) {
        const item = (window.WASTE_DATABASE || []).find(w => w.id === wasteId);
        if (!item) return null;

        const detectionResult = {
            item,
            isPreset: true,
            confidence: null,
            confidenceText: 'عينة مرجعية معتمدة (Demo)',
            confidenceTextEn: 'Verified Reference Preset (Demo)',
            inferenceTimeMs: null,
            modelName: 'اختيار يدوي / عينة تجريبية (Manual Preset)',
            texture: item.textureDescription,
            opticalFeatures: `عينة تجريبية موثقة: تم اختيار الخامة كـ "${item.name}" برمز إعادة التدوير ${item.resinCode}`,
            sourceType: 'preset-sample',
            decision: 'confident',
            qualityWarnings: [],
            topK: [],
            backendData: {
                status: 'success',
                material: item.nameEn || item.name,
                class_name: item.binType,
                confidence: null,
                decision: 'confident',
                target_bin: item.binType,
                co2_saved_grams: item.carbonSavingsGrams || 85,
                guide: item.properHandling || []
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

        // Ensure client upload stays strictly under ~4 MB: always downscale when > 3 MB
        if (file.size && file.size > 3 * 1024 * 1024) {
            try {
                file = await this.downscaleImage(file, 1024, 0.85);
                if (file.size && file.size > 3 * 1024 * 1024) {
                    file = await this.downscaleImage(file, 800, 0.75);
                }
            } catch (err) {
                console.warn('[VisionModule] Downscale before upload failed:', err);
            }
        }

        const formData = new FormData();
        formData.append('file', file);

        const fetchOptions = {
            method: 'POST',
            body: formData
        };

        const isLocalDev = typeof window !== 'undefined' && 
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:');

        const candidates = [];
        if (typeof window !== 'undefined' && window.ECOSORT_API_URL) {
            candidates.push(window.ECOSORT_API_URL);
        }
        candidates.push('/predict', '/api/predict', '/api/index.py', '/api');

        // If developing locally on a static server (e.g. Live Server on 5500), also probe running Flask server
        if (isLocalDev && typeof window !== 'undefined' && window.location.port !== '5000') {
            candidates.push('http://127.0.0.1:5000/predict', 'http://localhost:5000/predict');
        }

        let resp = null;

        for (const candidateUrl of candidates) {
            try {
                resp = await fetch(candidateUrl, fetchOptions);
                // If OK or a real application response (400 bad image, 413 too large, 429 rate limited, 503 model degraded), accept it
                if (resp.ok || resp.status === 400 || resp.status === 413 || resp.status === 429 || resp.status === 503) {
                    break;
                }
            } catch (_) {}
        }

        if (!resp) {
            throw new Error('تعذر الاتصال بالخادم. يرجى التأكد من تشغيل الخادم والاتصال بالشبكة.');
        }

        if (!resp.ok) {
            let errorText = `HTTP ${resp.status}`;
            if (resp.status === 413) {
                errorText = 'حجم الصورة المرفوعة كبير جداً (تجاوز الحد الأقصى 4 ميجابايت). يرجى اختيار صورة أصغر.';
            } else if (resp.status === 429) {
                errorText = 'تم تجاوز معدل الطلبات المسموح به. يرجى الانتظار قليلاً ثم إعادة المحاولة.';
            } else if (resp.status === 405) {
                errorText = 'طريقة الطلب غير مسموح بها (HTTP 405). يرجى التحقق من إعدادات Vercel أو تعطيل Deployment Protection.';
            } else {
                try {
                    const errData = await resp.json();
                    if (errData && errData.message) errorText = errData.message;
                } catch (_) {
                    // Gracefully handle non-JSON error responses (e.g. HTML 413 from reverse proxy)
                    try {
                        const rawText = await resp.text();
                        if (rawText && rawText.length < 200 && !rawText.includes('<html')) {
                            errorText = rawText;
                        }
                    } catch (_) {}
                }
            }
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
            isPreset: false,
            confidence: confidencePct,
            decision: data.decision || 'confident', // 'confident' | 'uncertain' | 'rejected'
            margin: data.margin != null ? Number(data.margin) : null,
            qualityWarnings: data.quality_warnings || [],
            topK: (data.top_k || []).map(k => {
                const mappedItem = this.mapBackendClassToWasteItem(k.class_name);
                return {
                    className: k.class_name,
                    materialId: mappedItem ? mappedItem.id : null,
                    materialNameAr: k.material_name_ar || (mappedItem ? mappedItem.name : k.class_name),
                    materialNameEn: k.material_name_en || (mappedItem ? mappedItem.nameEn : k.class_name),
                    confidence: Number(k.confidence),
                    confidenceFormatted: k.confidence_formatted || `${k.confidence}%`
                };
            }),
            inferenceTimeMs: data.inference_time_ms != null ? Number(data.inference_time_ms) : null,
            modelName: data.model_version || (data.backendData && data.backendData.model_version) || 'EcoSort Model',
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
                return db.find(w => w.id === 'hdpe_container') || db[0];
            }
            if (material && material.toLowerCase().includes('pet')) {
                return db.find(w => w.id === 'pet_bottle') || db[0];
            }
            return db.find(w => w.id === 'generic_plastic') || db.find(w => w.binType === 'plastic') || db[0];
        } else if (cls === 'trash') {
            return db.find(w => w.id === 'mixed_trash') || db.find(w => w.binType === 'trash') || db[0];
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

        // 1. تصغير الصورة على جهة العميل لتسريع الرفع واحترام توجيه EXIF
        const preparedFile = await this.downscaleImage(file, 1024, 0.90);

        // 2. إرسال الصورة للـ Backend
        let analysis;
        try {
            analysis = await this.classifyWithBackend(preparedFile);
        } catch (err) {
            this.isProcessing = false;
            console.error('[VisionModule] خطأ أثناء استدعاء الباك اند:', err);
            throw new Error(err.message || 'تعذر الاتصال بخدمة الذكاء الاصطناعي. يرجى التأكد من اتصال الإنترنت والمحاولة لاحقاً.');
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
            reader.readAsDataURL(preparedFile);
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
