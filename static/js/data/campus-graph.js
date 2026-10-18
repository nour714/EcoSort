/**
 * EcoSort - بيانات خريطة حرم جامعة كفر الشيخ كـ Graph
 * تمثيل الحرم الجامعي كـ Weighted Directed/Undirected Graph: G = (V, E)
 * 
 * V: العُقد (Nodes) تمثل كليات ومباني الجامعة، مع إحداثيات (x, y) والإحداثيات الجغرافية (lat, lng)
 *    وحالة الحاويات ونوع المخلفات المقبولة باللغتين العربية والإنجليزية.
 * E: الحواف (Edges) تمثل الممرات ومسارات المشاة بين الكليات مع المسافة الحقيقية بالمتر.
 */

const CAMPUS_GRAPH_DATA = {
    // إحداثيات مركز حرم جامعة كفر الشيخ على خريطة Leaflet / OpenStreetMap
    center: [31.0988, 30.9485],
    defaultZoom: 16.5,

    // العُقد (Nodes): كليات ومباني جامعة كفر الشيخ
    nodes: [
        {
            id: 'gate',
            name: 'البوابة الرئيسية',
            nameEn: 'Main Campus Gate',
            subtitle: 'طريق الجيش - مدخل الجامعة الرئيسي',
            subtitleEn: 'El-Gaysh Road - Main Campus Entrance',
            category: 'gate',
            categoryEn: 'gate',
            x: 425,
            y: 540,
            lat: 31.0962,
            lng: 30.9482,
            icon: 'gate',
            bins: [
                { type: 'plastic', available: false, capacity: 94, label: 'حاوية بلاستيك PET (ممتلئة بنسبة 94%)', labelEn: 'Plastic PET Bin (Full 94%)' },
                { type: 'metal', available: true, capacity: 30, label: 'حاوية علب كانز ومعادن', labelEn: 'Metal & Cans Bin' },
                { type: 'paper', available: true, capacity: 50, label: 'حاوية أوراق وكرتون', labelEn: 'Paper & Cardboard Bin' },
                { type: 'organic', available: false, capacity: 90, label: 'حاوية عضوي (ممتلئة)', labelEn: 'Organic Bin (Full)' }
            ]
        },
        {
            id: 'ai',
            name: 'كلية الذكاء الاصطناعي',
            nameEn: 'Faculty of Artificial Intelligence',
            subtitle: 'أول كلية ذكاء اصطناعي بمصر',
            subtitleEn: 'First AI Faculty in Egypt',
            category: 'tech',
            categoryEn: 'tech',
            x: 230,
            y: 430,
            lat: 31.0975,
            lng: 30.9458,
            icon: 'cpu',
            bins: [
                { type: 'plastic', available: true, capacity: 35, label: 'حاوية بلاستيك PET & HDPE', labelEn: 'Plastic PET & HDPE Bin' },
                { type: 'metal', available: true, capacity: 40, label: 'حاوية معادن وإلكترونيات', labelEn: 'Metal & Electronics Bin' },
                { type: 'paper', available: true, capacity: 25, label: 'حاوية أوراق أكاديمية', labelEn: 'Academic Paper Bin' },
                { type: 'ewaste', available: true, capacity: 15, label: 'نقطة تجميع مخلفات إلكترونية', labelEn: 'E-Waste Collection Point' }
            ]
        },
        {
            id: 'fci',
            name: 'كلية الحاسبات والمعلومات',
            nameEn: 'Faculty of Computers & Information',
            subtitle: 'مبنى البرمجيات ونظم المعلومات',
            subtitleEn: 'Software & Information Systems Building',
            category: 'tech',
            categoryEn: 'tech',
            x: 170,
            y: 310,
            lat: 31.0988,
            lng: 30.9452,
            icon: 'code',
            bins: [
                { type: 'plastic', available: false, capacity: 92, label: 'حاوية بلاستيك (ممتلئة)', labelEn: 'Plastic Bin (Full)' },
                { type: 'metal', available: true, capacity: 55, label: 'حاوية معادن وكانز', labelEn: 'Metal & Cans Bin' },
                { type: 'paper', available: true, capacity: 40, label: 'حاوية أوراق وطباعة', labelEn: 'Paper & Printing Bin' },
                { type: 'ewaste', available: true, capacity: 20, label: 'نقطة مخلفات تقنية', labelEn: 'Tech Waste Point' }
            ]
        },
        {
            id: 'eng',
            name: 'كلية الهندسة',
            nameEn: 'Faculty of Engineering',
            subtitle: 'مجمع الورش والمعامل الهندسية',
            subtitleEn: 'Engineering Labs & Workshops Complex',
            category: 'tech',
            categoryEn: 'tech',
            x: 340,
            y: 360,
            lat: 31.0982,
            lng: 30.9475,
            icon: 'tool',
            bins: [
                { type: 'plastic', available: true, capacity: 60, label: 'حاوية بوليمرات وبلاستيك', labelEn: 'Polymer & Plastic Bin' },
                { type: 'metal', available: true, capacity: 30, label: 'حاوية خردة ومعادن وكانز', labelEn: 'Scrap & Metal Bin' },
                { type: 'paper', available: true, capacity: 45, label: 'حاوية مخططات وأوراق', labelEn: 'Blueprints & Paper Bin' },
                { type: 'ewaste', available: true, capacity: 35, label: 'حاوية نفايات إلكترونية وبطاريات', labelEn: 'E-Waste & Batteries Bin' }
            ]
        },
        {
            id: 'sci',
            name: 'كلية العلوم',
            nameEn: 'Faculty of Science',
            subtitle: 'معامل الكيمياء والفيزياء والبيئة',
            subtitleEn: 'Chemistry, Physics & Eco Labs',
            category: 'tech',
            categoryEn: 'tech',
            x: 520,
            y: 380,
            lat: 31.0976,
            lng: 30.9508,
            icon: 'flask',
            bins: [
                { type: 'plastic', available: true, capacity: 40, label: 'حاوية بولي إيثيلين HDPE', labelEn: 'HDPE Polyethylene Bin' },
                { type: 'metal', available: true, capacity: 50, label: 'حاوية علب كانز', labelEn: 'Beverage Cans Bin' },
                { type: 'paper', available: false, capacity: 95, label: 'حاوية أوراق (ممتلئة)', labelEn: 'Paper Bin (Full)' },
                { type: 'glass', available: true, capacity: 25, label: 'حاوية زجاج معملي', labelEn: 'Lab Glass Bin' }
            ]
        },
        {
            id: 'restaurant',
            name: 'المطعم المركزي والخدمات',
            nameEn: 'Central Cafeteria & Services',
            subtitle: 'مركز التغذية والأنشطة الطلابية',
            subtitleEn: 'Student Cafeteria & Activities Center',
            category: 'service',
            categoryEn: 'service',
            x: 430,
            y: 280,
            lat: 31.0993,
            lng: 30.9486,
            icon: 'utensils',
            bins: [
                { type: 'plastic', available: true, capacity: 70, label: 'حاوية زجاجات مياه وعصائر', labelEn: 'Water & Juice Bottles Bin' },
                { type: 'metal', available: true, capacity: 65, label: 'حاوية كانز مشروبات', labelEn: 'Soda Cans Bin' },
                { type: 'paper', available: true, capacity: 55, label: 'حاوية كرتون وأغلفة أطعمة', labelEn: 'Food Packaging & Cardboard Bin' },
                { type: 'organic', available: true, capacity: 40, label: 'حاوية بقايا أطعمة (كومبوست)', labelEn: 'Food Waste (Compost) Bin' }
            ]
        },
        {
            id: 'pharmacy',
            name: 'كلية الصيدلة',
            nameEn: 'Faculty of Pharmacy',
            subtitle: 'مركز الأبحاث والتصنيع الدوائي',
            subtitleEn: 'Pharmaceutical Research & Labs',
            category: 'medical',
            categoryEn: 'medical',
            x: 640,
            y: 320,
            lat: 31.0990,
            lng: 30.9520,
            icon: 'pill',
            bins: [
                { type: 'plastic', available: false, capacity: 88, label: 'حاوية عبوات بلاستيكية (ممتلئة)', labelEn: 'Plastic Containers Bin (Full)' },
                { type: 'metal', available: true, capacity: 20, label: 'حاوية فويل وألومنيوم', labelEn: 'Foil & Aluminum Bin' },
                { type: 'paper', available: true, capacity: 30, label: 'حاوية كرتون ونشرات', labelEn: 'Cardboard & Leaflets Bin' },
                { type: 'glass', available: true, capacity: 40, label: 'حاوية زجاج دوائي', labelEn: 'Pharma Glass Bin' }
            ]
        },
        {
            id: 'medicine',
            name: 'كلية الطب البشري',
            nameEn: 'Faculty of Medicine',
            subtitle: 'المجمع الطبي والمستشفى الجامعي',
            subtitleEn: 'Medical Complex & University Hospital',
            category: 'medical',
            categoryEn: 'medical',
            x: 710,
            y: 190,
            lat: 31.1012,
            lng: 30.9532,
            icon: 'heart-pulse',
            bins: [
                { type: 'plastic', available: true, capacity: 50, label: 'حاوية بلاستيك معقم', labelEn: 'Sterile Plastic Bin' },
                { type: 'metal', available: true, capacity: 45, label: 'حاوية معادن', labelEn: 'Metals Bin' },
                { type: 'paper', available: true, capacity: 35, label: 'حاوية مستندات طبية', labelEn: 'Medical Documents Bin' }
            ]
        },
        {
            id: 'library',
            name: 'المكتبة المركزية',
            nameEn: 'Central University Library',
            subtitle: 'مركز المؤتمرات والتعليم الإلكتروني',
            subtitleEn: 'Conference Center & E-Learning',
            category: 'service',
            categoryEn: 'service',
            x: 320,
            y: 190,
            lat: 31.1004,
            lng: 30.9472,
            icon: 'book',
            bins: [
                { type: 'plastic', available: true, capacity: 20, label: 'حاوية زجاجات مياه', labelEn: 'Water Bottles Bin' },
                { type: 'metal', available: true, capacity: 25, label: 'حاوية كانز', labelEn: 'Beverage Cans Bin' },
                { type: 'paper', available: true, capacity: 40, label: 'حاوية أوراق وكتب وكرتون', labelEn: 'Books & Paper Bin' }
            ]
        },
        {
            id: 'admin',
            name: 'مبنى إدارة الجامعة',
            nameEn: 'University Administration',
            subtitle: 'المقر الإداري ورئاسة الجامعة',
            subtitleEn: 'Presidency & Administration HQ',
            category: 'service',
            categoryEn: 'service',
            x: 480,
            y: 150,
            lat: 31.1010,
            lng: 30.9495,
            icon: 'landmark',
            bins: [
                { type: 'plastic', available: true, capacity: 30, label: 'حاوية بلاستيك', labelEn: 'Plastic Bin' },
                { type: 'metal', available: false, capacity: 96, label: 'حاوية معادن (ممتلئة)', labelEn: 'Metal Bin (Full)' },
                { type: 'paper', available: true, capacity: 60, label: 'حاوية أوراق إدارية', labelEn: 'Admin Paper Bin' }
            ]
        },
        {
            id: 'sports',
            name: 'المجمع الرياضي والملاعب',
            nameEn: 'Sports Complex & Stadium',
            subtitle: 'الصالة المغطاة والملاعب المفتوحة',
            subtitleEn: 'Indoor Halls & Athletics Fields',
            category: 'service',
            categoryEn: 'service',
            x: 160,
            y: 160,
            lat: 31.1006,
            lng: 30.9444,
            icon: 'trophy',
            bins: [
                { type: 'plastic', available: true, capacity: 65, label: 'حاوية زجاجات مياه رياضية', labelEn: 'Sports Water Bottles Bin' },
                { type: 'metal', available: true, capacity: 50, label: 'حاوية مشروبات طاقة وكانز', labelEn: 'Energy Drink Cans Bin' },
                { type: 'paper', available: true, capacity: 20, label: 'حاوية أوراق', labelEn: 'Paper Bin' }
            ]
        },
        {
            id: 'agri',
            name: 'كلية الزراعة والحدائق',
            nameEn: 'Faculty of Agriculture',
            subtitle: 'المزارع البحثية والمساحات الخضراء',
            subtitleEn: 'Research Farms & Green Spaces',
            category: 'tech',
            categoryEn: 'tech',
            x: 620,
            y: 470,
            lat: 31.0965,
            lng: 30.9522,
            icon: 'sprout',
            bins: [
                { type: 'plastic', available: true, capacity: 30, label: 'حاوية أغلفة بلاستيكية', labelEn: 'Plastic Wraps Bin' },
                { type: 'metal', available: true, capacity: 30, label: 'حاوية معادن', labelEn: 'Metals Bin' },
                { type: 'paper', available: true, capacity: 25, label: 'حاوية كرتون وأوراق', labelEn: 'Cardboard & Paper Bin' },
                { type: 'organic', available: true, capacity: 20, label: 'وحدة التسميد والمخلفات العضوية', labelEn: 'Composting & Organic Unit' }
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
        this.center = data.center || [31.0988, 30.9485];
        this.defaultZoom = data.defaultZoom || 16.5;

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
    }

    // البحث عن أقرب مبنى أو كلية باستخدام الإحداثيات الجغرافية الحقيقية (Haversine formula)
    findNearestNodeByGPS(lat, lng) {
        let nearestNode = null;
        let minDistanceKm = Infinity;

        const toRad = deg => (deg * Math.PI) / 180;
        const R = 6371; // نصف قطر الأرض بالكيلومتر

        this.getAllNodes().forEach(node => {
            if (typeof node.lat !== 'number' || typeof node.lng !== 'number') return;

            const dLat = toRad(node.lat - lat);
            const dLon = toRad(node.lng - lng);
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat)) * Math.cos(toRad(node.lat)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const dKm = R * c;

            if (dKm < minDistanceKm) {
                minDistanceKm = dKm;
                nearestNode = node;
            }
        });

        return {
            node: nearestNode,
            distanceMeters: Math.round(minDistanceKm * 1000)
        };
    }
}

// تصدير وتوفير الكائن في النطاق العام للمتصفح
window.CampusGraph = CampusGraph;
window.CAMPUS_GRAPH_DATA = CAMPUS_GRAPH_DATA;
