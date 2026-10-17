const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

// استخراج كافة المعرفات (IDs) من ملف index.html
const idMatches = [...html.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]);
const htmlIds = new Set(idMatches);

const jsFiles = [
    path.join(baseDir, 'js/app.js'),
    path.join(baseDir, 'js/modules/evaluation-ui.js'),
    path.join(baseDir, 'js/modules/vision-module.js'),
    path.join(baseDir, 'js/modules/graph-canvas.js')
];

let allGood = true;
let totalChecked = 0;

jsFiles.forEach(file => {
    if (!fs.existsSync(file)) return;
    const code = fs.readFileSync(file, 'utf8');
    const getElemMatches = [...code.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map(m => m[1]);
    getElemMatches.forEach(id => {
        totalChecked++;
        if (!htmlIds.has(id)) {
            console.error(`❌ خطأ في ${path.basename(file)}: المعرف "${id}" غير موجود في index.html!`);
            allGood = false;
        }
    });
});

if (allGood) {
    console.log(`✅ فحص DOM ناجح بنسبة 100%: تم التحقق من ${totalChecked} استدعاء getElementById وتطابقها التام!`);
} else {
    process.exit(1);
}
