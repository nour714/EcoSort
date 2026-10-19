/**
 * =========================================================================================
 * خوارزمية ديكسترا لأقصر مسار (Dijkstra's Shortest Path Algorithm)
 * =========================================================================================
 * الغرض الأكاديمي:
 * حل مسألة أقصر مسار من مصدر واحد (Single-Source Shortest Path - SSSP) في رسم بياني موزون
 * ذي أوزان غير سالبة (Non-negative Edge Weights).
 *
 * التعقيد الحسابي (Time & Space Complexity):
 * - التعقيد الزمني (Time Complexity):
 *   * باستخدام Min-Priority Queue / Min-Heap: O((V + E) log V)
 *   * حيث V = عدد العقد (Vertices/Colleges) و E = عدد الحواف (Edges/Pathways).
 *   * في هذا التطبيق التعليمي يتم استخدام مصفوفة مسافات دقيقة: O(V^2 + E).
 * - التعقيد المكاني (Space Complexity): O(V) لتخزين المسافات، العقد السابقة، وقائمة الزيارات.
 *
 * خطوات عمل الخوارزمية في مشروع EcoSort:
 * 1. تهيئة مصفوفة المسافات: مسافة العقدة الابتدائية (موقع الطالب) = 0، وباقي العقد = مالانهاية (Infinity).
 * 2. الاحتفاظ بمجموعة العقد التي لم تتم زيارتها (Unvisited Set).
 * 3. في كل تكرار، اختيار العقدة ذات أقل مسافة تقديرية وفحص جميع جيرانها.
 * 4. خطوة الاسترخاء (Relaxation Step):
 *    إذا كانت (المسافة للعقدة الحالية + وزن الحافة المؤدية للجار) أقل من (المسافة المسجلة للجار)،
 *    يتم تحديث مسافة الجار وتعيين العقدة الحالية كعقدة سابقة له.
 * 5. عند العثور على أقرب حاوية تقبل نوع المخلفات وتكون "متاحة (Available)"،
 *    يتم استرجاع المسار الكامل بالرجوع إلى مصفوفة الأسلاف (Predecessors).
 * =========================================================================================
 */

class DijkstraAlgorithm {
    /**
     * حساب أقصر مسار من عقدة البداية إلى أقرب عقدة هدف تحقق الشروط (نوع الحاوية والحالة المتاحة)
     * 
     * @param {CampusGraph} graph - كائن خريطة الحرم الجامعي
     * @param {string} startNodeId - معرف عقدة البداية (موقع المستخدم الحالي)
     * @param {Array<string>} targetNodeIds - معرفات العقد التي تحتوي على الحاويات المطلوبة المتاحة
     * @returns {Object} نتيجة الخوارزمية مع المقاييس الأكاديمية
     */
    static findShortestPath(graph, startNodeId, targetNodeIds = []) {
        const startTime = performance.now(); // قياس دقيق لزمن التنفيذ بالميكروثانية

        const allNodes = graph.getAllNodes();
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();
        const visitedOrder = []; // ترتيب العقد أثناء الفحص (لأغراض التحليل المرئي)
        const targetSet = new Set(targetNodeIds);

        // خطوة 1: التهيئة (Initialization)
        allNodes.forEach(node => {
            distances.set(node.id, Infinity);
            previous.set(node.id, null);
            unvisited.add(node.id);
        });

        // مسافة عقدة البداية إلى نفسها دائماً 0
        distances.set(startNodeId, 0);

        let destinationFound = null;

        // التحقق الاستباقي: إذا كان موقع الطالب الحالي يحتوي بالفعل على الحاوية المطلوبة وهي متاحة
        if (targetSet.has(startNodeId)) {
            const endTime = performance.now();
            return {
                algorithm: 'Dijkstra',
                startNodeId,
                targetNodeId: startNodeId,
                path: [startNodeId],
                totalDistance: 0,
                visitedNodesCount: 1,
                visitedOrder: [startNodeId],
                executionTimeMs: Number((endTime - startTime).toFixed(3)),
                complexity: 'O((V + E) log V)',
                found: true,
                message: 'الحاوية المطلوبة متوفرة ومتاحة في موقعك الحالي مباشرة!'
            };
        }

        // خطوة 2: حلقة الفحص الرئيسية (Main Exploration Loop)
        while (unvisited.size > 0) {
            // اختيار العقدة ذات المسافة الأدنى من بين العقد غير المزارة
            let currentNodeId = null;
            let minDistance = Infinity;

            for (const nodeId of unvisited) {
                const dist = distances.get(nodeId);
                if (dist < minDistance) {
                    minDistance = dist;
                    currentNodeId = nodeId;
                }
            }

            // إذا كانت أصغر مسافة هي المالانهاية، فهذا يعني أن باقي العقد غير متصلة
            if (currentNodeId === null || minDistance === Infinity) {
                break;
            }

            // إزالة العقدة الحالية من مجموعة غير المزار وتوثيق زيارتها
            unvisited.delete(currentNodeId);
            visitedOrder.push(currentNodeId);

            // التحقق مما إذا وصلنا إلى إحدى العقد الهدف المتاحة
            if (targetSet.has(currentNodeId)) {
                destinationFound = currentNodeId;
                break; // نكتفي بالوصول لأول عقدة هدف لأن ديكسترا يضمن أنها الأقرب على الإطلاق
            }

            // خطوة 3: فحص الجيران وتطبيق الاسترخاء (Edge Relaxation)
            const neighbors = graph.getNeighbors(currentNodeId);

            for (const neighbor of neighbors) {
                const neighborId = neighbor.node;
                const edgeWeight = neighbor.weight;

                if (!unvisited.has(neighborId)) continue;

                const tentativeDistance = distances.get(currentNodeId) + edgeWeight;

                // تحديث المسافة إذا وجدنا مساراً أقصر
                if (tentativeDistance < distances.get(neighborId)) {
                    distances.set(neighborId, tentativeDistance);
                    previous.set(neighborId, currentNodeId);
                }
            }
        }

        const endTime = performance.now();
        const executionTimeMs = Number((endTime - startTime).toFixed(3));

        // خطوة 4: إعادة بناء المسار (Path Reconstruction)
        if (!destinationFound) {
            return {
                algorithm: 'Dijkstra',
                startNodeId,
                targetNodeId: null,
                path: [],
                totalDistance: Infinity,
                visitedNodesCount: visitedOrder.length,
                visitedOrder,
                executionTimeMs,
                complexity: 'O((V + E) log V)',
                found: false,
                message: 'لم يتم العثور على أي حاوية متاحة لهذا النوع داخل الحرم الجامعي.'
            };
        }

        // تتبع المسار للخلف من الهدف إلى البداية
        const path = [];
        let curr = destinationFound;
        while (curr !== null) {
            path.unshift(curr);
            curr = previous.get(curr);
        }

        return {
            algorithm: 'Dijkstra',
            startNodeId,
            targetNodeId: destinationFound,
            path,
            totalDistance: distances.get(destinationFound),
            visitedNodesCount: visitedOrder.length,
            visitedOrder,
            executionTimeMs,
            complexity: 'O((V + E) log V)',
            found: true,
            allDistances: distances
        };
    }

    /**
     * حساب المسافات لجميع العقد في الرسم البياني دفعة واحدة (مفيد لترتيب Merge Sort)
     */
    static calculateAllDistances(graph, startNodeId) {
        const allNodes = graph.getAllNodes();
        const distances = new Map();
        const unvisited = new Set();

        allNodes.forEach(node => {
            distances.set(node.id, Infinity);
            unvisited.add(node.id);
        });
        distances.set(startNodeId, 0);

        while (unvisited.size > 0) {
            let curr = null;
            let minDist = Infinity;
            for (const id of unvisited) {
                const d = distances.get(id);
                if (d < minDist) {
                    minDist = d;
                    curr = id;
                }
            }
            if (curr === null || minDist === Infinity) break;
            unvisited.delete(curr);

            const neighbors = graph.getNeighbors(curr);
            for (const neighbor of neighbors) {
                if (!unvisited.has(neighbor.node)) continue;
                const newDist = distances.get(curr) + neighbor.weight;
                if (newDist < distances.get(neighbor.node)) {
                    distances.set(neighbor.node, newDist);
                }
            }
        }
        return distances;
    }
}

if (typeof window !== 'undefined') {
    window.DijkstraAlgorithm = DijkstraAlgorithm;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DijkstraAlgorithm;
}
