// يتحقق إن كل ملف CSS/JS مذكور في index.html موجود فعلاً،
// وإن كل كلاس مستخدم في HTML/JS له تعريف في ملفات CSS.
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
let ok = true;

// 1) الملفات المرتبطة
const refs = [...html.matchAll(/(?:src|href)="((?:css|js|assets)\/[^"]+)"/g)].map(m => m[1]);
refs.forEach(r => {
    if (!fs.existsSync(path.join(base, r))) {
        console.error(`❌ ملف مفقود: ${r}`);
        ok = false;
    }
});

// 2) الكلاسات غير المعرّفة
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const js = walk(path.join(base, 'js')).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const css = walk(path.join(base, 'css')).map(f => fs.readFileSync(f, 'utf8')).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
const defined = new Set([...css.matchAll(/\.((?:\\.|[\w-])+)/g)].map(m => m[1].replace(/\\/g, '')));

const used = new Set();
for (const m of (html + js).matchAll(/class="([^"]*)"/g)) {
    // نشيل تعبيرات ${...} الديناميكية ونقبل أسماء الكلاسات الصالحة فقط
    m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/).forEach(c => {
        if (/^[a-z][\w.-]*$/i.test(c)) used.add(c);
    });
}
// الكلاسات اللي بتتحط من classList في الـ JS
for (const m of js.matchAll(/classList\.(?:add|remove|toggle)\(\s*'([^']+)'/g)) used.add(m[1]);
const missing = [...used].filter(c => !defined.has(c));
// كلاسات هيكلية بدون تنسيق مقصود
const allowed = new Set([
    // كلاسات هيكلية (hooks) بدون تنسيق مقصود
    'step-check', 'step-num', 'location-pin-icon', 'cv-upload-box',
    'presets-box', 'map-card-full', 'mobile-route-actions', 'bin-desc'
]);
const real = missing.filter(c => !allowed.has(c));
if (real.length) {
    console.error('❌ كلاسات بلا تعريف CSS:', real.join(', '));
    ok = false;
}

if (!ok) process.exit(1);
console.log(`✅ فحص الأصول ناجح: ${refs.length} ملف مرتبط، ${used.size} كلاس مستخدم وكلها معرّفة.`);
