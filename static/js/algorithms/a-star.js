/**
 * =========================================================================================
 * خوارزمية البحث الموجه إيه ستار (A* Search Algorithm)
 * =========================================================================================
 * الغرض الأكاديمي:
 * خوارزمية بحث استرشادية (Heuristic Search) تجمع بين القوة الرياضية لخوارزمية ديكسترا (Dijkstra)
 * والسرعة التوجيهية لخوارزمية أفضل-أولاً (Greedy Best-First Search).
 * 
 * دالة التكلفة (Evaluation Function):
 * f(n) = g(n) + h(n)
 * - g(n): التكلفة الفعلية المؤكدة من نقطة البداية إلى العقدة الحالية n.
 * - h(n): الدالة الإرشادية (Heuristic Function) - التقدير الأدنى للمسافة من n إلى الهدف.
 * - f(n): التقدير الإجمالي لأقصر مسار يمر عبر العقدة n وصولاً إلى الحاوية المستهدفة.
 * 
 * شروط الدالة الاسترشادية (Admissibility & Consistency):
 * 1. مقبولة (Admissible): h(n) <= h*(n)
 *    المسافة التقديرية لا تتجاوز أبداً المسافة الحقيقية، وتم اشتقاقها من مسافة الدائرة العظمى (Haversine Distance):
 *    h(n) = haversine(node_n, target)
 * 2. متسقة (Consistent / Monotonic):
 *    تحقق متباينة المثلث: h(u) <= cost(u, v) + h(v)
 *    حيث أن جميع أوزان الحواف أكبر من أو تساوي مسافة هافرساين المباشرة (weight >= haversine).
 * 
 * في سيناريو EcoSort متعدد الأهداف (Multiple available bins):
 * يتم حساب h(n) كأصغر مسافة هافرساين من العقدة n إلى أي حاوية متاحة مقبولة:
 * h(n) = min_{t in Targets} [ HaversineDistance(n, t) ]
 * 
 * التعقيد الحسابي:
 * - في أفضل الأحوال: O(b * d) حيث b هو عامل التفرع و d هو عمق الهدف.
 * - في أسوأ الأحوال: O(V log V + E) مقارب لديكسترا ولكنه يفحص عدداً أقل بكثير من العقد
 *   بفضل التوجيه الذكي نحو الهدف بدلاً من الانتشار الدائري في كافة الاتجاهات.
 * =========================================================================================
 */

class AStarAlgorithm {
    /**
     * حساب أقصر مسار باستخدام A* مع المقاييس الأكاديمية
     * 
     * @param {CampusGraph} graph - كائن خريطة الحرم الجامعي
     * @param {string} startNodeId - معرف عقدة البداية
     * @param {Array<string>} targetNodeIds - معرفات العقد الهدف
     * @returns {Object} نتيجة الخوارزمية
     */
    static findShortestPath(graph, startNodeId, targetNodeIds = []) {
        const startTime = performance.now();

        const allNodes = graph.getAllNodes();
        const nodeMap = new Map();
        allNodes.forEach(n => nodeMap.set(n.id, n));

        const targetSet = new Set(targetNodeIds);

        // التحقق الاستباقي
        if (targetSet.has(startNodeId)) {
            const endTime = performance.now();
            return {
                algorithm: 'A*',
                startNodeId,
                targetNodeId: startNodeId,
                path: [startNodeId],
                totalDistance: 0,
                visitedNodesCount: 1,
                visitedOrder: [startNodeId],
                executionTimeMs: Number((endTime - startTime).toFixed(3)),
                complexity: 'O(b^d) / O(V log V)',
                found: true,
                message: 'الحاوية المطلوبة متوفرة ومتاحة في موقعك الحالي مباشرة!'
            };
        }

        if (targetNodeIds.length === 0) {
            const endTime = performance.now();
            return {
                algorithm: 'A*',
                startNodeId,
                targetNodeId: null,
                path: [],
                totalDistance: Infinity,
                visitedNodesCount: 0,
                visitedOrder: [],
                executionTimeMs: Number((endTime - startTime).toFixed(3)),
                complexity: 'O(b^d)',
                found: false,
                message: 'لا توجد حاويات متاحة حالياً.'
            };
        }

        // استخراج إحداثيات العقد الهدف لحساب الدالة الاسترشادية (Heuristic)
        const targetNodes = targetNodeIds.map(id => nodeMap.get(id)).filter(Boolean);

        /**
         * دالة التقدير الإرشادي (Admissible & Consistent Haversine Heuristic)
         * مسافة الدائرة العظمى (Haversine) بين موقع العقدة الحالية وأقرب عقدة هدف.
         */
        const heuristic = (nodeId) => AStarAlgorithm.computeHeuristic(graph, nodeId, targetNodeIds);

        // المجموعات: Open Set (قيد الفحص) و Closed Set (تم الانتهاء منها)
        const openSet = new Set([startNodeId]);
        const closedSet = new Set();
        const visitedOrder = [];

        // خرائط التكاليف والأسلاف
        const gScore = new Map(); // التكلفة الفعلية المؤكدة
        const fScore = new Map(); // التكلفة الإجمالية المقدرة f = g + h
        const cameFrom = new Map();

        allNodes.forEach(node => {
            gScore.set(node.id, Infinity);
            fScore.set(node.id, Infinity);
        });

        gScore.set(startNodeId, 0);
        fScore.set(startNodeId, heuristic(startNodeId));

        let destinationFound = null;

        // حلقة الاستكشاف الاسترشادي
        while (openSet.size > 0) {
            // اختيار العقدة ذات أقل fScore في Open Set
            let current = null;
            let lowestF = Infinity;

            for (const nodeId of openSet) {
                const f = fScore.get(nodeId);
                if (f < lowestF) {
                    lowestF = f;
                    current = nodeId;
                }
            }

            // إذا وصلنا إلى إحدى العقد الهدف
            if (targetSet.has(current)) {
                destinationFound = current;
                visitedOrder.push(current);
                break;
            }

            // نقل العقدة من Open إلى Closed
            openSet.delete(current);
            closedSet.add(current);
            visitedOrder.push(current);

            // فحص الجيران وتحديث القيم
            const neighbors = graph.getNeighbors(current);

            for (const neighbor of neighbors) {
                const neighborId = neighbor.node;
                const weight = neighbor.weight;

                // تخطي العقد المغلقة بالفعل
                if (closedSet.has(neighborId)) continue;

                // التكلفة المؤقتة للوصول إلى الجار عبر العقدة الحالية
                const tentativeG = gScore.get(current) + weight;

                if (!openSet.has(neighborId)) {
                    openSet.add(neighborId); // إضافة الجار للمجموعة المفتوحة
                } else if (tentativeG >= gScore.get(neighborId)) {
                    continue; // وجدنا مساراً غير أفضل، نتخطاه
                }

                // هذا المسار هو الأفضل حتى الآن، نسجله
                cameFrom.set(neighborId, current);
                gScore.set(neighborId, tentativeG);
                fScore.set(neighborId, tentativeG + heuristic(neighborId));
            }
        }

        const endTime = performance.now();
        const executionTimeMs = Number((endTime - startTime).toFixed(3));

        // إعادة بناء المسار في حال تم العثور على هدف
        if (!destinationFound) {
            return {
                algorithm: 'A*',
                startNodeId,
                targetNodeId: null,
                path: [],
                totalDistance: Infinity,
                visitedNodesCount: visitedOrder.length,
                visitedOrder,
                executionTimeMs,
                complexity: 'O(b^d) / O(V log V)',
                found: false,
                message: 'تعذر الوصول لأي حاوية متاحة عبر المسارات الحالية.'
            };
        }

        const path = [];
        let curr = destinationFound;
        while (curr !== undefined && curr !== null) {
            path.unshift(curr);
            curr = cameFrom.get(curr);
        }

        return {
            algorithm: 'A*',
            startNodeId,
            targetNodeId: destinationFound,
            path,
            totalDistance: gScore.get(destinationFound),
            visitedNodesCount: visitedOrder.length,
            visitedOrder,
            executionTimeMs,
            complexity: 'O(b^d) / O(V log V)',
            found: true,
            gScore
        };
    }

    /**
     * حساب الدالة الاسترشادية المتسقة والمقبولة h(n)
     * h(n) = min_{t in Targets} [ HaversineDistance(n, t) ]
     */
    static computeHeuristic(graph, nodeId, targetNodeIds = []) {
        const node = graph.getNode(nodeId);
        if (!node || typeof node.lat !== 'number' || typeof node.lng !== 'number') return 0;

        const haversine = (typeof CampusGraph !== 'undefined' && CampusGraph.haversineDistance)
            ? CampusGraph.haversineDistance
            : (lat1, lon1, lat2, lon2) => {
                const toRad = deg => (deg * Math.PI) / 180;
                const R = 6371000;
                const dLat = toRad(lat2 - lat1);
                const dLon = toRad(lon2 - lon1);
                const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            };

        let minDistance = Infinity;
        for (const tid of targetNodeIds) {
            const target = graph.getNode(tid);
            if (!target || typeof target.lat !== 'number' || typeof target.lng !== 'number') continue;
            const d = haversine(node.lat, node.lng, target.lat, target.lng);
            if (d < minDistance) {
                minDistance = d;
            }
        }
        return minDistance === Infinity ? 0 : minDistance;
    }
}

if (typeof window !== 'undefined') {
    window.AStarAlgorithm = AStarAlgorithm;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AStarAlgorithm;
}
