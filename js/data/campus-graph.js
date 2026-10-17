/**
 * EcoSort - بيانات خريطة حرم جامعة كفر الشيخ كـ Graph
 * تمثيل الحرم الجامعي كـ Weighted Directed/Undirected Graph: G = (V, E)
 * 
 * V: العُقد (Nodes) تمثل كليات ومباني الجامعة، مع إحداثيات (x, y) وحالة الحاويات ونوع المخلفات المقبولة.
 * E: الحواف (Edges) تمثل الممرات ومسارات المشاة بين الكليات مع المسافة الحقيقية بالمتر.
 */

const CAMPUS_GRAPH_DATA = {
    // العُقد (Nodes): كليات ومباني جامعة كفر الشيخ
    nodes: [
        {
            id: 'gate',
            name: 'البوابة الرئيسية',
            subtitle: 'طريق الجيش - مدخل الجامعة',
            category: 'gate',
            x: 425,
            y: 540,
            icon: 'gate',
            bins: [
                { type: 'plastic', available: false, capacity: 94, label: 'حاوية بلاستيك PET (ممتلئة بنسبة 94%)' },
                { type: 'metal', available: true, capacity: 30, label: 'حاوية علب كانز ومعادن' },
                { type: 'paper', available: true, capacity: 50, label: 'حاوية أوراق وكرتون' },
                { type: 'organic', available: false, capacity: 90, label: 'حاوية عضوي (ممتلئة)' }
            ]
        },
        {
            id: 'ai',
            name: 'كلية الذكاء الاصطناعي',
            subtitle: 'أول كلية ذكاء اصطناعي بمصر',
            category: 'faculty',
            x: 230,
            y: 430,
            icon: 'cpu',
            bins: [
                { type: 'plastic', available: true, capacity: 35, label: 'حاوية بلاستيك PET & HDPE' },
                { type: 'metal', available: true, capacity: 40, label: 'حاوية معادن وإلكترونيات' },
                { type: 'paper', available: true, capacity: 25, label: 'حاوية أوراق أكاديمية' },
                { type: 'ewaste', available: true, capacity: 15, label: 'نقطة تجميع مخلفات إلكترونية' }
            ]
        },
        {
            id: 'fci',
            name: 'كلية الحاسبات والمعلومات',
            subtitle: 'مبنى البرمجيات ونظم المعلومات',
            category: 'faculty',
            x: 170,
            y: 310,
            icon: 'code',
            bins: [
                { type: 'plastic', available: false, capacity: 92, label: 'حاوية بلاستيك (ممتلئة)' },
                { type: 'metal', available: true, capacity: 55, label: 'حاوية معادن وكانز' },
                { type: 'paper', available: true, capacity: 40, label: 'حاوية أوراق وطباعة' },
                { type: 'ewaste', available: true, capacity: 20, label: 'نقطة مخلفات تقنية' }
            ]
        },
        {
            id: 'eng',
            name: 'كلية الهندسة',
            subtitle: 'مجمع الورش والمعامل الهندسية',
            category: 'faculty',
            x: 340,
            y: 360,
            icon: 'tool',
            bins: [
                { type: 'plastic', available: true, capacity: 60, label: 'حاوية بوليمرات وبلاستيك' },
                { type: 'metal', available: true, capacity: 30, label: 'حاوية خردة ومعادن وكانز' },
                { type: 'paper', available: true, capacity: 45, label: 'حاوية مخططات وأوراق' },
                { type: 'ewaste', available: true, capacity: 35, label: 'حاوية نفايات إلكترونية وبطاريات' }
            ]
        },
        {
            id: 'sci',
            name: 'كلية العلوم',
            subtitle: 'معامل الكيمياء والفيزياء والبيئة',
            category: 'faculty',
            x: 520,
            y: 380,
            icon: 'flask',
            bins: [
                { type: 'plastic', available: true, capacity: 40, label: 'حاوية بولي إيثيلين HDPE' },
                { type: 'metal', available: true, capacity: 50, label: 'حاوية علب كانز' },
                { type: 'paper', available: false, capacity: 95, label: 'حاوية أوراق (ممتلئة)' },
                { type: 'glass', available: true, capacity: 25, label: 'حاوية زجاج معملي' }
            ]
        },
        {
            id: 'restaurant',
            name: 'المطعم المركزي والخدمات',
            subtitle: 'مركز التغذية والأنشطة الطلابية',
            category: 'service',
            x: 430,
            y: 280,
            icon: 'utensils',
            bins: [
                { type: 'plastic', available: true, capacity: 70, label: 'حاوية زجاجات مياه وعصائر' },
                { type: 'metal', available: true, capacity: 65, label: 'حاوية كانز مشروبات' },
                { type: 'paper', available: true, capacity: 55, label: 'حاوية كرتون وأغلفة أطعمة' },
                { type: 'organic', available: true, capacity: 40, label: 'حاوية بقايا أطعمة (كومبوست)' }
            ]
        },
        {
            id: 'pharmacy',
            name: 'كلية الصيدلة',
            subtitle: 'مركز الأبحاث والتصنيع الدوائي',
            category: 'faculty',
            x: 640,
            y: 320,
            icon: 'pill',
            bins: [
                { type: 'plastic', available: false, capacity: 88, label: 'حاوية عبوات بلاستيكية (ممتلئة)' },
                { type: 'metal', available: true, capacity: 20, label: 'حاوية فويل وألومنيوم' },
                { type: 'paper', available: true, capacity: 30, label: 'حاوية كرتون ونشرات' },
                { type: 'glass', available: true, capacity: 40, label: 'حاوية زجاج دوائي' }
            ]
        },
        {
            id: 'medicine',
            name: 'كلية الطب البشري',
            subtitle: 'المجمع الطبي والمستشفى الجامعي',
            category: 'faculty',
            x: 710,
            y: 190,
            icon: 'heart-pulse',
            bins: [
                { type: 'plastic', available: true, capacity: 50, label: 'حاوية بلاستيك معقم' },
                { type: 'metal', available: true, capacity: 45, label: 'حاوية معادن' },
                { type: 'paper', available: true, capacity: 35, label: 'حاوية مستندات طبية' }
            ]
        },
        {
            id: 'library',
            name: 'المكتبة المركزية',
            subtitle: 'مركز المؤتمرات والتعليم الإلكتروني',
            category: 'service',
            x: 320,
            y: 190,
            icon: 'book',
            bins: [
                { type: 'plastic', available: true, capacity: 20, label: 'حاوية زجاجات مياه' },
                { type: 'metal', available: true, capacity: 25, label: 'حاوية كانز' },
                { type: 'paper', available: true, capacity: 40, label: 'حاوية أوراق وكتب وكرتون' }
            ]
        },
        {
            id: 'admin',
            name: 'مبنى إدارة الجامعة',
            subtitle: 'المقر الإداري ورئاسة الجامعة',
            category: 'admin',
            x: 480,
            y: 150,
            icon: 'landmark',
            bins: [
                { type: 'plastic', available: true, capacity: 30, label: 'حاوية بلاستيك' },
                { type: 'metal', available: false, capacity: 96, label: 'حاوية معادن (ممتلئة)' },
                { type: 'paper', available: true, capacity: 60, label: 'حاوية أوراق إدارية' }
            ]
        },
        {
            id: 'sports',
            name: 'المجمع الرياضي والملاعب',
            subtitle: 'الصالة المغطاة والملاعب المفتوحة',
            category: 'sports',
            x: 160,
            y: 160,
            icon: 'trophy',
            bins: [
                { type: 'plastic', available: true, capacity: 65, label: 'حاوية زجاجات مياه رياضية' },
                { type: 'metal', available: true, capacity: 50, label: 'حاوية مشروبات طاقة وكانز' },
                { type: 'paper', available: true, capacity: 20, label: 'حاوية أوراق' }
            ]
        },
        {
            id: 'agri',
            name: 'كلية الزراعة والحدائق',
            subtitle: 'المزارع البحثية والمساحات الخضراء',
            category: 'faculty',
            x: 620,
            y: 470,
            icon: 'sprout',
            bins: [
                { type: 'plastic', available: true, capacity: 30, label: 'حاوية أغلفة بلاستيكية' },
                { type: 'metal', available: true, capacity: 30, label: 'حاوية معادن' },
                { type: 'paper', available: true, capacity: 25, label: 'حاوية كرتون وأوراق' },
                { type: 'organic', available: true, capacity: 20, label: 'وحدة التسميد والمخلفات العضوية' }
            ]
        }
    ],

    // الحواف (Edges): الممرات ومسافات المشي المباشرة بالمتر
    edges: [
        // اتصالات البوابة الرئيسية
        { from: 'gate', to: 'ai', weight: 190 },
        { from: 'gate', to: 'eng', weight: 210 },
        { from: 'gate', to: 'sci', weight: 220 },
        { from: 'gate', to: 'agri', weight: 230 },

        // اتصالات كلية الذكاء الاصطناعي
        { from: 'ai', to: 'fci', weight: 140 },
        { from: 'ai', to: 'eng', weight: 130 },

        // اتصالات كلية الحاسبات والمعلومات
        { from: 'fci', to: 'sports', weight: 160 },
        { from: 'fci', to: 'library', weight: 190 },
        { from: 'fci', to: 'eng', weight: 180 },

        // اتصالات كلية الهندسة
        { from: 'eng', to: 'restaurant', weight: 120 },
        { from: 'eng', to: 'library', weight: 170 },
        { from: 'eng', to: 'sci', weight: 190 },

        // اتصالات كلية العلوم
        { from: 'sci', to: 'restaurant', weight: 130 },
        { from: 'sci', to: 'pharmacy', weight: 150 },
        { from: 'sci', to: 'agri', weight: 160 },

        // اتصالات المطعم المركزي
        { from: 'restaurant', to: 'library', weight: 140 },
        { from: 'restaurant', to: 'admin', weight: 150 },
        { from: 'restaurant', to: 'pharmacy', weight: 220 },

        // اتصالات الصيدلة
        { from: 'pharmacy', to: 'medicine', weight: 160 },
        { from: 'pharmacy', to: 'admin', weight: 210 },
        { from: 'pharmacy', to: 'agri', weight: 180 },

        // اتصالات الطب البشري
        { from: 'medicine', to: 'admin', weight: 240 },

        // اتصالات المكتبة المركزية
        { from: 'library', to: 'sports', weight: 170 },
        { from: 'library', to: 'admin', weight: 170 },

        // اتصالات مبنى الإدارة والملاعب
        { from: 'sports', to: 'admin', weight: 320 }
    ]
};

// إنشاء Adjacency List لتسهيل وتسريع عمليات البحث والخوارزميات
class CampusGraph {
    constructor(data = CAMPUS_GRAPH_DATA) {
        this.nodes = new Map();
        this.adjacencyList = new Map();
        this.rawEdges = [];

        this.init(data);
    }

    init(data) {
        // إضافة العقد
        data.nodes.forEach(node => {
            this.nodes.set(node.id, { ...node });
            this.adjacencyList.set(node.id, []);
        });

        // إضافة الحواف (Undirected Graph ثنائي الاتجاه للمشاة في الحرم)
        data.edges.forEach(edge => {
            this.addEdge(edge.from, edge.to, edge.weight);
        });
    }

    addEdge(u, v, weight) {
        this.rawEdges.push({ from: u, to: v, weight });
        
        if (this.adjacencyList.has(u)) {
            this.adjacencyList.get(u).push({ node: v, weight });
        }
        if (this.adjacencyList.has(v)) {
            this.adjacencyList.get(v).push({ node: u, weight });
        }
    }

    getNode(id) {
        return this.nodes.get(id);
    }

    getAllNodes() {
        return Array.from(this.nodes.values());
    }

    getAllEdges() {
        return this.rawEdges;
    }

    getNeighbors(nodeId) {
        return this.adjacencyList.get(nodeId) || [];
    }

    // التحقق مما إذا كانت العقدة تمتلك حاوية متاحة لنوع مخلفات محدد
    hasAvailableBin(nodeId, wasteType) {
        const node = this.getNode(nodeId);
        if (!node || !node.bins) return false;
        
        return node.bins.some(bin => {
            // دعم البحث عن البلاستيك بأنواعه
            if (wasteType === 'plastic' || wasteType === 'pet' || wasteType === 'hdpe') {
                return (bin.type === 'plastic' || bin.type === 'pet' || bin.type === 'hdpe') && bin.available;
            }
            return bin.type === wasteType && bin.available;
        });
    }

    // استرجاع كل العقد التي تحتوي على حاوية متاحة لهذا النوع
    getTargetNodesForWaste(wasteType) {
        return this.getAllNodes().filter(node => this.hasAvailableBin(node.id, wasteType));
    }

    // تبديل حالة الحاوية (متاحة / ممتلئة) في عقدة معينة (لأغراض المحاكاة والتفاعل)
    toggleBinStatus(nodeId, wasteType) {
        const node = this.getNode(nodeId);
        if (!node) return null;

        const bin = node.bins.find(b => {
            if (wasteType === 'plastic' || wasteType === 'pet' || wasteType === 'hdpe') {
                return b.type === 'plastic' || b.type === 'pet' || b.type === 'hdpe';
            }
            return b.type === wasteType;
        });

        if (bin) {
            bin.available = !bin.available;
            bin.capacity = bin.available ? 35 : 95;
            return bin;
        }
        return null;
    }

    // ضبط حالة كل الحاويات في عقدة لتكون كلها ممتلئة أو متاحة
    toggleNodeOverallStatus(nodeId) {
        const node = this.getNode(nodeId);
        if (!node) return false;

        const anyAvailable = node.bins.some(b => b.available);
        const newStatus = !anyAvailable;

        node.bins.forEach(b => {
            b.available = newStatus;
            b.capacity = newStatus ? 30 : 95;
        });

        return newStatus;
    }
}

// تصدير أو توفير الكائن في النطاق العام للمتصفح
window.CampusGraph = CampusGraph;
window.CAMPUS_GRAPH_DATA = CAMPUS_GRAPH_DATA;
