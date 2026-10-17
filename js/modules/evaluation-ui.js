/**
 * =========================================================================================
 * لوحة التقييم الأكاديمي والمقارنة الخوارزمية (Evaluation & Performance Panel)
 * =========================================================================================
 * الوظائف:
 * 1. تشغيل وتقييم خوارزميتي Dijkstra و A* بالتوازي ومقارنة الأداء الأكاديمي.
 * 2. قياس زمن التنفيذ (Execution Time) بدقة ميكروثانية.
 * 3. حصر عدد العقد التي تم استكشافها (Visited Nodes) وبيان تفوق A* في توجيه البحث.
 * 4. تطبيق خوارزمية Merge Sort لترتيب جميع الحاويات المتاحة في كليات الجامعة تصاعدياً.
 * =========================================================================================
 */

class EvaluationUI {
    constructor({ onAlgorithmChanged, onNavigateToBin }) {
        this.currentAlgorithm = 'dijkstra'; // 'dijkstra' أو 'astar'
        this.onAlgorithmChanged = onAlgorithmChanged;
        this.onNavigateToBin = onNavigateToBin;
        this.lastEvaluation = null;
    }

    setAlgorithm(algoName) {
        if (algoName === 'dijkstra' || algoName === 'astar') {
            this.currentAlgorithm = algoName;
            if (typeof this.onAlgorithmChanged === 'function') {
                this.onAlgorithmChanged(this.currentAlgorithm);
            }
        }
    }

    /**
     * تشغيل المقارنة الشاملة وحساب النتائج وترتيب الحاويات بـ Merge Sort
     * 
     * @param {CampusGraph} graph 
     * @param {string} startNodeId 
     * @param {string} wasteType 
     * @returns {Object} نتائج التحليل والمقارنة
     */
    evaluateAll(graph, startNodeId, wasteType) {
        // 1. استخراج العقد التي تمتلك حاوية متاحة
        const targetNodes = graph.getTargetNodesForWaste(wasteType);
        const targetNodeIds = targetNodes.map(n => n.id);

        // 2. تشغيل خوارزمية ديكسترا
        const dijkstraResult = DijkstraAlgorithm.findShortestPath(graph, startNodeId, targetNodeIds);

        // 3. تشغيل خوارزمية إيه ستار A*
        const astarResult = AStarAlgorithm.findShortestPath(graph, startNodeId, targetNodeIds);

        // 4. حساب المسافات لجميع العقد لاستخدامها في Merge Sort
        const allDistances = DijkstraAlgorithm.calculateAllDistances(graph, startNodeId);

        // 5. تجميع بيانات الحاويات المتاحة
        const availableBinsList = [];
        targetNodes.forEach(node => {
            const dist = allDistances.get(node.id) || Infinity;
            if (dist < Infinity) {
                // إيجاد الحاوية الخاصة بهذا النوع داخل الكلية
                const bin = node.bins.find(b => {
                    if (wasteType === 'plastic' || wasteType === 'pet' || wasteType === 'hdpe') {
                        return (b.type === 'plastic' || b.type === 'pet' || b.type === 'hdpe') && b.available;
                    }
                    return b.type === wasteType && b.available;
                });

                availableBinsList.push({
                    nodeId: node.id,
                    nodeName: node.name,
                    subtitle: node.subtitle,
                    distance: dist,
                    walkingMinutes: Number((dist / 80).toFixed(1)), // متوسط سرعة مشي 80م/دقيقة
                    capacity: bin ? bin.capacity : 50,
                    binLabel: bin ? bin.label : 'حاوية متاحة'
                });
            }
        });

        // 6. تطبيق خوارزمية Merge Sort لترتيب الحاويات تصاعدياً حسب المسافة
        const sortedBins = MergeSortAlgorithm.sortBinsByDistance(availableBinsList);

        const evaluationData = {
            currentAlgorithm: this.currentAlgorithm,
            dijkstra: dijkstraResult,
            astar: astarResult,
            activeResult: this.currentAlgorithm === 'dijkstra' ? dijkstraResult : astarResult,
            targetNodesCount: targetNodeIds.length,
            sortedBins,
            startNodeId,
            wasteType
        };

        this.lastEvaluation = evaluationData;
        this.renderMetrics(evaluationData);
        this.renderSortedBinsTable(evaluationData.sortedBins);
        this.renderComparisonTable(dijkstraResult, astarResult);

        return evaluationData;
    }

    /**
     * تحديث بطاقات مؤشرات الأداء الرئيسية (KPIs)
     */
    renderMetrics(evalData) {
        const active = evalData.activeResult;

        const timeElem = document.getElementById('metric-execution-time');
        const nodesElem = document.getElementById('metric-visited-nodes');
        const distanceElem = document.getElementById('metric-total-distance');
        const walkingElem = document.getElementById('metric-walking-time');
        const pathElem = document.getElementById('metric-path-summary');

        if (timeElem) timeElem.textContent = `${active.executionTimeMs} ms`;
        if (nodesElem) nodesElem.textContent = `${active.visitedNodesCount} عُقدة`;
        if (distanceElem) {
            distanceElem.textContent = active.totalDistance === Infinity ? 'غير متصل' : `${active.totalDistance} متر`;
        }
        if (walkingElem) {
            const mins = active.totalDistance === Infinity ? '-' : (active.totalDistance / 80).toFixed(1);
            walkingElem.textContent = `${mins} دقيقة تقريباً`;
        }

        // تحديث اسم ووصف الحاوية الهدف في بطاقة النتيجة
        const targetTitleElem = document.getElementById('final-target-bin-name');
        const targetDescElem = document.getElementById('final-target-bin-desc');
        if (targetTitleElem && active.targetNodeId && window.CAMPUS_GRAPH_DATA) {
            const targetNode = window.CAMPUS_GRAPH_DATA.nodes.find(n => n.id === active.targetNodeId);
            if (targetNode) {
                targetTitleElem.textContent = targetNode.name;
                if (targetDescElem) {
                    const bin = targetNode.bins.find(b => {
                        if (evalData.wasteType === 'plastic' || evalData.wasteType === 'pet' || evalData.wasteType === 'hdpe') {
                            return (b.type === 'plastic' || b.type === 'pet' || b.type === 'hdpe') && b.available;
                        }
                        return b.type === evalData.wasteType && b.available;
                    });
                    targetDescElem.textContent = bin 
                        ? `${bin.label} (متاحة بنسبة سعة ${bin.capacity}%)` 
                        : 'حاوية متاحة ومطابقة للفرز';
                }
            }
        }

        // عرض تفاصيل مسار العبور
        if (pathElem && window.CAMPUS_GRAPH_DATA) {
            if (active.path && active.path.length > 0) {
                if (active.path.length === 1) {
                    pathElem.textContent = 'أنت متواجد بالفعل عند أقرب حاوية متاحة في موقعك الحالي!';
                } else {
                    const names = active.path.map(id => {
                        const n = window.CAMPUS_GRAPH_DATA.nodes.find(node => node.id === id);
                        return n ? n.name : id;
                    });
                    pathElem.innerHTML = names.join(' <span class="text-emerald-500 font-bold">&larr;</span> ');
                }
            } else {
                pathElem.textContent = 'لا يوجد مسار متاح حالياً';
            }
        }
    }

    /**
     * عرض جدول المقارنة الأكاديمية بين Dijkstra و A*
     */
    renderComparisonTable(dijkstra, astar) {
        const tableContainer = document.getElementById('academic-comparison-table-body');
        if (!tableContainer) return;

        const distanceDiff = dijkstra.totalDistance === astar.totalDistance 
            ? '<span class="badge badge-success">متطابقة ومثالية (Optimal 100%)</span>' 
            : '<span class="badge badge-warning">اختلاف في التكلفة</span>';

        const nodesComparison = astar.visitedNodesCount <= dijkstra.visitedNodesCount
            ? `<span class="text-emerald-600 font-bold">وفّر A* فحص ${dijkstra.visitedNodesCount - astar.visitedNodesCount} عُقدة بفضل التوجيه الإرشادي</span>`
            : 'أداء متقارب في الشبكات الصغيرة';

        tableContainer.innerHTML = `
            <tr>
                <td class="font-bold">المسافة المحسوبة</td>
                <td class="text-blue-600 font-semibold">${dijkstra.totalDistance} م</td>
                <td class="text-purple-600 font-semibold">${astar.totalDistance} م</td>
                <td>${distanceDiff}</td>
            </tr>
            <tr>
                <td class="font-bold">عدد العُقد المستكشفة (Visited)</td>
                <td><span class="badge badge-blue">${dijkstra.visitedNodesCount} عُقد</span></td>
                <td><span class="badge badge-purple">${astar.visitedNodesCount} عُقد</span></td>
                <td>${nodesComparison}</td>
            </tr>
            <tr>
                <td class="font-bold">زمن التنفيذ (Latency)</td>
                <td>${dijkstra.executionTimeMs} ms</td>
                <td>${astar.executionTimeMs} ms</td>
                <td class="text-xs text-gray-500">دقة ميكروثانية عبر performance.now()</td>
            </tr>
            <tr>
                <td class="font-bold">التعقيد النظري (Complexity)</td>
                <td><code>O((V + E) log V)</code></td>
                <td><code>O(b^d) / Heuristic</code></td>
                <td class="text-xs text-gray-500">حساب استرشادي Euclidean</td>
            </tr>
        `;
    }

    /**
     * عرض قائمة الحاويات المتاحة المرتبة بواسطة Merge Sort
     */
    renderSortedBinsTable(sortedBins) {
        const container = document.getElementById('sorted-bins-list-container');
        if (!container) return;

        if (!sortedBins || sortedBins.length === 0) {
            container.innerHTML = `
                <div class="empty-state p-4 text-center text-gray-500">
                    <p>⚠️ لا توجد حاويات متاحة حالياً لهذا النوع في حرم الجامعة.</p>
                </div>
            `;
            return;
        }

        let html = '';
        sortedBins.forEach((bin, index) => {
            const isClosest = index === 0;
            const rankBadge = isClosest 
                ? '<span class="badge badge-emerald">الأقرب إليك 🥇</span>' 
                : `<span class="badge badge-gray">الترتيب #${index + 1}</span>`;

            html += `
                <div class="sorted-bin-item ${isClosest ? 'closest-bin' : ''}">
                    <div class="bin-item-info">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-gray-800">${bin.nodeName}</span>
                            ${rankBadge}
                        </div>
                        <div class="text-xs text-gray-500 mt-0.5">${bin.subtitle} | ${bin.binLabel}</div>
                    </div>
                    <div class="bin-item-meta">
                        <div class="distance-metric">
                            <span class="distance-value">${bin.distance}</span>
                            <span class="distance-unit">متر</span>
                        </div>
                        <div class="text-xs text-gray-400">(~${bin.walkingMinutes} د مشي)</div>
                        <button class="btn btn-outline-sm mt-1" onclick="window.app.navigateToTarget('${bin.nodeId}')">
                            اختر المسار &larr;
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }
}

window.EvaluationUI = EvaluationUI;
