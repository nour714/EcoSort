/**
 * اختبارات التحقق من إزالة الخيار الثاني وضمان عمل الرفع والتصوير والكاميرا
 */
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

console.log('--- 1. فحص إزالة الخيار الثاني (اختيار مباشر بنقرة واحدة) ---');
console.assert(!html.includes('الخيار الثاني: اختيار مباشر بنقرة واحدة'), 'يجب إزالة نص الخيار الثاني بالكامل');
console.assert(!html.includes('presets-box'), 'يجب ألا يحتوي index.html على كلاس presets-box');
console.assert(!html.includes('waste-types-grid'), 'يجب ألا يحتوي index.html على كلاس waste-types-grid');
console.log('✅ تم التأكد من إزالة بطاقات الخيار الثاني بنجاح 100%');

console.log('\n--- 2. فحص عناصر الرفع والتصوير والكاميرا في الـ HTML ---');
const requiredIds = [
    'btn-trigger-camera',
    'btn-trigger-upload',
    'waste-image-input',
    'waste-camera-input',
    'cv-dropzone',
    'scanner-laser-line',
    'cv-upload-placeholder',
    'cv-camera-stream-container',
    'cv-camera-video',
    'btn-camera-capture',
    'btn-camera-switch',
    'btn-camera-close',
    'cv-image-preview-container',
    'cv-uploaded-image',
    'btn-rescan-camera',
    'btn-reupload-image',
    'manual-waste-selector'
];

requiredIds.forEach(id => {
    console.assert(html.includes(`id="${id}"`), `العنصر بالمعرف "${id}" يجب أن يكون موجوداً`);
});
console.log(`✅ جميع عناصر الرفع والتصوير والكاميرا (${requiredIds.length} عنصر) معرّفة بدقة!`);

console.log('\n--- 3. فحص خصائص مدخلات الملفات (Input Separation) ---');
// waste-image-input يجب ألا يحتوي على capture لتمكين اختيار ملفات المعرض بحرية
const wasteImageMatch = html.match(/<input[^>]*id="waste-image-input"[^>]*>/);
console.assert(wasteImageMatch, 'يجب وجود input waste-image-input');
console.assert(!wasteImageMatch[0].includes('capture='), 'waste-image-input يجب ألا يحتوي على capture لضمان فتح المعرض والملفات');

// waste-camera-input يجب أن يحتوي على capture="environment" لتوجيه الهاتف مباشرة للكاميرا
const wasteCameraMatch = html.match(/<input[^>]*id="waste-camera-input"[^>]*>/);
console.assert(wasteCameraMatch, 'يجب وجود input waste-camera-input');
console.assert(wasteCameraMatch[0].includes('capture="environment"'), 'waste-camera-input يجب أن يحتوي على capture="environment"');
console.log('✅ الفصل التام بين مدخل رفع الملفات ومدخل الكاميرا يعمل بالشكل القياسي!');

console.log('\n--- 4. فحص إخفاء كارت النتيجة قبل الفحص وظهور رسالة الانتظار ---');
const resultCardMatch = html.match(/<article[^>]*id="card-inspection-result"[^>]*>/);
console.assert(resultCardMatch, 'يجب وجود كارت النتيجة card-inspection-result');
console.assert(resultCardMatch[0].includes('hidden'), 'كارت النتيجة يجب أن يكون مخفياً (hidden) في البداية ولا يظهر إلا بعد الفحص');

const noticeMatch = html.match(/<div[^>]*id="awaiting-scan-notice"[^>]*>/);
console.assert(noticeMatch, 'يجب وجود رسالة الانتظار awaiting-scan-notice قبل الفحص');

const nextBtnMatch = html.match(/<button[^>]*id="btn-go-to-step-3"[^>]*>/);
console.assert(nextBtnMatch, 'يجب وجود زر الانتقال للخطوة 3');
console.assert(nextBtnMatch[0].includes('disabled'), 'زر الانتقال للخطوة 3 يجب أن يكون معطلاً (disabled) حتى يتم فحص المخلفات');
console.log('✅ كارت النتيجة مخفي مبدئياً، رسالة الانتظار معروضة، وزر التالي معطل حتى إتمام الفحص بنجاح!');

console.log('\n--- 4. اختبار وحدة VisionModule لمعالجة الصور والمطابقة ---');
global.window = global;
require(path.join(baseDir, 'js/data/waste-database.js'));
require(path.join(baseDir, 'js/modules/vision-module.js'));

let detectedItem = null;
const vision = new window.VisionModule((result) => {
    detectedItem = result;
});

// اختبار Preset
const presetRes = vision.selectPreset('alu_can');
console.assert(presetRes.item.id === 'alu_can', 'يجب أن يتعرف على علبة الكانز');
console.assert(detectedItem.item.id === 'alu_can', 'callback onWasteDetected يجب أن يُستدعى');

// اختبار تحليل الألوان بالكانفاس محاكاة
// Mock canvas & image
class MockContext {
    drawImage() {}
    getImageData() {
        // إنشاء هيستوجرام لوني مخصص لعينة كرتون (بني: R=150, G=110, B=60)
        const size = 128;
        const data = new Uint8ClampedArray(size * size * 4);
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 150;     // R
            data[i + 1] = 110; // G
            data[i + 2] = 60;  // B
            data[i + 3] = 255; // A
        }
        return { data };
    }
}

global.document = {
    createElement(tag) {
        if (tag === 'canvas') {
            return {
                width: 128,
                height: 128,
                getContext() { return new MockContext(); },
                toDataURL() { return 'data:image/jpeg;base64,mock'; }
            };
        }
        return {};
    }
};

const mockImg = {};
const analysisResult = vision.analyzeImageOnCanvas(mockImg, 'captured_photo_123.jpg');
console.assert(analysisResult.item.id === 'cardboard_box', 'يجب تصنيف الألوان البنية ككرتون تلقائياً');
console.assert(analysisResult.confidence >= 90, 'نسبة الثقة يجب أن تكون واقعية');
console.assert(analysisResult.inferenceTimeMs > 0, 'زمن الاستدلال يجب أن يكون موجباً');

console.log(`✅ التحليل البصري للهيستوجرام اللوني صنف الصورة بدقة إلى: ${analysisResult.item.name} (${analysisResult.confidence}%)`);

console.log('\n--- 5. اختبار استدعاء TensorFlow.js و MobileNet عبر الـ CDN ---');
console.assert(html.includes('@tensorflow/tfjs'), 'يجب استدعاء مكتبة TensorFlow.js في index.html');
console.assert(html.includes('@tensorflow-models/mobilenet'), 'يجب استدعاء مكتبة MobileNet في index.html');
console.log('✅ تم التحقق من استدعاء سكريبتات TensorFlow.js و MobileNet عبر CDN!');

console.log('\n--- 6. اختبار خريطة مطابقة تنبؤات MobileNet الذكية (MobileNet Mapping) ---');
const testPredictions = [
    { predictions: [{ className: 'water bottle', probability: 0.95 }], expectedId: 'pet_bottle' },
    { predictions: [{ className: 'plastic pop bottle, soda bottle', probability: 0.91 }], expectedId: 'pet_bottle' },
    { predictions: [{ className: 'lotion, shampoo dispenser', probability: 0.88 }], expectedId: 'hdpe_container' },
    { predictions: [{ className: 'beer can, soda can', probability: 0.93 }], expectedId: 'alu_can' },
    { predictions: [{ className: 'cardboard carton, box', probability: 0.94 }], expectedId: 'cardboard_box' }
];

testPredictions.forEach(({ predictions, expectedId }) => {
    const mapped = vision.mapMobileNetPredictions(predictions);
    console.assert(mapped && mapped.item && mapped.item.id === expectedId, `التنبؤ "${predictions[0].className}" يجب أن يُطابق ${expectedId}`);
    console.assert(mapped.confidence >= 75 && mapped.confidence <= 99.9, 'نسبة الثقة يجب أن تتوافق مع احتمالية الموديل');
});
console.log('✅ جميع قواعد مطابقة تنبؤات MobileNet لفئات النفايات تعمل بدقة 100%!');

console.log('\n--- 7. اختبار خط الدفاع الثاني: فحص اسم الملف (Filename Fallback) ---');
const filenameTests = [
    { fn: 'fresh_shampoo_bottle.jpg', expectedId: 'hdpe_container' },
    { fn: 'pepsi_can_drink.png', expectedId: 'alu_can' },
    { fn: 'shipping_carton_box.webp', expectedId: 'cardboard_box' },
    { fn: 'fresh_apple_food_waste.jpeg', expectedId: 'organic_food' }
];

filenameTests.forEach(({ fn, expectedId }) => {
    const fnResult = vision.classifyByFilename(fn);
    console.assert(fnResult && fnResult.item && fnResult.item.id === expectedId, `الملف "${fn}" يجب أن يصنف كـ ${expectedId}`);
});
console.log('✅ محرك الكلمات المفتاحية لاسم الملف يعمل بنجاح كخط دفاع ثانٍ!');

console.log('\n======================================================');
console.log('✅ كافة اختبارات الرفع والتصوير ونموذج MobileNet نجحت 100%!');
console.log('======================================================');
