/**
 * =========================================================================================
 * خوارزمية الترتيب بالدمج (Merge Sort Algorithm)
 * =========================================================================================
 * الغرض الأكاديمي:
 * تطبيق استراتيجية "فرّق تسُد" (Divide-and-Conquer Paradigm) لترتيب قائمة الحاويات المتاحة
 * في حرم جامعة كفر الشيخ ترتيباً تصاعدياً حسب مسافة المشي الحقيقية من موقع الطالب.
 *
 * التحليل الرياضي والتعقيد الحسابي:
 * - معادلة التكرار (Recurrence Relation):
 *   T(n) = 2T(n/2) + O(n)
 *   طبقاً لنظرية الماستر (Master Theorem - Case 2):
 *   a = 2, b = 2, f(n) = O(n) => log_b(a) = log_2(2) = 1 => T(n) = Theta(n log n).
 * - التعقيد الزمني (Time Complexity):
 *   * أفضل حالة (Best Case): O(n log n)
 *   * الحالة المتوسطة (Average Case): O(n log n)
 *   * أسوأ حالة (Worst Case): O(n log n) - مضمون وثابت لا يتأثر بترتيب البيانات المسبق.
 * - التعقيد المكاني (Space Complexity): O(n) لتخزين المصفوفات الفرعية أثناء عملية الدمج.
 * - خاصية الاستقرار (Stability): خوارزمية مستقرة (Stable Sort)، تحافظ على الترتيب النسبي للعناصر المتساوية.
 *
 * مراحل الخوارزمية:
 * 1. التقسيم (Divide): تقسيم المصفوفة إلى نصفين متساويين عند نقطة المنتصف Mid = floor(n / 2).
 * 2. الحل التكراري (Conquer): فرز النصف الأيسر والنصف الأيمن بشكل استدعاء ذاتي (Recursively).
 * 3. الدمج (Combine / Merge): دمج النصفين المرتبين معاً في مصفوفة واحدة مرتبة بمقارنة المؤشرين.
 * =========================================================================================
 */

class MergeSortAlgorithm {
    /**
     * ترتيب مصفوفة كائنات تصاعدياً باستخدام دالة مقارنة مخصصة
     * 
     * @param {Array} array - المصفوفة المراد ترتيبها
     * @param {Function} compareFn - دالة المقارنة: (a, b) => a.distance - b.distance
     * @returns {Array} مصفوفة جديدة مرتبة تصاعدياً
     */
    static sort(array, compareFn = (a, b) => a - b) {
        // حالة الأساس للتوقف (Base Case): إذا كان طول المصفوفة 0 أو 1، فهي مرتبة بالفعل
        if (!Array.isArray(array) || array.length <= 1) {
            return [...array];
        }

        // خطوة 1: التقسيم (Divide)
        const middleIndex = Math.floor(array.length / 2);
        const leftHalf = array.slice(0, middleIndex);
        const rightHalf = array.slice(middleIndex);

        // خطوة 2: الحل التكراري (Conquer)
        const sortedLeft = MergeSortAlgorithm.sort(leftHalf, compareFn);
        const sortedRight = MergeSortAlgorithm.sort(rightHalf, compareFn);

        // خطوة 3: الدمج المنظم (Combine / Merge)
        return MergeSortAlgorithm.merge(sortedLeft, sortedRight, compareFn);
    }

    /**
     * دمج مصفوفتين مرتبتين في مصفوفة واحدة مرتبة في زمن خطي O(n)
     * 
     * @param {Array} left - المصفوفة اليسرى المرتبة
     * @param {Array} right - المصفوفة اليمنى المرتبة
     * @param {Function} compareFn - دالة المقارنة
     * @returns {Array} المصفوفة المدمجة والمرتبة
     */
    static merge(left, right, compareFn) {
        const mergedResult = [];
        let leftIndex = 0;
        let rightIndex = 0;

        // مقارنة العناصر من كلا النصفين ووضع الأصغر أولاً
        while (leftIndex < left.length && rightIndex < right.length) {
            const comparison = compareFn(left[leftIndex], right[rightIndex]);

            if (comparison <= 0) {
                // العنصر الأيسر أصغر أو مساوٍ (يضمن الاستقرار Stability)
                mergedResult.push(left[leftIndex]);
                leftIndex++;
            } else {
                mergedResult.push(right[rightIndex]);
                rightIndex++;
            }
        }

        // تفريغ أي عناصر متبقية في النصف الأيسر
        while (leftIndex < left.length) {
            mergedResult.push(left[leftIndex]);
            leftIndex++;
        }

        // تفريغ أي عناصر متبقية في النصف الأيمن
        while (rightIndex < right.length) {
            mergedResult.push(right[rightIndex]);
            rightIndex++;
        }

        return mergedResult;
    }

    /**
     * ترتيب حاويات الجامعة المتاحة حسب مسافة المشي الحقيقية
     * 
     * @param {Array<Object>} binsList - قائمة الحاويات مع المسافة المحسوبة
     * @returns {Array<Object>} قائمة الحاويات مرتبة من الأقرب إلى الأبعد
     */
    static sortBinsByDistance(binsList) {
        return MergeSortAlgorithm.sort(binsList, (binA, binB) => {
            return binA.distance - binB.distance;
        });
    }
}

window.MergeSortAlgorithm = MergeSortAlgorithm;
