/**
 * =========================================================================================
 * محرك استرجاع المعلومات الذكي (Information Retrieval - IR Engine)
 * =========================================================================================
 * التقنيات المطبقة:
 * 1. معالجة اللغة الطبيعية العربية (Arabic Text Normalization):
 *    - إزالة التشكيل وعلامات الترقيم (Diacritics & Punctuation removal).
 *    - توحيد الألف (أ، إ، آ -> ا)، والتاء المربوطة (ة -> ه)، والياء المقصورة (ى -> ي).
 * 2. التقطيع اللغوي (Tokenization) وإيقاف الكلمات الزائدة (Stop Words Filtering).
 * 3. خوارزمية قياس التشابه الضبابي (Levenshtein Distance / Fuzzy Matching):
 *    - معالجة الأخطاء الإملائية في كتابة أسماء المخلفات (Typo Tolerance).
 * 4. نظام الترتيب وتسجيل النقاط (Relevance Scoring & Ranking):
 *    - حساب تطابق الكلمات المفتاحية وعناوين الخامات لترتيب النتائج تنازلياً.
 * =========================================================================================
 */

class InformationRetrievalEngine {
    constructor(catalog = window.IR_EXPANDED_CATALOG || []) {
        this.catalog = catalog;
        this.arabicStopWords = new Set([
            'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 
            'التي', 'الذي', 'كيف', 'أين', 'طريقة', 'تخلص', 'رمي', 'مكان'
        ]);
    }

    /**
     * معالجة وتوحيد النص العربي لتفادي الاختلافات الإملائية
     * @param {string} text 
     * @returns {string} النص الموحد
     */
    static normalizeArabic(text) {
        if (!text || typeof text !== 'string') return '';

        return text
            .trim()
            .toLowerCase()
            // إزالة التشكيل العربي (Tashkeel)
            .replace(/[\u064B-\u065F\u0670]/g, '')
            // توحيد الألفات
            .replace(/[أإآء]/g, 'ا')
            // توحيد الياء
            .replace(/ى/g, 'ي')
            // توحيد التاء المربوطة والهاء
            .replace(/ة/g, 'ه')
            // إزالة الحركات والرموز غير الأبجدية مع الحفاظ على الأرقام الإنجليزية والعربية
            .replace(/[^\u0621-\u064A0-9a-zA-Z\s]/g, ' ')
            .replace(/\s+/g, ' ');
    }

    /**
     * حساب مسافة ليفنشتاين لقياس التشابه الضبابي بين كلمتين (Fuzzy Matching)
     * @param {string} a 
     * @param {string} b 
     * @returns {number} عدد التعديلات اللازمة للتحويل
     */
    static levenshteinDistance(a, b) {
        const matrix = [];
        const n = a.length;
        const m = b.length;

        if (n === 0) return m;
        if (m === 0) return n;

        for (let i = 0; i <= n; i++) matrix[i] = [i];
        for (let j = 0; j <= m; j++) matrix[0][j] = j;

        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // الحذف Deletion
                    matrix[i][j - 1] + 1,      // الإضافة Insertion
                    matrix[i - 1][j - 1] + cost // الاستبدال Substitution
                );
            }
        }
        return matrix[n][m];
    }

    /**
     * حساب نسبة التشابه بين كلمتين (Similarity Ratio بين 0 و 1)
     */
    static stringSimilarity(str1, str2) {
        const maxLen = Math.max(str1.length, str2.length);
        if (maxLen === 0) return 1.0;
        const distance = InformationRetrievalEngine.levenshteinDistance(str1, str2);
        return 1 - (distance / maxLen);
    }

    /**
     * تقطيع النص إلى كلمات مفتاحية بعد إزالة الكلمات الزائدة
     */
    tokenize(query) {
        const clean = InformationRetrievalEngine.normalizeArabic(query);
        return clean
            .split(' ')
            .filter(token => token.length > 1 && !this.arabicStopWords.has(token));
    }

    /**
     * البحث الذكي في قاعدة البيانات واسترجاع النتائج مرتبة حسب الأهمية
     * @param {string} query - استعلام البحث من المستخدم
     * @param {number} maxResults - الحد الأقصى للنتائج المسترجعة
     * @returns {Array<Object>} قائمة النتائج المطابقة مع درجة التشابه والتفاصيل
     */
    search(query, maxResults = 5) {
        if (!query || query.trim().length === 0) {
            return [];
        }

        const queryNormalized = InformationRetrievalEngine.normalizeArabic(query);
        const queryTokens = this.tokenize(query);

        if (queryTokens.length === 0 && queryNormalized.length > 0) {
            queryTokens.push(queryNormalized);
        }

        const scoredResults = [];

        for (const item of this.catalog) {
            let score = 0;
            const matchedTerms = [];

            const nameNorm = InformationRetrievalEngine.normalizeArabic(item.name);
            const catNorm = InformationRetrievalEngine.normalizeArabic(item.category);
            const codeNorm = InformationRetrievalEngine.normalizeArabic(item.resinCode || '');

            // 1. التطابق التام مع الاسم (Exact Substring Match)
            if (nameNorm.includes(queryNormalized)) {
                score += 100;
                matchedTerms.push('اسم المادة');
            }

            // 2. التطابق مع الفئة أو رمز المادة
            if (catNorm.includes(queryNormalized) || codeNorm.includes(queryNormalized)) {
                score += 50;
                matchedTerms.push('تصنيف المادة');
            }

            // 3. تطابق الكلمات المفتاحية وعنوان المادة (Keyword & Title Fuzzy Matching)
            const itemKeywords = (item.keywords || []).map(kw => InformationRetrievalEngine.normalizeArabic(kw));
            const nameTokens = nameNorm.split(' ').filter(t => t.length > 2);
            const allTargetTokens = [...new Set([...itemKeywords, ...nameTokens])];

            for (const qToken of queryTokens) {
                // هل الكلمة موجودة تماماً في الكلمات المفتاحية؟
                const exactMatch = allTargetTokens.some(kw => kw === qToken || kw.includes(qToken) || qToken.includes(kw));
                if (exactMatch) {
                    score += 40;
                    matchedTerms.push(qToken);
                    continue;
                }

                // فحص التشابه الضبابي (Fuzzy Levenshtein) لمعالجة الأخطاء الإملائية
                for (const targetToken of allTargetTokens) {
                    const dist = InformationRetrievalEngine.levenshteinDistance(qToken, targetToken);
                    const similarity = InformationRetrievalEngine.stringSimilarity(qToken, targetToken);

                    // قبول الخطأ الإملائي إذا كانت المسافة <= 2 أو نسبة التشابه >= 0.60 للكلمات فوق 3 أحرف
                    if ((dist <= 2 && qToken.length >= 4) || similarity >= 0.60) {
                        score += 35 * similarity;
                        matchedTerms.push(`${targetToken} (تشابه إملائي)`);
                        break;
                    }
                }
            }

            // إذا كان هناك أي تطابق ذو دلالة
            if (score > 15) {
                scoredResults.push({
                    item,
                    score: Number(score.toFixed(1)),
                    matchedTerms: [...new Set(matchedTerms)]
                });
            }
        }

        // ترتيب النتائج تنازلياً حسب درجة الملاءمة (Relevance Score)
        scoredResults.sort((a, b) => b.score - a.score);

        return scoredResults.slice(0, maxResults);
    }
}

window.InformationRetrievalEngine = InformationRetrievalEngine;
