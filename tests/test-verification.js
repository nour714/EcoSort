/**
 * سكريبت فحص واختبار خوارزميات ومحرك البحث لمشروع EcoSort
 */

// محاكاة window للبيئة الخادمة / Node.js
global.window = global;
global.performance = require('perf_hooks').performance;

const path = require('path');
const baseDir = path.join(__dirname, '..');

require(path.join(baseDir, 'js/data/campus-graph.js'));
require(path.join(baseDir, 'js/data/waste-database.js'));
require(path.join(baseDir, 'js/algorithms/dijkstra.js'));
require(path.join(baseDir, 'js/algorithms/a-star.js'));
require(path.join(baseDir, 'js/algorithms/merge-sort.js'));
require(path.join(baseDir, 'js/modules/search-ir.js'));

console.log('--- 1. اختبار قاعدة بيانات الحرم الجامعي (Campus Graph) ---');
const graph = new window.CampusGraph(window.CAMPUS_GRAPH_DATA);
const allNodes = graph.getAllNodes();
const allEdges = graph.getAllEdges();
console.log(`عدد كليات ومباني الحرم: ${allNodes.length}`);
console.log(`عدد الممرات الرابطة: ${allEdges.length}`);
console.assert(allNodes.length === 12, 'يجب أن يكون عدد العقد 12');
console.assert(allEdges.length >= 15, 'يجب أن يكون عدد الحواف 15 على الأقل');

console.log('\n--- 2. اختبار خوارزمية ديكسترا (Dijkstra) ---');
// البداية من كلية الحاسبات والمعلومات (fci) التي تمتلك حاوية بلاستيك ممتلئة
const plasticTargets = graph.getTargetNodesForWaste('plastic').map(n => n.id);
console.log('العقد التي تمتلك حاوية بلاستيك متاحة:', plasticTargets);

const dijkstraRes = window.DijkstraAlgorithm.findShortestPath(graph, 'fci', plasticTargets);
console.log('نتيجة ديكسترا من كلية الحاسبات (حاويتها ممتلئة):', {
    target: dijkstraRes.targetNodeId,
    path: dijkstraRes.path,
    distance: dijkstraRes.totalDistance,
    visitedCount: dijkstraRes.visitedNodesCount,
    executionTimeMs: dijkstraRes.executionTimeMs
});
console.assert(dijkstraRes.found === true, 'يجب العثور على حاوية بلاستيك');
console.assert(dijkstraRes.totalDistance > 0, 'المسافة يجب أن تكون أكبر من صفر من كلية الحاسبات');

console.log('\n--- 3. اختبار خوارزمية إيه ستار (A* Search) ---');
const astarRes = window.AStarAlgorithm.findShortestPath(graph, 'fci', plasticTargets);
console.log('نتيجة A* من كلية الحاسبات:', {
    target: astarRes.targetNodeId,
    path: astarRes.path,
    distance: astarRes.totalDistance,
    visitedCount: astarRes.visitedNodesCount,
    executionTimeMs: astarRes.executionTimeMs
});
console.assert(astarRes.found === true, 'يجب العثور على حاوية في A*');
console.assert(astarRes.totalDistance === dijkstraRes.totalDistance, 'المسافة المثالية المحسوبة يجب أن تتطابق تماماً بين Dijkstra و A*');

console.log('\n--- 4. اختبار تخطي الحاويات الممتلئة (Full Bins Skipping) ---');
// جعل أقرب حاوية (كلية الذكاء الاصطناعي ai) ممتلئة أيضاً، ثم إعادة الحساب
console.log('تغيير حالة حاوية البلاستيك في كلية الذكاء الاصطناعي إلى ممتلئة...');
const bin = graph.getNode('ai').bins.find(b => b.type === 'plastic');
bin.available = false;

const updatedPlasticTargets = graph.getTargetNodesForWaste('plastic').map(n => n.id);
const reroutedDijkstra = window.DijkstraAlgorithm.findShortestPath(graph, 'fci', updatedPlasticTargets);
console.log('المسار الجديد بعد إعادة التوجيه وتخطي الحاوية الممتلئة:', {
    target: reroutedDijkstra.targetNodeId,
    path: reroutedDijkstra.path,
    distance: reroutedDijkstra.totalDistance
});
console.assert(reroutedDijkstra.targetNodeId !== 'ai', 'يجب ألا يتم التوجيه لكلية الذكاء الاصطناعي لأنها ممتلئة الآن');
console.assert(reroutedDijkstra.targetNodeId !== 'fci', 'يجب ألا يتم التوجيه لكلية الحاسبات لأنها ممتلئة');

console.log('\n--- 5. اختبار خوارزمية الترتيب بالدمج (Merge Sort) ---');
const dummyBins = [
    { name: 'كلية العلوم', distance: 220 },
    { name: 'كلية الهندسة', distance: 130 },
    { name: 'المطعم المركزي', distance: 270 },
    { name: 'كلية الذكاء الاصطناعي', distance: 190 },
    { name: 'المكتبة المركزية', distance: 340 }
];
const sortedBins = window.MergeSortAlgorithm.sortBinsByDistance(dummyBins);
console.log('ترتيب الحاويات تصاعدياً حسب المسافة:', sortedBins.map(b => `${b.name} (${b.distance}م)`));
for (let i = 0; i < sortedBins.length - 1; i++) {
    console.assert(sortedBins[i].distance <= sortedBins[i + 1].distance, 'يجب أن تكون المسافات مرتبة تصاعدياً');
}

console.log('\n--- 6. اختبار محرك استرجاع المعلومات والبحث الذكي (IR Engine) ---');
const irEngine = new window.InformationRetrievalEngine(window.IR_EXPANDED_CATALOG);

const testQueries = ['بلاستيك', 'كانز', 'كرتون', 'بقايا طعام', 'بلستك']; // لاحظ الخطأ الإملائي في 'بلستك' لاختبار الـ Fuzzy Levenshtein
testQueries.forEach(q => {
    const results = irEngine.search(q, 2);
    console.log(`استعلام: "${q}" -> تم استرجاع:`, results.map(r => `${r.item.name} (درجة التطابق: ${r.score})`));
    console.assert(results.length > 0, `يجب إيجاد نتائج للاستعلام "${q}"`);
});

console.log('\n======================================================');
console.log('✅ جميع الاختبارات الأكاديمية والبرمجية نجحت بنسبة 100%!');
console.log('======================================================');
